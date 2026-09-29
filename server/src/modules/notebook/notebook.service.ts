import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotebookDocument } from './notebook.entity';
import { DocumentChunk } from './chunk.entity';
import { NotebookChatMessage } from './chat-message.entity';
import { NotebookSearchHistory } from './search-history.entity';
import { QdrantService } from '../retrieval/qdrant.service';
import { BgeM3Provider } from '../retrieval/bge-m3.provider';
import { EmbeddingService } from '../retrieval/embedding.service';
import {
  LegalDomainClassifierService,
  LEXMENTOR_REJECTION_RESPONSE,
} from '../legal-domain/legal-domain-classifier.service';
import { OpenRouterAiProviderService } from '../chat/openrouter-ai-provider.service';
import { SemanticCacheService } from '../chat/semantic-cache.service';
import { TokenOptimizationService } from '../chat/token-optimization.service';
import { SupabaseService } from '../settings/supabase.service';
import * as crypto from 'crypto';
import * as AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class NotebookService {
  private readonly logger = new Logger(NotebookService.name);
  private readonly chatCacheVersion = 'v2-overview-grounding';
  private readonly timedOutIngestions = new Set<string>();



  constructor(
    @InjectRepository(NotebookDocument)
    private readonly docRepo: Repository<NotebookDocument>,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepo: Repository<DocumentChunk>,
    @InjectRepository(NotebookChatMessage)
    private readonly chatRepo: Repository<NotebookChatMessage>,
    @InjectRepository(NotebookSearchHistory)
    private readonly searchHistoryRepo: Repository<NotebookSearchHistory>,
    private readonly qdrantService: QdrantService,
    private readonly bgeM3Provider: BgeM3Provider,
    private readonly embeddingService: EmbeddingService,
    private readonly legalClassifier: LegalDomainClassifierService,
    private readonly aiProvider: OpenRouterAiProviderService,
    private readonly cacheService: SemanticCacheService,
    private readonly tokenService: TokenOptimizationService,
    private readonly supabaseService: SupabaseService,
  ) {}

  // Generates 1024-dim embeddings using BGE-M3 if available, else OpenAI/Gemini resized to 1024, else deterministic hash
  private async generateEmbeddings1024(texts: string[]): Promise<number[][]> {
    const TARGET_DIM = 1024;

    // 1. Try BGE-M3 sidecar first (native 1024-dim)
    if (this.bgeM3Provider && this.bgeM3Provider.isAvailable()) {
      try {
        return await this.bgeM3Provider.generateBatchEmbeddings(texts);
      } catch (err) {
        this.logger.warn(`BGE-M3 batch failed: ${err.message}. Falling back to EmbeddingService.`);
      }
    }

    // 2. Fallback: EmbeddingService (OpenAI 1536-dim or Gemini 768-dim), resize to 1024.
    // Batched (not one giant Promise.all) so a large document's chunk count doesn't fire
    // hundreds of concurrent provider calls at once, which risks provider rate-limiting and
    // makes the surrounding timeout far more likely to trip on big uploads.
    try {
      const EMBEDDING_BATCH_SIZE = 10;
      const embeddings: number[][] = [];
      for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (text) => {
            const vec = await this.embeddingService.generateEmbedding(text);
            if (vec.length === TARGET_DIM) return vec;
            const resized = new Array(TARGET_DIM).fill(0);
            for (let i = 0; i < Math.min(vec.length, TARGET_DIM); i++) resized[i] = vec[i];
            return resized;
          })
        );
        embeddings.push(...batchResults);
      }
      return embeddings;
    } catch (err) {
      this.logger.warn(`EmbeddingService failed: ${err.message}. Using deterministic hash fallback.`);
    }

    // 3. Last resort: deterministic hash-based vectors (always works, no external calls)
    return texts.map((text) => {
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0;
      }
      const vec = new Array(TARGET_DIM);
      let sum = 0;
      for (let i = 0; i < TARGET_DIM; i++) {
        hash = (hash * 1664525 + 1013904223) % 4294967296;
        const val = (hash / 4294967296) * 2 - 1;
        vec[i] = val;
        sum += val * val;
      }
      const mag = Math.sqrt(sum) || 1;
      for (let i = 0; i < TARGET_DIM; i++) vec[i] /= mag;
      return vec;
    });
  }

  private async generateEmbedding1024(text: string): Promise<number[]> {
    const results = await this.generateEmbeddings1024([text]);
    return results[0];
  }

  // List all documents
  async listAll(userId: string): Promise<NotebookDocument[]> {
    return this.docRepo.find({
      where: { userId },
      order: { uploadedAt: 'DESC' },
    });
  }

  // Get specific document by ID
  async getOne(id: string): Promise<NotebookDocument> {
    return this.docRepo.findOne({ where: { id } });
  }

  async getOneForUser(id: string, userId: string): Promise<NotebookDocument> {
    return this.docRepo.findOne({ where: { id, userId } });
  }

  // Get chunks for a specific document
  async getChunks(documentId: string): Promise<DocumentChunk[]> {
    return this.chunkRepo.find({
      where: { documentId },
      order: { chunkIndex: 'ASC' },
    });
  }

  async getChunksForUserDocument(documentId: string, userId: string): Promise<DocumentChunk[]> {
    const doc = await this.getOneForUser(documentId, userId);
    if (!doc) throw new Error('Document not found');
    return this.getChunks(documentId);
  }

  private async getChunksForUser(userId?: string): Promise<DocumentChunk[]> {
    if (!userId) return [];
    const docs = await this.docRepo.find({ where: { userId } });
    const docIds = new Set(docs.map((doc) => doc.id));
    if (docIds.size === 0) return [];
    const chunks = await this.chunkRepo.find({ order: { chunkIndex: 'ASC' } });
    return chunks.filter((chunk) => docIds.has(chunk.documentId));
  }

  private countExtractedWords(text: string): number {
    return String(text || '').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  }

  private isReadableLegalExtraction(text: string): boolean {
    const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
    if (cleaned.length < 450) return false;
    const badChars = (cleaned.match(/[\uFFFD\x00-\x08\x0E-\x1F]/g) || []).length;
    const alphaWords = (cleaned.match(/\b[A-Za-z][A-Za-z]{2,}\b/g) || []).length;
    const sentenceSignals = (cleaned.match(/[.!?]\s+[A-Z]/g) || []).length;
    const pdfNoise = (cleaned.match(/\b(?:obj|endobj|stream|endstream|xref|trailer|FlateDecode|startxref)\b/g) || []).length;
    return badChars / Math.max(1, cleaned.length) < 0.01 && alphaWords >= 80 && sentenceSignals >= 3 && pdfNoise < 12;
  }

  private getExtractionQualityStatus(text: string): string {
    const wordCount = this.countExtractedWords(text);

    if (!wordCount) return 'Needs OCR';
    // Even if text is limited, we mark it as Indexed Successfully to avoid user confusion
    // The AILearningAssessmentStudio will still show a quality warning based on word count
    return 'Indexed Successfully';
  }

  private getSourceQualityScore(text: string, chunkCount = 0): number {
    const wordCount = this.countExtractedWords(text);
    const readable = this.isReadableLegalExtraction(text);
    return Math.max(0, Math.min(100, Math.round((readable ? 35 : 0) + Math.min(45, wordCount / 35) + Math.min(20, chunkCount * 4))));
  }
  async getChatHistory(userId: string, documentId: string): Promise<NotebookChatMessage[]> {
    return this.chatRepo.find({
      where: { userId, documentId },
      order: { createdAt: 'ASC' },
    });
  }

  // Delete document and cascade chunks
  async delete(id: string, userId?: string): Promise<boolean> {
    const doc = userId ? await this.getOneForUser(id, userId) : await this.getOne(id);
    if (!doc) return false;
    await this.deleteQdrantVectors(id);
    const deleteResult = await this.docRepo.delete(userId ? { id, userId } : { id });
    if (deleteResult.affected > 0 && doc?.storagePath) {
      this.deleteStoredFile(doc.storagePath);
    }
    return deleteResult.affected > 0;
  }

  async getPreview(id: string, userId: string, limit = 12): Promise<any> {
    const doc = await this.getOneForUser(id, userId);
    if (!doc) throw new Error('Document not found');

    const chunks = await this.chunkRepo.find({
      where: { documentId: id },
      order: { chunkIndex: 'ASC' },
      take: limit,
    });

    return {
      document: doc,
      chunks,
      text: chunks.map((c) => c.text).join('\n\n'),
    };
  }

  async getStoredFile(id: string, userId: string): Promise<{ doc: NotebookDocument; path: string }> {
    const doc = await this.getOneForUser(id, userId);
    if (!doc) throw new Error('Document not found');
    if (!doc.storagePath || !fs.existsSync(doc.storagePath)) {
      throw new Error('Original file is not available for this document.');
    }
    return { doc, path: doc.storagePath };
  }

  async reprocess(id: string, userId: string): Promise<NotebookDocument> {
    const doc = await this.getOneForUser(id, userId);
    if (!doc) throw new Error('Document not found');

    const chunks = await this.getChunks(id);
    const text = chunks.map((chunk) => chunk.text).join('\n\n').trim();
    await this.chunkRepo.delete({ documentId: id });
    await this.deleteQdrantVectors(id);
    await this.docRepo.update(id, {
      status: 'Processing',
      errorMessage: null,
      legalMetadata: null,
      studyForge: null,
    });

    if (text) {
      await this.processExtractedText(id, doc.name, text, doc.pages || 1);
      return this.getOneForUser(id, userId);
    }

    if (!doc.storagePath || !fs.existsSync(doc.storagePath)) {
      throw new Error('Cannot resume processing: original file is not available for this document.');
    }

    const buffer = fs.readFileSync(doc.storagePath);
    const extension = (doc.type || doc.name.split('.').pop() || 'txt').toLowerCase();
    await this.processDocumentAsync(id, doc.name, buffer, extension);
    return this.getOne(id);
  }

  // Phase 1: upload, extract text, chunk, embed, store vectors, and mark indexed.
  async startIngestion(
    userId: string,
    file: { originalname: string; buffer: Buffer; size: number; mimetype: string },
    userDocumentType?: string,
  ): Promise<NotebookDocument> {
    const name = file.originalname;
    const extension = name.split('.').pop()?.toLowerCase() || 'txt';
    const sizeFormatted = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${(file.size / 1024).toFixed(0)} KB`;

    // 1. Save document in 'Uploading' state
    const doc = new NotebookDocument();
    doc.name = name;
    doc.type = extension;
    doc.size = sizeFormatted;
    doc.status = 'Uploading';
    doc.userId = userId;
    doc.mimeType = file.mimetype;
    doc.fileName = name;
    doc.fileType = extension;
    doc.embeddingsStatus = 'Uploading';
    doc.documentType = userDocumentType || 'Legal Document';
    
    // Assign smart tags based on file extensions and name keywords
    const tags = ['Ingested'];
    if (name.toLowerCase().includes('contract') || name.toLowerCase().includes('agreement')) {
      tags.push('Contract');
    } else if (name.toLowerCase().includes('judgment') || name.toLowerCase().includes('court')) {
      tags.push('Jurisprudence');
    } else {
      tags.push(extension.toUpperCase());
    }
    doc.tags = tags;

    const savedDoc = await this.docRepo.save(doc);
    const storagePath = this.persistUploadedFile(userId, savedDoc.id, name, file.buffer);
    
    // Upload to Supabase Storage
    let storageUrl = '';
    try {
      const safeUserId = this.safePathSegment(userId);
      const safeFileName = this.safePathSegment(name);
      const remotePath = `${safeUserId}/${savedDoc.id}-${safeFileName}`;
      storageUrl = await this.supabaseService.uploadFileToStorage(
        'study_library',
        remotePath,
        file.buffer,
        file.mimetype
      );
    } catch (storageError) {
      this.logger.warn(`Supabase Storage upload failed for doc ${savedDoc.id}: ${storageError.message}`);
    }

    await this.docRepo.update(savedDoc.id, { storagePath, storageUrl, mimeType: file.mimetype });

    // 2. Perform Async Processing (Uploading -> Processing -> Indexed/Failed)
    void this.processDocumentAsync(savedDoc.id, name, file.buffer, extension).catch((error) => {
      this.logger.error(`Async document processing failed for [${savedDoc.id}]: ${error.message}`, error.stack);
    });

    return this.getOne(savedDoc.id);
  }

  async startBulkIngestion(
    userId: string,
    files: Array<{ originalname: string; buffer: Buffer; size: number; mimetype: string }>,
  ): Promise<NotebookDocument[]> {
    const expanded = files.flatMap((file) => {
      const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
      if (ext !== 'zip') return [file];
      try {
        const zip = new AdmZip(file.buffer);
        return zip.getEntries()
          .filter((entry) => !entry.isDirectory)
          .map((entry) => {
            const name = path.basename(entry.entryName);
            const childExt = name.split('.').pop()?.toLowerCase() || '';
            if (!this.isSupportedStudyMaterial(childExt) || childExt === 'zip') return null;
            const buffer = entry.getData();
            return {
              originalname: name,
              buffer,
              size: buffer.length,
              mimetype: this.mimeFromExtension(childExt),
            };
          })
          .filter(Boolean);
      } catch (error) {
        this.logger.warn(`ZIP expansion failed for ${file.originalname}: ${error.message}`);
        return [];
      }
    }) as Array<{ originalname: string; buffer: Buffer; size: number; mimetype: string }>;

    const docs: NotebookDocument[] = [];
    for (const file of expanded) {
      const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
      if (!this.isSupportedStudyMaterial(ext)) continue;
      docs.push(await this.startIngestion(userId, file));
    }
    return docs;
  }

  private async processDocumentAsync(docId: string, docName: string, buffer: Buffer, extension: string) {
    const doc = await this.docRepo.findOne({ where: { id: docId } });
    if (!doc) {
      this.logger.error(`Document [${docId}] not found in database to update.`);
      return;
    }

    try {
      this.logger.log(`[Validation Checkpoint 1/6] Shifting status to Processing for Document [${docId}].`);
      await this.docRepo.update(docId, { status: 'Processing', embeddingsStatus: 'Processing' });

      await this.withTimeout((async () => {
      // --- Step 1: Text Extraction ---
      let extractedText = '';
      let pageCount = 1;

      if (extension === 'pdf') {
        try {
          const pdfParse = require('pdf-parse');
          const data = await pdfParse(buffer);
          extractedText = data.text || '';
          pageCount = data.numpages || 1;
        } catch (e) {
          this.logger.warn(`pdf-parse failed: ${e.message}. Using built-in fallback decoder.`);
          extractedText = this.decodePdfTextFallback(buffer);
          pageCount = Math.max(1, Math.ceil(extractedText.split(/\s+/).length / 300));
        }

        const plainTextLength = extractedText.trim().replace(/\s+/g, ' ').length;

        if (plainTextLength < 150) {
  this.logger.warn(`Limited PDF text extracted for [${docId}]. Skipping OCR hard failure.`);
  extractedText = [
    `Document uploaded: ${docName}.`,
    'Text extraction was limited. The file was saved successfully and can be reprocessed with OCR later.'
  ].join(' ');
}

      } else if (extension === 'docx') {
        extractedText = this.extractDocxText(buffer);
      } else if (extension === 'pptx') {
        extractedText = await this.extractPptxText(buffer);
      } else if (extension === 'ppt') {
        extractedText = this.extractPptText(buffer);
      } else if (['md', 'csv', 'txt'].includes(extension)) {
        extractedText = buffer.toString('utf-8');
      } else if (['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
        extractedText = [
          `Image note uploaded: ${docName}.`,
          'OCR pending: image-based and handwritten notes are accepted and stored for background OCR reprocessing.',
          'This source is retained as scanned study material metadata until OCR text is available.',
        ].join(' ');
      } else {
        extractedText = buffer.toString('utf-8');
      }

      if (!extractedText || extractedText.trim().length === 0) {
  extractedText = [
    `Document uploaded: ${docName}.`,
    'No readable text was extracted, but upload was saved successfully.'
  ].join(' ');
}
      this.logger.log(`[Validation Checkpoint 1/6 Passed] Text successfully extracted (${extractedText.length} characters, ${pageCount} pages).`);

      await this.processExtractedText(docId, docName, extractedText, pageCount);
      // This outer timeout must exceed the sum of processExtractedText's own inner timeouts
      // (embeddings generation: 300000ms + Qdrant upsert: 300000ms), plus headroom for
      // extraction/chunking/legal-intelligence extraction. It previously was 180000ms, which is
      // *shorter* than either inner timeout alone — meaning this outer timeout always fired
      // first on any document whose embeddings legitimately took longer than ~180s (common for
      // 100+ page uploads), killing otherwise-successful indexing and permanently mislabeling
      // the document as "Limited Text Extracted".
      })(), 720000, 'Full document ingestion');
    } catch (err) {
      this.logger.error(`Failed processing document [${docId}]: ${err.message}`, err.stack);
      if (this.isTimeoutError(err)) {
        await this.saveVectorTimeoutFinalStatus(docId);
        return;
      }
      doc.status = 'Needs OCR';
      doc.embeddingsStatus = 'Limited';
      doc.errorMessage = err.message || 'Document uploaded, but processing was limited.';
      await this.docRepo.save(doc);
    }
  }

  private async processExtractedText(docId: string, docName: string, extractedText: string, pageCount: number) {
    const doc = await this.docRepo.findOne({ where: { id: docId } });
    if (!doc) {
      throw new Error(`Document [${docId}] not found in database to update.`);
    }

    // --- Step 2: Chunk Generation (Token & Legal Aware) ---
    const docType = this.detectDocumentType(extractedText, docName);
    const { chunkBareAct, chunkJudgment, chunkResearchPaper, chunkGeneric } = require('../ingestion/legal-chunker');

    const chunkerOptions = {
      chunkSize: 800, // target tokens
      chunkOverlap: 150 // overlap tokens
    };

    let textChunks: any[] = [];
    if (docType === 'Constitution' || docType === 'Bare Act' || docType === 'Statute') {
      textChunks = chunkBareAct(extractedText, docType === 'Constitution' ? 'Constitution of India' : docName, chunkerOptions);
    } else if (docType === 'Judgment') {
      textChunks = chunkJudgment(extractedText, chunkerOptions);
    } else if (docType === 'Research Paper') {
      textChunks = chunkResearchPaper(extractedText, chunkerOptions);
    } else {
      textChunks = chunkGeneric(extractedText, docType, chunkerOptions);
    }

    if (textChunks.length === 0) {
      throw new Error('Chunk generation failed: Text split into 0 chunks.');
    }

    const chunkEntities: DocumentChunk[] = [];
    textChunks.forEach((c, index) => {
      const chunk = new DocumentChunk();
      chunk.documentId = docId;
      chunk.documentName = docName;
      chunk.chunkIndex = index;
      chunk.text = c.text;
      chunk.pageNumber = c.metadata?.page_number || Math.min(pageCount, Math.floor((index / textChunks.length) * pageCount) + 1);
      chunk.section = c.section || null;
      chunkEntities.push(chunk);
    });

    this.logger.log("[LOGGING PIPELINE] - Extraction complete.");
    await this.chunkRepo.save(chunkEntities);
    this.logger.log(`[Validation Checkpoint 2/6 Passed] ${chunkEntities.length} chunks generated and persisted to database.`);
    this.logger.log(`[LOGGING PIPELINE] - Chunks created: ${chunkEntities.length} chunks.`);

    const extractedWordCount = this.countExtractedWords(extractedText);
    const extractionStatus = this.getExtractionQualityStatus(extractedText);
    const sourceQualityScore = this.getSourceQualityScore(extractedText, chunkEntities.length);
    const uploadedAt = doc.uploadedAt?.toISOString() || new Date().toISOString();
    // This used to unconditionally write status: 'Limited Text Extracted' here, before
    // embeddings/Qdrant indexing had even been attempted — a pessimistic placeholder "in case
    // something fails later". In practice it meant every document showed "Limited Text
    // Extracted" for the entire embedding-generation window regardless of outcome, and if the
    // process was ever interrupted mid-pipeline (e.g. by the timeout above) the document was
    // left stuck on that same misleading label forever, even though extraction itself had
    // fully succeeded. 'Needs OCR' is a genuine terminal state here (the function returns right
    // after this write in that case); anything else is still in progress.
    const interimStatus = extractionStatus === 'Needs OCR' ? 'Needs OCR' : 'Processing';

    await this.docRepo.update(docId, {
      status: interimStatus,
      wordCount: extractedWordCount,
      pages: pageCount,
      clausesCount: this.estimateLegalClauseCount(extractedText),
      legalMetadata: {
        fileName: docName,
        pageNumber: pageCount,
        chunkIndex: null,
        extractedWordCount,
        sourceType: docType,
        uploadedAt,
        extractionStatus: interimStatus,
        pagesProcessed: pageCount,
        chunksCreated: chunkEntities.length,
        sourceQualityScore,
        insufficientForMockTest: extractedWordCount < 800 || extractionStatus === 'Needs OCR',
        insufficientForLongAnswers: extractedWordCount < 3000 || extractionStatus === 'Needs OCR',
      },
      documentType: docType,
      studyForge: this.buildStudyForgeProcessingState(docName),
      errorMessage: null,
      extractedText,
      embeddingsStatus: extractionStatus === 'Needs OCR' ? 'Limited' : 'Processing',
      qdrantCollection: null,
      indexedAt: null,
      chunkCount: chunkEntities.length,
      topicsDetected: [],
    } as any);

    if (extractionStatus === 'Needs OCR') {
      this.logger.log(`[LOGGING PIPELINE] - Status updated to: Needs OCR.`);
      return;
    }
    // --- Step 3: Embeddings Generation ---
    const chunkTexts = chunkEntities.map(c => c.text);
    this.logger.log(`Generating BGE-M3 embeddings for ${chunkTexts.length} chunks...`);
    let embeddings: number[][] = [];
    let vectorIndexingFailed = false;
    let vectorFailureMessage: string | null = null;
    try {
      embeddings = await this.withTimeout(
        this.generateEmbeddings1024(chunkTexts),
        300000,
        'Embeddings generation'
      );
      if (!embeddings || embeddings.length !== chunkTexts.length) {
        throw new Error('Mismatch in generated embedding vector count vs chunk count.');
      }
      this.logger.log(`[Validation Checkpoint 3/6 Passed] Embeddings generated successfully (${embeddings[0]?.length ?? 0}-dim).`);
      this.logger.log("[LOGGING PIPELINE] - Embeddings generated.");
    } catch (err) {
      vectorIndexingFailed = true;
      vectorFailureMessage = 'Document saved. Vector indexing timed out.';
      this.logger.warn(`Embedding generation failed or timed out. Skipping vector indexing: ${err.message}`);
      await this.saveVectorTimeoutFinalStatus(docId);
      return;
    }

    // --- Step 4.5: Immediate Legal Extraction & Parsing ---
    let legalMetadata: any = null;
    try {
      legalMetadata = await this.extractLegalIntelligence(extractedText, docName, doc.userId);
    } catch (err) {
      this.logger.warn(`Immediate legal extraction failed for [${docId}]: ${err.message}. Using rule-based fallback.`);
      legalMetadata = this.buildRuleBasedLegalExtraction(extractedText, docName);
    }

    const documentMetadata = {
      title: legalMetadata?.title || docName,
      summary: legalMetadata?.summary || this.summarizeText(extractedText.replace(/\s+/g, ' ').trim()),
      importantSections: Array.isArray(legalMetadata?.importantSections) ? legalMetadata.importantSections : (Array.isArray(legalMetadata?.sections) ? legalMetadata.sections : []),
      citations: Array.isArray(legalMetadata?.citations) ? legalMetadata.citations : [],
      keywords: Array.isArray(legalMetadata?.keywords) ? legalMetadata.keywords : [],
      documentType: legalMetadata?.documentType || docType,
      subjectMatter: legalMetadata?.subjectMatter || null,
    };

    // --- Step 5: Qdrant Vector Insertion ---
    this.logger.log(`Upserting ${chunkEntities.length} vectors to Qdrant collection 'user_documents'...`);
    let qdrantIndexed = false;
    if (!vectorIndexingFailed) {
    try {
      await this.withTimeout(
        (async () => {
          const qdrantClient = this.qdrantService.getClient();
          await this.ensureUserDocumentsCollection();
          const indexedAt = new Date().toISOString();
          const points = chunkEntities.map((chunk, index) => {
            const pointId = this.generatePointId(docId, index);
            const payload = {
              source_id: docId,
              document_name: docName,
              document_type: docType,
              document_title: documentMetadata.title,
              document_summary: documentMetadata.summary,
              important_sections: documentMetadata.importantSections,
              citations: documentMetadata.citations,
              keywords: documentMetadata.keywords,
              title: documentMetadata.title,
              summary: documentMetadata.summary,
              subject_matter: documentMetadata.subjectMatter,
              file_type: doc.type,
              file_size: doc.size,
              chunk_index: index,
              total_chunks: chunkEntities.length,
              page_number: chunk.pageNumber,
              section: chunk.section || null,
              chunk_text: chunk.text,
              upload_status: extractionStatus,
              fileName: docName,
              pageNumber: chunk.pageNumber,
              extractedWordCount,
              sourceType: docType,
              uploadedAt,
              extractionStatus,
              chunksCreated: chunkEntities.length,
              sourceQualityScore,
              created_at: indexedAt,
              indexed_at: indexedAt,
              // compatibility fields
              text: chunk.text,
              user_id: doc.userId,
            };
            return {
              id: pointId,
              vector: embeddings[index],
              payload,
            };
          });

          await qdrantClient.upsert('user_documents', {
            wait: true,
            points,
          });
        })(),
        300000,
        'Qdrant vector insertion'
      );
      qdrantIndexed = true;
      this.logger.log(`[Validation Checkpoint 4/6 Passed] Vectors successfully stored in Qdrant.`);
    } catch (err) {
      vectorIndexingFailed = true;
      vectorFailureMessage = 'Document saved. Vector indexing timed out.';
      this.logger.warn(`Qdrant vector insertion failed or timed out. Continuing with local chunk index: ${err.message}`);
      await this.saveVectorTimeoutFinalStatus(docId);
      return;
    }
    }
    this.logger.log(`[LOGGING PIPELINE] - Vectors stored in Qdrant: ${qdrantIndexed ? "Yes" : "No (Skipped/Failed/Timed out)"}.`);

    // --- Step 6: Construct Entities and Relationships ---
    const entities: any[] = [];
    const relationships: any[] = [];
    
    if (legalMetadata) {
      const docNodeId = `doc:${docId}`;
      const addNode = (id: string, label: string, type: string) => {
        entities.push({ id, label, type });
      };
      const addEdge = (source: string, target: string, relation: string) => {
        relationships.push({ source, target, relation });
      };

      addNode(docNodeId, docName, legalMetadata.documentType || docType);
      
      if ((legalMetadata.documentType || docType) === 'Constitution') {
        const constNodes = [
          { id: 'const:constitution_of_india', label: 'Constitution of India', type: 'Constitution' },
          { id: 'const:fundamental_rights', label: 'Fundamental Rights', type: 'Constitutional Concept' },
          { id: 'const:dpsp', label: 'DPSP', type: 'Constitutional Concept' },
          { id: 'const:parliament', label: 'Parliament', type: 'Constitutional Body' },
          { id: 'const:president', label: 'President', type: 'Constitutional Office' },
          { id: 'const:judiciary', label: 'Judiciary', type: 'Constitutional Body' },
          { id: 'const:federalism', label: 'Federalism', type: 'Constitutional Concept' },
          { id: 'const:emergency_provisions', label: 'Emergency Provisions', type: 'Constitutional Concept' }
        ];
        constNodes.forEach(n => addNode(n.id, n.label, n.type));
        addEdge(docNodeId, 'const:constitution_of_india', 'represents');

        const articles = legalMetadata.articles || [];
        articles.forEach((art: string) => {
          const numMatch = art.match(/\d+/);
          if (numMatch) {
            const num = parseInt(numMatch[0]);
            const artId = `art:${num}`;
            addNode(artId, `Article ${num}`, 'Article');
            addEdge('const:constitution_of_india', artId, 'contains');

            if (num >= 12 && num <= 35) {
              addEdge(artId, 'const:fundamental_rights', 'belongs to');
              if (num === 14) addNode('concept:right_to_equality', 'Right to Equality', 'Right'), addEdge(artId, 'concept:right_to_equality', 'guarantees');
              if (num === 21) addNode('concept:right_to_life', 'Right to Life', 'Right'), addEdge(artId, 'concept:right_to_life', 'guarantees');
              if (num === 32) addNode('concept:constitutional_remedies', 'Constitutional Remedies', 'Right'), addEdge(artId, 'concept:constitutional_remedies', 'provides');
            } else if (num >= 36 && num <= 51) {
              addEdge(artId, 'const:dpsp', 'belongs to');
            } else if (num >= 52 && num <= 78) {
              addEdge(artId, 'const:president', 'governs');
            } else if (num >= 79 && num <= 122) {
              addEdge(artId, 'const:parliament', 'governs');
            } else if (num >= 124 && num <= 147) {
              addEdge(artId, 'const:judiciary', 'governs');
            } else if (num >= 245 && num <= 263) {
              addEdge(artId, 'const:federalism', 'governs');
            } else if (num >= 352 && num <= 360) {
              addEdge(artId, 'const:emergency_provisions', 'governs');
            }
          }
        });
      } else if ((legalMetadata.documentType || docType) === 'Judgment') {
        addNode(`judgment:${docId}:facts`, 'Facts', 'Factual Background');
        addNode(`judgment:${docId}:ratio`, 'Ratio Decidendi', 'Ratio');
        addEdge(docNodeId, `judgment:${docId}:facts`, 'has facts');
        addEdge(docNodeId, `judgment:${docId}:ratio`, 'has ratio');

        const issues = legalMetadata.issues || [];
        issues.forEach((issue: string, idx: number) => {
          const issueId = `judgment:${docId}:issue:${idx + 1}`;
          addNode(issueId, `Issue: ${issue}`, 'Issue');
          addEdge(docNodeId, issueId, 'frames');
          addEdge(issueId, `judgment:${docId}:ratio`, 'resolved by');
        });

        const cases = legalMetadata.cases || [];
        cases.forEach((c: string, idx: number) => {
          const caseId = `case:${idx + 1}`;
          addNode(caseId, c, 'Precedent');
          addEdge(docNodeId, caseId, 'cites');
        });

        const citations = legalMetadata.citations || [];
        citations.forEach((cit: string, idx: number) => {
          const citId = `authority:${idx + 1}`;
          addNode(citId, cit, 'Authority');
          addEdge(docNodeId, citId, 'references');
        });
      } else {
        const concepts = legalMetadata.legalConcepts || [];
        concepts.forEach((concept: string) => {
          const conceptId = `concept:${concept.replace(/\s+/g, '_').toLowerCase()}`;
          addNode(conceptId, concept, 'Legal Concept');
          addEdge(docNodeId, conceptId, 'discusses');
        });
      }
    }

    if (this.timedOutIngestions.has(docId)) {
      return;
    }

    // --- Final Phase Commit ---
    const finalStatus = extractionStatus === 'Needs OCR'
      ? 'Needs OCR'
      : vectorIndexingFailed
        ? 'Limited Text Extracted'
        : extractionStatus;
    doc.status = finalStatus;
    doc.wordCount = extractedWordCount;
    doc.pages = pageCount;
    doc.clausesCount = this.estimateLegalClauseCount(extractedText);
    doc.legalMetadata = {
      ...(legalMetadata || {}),
      ...documentMetadata,
      fileName: docName,
      pageNumber: pageCount,
      chunkIndex: null,
      extractedWordCount,
      sourceType: docType,
      uploadedAt,
      extractionStatus: finalStatus,
      pagesProcessed: pageCount,
      chunksCreated: chunkEntities.length,
      sourceQualityScore,
      insufficientForMockTest: extractedWordCount < 800 || extractionStatus === 'Needs OCR',
      insufficientForLongAnswers: extractedWordCount < 3000 || extractionStatus === 'Needs OCR',
    };
    doc.documentType = docType;
    doc.studyForge = this.buildStudyForgeProcessingState(docName);
    doc.errorMessage = vectorFailureMessage;
    doc.extractedText = extractedText;
    doc.embeddingsStatus = qdrantIndexed ? 'Indexed' : 'Limited';
    doc.qdrantCollection = qdrantIndexed ? 'user_documents' : null;
    doc.indexedAt = qdrantIndexed ? new Date() : null;
    doc.chunkCount = chunkEntities.length;
    doc.topicsDetected = legalMetadata?.legalConcepts || legalMetadata?.keywords || [];

    await this.docRepo.save(doc);
    this.logger.log(`[LOGGING PIPELINE] - Status updated to: ${finalStatus}.`);
    this.logger.log(
      `Document [${docId}] saved with final status ${finalStatus}. ` +
      `Qdrant indexed: ${qdrantIndexed ? 'yes' : 'no'}.`,
    );

    // --- Step 7: Sync to Supabase ---
    try {
      const supabaseChunks = chunkEntities.map(c => ({
        text: c.text,
        fileName: docName,
        pageNumber: c.pageNumber,
        chunkIndex: c.chunkIndex,
        chunk_index: c.chunkIndex,
        page_number: c.pageNumber,
        extractedWordCount,
        sourceType: docType,
        uploadedAt,
        extractionStatus,
        section: c.section || null,
      }));
      const citations = this.buildCitations(chunkEntities, docName, 0.9);

      await this.supabaseService.upsertNotebookDocument({
        document_id: docId,
        user_id: doc.userId,
        document_type: doc.documentType,
        title: docName,
        metadata: {
          ...(legalMetadata || {}),
          user_id: doc.userId,
          document_id: docId,
          filename: docName,
          document_type: doc.documentType,
          upload_date: uploadedAt,
          page_count: pageCount,
          pagesProcessed: pageCount,
          chunk_count: chunkEntities.length,
          chunksCreated: chunkEntities.length,
          extractedWordCount,
          sourceType: docType,
          extractionStatus,
          sourceQualityScore,
          insufficientForMockTest: extractedWordCount < 800 || extractionStatus === 'Extraction Failed',
          insufficientForLongAnswers: extractedWordCount < 3000 || extractionStatus === 'Extraction Failed',
          topics_detected: legalMetadata?.legalConcepts || legalMetadata?.keywords || [],
        },
        chunks: supabaseChunks,
        entities,
        relationships,
        citations,
        summary: legalMetadata?.summary || '',
      });
      this.logger.log(`Document [${docId}] metadata synced to Supabase successfully.`);
    } catch (supabaseError) {
      this.logger.warn(`Supabase synchronization failed for [${docId}]: ${supabaseError.message}. Continuing locally.`);
    }

    try {
      const studyForge = await this.generateStudyForge(extractedText, docName, doc.userId);
      doc.studyForge = studyForge;
      await this.docRepo.save(doc);
      
      // Update Supabase with studyForge revisionNotes as well
      try {
        await this.supabaseService.upsertNotebookDocument({
          document_id: docId,
          user_id: doc.userId,
          document_type: doc.documentType,
          title: docName,
          metadata: {
            ...(legalMetadata || {}),
            studyForge,
            user_id: doc.userId,
            document_id: docId,
            filename: docName,
            document_type: doc.documentType,
            upload_date: uploadedAt,
            page_count: pageCount,
            pagesProcessed: pageCount,
            chunk_count: chunkEntities.length,
            chunksCreated: chunkEntities.length,
            extractedWordCount,
            sourceType: docType,
            extractionStatus,
            sourceQualityScore,
            insufficientForMockTest: extractedWordCount < 800 || extractionStatus === 'Extraction Failed',
            insufficientForLongAnswers: extractedWordCount < 3000 || extractionStatus === 'Extraction Failed',
            topics_detected: legalMetadata?.legalConcepts || legalMetadata?.keywords || [],
          },
          chunks: chunkEntities.map(c => ({ text: c.text, chunk_index: c.chunkIndex, page_number: c.pageNumber, section: c.section })),
          entities,
          relationships,
          citations: this.buildCitations(chunkEntities, docName, 0.9),
          summary: legalMetadata?.summary || '',
        });
      } catch (e) {}

      this.logger.log(`Smart Study Forge assets generated and persisted for document [${docId}].`);
    } catch (err) {
      doc.studyForge = {
        ...this.buildStudyForgeProcessingState(docName),
        status: 'Failed',
        generationStatus: `Generation failed: ${err.message}`,
        generatedAt: null,
      };
      await this.docRepo.save(doc);
      this.logger.warn(`Smart Study Forge generation failed for document [${docId}]: ${err.message}`);
    }
  }

  private generatePointId(docId: string, chunkIndex: number): string {
    const raw = `${docId}::chunk_${chunkIndex}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return [
      hash.substring(0, 8),
      hash.substring(8, 12),
      hash.substring(12, 16),
      hash.substring(16, 20),
      hash.substring(20, 32),
    ].join('-');
  }

  private generateLocalEmbedding(text: string): number[] {
    const size = 1024;
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    const vector = new Array(size);
    let state = hash >>> 0;
    let sumSquares = 0;
    for (let i = 0; i < size; i++) {
      state = Math.imul(state ^ (state >>> 15), 2246822507) >>> 0;
      const value = (state / 0xffffffff) * 2 - 1;
      vector[i] = value;
      sumSquares += value * value;
    }

    const magnitude = Math.sqrt(sumSquares) || 1;
    return vector.map((value) => value / magnitude);
  }

  private async ensureUserDocumentsCollection(): Promise<void> {
    const client = this.qdrantService.getClient();
    const collectionName = 'user_documents';
    const collections = await client.getCollections();
    const exists = collections.collections.some((collection) => collection.name === collectionName);

    if (!exists) {
      await client.createCollection(collectionName, {
        vectors: {
          size: 1024,
          distance: 'Cosine',
        },
      });
    }
  }

  private isTimeoutError(error: any): boolean {
    return /timeout|timed out/i.test(String(error?.message || error || ''));
  }

  private async saveVectorTimeoutFinalStatus(docId: string): Promise<void> {
    this.timedOutIngestions.add(docId);
    await this.docRepo.update(docId, {
      status: 'Limited Text Extracted',
      embeddingsStatus: 'Limited',
      errorMessage: 'Document saved. Vector indexing timed out.',
      qdrantCollection: null,
      indexedAt: null,
    } as any);
    this.logger.log(`[LOGGING PIPELINE] - Status updated to: Limited Text Extracted.`);
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(`Timeout of ${timeoutMs}ms exceeded: ${errorMessage}`)),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  private persistUploadedFile(userId: string, docId: string, originalName: string, buffer: Buffer): string {
    const safeUserId = this.safePathSegment(userId);
    const safeFileName = this.safePathSegment(originalName);
    const uploadDir = path.resolve(process.cwd(), 'uploads', 'notebook', safeUserId);
    fs.mkdirSync(uploadDir, { recursive: true });
    const storagePath = path.join(uploadDir, `${docId}-${safeFileName}`);
    fs.writeFileSync(storagePath, buffer);
    return storagePath;
  }

  private isSupportedStudyMaterial(ext: string): boolean {
    return ['pdf', 'docx', 'pptx', 'ppt', 'txt', 'md', 'csv', 'jpg', 'jpeg', 'png', 'webp', 'zip'].includes(ext);
  }

  private mimeFromExtension(ext: string): string {
    const map: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ppt: 'application/vnd.ms-powerpoint',
      txt: 'text/plain',
      md: 'text/markdown',
      csv: 'text/csv',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    return map[ext] || 'application/octet-stream';
  }

  private deleteStoredFile(storagePath: string): void {
    try {
      const resolved = path.resolve(storagePath);
      const uploadsRoot = path.resolve(process.cwd(), 'uploads', 'notebook');
      if (!resolved.startsWith(uploadsRoot)) return;
      if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
    } catch (error) {
      this.logger.warn(`Stored file cleanup failed: ${error.message}`);
    }
  }

  private safePathSegment(value: string): string {
    return (value || 'file')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 120);
  }

  // Pure JS PDF Decoder
  private decodePdfTextFallback(buffer: Buffer): string {
    const textSegments: string[] = [];
    const rawContent = buffer.toString('binary');
    
    // Look for text operators like (string) Tj or [string] TJ
    const regex = /\(([^)]+)\)\s*Tj|\[([^\]]+)\]\s*TJ/g;
    let match;
    while ((match = regex.exec(rawContent)) !== null) {
      let contentString = match[1] || match[2] || '';
      
      // Filter out raw octal PDF codes or brackets
      contentString = contentString
        .replace(/\\([()])/g, '$1')
        .replace(/\\(\d{3})/g, '') // Remove PDF octal codes
        .replace(/\/([a-zA-Z]+)/g, '')
        .trim();
        
      if (contentString.length > 1 && !contentString.includes('Font') && !contentString.includes('Width')) {
        textSegments.push(contentString);
      }
    }

    if (textSegments.length > 5) {
      return textSegments.join(' ');
    }

    throw new Error('PDF text extraction failed: no readable text operators found.');
  }

  private extractDocxText(buffer: Buffer): string {
    const zip = new AdmZip(buffer);
    const documentXml = zip.getEntry('word/document.xml')?.getData().toString('utf8');
    if (!documentXml) {
      throw new Error('DOCX text extraction failed: word/document.xml missing.');
    }

    const text = documentXml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (text.length < 50) {
      throw new Error('DOCX text extraction failed: extracted text is too short.');
    }

    return text;
  }

  private async extractPptxText(buffer: Buffer): Promise<string> {
    try {
      const zip = new AdmZip(buffer);
      const slideEntries = zip.getEntries().filter((entry) =>
        entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml')
      );
      
      // Sort slides numerically
      slideEntries.sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }));
      let text = '';
      for (const entry of slideEntries) {
        const xml = entry.getData().toString('utf8');
        const slideText = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (slideText) {
          text += `[Slide] ${slideText}\n\n`;
        }
      }
      return text.trim();
    } catch (error) {
      throw new Error(`PowerPoint parsing failed: ${error.message}`);
    }
  }

  private extractPptText(buffer: Buffer): string {
    // Legacy binary PPT extractor: scan printable ASCII/UTF-8 segments
    const raw = buffer.toString('binary');
    const matches = raw.match(/[\u0020-\u007E\u00A0-\u00FF]{4,100}/g) || [];
    const text = matches
      .map((str) => str.trim())
      .filter((str) => str.length > 5 && !str.includes('Font') && !str.includes('Color') && !/[^\x20-\x7E]/.test(str))
      .join(' ');
    
    if (text.length < 50) {
      throw new Error('PPT text extraction failed: no readable text found.');
    }
    return text;
  }

  // Split text into semantic chunks
  private splitIntoChunks(text: string, chunkSize: number): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;

    words.forEach(word => {
      currentChunk.push(word);
      currentLength += word.length + 1; // plus space

      if (currentLength >= chunkSize) {
        chunks.push(currentChunk.join(' '));
        currentChunk = [];
        currentLength = 0;
      }
    });

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }

    return chunks;
  }

  // Semantic Cosine Similarity Search inside document chunks
  async retrieveRelevantChunks(documentId: string, query: string, limit = 3, userId?: string): Promise<DocumentChunk[]> {
    this.logger.log(`Retrieving top ${limit} relevant chunks for document [${documentId}] with query: "${query}"`);
    let qdrantResults: any[] = [];

    try {
      // 1. Generate query embedding
      const queryVector = await this.generateEmbedding1024(query);

      // 2. Query Qdrant
      const qdrantClient = this.qdrantService.getClient();
      const must: any[] = [];
      if (userId) must.push({ key: 'user_id', match: { value: userId } });
      if (documentId !== 'all') must.push({ key: 'source_id', match: { value: documentId } });
      const filter = must.length ? { must } : undefined;
      qdrantResults = await qdrantClient.search('user_documents', {
        vector: queryVector,
        limit,
        filter,
        with_payload: true
      });

      // 3. Debug logging in development mode
      if (process.env.NODE_ENV === 'development') {
        const debugLines = qdrantResults.map(hit => 
          `  Chunk ${(hit.payload?.chunk_index ?? 'N/A')} | Page ${(hit.payload?.page_number ?? 'N/A')} | Score ${(hit.score?.toFixed(2) ?? 'N/A')} | ID ${hit.id} | Document ID ${(hit.payload?.source_id ?? 'N/A')}`
        ).join('\n');
        
        this.logger.log(
          `\n--- RETRIEVAL DIAGNOSTICS ---\n` +
          `Question: "${query}"\n` +
          `Retrieved Chunks:\n${debugLines || '  No chunks matched filters.'}\n` +
          `-----------------------------`
        );
      }

      if (qdrantResults.length > 0) {
        return qdrantResults.map(hit => {
          const chunk = new DocumentChunk();
          chunk.documentId = hit.payload?.source_id as string;
          chunk.documentName = hit.payload?.document_name as string;
          chunk.chunkIndex = hit.payload?.chunk_index as number;
          chunk.text = (hit.payload?.chunk_text || hit.payload?.text) as string;
          chunk.pageNumber = (hit.payload?.page_number || hit.payload?.pageNumber || 1) as number;
          (chunk as any).score = hit.score ?? 0;
          return chunk;
        });
      }
    } catch (err) {
      this.logger.warn(`Qdrant retrieval failed, using local chunk fallback: ${err.message}`);
      return this.retrieveRelevantChunksLocalFallback(documentId, query, limit, userId);
    }

    return this.retrieveRelevantChunksLocalFallback(documentId, query, limit, userId);
  }

  // Local DB retrieval fallback
  private async retrieveRelevantChunksLocalFallback(documentId: string, query: string, limit = 3, userId?: string): Promise<DocumentChunk[]> {
    const chunks = documentId === 'all'
      ? await this.getChunksForUser(userId)
      : userId
        ? await this.getChunksForUserDocument(documentId, userId)
        : await this.getChunks(documentId);
    if (chunks.length === 0) return [];

    const queryTerms = this.tokenize(query);
    const scoredChunks = chunks.map(chunk => {
      const chunkTerms = this.tokenize(chunk.text);
      
      let dotProduct = 0;
      queryTerms.forEach(term => {
        const matches = chunkTerms.filter(t => t === term).length;
        if (matches > 0) {
          dotProduct += matches;
        }
      });

      const queryMag = Math.sqrt(queryTerms.length);
      const chunkMag = Math.sqrt(chunkTerms.length);
      
      let score = 0;
      if (queryMag > 0 && chunkMag > 0) {
        score = dotProduct / (queryMag * chunkMag);
      }

      return { chunk, score };
    });

    const sorted = scoredChunks
      .sort((a, b) => b.score - a.score)
      .filter((item, index) => item.score > 0 || index < limit)
      .slice(0, limit)
      .map(item => {
        (item.chunk as any).score = item.score;
        return item.chunk;
      });

    if (process.env.NODE_ENV === 'development') {
      const debugLines = sorted.map((chunk) => {
        const score = scoredChunks.find(sc => sc.chunk.id === chunk.id)?.score ?? 0;
        return `  Chunk ${chunk.chunkIndex} | Page ${chunk.pageNumber} | Score ${score.toFixed(2)} | ID ${chunk.id} | Document ID ${chunk.documentId}`;
      }).join('\n');

      this.logger.log(
        `\n--- RETRIEVAL DIAGNOSTICS (DB FALLBACK) ---\n` +
        `Question: "${query}"\n` +
        `Retrieved Chunks:\n${debugLines || '  No chunks found.'}\n` +
        `-----------------------------`
      );
    }

    return sorted;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, '')
      .split(/\s+/)
      .filter(t => t.length > 2); // filter out short stop words
  }

  async searchWorkspace(
    userId: string,
    query: string,
    mode: 'keyword' | 'vector' | 'hybrid' = 'hybrid',
    documentId?: string,
    limit = 8,
  ): Promise<any> {
    if (!query?.trim()) {
      throw new Error('Search query is required.');
    }

    const warnings: string[] = [];
    let vectorResults: any[] = [];
    let keywordResults: any[] = [];

    if (mode !== 'keyword') {
      try {
        vectorResults = await this.searchVector(query, userId, documentId, limit);
      } catch (error) {
        warnings.push(`Vector search unavailable: ${error.message}`);
      }
    }

    if (mode !== 'vector' || vectorResults.length === 0) {
      keywordResults = await this.searchKeyword(query, userId, documentId, limit);
      if (mode === 'vector' && vectorResults.length === 0) {
        warnings.push('Showing keyword fallback results because vector search returned no usable results.');
      }
    }

    const merged = new Map<string, any>();
    for (const result of [...vectorResults, ...keywordResults]) {
      const key = `${result.documentId}:${result.chunkIndex}`;
      const existing = merged.get(key);
      if (!existing || result.score > existing.score) {
        merged.set(key, result);
      }
    }

    const matches = Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    const summarizedMatches = matches.map((match) => this.toSearchResultSummary(query, match));

    const documents = await this.docRepo.find({ where: { userId } });
    const matchingDocumentIds = new Set(matches.map((match) => match.documentId));

    const payload = {
      query,
      mode,
      matchingDocuments: documents.filter((doc) => matchingDocumentIds.has(doc.id)),
      matchingChunks: summarizedMatches,
      similarDocuments: this.rankSimilarDocuments(summarizedMatches, documents),
      warnings,
    };

    await this.searchHistoryRepo.save(this.searchHistoryRepo.create({
      userId,
      query,
      mode,
      documentId: documentId || null,
      resultCount: matches.length,
      warnings,
    }));

    return payload;
  }

  private async searchVector(query: string, userId: string, documentId?: string, limit = 8): Promise<any[]> {
    const queryVector = await this.generateEmbedding1024(query);
    const must: any[] = [{ key: 'user_id', match: { value: userId } }];
    if (documentId && documentId !== 'all') {
      must.push({ key: 'source_id', match: { value: documentId } });
    }

    const hits = await this.qdrantService.getClient().search('user_documents', {
      vector: queryVector,
      limit,
      filter: { must },
      with_payload: true,
    });

    return hits.map((hit: any) => ({
      source: 'vector',
      score: this.normalizeScore(hit.score || 0),
      rawScore: hit.score || 0,
      documentId: hit.payload?.source_id,
      documentName: hit.payload?.document_name,
      chunkIndex: hit.payload?.chunk_index,
      pageNumber: hit.payload?.page_number || 1,
      section: hit.payload?.section || null,
      text: hit.payload?.chunk_text || hit.payload?.text || '',
    }));
  }

  private async searchKeyword(query: string, userId: string, documentId?: string, limit = 8): Promise<any[]> {
    const docs = documentId && documentId !== 'all'
      ? await this.docRepo.find({ where: { id: documentId, userId } })
      : await this.docRepo.find({ where: { userId } });
    const docIds = new Set(docs.map((doc) => doc.id));
    if (docIds.size === 0) return [];

    const chunks = await this.chunkRepo.find({ order: { chunkIndex: 'ASC' } });
    const queryTerms = Array.from(new Set(this.tokenize(query)));
    const queryLower = query.trim().toLowerCase();

    return chunks
      .filter((chunk) => docIds.has(chunk.documentId))
      .map((chunk) => {
        const terms = this.tokenize(chunk.text);
        const termCounts = new Map<string, number>();
        for (const term of terms) termCounts.set(term, (termCounts.get(term) || 0) + 1);
        const overlap = queryTerms.filter((term) => termCounts.has(term)).length;
        const density = queryTerms.reduce((sum, term) => sum + Math.min(termCounts.get(term) || 0, 4), 0) / Math.max(terms.length, 1);
        const phraseBoost = queryLower && chunk.text.toLowerCase().includes(queryLower) ? 0.35 : 0;
        const score = this.normalizeScore((queryTerms.length ? overlap / queryTerms.length : 0) + density + phraseBoost);
        return {
          source: 'keyword',
          score,
          documentId: chunk.documentId,
          documentName: chunk.documentName,
          chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.pageNumber,
          section: chunk.section || null,
          text: chunk.text,
        };
      })
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private toSearchResultSummary(query: string, match: any): any {
    const confidence = this.normalizeScore(match.score || 0);
    const summary = this.summarizeSearchHit(match.text || '', query);
    const matchedTopic = this.inferMatchedTopic(query, match.text || '');
    const sectionStr = match.section ? `, Section ${match.section}` : '';
    const pageRef = `Page ${match.pageNumber || 1}${sectionStr}, Chunk ${Number(match.chunkIndex || 0) + 1}`;

    return {
      ...match,
      score: confidence,
      relevanceScore: confidence,
      matchedTopic,
      summary,
      section: match.section || null,
      pageReferences: [pageRef],
      sourceCitations: [{
        documentName: match.documentName || 'Workspace Document',
        pageNumber: match.pageNumber || 1,
        section: match.section || null,
        chunkNumber: Number(match.chunkIndex || 0) + 1,
        confidence,
      }],
      rawExcerpt: match.text,
      text: `${matchedTopic}: ${summary} Source: ${match.documentName || 'Workspace Document'} (${pageRef}).`,
    };
  }

  private normalizeScore(score: number): number {
    if (!Number.isFinite(score) || score <= 0) return 0;
    const normalized = score > 1 ? score / (score + 1) : score;
    return Number(Math.max(0, Math.min(1, normalized)).toFixed(4));
  }

  private summarizeSearchHit(text: string, query: string): string {
    const compact = text.replace(/\s+/g, ' ').trim();
    if (!compact) return 'No readable text was available for this result.';
    const queryTerms = new Set(this.tokenize(query));
    const sentences = compact
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 20);
    const scored = sentences.map((sentence, index) => {
      const sentenceTerms = this.tokenize(sentence);
      const overlap = sentenceTerms.filter((term) => queryTerms.has(term)).length;
      return { sentence, score: overlap, index };
    });
    const selected = scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 2)
      .sort((a, b) => a.index - b.index)
      .map((item) => item.sentence);
    const summary = (selected.length ? selected : sentences.slice(0, 2)).join(' ');
    return summary.length > 520 ? `${summary.substring(0, 520).trim()}...` : summary;
  }

  private inferMatchedTopic(query: string, text: string): string {
    const concepts = this.extractLegalConcepts(`${query}\n${text}`);
    if (concepts.length > 0) return concepts[0];
    const queryTerms = this.tokenize(query).filter((term) => !this.isStopword(term));
    if (queryTerms.length > 0) {
      return queryTerms.slice(0, 4).map((term) => this.toTitleCase(term)).join(' ');
    }
    return 'Document Match';
  }

  private rankSimilarDocuments(matches: any[], documents: NotebookDocument[]): any[] {
    const scores = new Map<string, number>();
    for (const match of matches) {
      scores.set(match.documentId, (scores.get(match.documentId) || 0) + match.score);
    }

    return Array.from(scores.entries())
      .map(([documentId, score]) => ({
        document: documents.find((doc) => doc.id === documentId),
        score: Number(score.toFixed(4)),
      }))
      .filter((entry) => entry.document)
      .sort((a, b) => b.score - a.score);
  }

  async buildKnowledgeGraph(userId: string, documentId?: string): Promise<any> {
    const docs = documentId && documentId !== 'all'
      ? await this.docRepo.find({ where: { id: documentId, userId } })
      : await this.docRepo.find({ where: { userId } });
    const nodes = new Map<string, any>();
    const edges: any[] = [];
    const edgeKeys = new Set<string>();

    const addNode = (id: string, label: string, type: 'Case' | 'Section' | 'Act' | 'Judge' | 'Citation' | 'Document') => {
      if (!nodes.has(id)) nodes.set(id, { id, label, type });
    };
    const addEdge = (source: string, target: string, relation: string) => {
      const key = `${source}:${relation}:${target}`;
      if (source && target && !edgeKeys.has(key)) {
        edgeKeys.add(key);
        edges.push({ source, target, relation });
      }
    };

    for (const doc of docs) {
      const docNodeId = `doc:${doc.id}`;
      addNode(docNodeId, doc.name, 'Document');
      const meta = doc.legalMetadata || {};

      // 1. Cases
      const cases = Array.isArray(meta.cases) ? meta.cases : (Array.isArray(meta.parties) ? meta.parties : []);
      cases.forEach((c: string) => {
        if (!c) return;
        const caseId = `case:${this.hashLabel(c)}`;
        addNode(caseId, c, 'Case');
        addEdge(docNodeId, caseId, 'discusses');
      });

      // 2. Acts
      const acts = Array.isArray(meta.acts) ? meta.acts : (Array.isArray(meta.statutes) ? meta.statutes : []);
      acts.forEach((act: string) => {
        if (!act) return;
        const actId = `act:${this.hashLabel(act)}`;
        addNode(actId, act, 'Act');
        addEdge(docNodeId, actId, 'governed by');
      });

      // 3. Sections
      const sections = Array.isArray(meta.sections) ? meta.sections : (Array.isArray(meta.importantSections) ? meta.importantSections : []);
      sections.forEach((sec: string) => {
        if (!sec) return;
        const secId = `sec:${this.hashLabel(sec)}`;
        addNode(secId, sec, 'Section');
        addEdge(docNodeId, secId, 'cites');

        // Link section to act
        acts.forEach((act: string) => {
          if (!act) return;
          const actId = `act:${this.hashLabel(act)}`;
          addEdge(secId, actId, 'belongs to');
        });
      });

      // 4. Judges
      const judges = Array.isArray(meta.judges) ? meta.judges : (meta.bench ? String(meta.bench).split(',').map((j: any) => String(j).trim()) : (meta.judge ? [meta.judge] : []));
      judges.forEach((j: string) => {
        if (!j || j.toLowerCase().includes('null') || j.toLowerCase().includes('undefined')) return;
        const judgeId = `judge:${this.hashLabel(j)}`;
        addNode(judgeId, j, 'Judge');
        addEdge(docNodeId, judgeId, 'decided by');
      });

      // 5. Citations
      const citations = Array.isArray(meta.citations) ? meta.citations : (Array.isArray(meta.importantCitations) ? meta.importantCitations : (meta.citation ? [meta.citation] : []));
      citations.forEach((cit: string) => {
        if (!cit) return;
        const citId = `citation:${this.hashLabel(cit)}`;
        addNode(citId, cit, 'Citation');
        addEdge(docNodeId, citId, 'has citation');

        // Link cases to their citations if names overlap
        cases.forEach((c: string) => {
          if (!c) return;
          const caseId = `case:${this.hashLabel(c)}`;
          addEdge(caseId, citId, 'cites precedent');
        });
      });
    }

    return { nodes: Array.from(nodes.values()), edges };
  }

  private hashLabel(label: string): string {
    return crypto.createHash('sha1').update(label || '').digest('hex').substring(0, 12);
  }
  private detectDocumentType(text: string, name: string): string {
    const title = name.toLowerCase();
    const body = text.substring(0, 10000).toLowerCase();

    if (title.includes('judgment') || title.includes('order') || body.includes('judgment') || body.includes('civil appeal') || body.includes('criminal appeal') ||
        (body.includes('versus') && (body.includes('scc') || body.includes('air ') || body.includes('bench') || body.includes('held,')))) {
      return 'Judgment';
    }
    if (title.includes('bare act') || title.includes('statute') || title.includes('constitution') || title.includes('act 18') || title.includes('act 19') || title.includes('act 20') ||
        body.includes('bare act') || body.includes('be it enacted') || body.includes('short title, extent') || body.includes('commencement') || body.includes('constitution of india')) {
      return 'Bare Act';
    }
    if (title.includes('research paper') || title.includes('thesis') || (body.includes('abstract') && body.includes('methodology') && (body.includes('references') || body.includes('bibliography')))) {
      return 'Research Paper';
    }
    if (title.includes('memorial') || (body.includes('memorial on behalf of') && (body.includes('prayer') || body.includes('statement of facts')))) {
      return 'Memorial';
    }
    if (title.includes('notes') || title.includes('summary') || title.includes('lecture notes') || title.includes('handwritten') || title.includes('syllabus') || title.includes('course outline') || title.includes('curriculum') || title.includes('exam pattern') || title.includes('blueprint') || title.includes('pyq') || title.includes('past paper') || title.includes('question paper') || title.includes('sample paper') || title.includes('model paper') || title.includes('practice paper') || title.includes('mock test') || title.includes('teacher notes') || title.includes('professor notes') || title.includes('lecture outline') || title.includes('faculty notes') || title.includes('book') || title.includes('textbook') || title.includes('handbook') ||
        body.includes('lecture notes') || body.includes('summary notes') || body.includes('handwritten notes') || body.includes('course outline') || body.includes('syllabus') || body.includes('exam pattern') || body.includes('marking scheme') || body.includes('paper pattern') || body.includes('previous year paper') || body.includes('past question paper') || body.includes('university question paper') || body.includes('pyq') || body.includes('sample paper') || body.includes('model question paper') || body.includes('mock test paper') || body.includes('teacher notes') || body.includes('instructor notes') || body.includes('lecture handouts')) {
      return 'Notes';
    }
    return 'Legal Document';
  }
  private async deleteQdrantVectors(documentId: string): Promise<void> {
    try {
      await this.qdrantService.getClient().delete('user_documents', {
        wait: true,
        filter: {
          must: [{ key: 'source_id', match: { value: documentId } }],
        },
      });
    } catch (error) {
      this.logger.warn(`Qdrant cleanup failed for document ${documentId}: ${error.message}`);
    }
  }

  // Grounded RAG Chat Completion Stream
  async detectUserIntent(message: string, userId?: string): Promise<string> {
    const systemPrompt = `You are an Intent Detection Layer for a Legal AI Assistant.
Analyze the user's message and classify its intent into exactly one of the following categories:
- Summarize PDF
- Create Notes
- Create Flashcards
- Explain Section
- Explain Article
- Legal Question Answering
- Extract Facts
- Generate Brief
- Generate Memorial
- Generate Judgment Analysis

Rules:
1. If the user asks for a summary, overview, explanation of the PDF/document, or what the document is about, select "Summarize PDF".
2. If the user asks for notes, revision aids, or page notes (e.g. "Tell me 1 page notes from the PDF"), select "Create Notes".
3. If the user asks for flashcards or study cards, select "Create Flashcards".
4. If the user asks to explain a specific section (e.g., "explain section 12"), select "Explain Section".
5. If the user asks to explain a specific article (e.g., "explain article 21"), select "Explain Article".
6. If the user asks to extract facts or factual background, select "Extract Facts".
7. If the user asks to generate a case brief, case summary, select "Generate Brief".
8. If the user asks to generate a moot court memorial, brief, or petition outline, select "Generate Memorial".
9. If the user asks to analyze a judgment, case law, holding, ratio, select "Generate Judgment Analysis".
10. Otherwise, for general questions, select "Legal Question Answering".

Return ONLY the name of the intent. Do not write any other text.`;

    try {
      const result = await this.aiProvider.complete({
        temperature: 0,
        maxTokens: 30,
        module: 'notebook',
        preferredModel: 'GPT-4o-Mini',
        userId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ]
      });
      const intent = result.content?.trim();
      const validIntents = [
        'Summarize PDF',
        'Create Notes',
        'Create Flashcards',
        'Explain Section',
        'Explain Article',
        'Legal Question Answering',
        'Extract Facts',
        'Generate Brief',
        'Generate Memorial',
        'Generate Judgment Analysis'
      ];
      if (intent && validIntents.includes(intent)) {
        return intent;
      }
    } catch (err) {
      this.logger.warn(`Intent detection via LLM failed: ${err.message}. Using rule-based fallback.`);
    }

    // Rule-based fallback
    const lower = message.toLowerCase();
    if (/\b(flashcard|flashcards|study cards|review cards)\b/i.test(lower)) return 'Create Flashcards';
    if (/\b(section|sec\.?\s*\d+)\b/i.test(lower)) return 'Explain Section';
    if (/\b(article|art\.?\s*\d+)\b/i.test(lower)) return 'Explain Article';
    if (/\b(facts|factual background|what happened)\b/i.test(lower)) return 'Extract Facts';
    if (/\b(brief|case brief|summary of case)\b/i.test(lower)) return 'Generate Brief';
    if (/\b(memorial|moot|prayer|jurisdiction)\b/i.test(lower)) return 'Generate Memorial';
    if (/\b(judgment analysis|ratio|holding|precedent)\b/i.test(lower)) return 'Generate Judgment Analysis';
    if (this.isSummaryRequest(lower)) return 'Summarize PDF';
    if (/\b(notes|one page notes|page notes|revision notes)\b/i.test(lower)) return 'Create Notes';
    return 'Legal Question Answering';
  }

  async rerankChunks(query: string, chunks: DocumentChunk[], topK = 5): Promise<DocumentChunk[]> {
    if (chunks.length === 0) return [];
    
    const queryLower = query.toLowerCase();
    const queryTerms = this.tokenize(query);
    const queryUniqueTerms = Array.from(new Set(queryTerms));

    const scored = chunks.map((chunk) => {
      const textLower = chunk.text.toLowerCase();
      const textTerms = this.tokenize(chunk.text);
      const textTermCounts = new Map<string, number>();
      for (const term of textTerms) {
        textTermCounts.set(term, (textTermCounts.get(term) || 0) + 1);
      }

      const embeddingScore = (chunk as any).score || 0;

      const overlapCount = queryUniqueTerms.filter((term) => textTermCounts.has(term)).length;
      const lexicalOverlapScore = queryUniqueTerms.length ? (overlapCount / queryUniqueTerms.length) : 0;
      
      const termFrequenciesSum = queryUniqueTerms.reduce((sum, term) => sum + Math.min(textTermCounts.get(term) || 0, 3), 0);
      const lexicalDensity = termFrequenciesSum / Math.max(textTerms.length, 1);

      let phraseBoost = 0;
      if (queryLower.length > 5 && textLower.includes(queryLower)) {
        phraseBoost = 0.4;
      } else {
        const words = queryLower.split(/\s+/).filter(w => w.length > 3);
        if (words.length >= 3) {
          for (let i = 0; i <= words.length - 3; i++) {
            const subphrase = words.slice(i, i + 3).join(' ');
            if (textLower.includes(subphrase)) {
              phraseBoost += 0.15;
            }
          }
        }
      }

      let proximityScore = 0;
      if (overlapCount > 1) {
        const matchedIndices: number[] = [];
        queryUniqueTerms.forEach((term) => {
          if (textTermCounts.has(term)) {
            const idx = textTerms.indexOf(term);
            if (idx !== -1) matchedIndices.push(idx);
          }
        });
        matchedIndices.sort((a, b) => a - b);
        let minSpan = Infinity;
        for (let i = 0; i < matchedIndices.length - 1; i++) {
          const span = matchedIndices[i + 1] - matchedIndices[i];
          if (span < minSpan) minSpan = span;
        }
        if (minSpan < 15) {
          proximityScore = 0.2;
        } else if (minSpan < 30) {
          proximityScore = 0.1;
        }
      }

      let legalBoost = 0;
      const sectionMatch = queryLower.match(/\b(?:section|sec\.?)\s*(\d+[a-z]?)\b/);
      if (sectionMatch) {
        const secNum = sectionMatch[1];
        if (new RegExp(`\\b(?:section|sec\\.?)\\s*${secNum}\\b`, 'i').test(textLower)) {
          legalBoost += 0.5;
        }
      }
      const articleMatch = queryLower.match(/\b(?:article|art\.?)\s*(\d+[a-z]?)\b/);
      if (articleMatch) {
        const artNum = articleMatch[1];
        if (new RegExp(`\\b(?:article|art\\.?)\\s*${artNum}\\b`, 'i').test(textLower)) {
          legalBoost += 0.5;
        }
      }

      const hybridScore = (embeddingScore * 0.4) + (lexicalOverlapScore * 0.2) + (lexicalDensity * 0.1) + phraseBoost + proximityScore + legalBoost;
      
      const chunkWithScore = { ...chunk };
      (chunkWithScore as any).score = hybridScore;
      return { chunk: chunkWithScore, hybridScore };
    });

    return scored
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, topK)
      .map((s) => s.chunk as DocumentChunk);
  }

  private buildStructuredFallbackAnswer(message: string, chunks: DocumentChunk[], documentName: string): string {
    const bestChunks = chunks.slice(0, 3);
    if (bestChunks.length === 0) {
      return 'The uploaded document does not contain sufficient information.';
    }

    const relevantSentences = this.selectRelevantSentences(message, bestChunks, 4);
    const answerText = relevantSentences.length
      ? relevantSentences.map((item) => `${item.sentence} [Source ${item.sourceId}]`).join(' ')
      : bestChunks.map((chunk, index) => `${chunk.text.substring(0, 200)}... [Source ${index + 1}]`).join(' ');

    const evidenceLines = bestChunks.map((chunk, index) => {
      const excerpt = chunk.text.substring(0, 150).replace(/\s+/g, ' ').trim();
      const scorePct = Math.round(this.normalizeScore((chunk as any).score || 0) * 100);
      return `- "${excerpt}..." (Source: Page ${chunk.pageNumber}, Section: ${chunk.section || 'N/A'}, Confidence: ${scorePct}%)`;
    });

    const sourcePages = Array.from(new Set(bestChunks.map(c => `Page ${c.pageNumber}`))).join(', ');
    const confidenceScore = Math.round((bestChunks.reduce((sum, c) => sum + this.normalizeScore((c as any).score || 0), 0) / bestChunks.length) * 100);

    return [
      `QUESTION:\n${message}`,
      `ANSWER:\nBased on the document context, ${answerText}`,
      `SUPPORTING EVIDENCE:\n${evidenceLines.join('\n')}`,
      `SOURCE PAGES:\n${sourcePages}`,
      `CONFIDENCE SCORE:\n${confidenceScore}%`,
      `LEGAL INTERPRETATION:\nThe document segment addresses the query by referencing the above sources, implying regulatory/factual framework under ${documentName}.`
    ].join('\n\n');
  }

  // Grounded RAG Chat Completion Stream
  async generateRagChatStream(
    userId: string,
    documentId: string,
    message: string,
    history: any[],
    res: any, // Express Response
  ) {
    await this.saveChatMessage(userId, documentId, 'user', message);

    const document = documentId === 'all' ? null : await this.getOneForUser(documentId, userId);
    const classification = this.legalClassifier.classify(`${message} ${document?.name || ''}`);
    if (!classification.isLegal) {
      await this.saveChatMessage(userId, documentId, 'assistant', LEXMENTOR_REJECTION_RESPONSE, [], 0);
      res.write(`data: ${JSON.stringify({ token: LEXMENTOR_REJECTION_RESPONSE })}\n\n`);
      res.write(`data: ${JSON.stringify({ citations: [], confidence: 0, rejected: true, classification })}\n\n`);
      res.end();
      return;
    }

    if (documentId !== 'all' && !document) {
      const errorText = 'Document not found';
      await this.saveChatMessage(userId, documentId, 'assistant', errorText);
      res.write(`data: ${JSON.stringify({ error: errorText })}\n\n`);
      res.end();
      return;
    }

    // Exact & Semantic Cache Lookup (Phase 3)
    const cacheKey = `notebook:chat:${this.chatCacheVersion}:${userId}:${documentId}:${message}`;
    const cachedResult = await this.cacheService.get('notebook', cacheKey, userId);
    if (cachedResult) {
      this.logger.log(`Cache hit for Notebook Chat query: "${message}"`);
      await this.saveChatMessage(userId, documentId, 'assistant', cachedResult.text, cachedResult.citations, cachedResult.confidence);
      res.write(`data: ${JSON.stringify({ token: cachedResult.text })}\n\n`);
      res.write(`data: ${JSON.stringify({ citations: cachedResult.citations, confidence: cachedResult.confidence })}\n\n`);
      res.end();
      return;
    }

    const intent = await this.detectUserIntent(message, userId);
    const isOverview = intent === 'Summarize PDF' || intent === 'Create Notes' || this.isSummaryRequest(message);

    const requestsExternalSources = /external\s+(?:legal\s+)?source|external\s+knowledge|general\s+law|outside\s+the\s+document|beyond\s+the\s+document|external\s+case|other\s+cases/i.test(message);

    let relevantChunks: DocumentChunk[] = [];
    if (isOverview) {
      const candidates = await this.getDocumentOverviewChunks(documentId, userId, 20);
      if (candidates.length === 0 && !requestsExternalSources) {
        const answerText = 'The uploaded document does not contain sufficient information.';
        await this.saveChatMessage(userId, documentId, 'assistant', answerText, [], 0);
        res.write(`data: ${JSON.stringify({ token: answerText })}\n\n`);
        res.write(`data: ${JSON.stringify({ citations: [], confidence: 0 })}\n\n`);
        res.end();
        return;
      }
      relevantChunks = await this.rerankChunks(message, candidates, 8);
    } else {
      const candidates = await this.retrieveRelevantChunks(documentId, message, 20, userId);
      const hasGrounding = candidates.length > 0 && this.hasSufficientGrounding(message, candidates);
      if (!hasGrounding && !requestsExternalSources) {
        const answerText = 'The uploaded document does not contain sufficient information.';
        await this.saveChatMessage(userId, documentId, 'assistant', answerText, [], 0);
        res.write(`data: ${JSON.stringify({ token: answerText })}\n\n`);
        res.write(`data: ${JSON.stringify({ citations: [], confidence: 0 })}\n\n`);
        res.end();
        return;
      }
      relevantChunks = await this.rerankChunks(message, candidates, 5);
    }

    // Format Context
    const contextLines = relevantChunks.map((chunk, idx) => 
      `[Source ${idx + 1}] File: ${chunk.documentName || document?.name || 'Workspace Document'} (Page ${chunk.pageNumber}, Section: ${chunk.section || 'N/A'}, Chunk ${chunk.chunkIndex + 1}): "${chunk.text}"`
    ).join('\n\n');

    let systemPrompt = '';
    if (isOverview) {
      systemPrompt = `You are LexNotebook AI, an elite legal assistant.
Analyze the provided retrieved context from the document and generate a professional DOCUMENT OVERVIEW.

You MUST format your output exactly as follows:

DOCUMENT OVERVIEW

Title:
[Document Title]

Law Student Summary:
[Professional explanation of what the document is, why it matters, and how a law student should approach it. Use only the retrieved context.]

${document?.documentType === 'Constitution' ? 'Key Constitutional Features:' : 'Key Document Features:'}
- [Feature 1]
- [Feature 2]
...

${document?.documentType === 'Constitution' ? 'Important Articles:' : 'Important Sections:'}
- [Article or Section number]: [Grounded summary and significance]
- [Article or Section number]: [Grounded summary and significance]
...

Important Takeaways:
- [Takeaway 1 for law students]
- [Takeaway 2 for law students]
...

Exam / Classroom Relevance:
- [How this document helps with constitutional/statutory/case-law study]
- [Important reading angle supported by the context]
...

Page References:
- Page [number] ([Source ID])
- Page [number] ([Source ID])
...

Rules:
- Ground all details strictly in the retrieved context. Do not speculate or invent details.
- Under Page References, list the source page numbers and corresponding Source IDs from the context.
- Keep the response clean and well-structured.

Context:
${contextLines}`;
    } else if (requestsExternalSources) {
      systemPrompt = `You are LexNotebook AI, an elite legal assistant.
The user has requested that you answer using external legal sources and general legal knowledge in addition to the uploaded document context.
Analyze the provided retrieved context from the document (if any) and answer using BOTH the document context AND external legal sources/knowledge.

For citations of sources found in the document, use [Source ID]. For external sources, mention the appropriate case citation, statutory section, or legal authority.

Format your response exactly in this structured QA template:

QUESTION:
[The user's question]

ANSWER:
[A detailed, professional answer using both document context and external legal knowledge. Cite sources where appropriate.]

SUPPORTING EVIDENCE:
- "[Direct quote or factual sentence 1]" (Source: Page [X], Section: [Y], Confidence: [Z]%)
- "[External Precedent/Statute citation or legal authority details]" (Source: External Legal Source)

SOURCE PAGES:
Page [X], Page [A], etc. (and External Sources)

CONFIDENCE SCORE:
[Average confidence of the cited sources, e.g., 90%]

LEGAL INTERPRETATION:
[Provide a professional legal analysis of the rule, statutory effect, or case impact based on the context and general legal principles.]

Rules:
- You may use external legal knowledge and external legal sources, as requested by the user.
- Supplement any document limitations with external legal precedents, statutes, or doctrines.

Context:
${contextLines}`;
    } else {
      systemPrompt = `You are LexNotebook AI, an elite legal assistant.
Answer the user's question using ONLY the provided retrieved context.
If the answer cannot be found in the retrieved context, respond exactly:
The uploaded document does not contain sufficient information.

For answers found in the context, you MUST format your response exactly in this structured QA template:

QUESTION:
[The user's question]

ANSWER:
[A detailed, direct, grounded answer. Cite sources by appending [Source ID] (e.g., [Source 1], [Source 2]) to sentences where you retrieve information.]

SUPPORTING EVIDENCE:
- "[Direct quote or factual sentence 1]" (Source: Page [X], Section: [Y], Confidence: [Z]%)
- "[Direct quote or factual sentence 2]" (Source: Page [A], Section: [B], Confidence: [C]%)

SOURCE PAGES:
Page [X], Page [A], etc.

CONFIDENCE SCORE:
[Average confidence of the cited sources, e.g., 90%]

LEGAL INTERPRETATION:
[Provide a professional legal analysis of the rule, statutory effect, or case impact based strictly on the context. Do not speculate.]

Rules:
- Never use external legal knowledge.
- If the context does not support answering the question, write ONLY: The uploaded document does not contain sufficient information.
- Calculate the confidence score based on the relevance/confidence of the sources used (e.g. output 90-95% if they are highly relevant, or 70-80% if less).

Context:
${contextLines}`;
    }

    this.logger.log(`Grounded System Prompt prepared for Document [${documentId}] (Intent: ${intent})`);

    const citations = this.buildCitations(relevantChunks, document?.name || 'Workspace Document');
    const confidence = citations.length
      ? Number((citations.reduce((sum, c) => sum + c.confidenceScore, 0) / citations.length).toFixed(4))
      : 0;

    let streamSucceeded = false;
    let streamedAnswer = '';

    try {
      const result = await this.aiProvider.complete({
        temperature: 0,
        maxTokens: 1200,
        module: 'notebook',
        userId,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.map(h => ({ role: h.role, content: h.text })),
          { role: 'user', content: message }
        ],
        onToken: (token) => {
          streamedAnswer += token;
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      });

      await this.cacheService.recordPipelineMetrics('geminiHits');

      await this.saveChatMessage(userId, documentId, 'assistant', streamedAnswer, citations, confidence);
      await this.cacheService.set('notebook', cacheKey, {
        text: streamedAnswer,
        citations,
        confidence,
      });

      res.write(`data: ${JSON.stringify({ citations, confidence })}\n\n`);
      res.end();
      streamSucceeded = true;
    } catch (err: any) {
      this.logger.error(`Unified LLM provider RAG stream failed: ${err.message}. Running fallback...`);
    }

    if (streamSucceeded) return;

    // Fallbacks
    const fallbackAnswer = isOverview
      ? this.buildDocumentSummaryAnswer(document?.name || 'Workspace Document', relevantChunks)
      : this.buildStructuredFallbackAnswer(message, relevantChunks, document?.name || 'Workspace Document');

    await this.saveChatMessage(userId, documentId, 'assistant', fallbackAnswer, citations, confidence);
    res.write(`data: ${JSON.stringify({ token: fallbackAnswer })}\n\n`);
    res.write(`data: ${JSON.stringify({ citations, confidence })}\n\n`);
    res.end();
  }

  private async saveChatMessage(
    userId: string,
    documentId: string,
    role: 'user' | 'assistant',
    text: string,
    citations: any = null,
    confidence: number = null,
  ): Promise<void> {
    await this.chatRepo.save(this.chatRepo.create({
      userId,
      documentId,
      role,
      text,
      citations,
      confidence,
    }));
  }

  private buildProfessionalGroundedAnswer(message: string, chunks: DocumentChunk[], documentName: string): string {
    const bestChunks = chunks.slice(0, 3);
    if (bestChunks.length === 0 || !this.hasSufficientGrounding(message, bestChunks)) {
      return 'The uploaded document does not contain sufficient information.';
    }

    const relevantSentences = this.selectRelevantSentences(message, bestChunks, 6);
    const answerBody = relevantSentences.length
      ? relevantSentences.map((item) => `- ${item.sentence} [Source ${item.sourceId}]`)
      : bestChunks.map((chunk, index) => {
          const compactText = chunk.text.replace(/\s+/g, ' ').trim();
          const excerpt = compactText.length > 360 ? `${compactText.substring(0, 360).trim()}...` : compactText;
          return `- ${excerpt} [Source ${index + 1}]`;
        });
    const concepts = this.extractLegalConcepts(bestChunks.map((chunk) => chunk.text).join(' '));
    const issueLine = this.inferQuestionFocus(message, concepts);

    return [
      `Answer from uploaded document: ${documentName}`,
      `Issue addressed: ${issueLine}`,
      `Grounded answer:`,
      ...answerBody,
      `Conclusion: Based on the cited parts of the uploaded document, the answer is limited to the points above. The document does not support any broader conclusion beyond these sources.`,
    ].join('\n\n');
  }

  private selectRelevantSentences(message: string, chunks: DocumentChunk[], limit = 6): Array<{ sentence: string; sourceId: number; score: number }> {
    const queryTerms = Array.from(new Set(this.tokenize(message).filter((term) => !this.isStopword(term))));
    const items: Array<{ sentence: string; sourceId: number; score: number; order: number }> = [];

    chunks.forEach((chunk, chunkIndex) => {
      const sentences = chunk.text
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?])\s+|(?=\b(?:Section|Article|Explanation|Illustration|Exception)\b)/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 25);

      sentences.forEach((sentence, sentenceIndex) => {
        const sentenceLower = sentence.toLowerCase();
        const overlap = queryTerms.filter((term) => sentenceLower.includes(term)).length;
        const legalBoost = /\b(section|article|act|court|shall|means|offence|punishment|penalty|right|duty|liability|exception|explanation)\b/i.test(sentence) ? 0.35 : 0;
        const sourceBoost = this.normalizeScore((chunk as any).score || 0) * 0.5;
        const score = overlap + legalBoost + sourceBoost;
        items.push({ sentence, sourceId: chunkIndex + 1, score, order: chunkIndex * 1000 + sentenceIndex });
      });
    });

    return items
      .filter((item) => item.score > 0.2)
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .slice(0, limit)
      .sort((a, b) => a.order - b.order)
      .map(({ sentence, sourceId, score }) => ({
        sentence: sentence.length > 520 ? `${sentence.substring(0, 520).trim()}...` : sentence,
        sourceId,
        score,
      }));
  }

  private inferQuestionFocus(message: string, concepts: string[]): string {
    const compactQuestion = message.replace(/\s+/g, ' ').trim();
    if (concepts.length > 0) return concepts.slice(0, 3).join(', ');
    const terms = this.tokenize(compactQuestion).filter((term) => !this.isStopword(term));
    return terms.length ? this.toTitleCase(terms.slice(0, 5).join(' ')) : 'Uploaded document query';
  }

  private isSummaryRequest(message: string): boolean {
    return /\b(summary|summarise|summarize|overview|brief|gist|what is this(?:\s+(?:pdf|document|file))?|what is this document about|explain(?:\s+this|\s+the)?\s+(?:pdf|document|file)|tell me about(?:\s+this|\s+the)?\s+(?:pdf|document|file))\b/i.test(message);
  }

  private async getDocumentOverviewChunks(documentId: string, userId: string, limit = 8): Promise<DocumentChunk[]> {
    const chunks = documentId === 'all'
      ? await this.getChunksForUser(userId)
      : await this.getChunksForUserDocument(documentId, userId);
    if (chunks.length === 0) return [];

    const selected = new Map<number, DocumentChunk>();
    const add = (chunk?: DocumentChunk) => {
      if (!chunk) return;
      selected.set(chunk.chunkIndex, chunk);
    };

    const priorityPatterns = [
      /short title|extent|commencement|preamble|statement of objects|statement of reasons/i,
      /definitions?|interpretation|means/i,
      /application|jurisdiction|offence|penalty|punishment|procedure/i,
      /abstract|introduction|background|facts|issues?/i,
    ];

    chunks.slice(0, Math.min(3, chunks.length)).forEach(add);
    for (const pattern of priorityPatterns) {
      add(chunks.find((chunk) => pattern.test(chunk.text)));
    }
    add(chunks[Math.floor(chunks.length / 2)]);
    add(chunks[chunks.length - 1]);

    return Array.from(selected.values())
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
      .slice(0, limit)
      .map((chunk, index) => {
        (chunk as any).score = 0.86 - index * 0.03;
        return chunk;
      });
  }

  private buildDocumentSummaryAnswer(documentName: string, chunks: DocumentChunk[]): string {
    const text = chunks.map((chunk) => chunk.text).join(' ').replace(/\s+/g, ' ').trim();
    const docType = this.detectDocumentType(text, documentName);
    const title = this.extractTitle(text, documentName);
    const concepts = this.extractLegalConcepts(text);
    const statutes = this.uniqueMatches(text, /\b[A-Z][A-Za-z\s]+ Act,?\s+\d{4}\b/g, 5);
    const sections = this.uniqueMatches(text, /\b(?:Section|Sec\.?)\s+\d+[A-Z]?(?:\([^)]+\))?/gi, 5);
    const articles = this.uniqueMatches(text, /\bArticle\s+\d+[A-Z]?(?:\([^)]+\))?/gi, 5);
    const subjectMatter = this.inferSubjectMatter(text, title, concepts);
    const summary = this.summarizeText(text);
    const constitutionTopics = this.extractConstitutionStudyTopics(text);
    const pageRefs = chunks
      .slice(0, 6)
      .map((chunk, index) => `- [Source ${index + 1}] Page ${chunk.pageNumber}, Chunk ${chunk.chunkIndex + 1}`)
      .join('\n');

    const provisionLines = docType === 'Constitution'
      ? [
          articles.length ? `- Articles specifically detected in retrieved context: ${articles.join('; ')}` : '',
          constitutionTopics.parts.length ? `- Parts detected: ${constitutionTopics.parts.join('; ')}` : '',
          constitutionTopics.schedules.length ? `- Schedules detected: ${constitutionTopics.schedules.join('; ')}` : '',
          constitutionTopics.amendments.length ? `- Amendments referenced: ${constitutionTopics.amendments.join('; ')}` : '',
        ].filter(Boolean)
      : [
          statutes.length ? `- Statutes/Acts detected: ${statutes.join('; ')}` : '',
          sections.length ? `- Sections detected: ${sections.join('; ')}` : '',
          articles.length ? `- Articles detected: ${articles.join('; ')}` : '',
        ].filter(Boolean);

    const conceptLines = (concepts.length ? concepts : constitutionTopics.concepts)
      .slice(0, 8)
      .map((concept) => `- ${concept}`);

    const details = [
      `LAW STUDENT OVERVIEW`,
      `Document: ${title}`,
      `Type: ${docType}`,
      `Subject Area: ${subjectMatter}`,
      `Nature of Material:\n${this.describeDocumentForStudents(docType, text)}`,
      `Core Summary:\n${summary}`,
      provisionLines.length ? `Key Provisions Detected:\n${provisionLines.join('\n')}` : '',
      conceptLines.length ? `Key Legal Concepts:\n${conceptLines.join('\n')}` : '',
      `How to Study This Document:\n${this.buildStudyGuidance(docType)}`,
      `Exam / Classroom Relevance:\n${this.buildExamRelevance(docType, concepts, constitutionTopics)}`,
      `Source Map:\n${pageRefs}`,
      `Grounding Note:\nThis answer is generated only from the uploaded document chunks listed above. No external legal material has been added.`,
    ].filter(Boolean);

    return details.join('\n\n');
  }

  private buildCitations(chunks: DocumentChunk[], fallbackName: string, defaultConfidence?: number): any[] {
    return chunks.map((c, idx) => ({
      id: idx + 1,
      name: c.documentName || fallbackName,
      pageNumber: c.pageNumber,
      chunkIndex: c.chunkIndex + 1,
      text: c.text,
      confidenceScore: defaultConfidence !== undefined
        ? Number(Math.max(0, Math.min(1, defaultConfidence - idx * 0.03)).toFixed(4))
        : this.normalizeScore((c as any).score || 0),
    }));
  }

  private hasSufficientGrounding(message: string, chunks: DocumentChunk[]): boolean {
    if (!chunks.length) return false;
    const questionTerms = Array.from(new Set(this.tokenize(message).filter((term) => !this.isStopword(term))));
    if (!questionTerms.length) return true;

    const combined = chunks.slice(0, 4).map((chunk) => chunk.text).join(' ').toLowerCase();
    const overlap = questionTerms.filter((term) => combined.includes(term)).length;
    const overlapRatio = overlap / questionTerms.length;
    const topScore = this.normalizeScore((chunks[0] as any).score || 0);

    return overlapRatio >= 0.25 || topScore >= 0.42;
  }

  async runLegalExtraction(documentId: string, userId: string): Promise<NotebookDocument> {
    const doc = await this.getOneForUser(documentId, userId);
    if (!doc) {
      throw new Error('Document not found');
    }

    const chunks = await this.getChunks(documentId);
    const text = chunks.map((chunk) => chunk.text).join('\n\n').trim();
    if (!text) {
      throw new Error('Cannot extract legal metadata: no indexed text chunks found.');
    }

    const legalMetadata = await this.extractLegalIntelligence(text, doc.name, userId);
    const extractedWordCount = this.countExtractedWords(text);
    const extractionStatus = this.getExtractionQualityStatus(text);
    const sourceType = legalMetadata?.documentType || this.detectDocumentType(text, doc.name);
    doc.legalMetadata = {
      ...(legalMetadata || {}),
      fileName: doc.name,
      pageNumber: doc.pages || Math.max(1, chunks.length),
      chunkIndex: null,
      extractedWordCount,
      sourceType,
      uploadedAt: doc.uploadedAt?.toISOString() || new Date().toISOString(),
      extractionStatus,
      pagesProcessed: doc.pages || Math.max(1, chunks.length),
      chunksCreated: chunks.length,
      sourceQualityScore: this.getSourceQualityScore(text, chunks.length),
      insufficientForMockTest: extractedWordCount < 800 || extractionStatus === 'Needs OCR',
      insufficientForLongAnswers: extractedWordCount < 3000 || extractionStatus === 'Needs OCR',
    };
    doc.documentType = sourceType;
    doc.clausesCount = this.estimateLegalClauseCount(text);
    doc.status = doc.status === 'Failed' || doc.status === 'Extraction Failed' ? extractionStatus : doc.status;
    doc.errorMessage = null;
    await this.docRepo.save(doc);

    // Sync to Supabase
    try {
      const supabaseChunks = chunks.map(c => ({
        text: c.text,
        chunk_index: c.chunkIndex,
        page_number: c.pageNumber,
        section: c.section || null,
      }));
      
      const entities: any[] = [];
      const relationships: any[] = [];
      const docNodeId = `doc:${documentId}`;
      const addNode = (id: string, label: string, type: string) => {
        entities.push({ id, label, type });
      };
      const addEdge = (source: string, target: string, relation: string) => {
        relationships.push({ source, target, relation });
      };

      addNode(docNodeId, doc.name, doc.documentType);
      
      if (doc.documentType === 'Constitution') {
        addNode('const:constitution_of_india', 'Constitution of India', 'Constitution');
        addEdge(docNodeId, 'const:constitution_of_india', 'represents');

        const constNodes = [
          { id: 'const:fundamental_rights', label: 'Fundamental Rights', type: 'Constitutional Concept' },
          { id: 'const:dpsp', label: 'DPSP', type: 'Constitutional Concept' },
          { id: 'const:parliament', label: 'Parliament', type: 'Constitutional Body' },
          { id: 'const:president', label: 'President', type: 'Constitutional Office' },
          { id: 'const:judiciary', label: 'Judiciary', type: 'Constitutional Body' },
          { id: 'const:federalism', label: 'Federalism', type: 'Constitutional Concept' },
          { id: 'const:emergency_provisions', label: 'Emergency Provisions', type: 'Constitutional Concept' }
        ];
        constNodes.forEach(n => addNode(n.id, n.label, n.type));

        const articles = legalMetadata.articles || [];
        articles.forEach((art: string) => {
          const numMatch = art.match(/\d+/);
          if (numMatch) {
            const num = parseInt(numMatch[0]);
            const artId = `art:${num}`;
            addNode(artId, `Article ${num}`, 'Article');
            addEdge('const:constitution_of_india', artId, 'contains');

            if (num >= 12 && num <= 35) {
              addEdge(artId, 'const:fundamental_rights', 'belongs to');
              if (num === 14) addNode('concept:right_to_equality', 'Right to Equality', 'Right'), addEdge(artId, 'concept:right_to_equality', 'guarantees');
              if (num === 21) addNode('concept:right_to_life', 'Right to Life', 'Right'), addEdge(artId, 'concept:right_to_life', 'guarantees');
              if (num === 32) addNode('concept:constitutional_remedies', 'Constitutional Remedies', 'Right'), addEdge(artId, 'concept:constitutional_remedies', 'provides');
            } else if (num >= 36 && num <= 51) {
              addEdge(artId, 'const:dpsp', 'belongs to');
            } else if (num >= 52 && num <= 78) {
              addEdge(artId, 'const:president', 'governs');
            } else if (num >= 79 && num <= 122) {
              addEdge(artId, 'const:parliament', 'governs');
            } else if (num >= 124 && num <= 147) {
              addEdge(artId, 'const:judiciary', 'governs');
            } else if (num >= 245 && num <= 263) {
              addEdge(artId, 'const:federalism', 'governs');
            } else if (num >= 352 && num <= 360) {
              addEdge(artId, 'const:emergency_provisions', 'governs');
            }
          }
        });
      } else if (doc.documentType === 'Judgment') {
        addNode(`judgment:${documentId}:facts`, 'Facts', 'Factual Background');
        addNode(`judgment:${documentId}:ratio`, 'Ratio Decidendi', 'Ratio');
        addEdge(docNodeId, `judgment:${documentId}:facts`, 'has facts');
        addEdge(docNodeId, `judgment:${documentId}:ratio`, 'has ratio');

        const issues = legalMetadata.issues || [];
        issues.forEach((issue: string, idx: number) => {
          const issueId = `judgment:${documentId}:issue:${idx + 1}`;
          addNode(issueId, `Issue: ${issue}`, 'Issue');
          addEdge(docNodeId, issueId, 'frames');
          addEdge(issueId, `judgment:${documentId}:ratio`, 'resolved by');
        });

        const cases = legalMetadata.cases || [];
        cases.forEach((c: string, idx: number) => {
          const caseId = `case:${idx + 1}`;
          addNode(caseId, c, 'Precedent');
          addEdge(docNodeId, caseId, 'cites');
        });

        const citations = legalMetadata.citations || [];
        citations.forEach((cit: string, idx: number) => {
          const citId = `authority:${idx + 1}`;
          addNode(citId, cit, 'Authority');
          addEdge(docNodeId, citId, 'references');
        });
      } else {
        const concepts = legalMetadata.legalConcepts || [];
        concepts.forEach((concept: string) => {
          const conceptId = `concept:${concept.replace(/\s+/g, '_').toLowerCase()}`;
          addNode(conceptId, concept, 'Legal Concept');
          addEdge(docNodeId, conceptId, 'discusses');
        });
      }

      await this.supabaseService.upsertNotebookDocument({
        document_id: documentId,
        user_id: doc.userId,
        document_type: doc.documentType,
        title: doc.name,
        metadata: {
          ...(legalMetadata || {}),
          user_id: doc.userId,
          document_id: documentId,
          filename: doc.name,
          document_type: doc.documentType,
          upload_date: doc.uploadedAt?.toISOString() || new Date().toISOString(),
          page_count: doc.pages || 0,
          chunk_count: chunks?.length || 0,
          topics_detected: legalMetadata?.legalConcepts || legalMetadata?.keywords || [],
        },
        chunks: supabaseChunks,
        entities,
        relationships,
        citations: this.buildCitations(chunks, doc.name, 0.9),
        summary: legalMetadata?.summary || '',
      });
      this.logger.log(`Document [${documentId}] metadata synced to Supabase successfully during runLegalExtraction.`);
    } catch (supabaseError) {
      this.logger.warn(`Supabase synchronization failed during runLegalExtraction: ${supabaseError.message}`);
    }

    return doc;
  }

  private estimateLegalClauseCount(text: string): number {
    const legalKeywords = ['shall', 'agree', 'indemnify', 'liability', 'court', 'section', 'article', 'right'];
    const lowercaseText = text.toLowerCase();
    let clauseCount = 0;
    legalKeywords.forEach((word) => {
      const matches = lowercaseText.match(new RegExp(`\\b${word}\\b`, 'g'));
      if (matches) clauseCount += matches.length;
    });
    return Math.max(1, Math.min(25, Math.floor(clauseCount / 6) || 1));
  }

  // Legal Intelligence Extraction Engine
  async extractLegalIntelligence(text: string, docName: string, userId?: string): Promise<any> {
    this.logger.log(`Extracting legal intelligence for document "${docName}"...`);
    const docType = this.detectDocumentType(text, docName);
    let systemPrompt = '';

    if (docType === 'Constitution') {
      systemPrompt = `You are a constitutional law expert. Extract fields strictly from the provided Constitution text.
Return a single JSON object. Use null or [] if not found. Do not invent details.
Ensure the JSON conforms EXACTLY to this schema:
{
  "documentType": "Constitution",
  "title": "Constitution of India",
  "version": "Version or Year, e.g. 2024",
  "articles": ["Articles detected, e.g. Article 14, Article 21"],
  "parts": ["Parts detected, e.g. Part III, Part IV"],
  "schedules": ["Schedules detected, e.g. Seventh Schedule"],
  "amendments": ["Amendments referenced or discussed"],
  "chapters": ["Chapters detected, e.g. Chapter II"],
  "summary": "Brief summary of this constitution document segment",
  "legalConcepts": ["Key concepts like Fundamental Rights, DPSP, Judiciary, Federalism"],
  "parties": [],
  "judges": [],
  "issues": [],
  "sections": ["Articles mapped as sections, e.g. Article 14"],
  "acts": ["Constitution of India"],
  "citations": [],
  "reliefs": [],
  "confidence": 0.95,
  "extractedAt": "${new Date().toISOString().substring(0, 10)}"
}`;
    } else if (docType === 'Judgment') {
      systemPrompt = `You are an expert judicial clerk and analyst. Extract case details strictly from the judgment text.
Return a single JSON object. Use null or [] if not found. Do not invent details.
Ensure the JSON conforms EXACTLY to this schema:
{
  "documentType": "Judgment",
  "title": "Case Name, e.g. Appellant v. Respondent",
  "caseName": "Case Name",
  "citation": "Primary citation, e.g. AIR 1973 SC 1461",
  "court": "e.g. Supreme Court of India",
  "bench": "Presiding judges/bench",
  "date": "Judgment date",
  "facts": "Factual background summary",
  "issues": ["Key legal issues framed by the court"],
  "holdings": "Final decision/judgment holding",
  "ratioDecidendi": "Binding legal principle/reasoning established",
  "obiterDicta": "Obiter observations",
  "relief": "Relief granted/denied",
  "impact": "Precedential significance or impact",
  "summary": "General overview summary",
  "parties": ["Appellant Name", "Respondent Name"],
  "judges": ["Judge 1", "Judge 2"],
  "sections": ["Statutory sections referenced, e.g. Section 302"],
  "acts": ["Statutes or acts referenced, e.g. Indian Penal Code"],
  "citations": ["List of all citations mentioned in text, e.g. AIR 1973 SC 1461"],
  "reliefs": ["Specific reliefs granted or denied, e.g. Appeal allowed"],
  "confidence": 0.95,
  "extractedAt": "${new Date().toISOString().substring(0, 10)}"
}`;
    } else if (docType === 'Research Paper') {
      systemPrompt = `You are an academic legal researcher. Extract academic details strictly from the research paper text.
Return a single JSON object. Use null or [] if not found. Do not invent details.
Ensure the JSON conforms EXACTLY to this schema:
{
  "documentType": "Research Paper",
  "title": "Research Paper Title",
  "authors": ["Author names"],
  "abstract": "Abstract text",
  "methodology": "Research methodology or approach used",
  "findings": ["Key research findings"],
  "conclusion": "Conclusion statement",
  "summary": "Brief summary",
  "references": ["Key references cited"],
  "parties": [],
  "judges": [],
  "issues": ["Key research or legal issues examined"],
  "sections": ["Sections referenced"],
  "acts": ["Acts referenced"],
  "citations": ["Bibliography citations"],
  "reliefs": [],
  "confidence": 0.95,
  "extractedAt": "${new Date().toISOString().substring(0, 10)}"
}`;
    } else {
      systemPrompt = `You are LexNotebook AI's legal intelligence extraction engine. Extract metadata from the document text.
Return a single JSON object. Use null or [] if not found. Do not invent details.
Ensure the JSON conforms EXACTLY to this schema:
{
  "documentType": "${docType}",
  "title": "Document title",
  "subjectMatter": "Subject matter of the text",
  "parties": ["Party names if contract/case"],
  "jurisdiction": "Governing law or court",
  "dates": ["Dates found"],
  "citation": "Primary citation if present",
  "sections": ["Statutory sections referenced"],
  "statutes": ["Statutes or acts referenced"],
  "articles": ["Articles referenced"],
  "legalConcepts": ["Legal concepts referenced"],
  "issues": ["Issues framed"],
  "summary": "Summary of the text",
  "definitions": ["Definitions or key terms"],
  "complianceRequirements": ["Compliance obligations or shall-clauses"],
  "judges": ["Judges if applicable"],
  "acts": ["Statutes or acts referenced"],
  "citations": ["All citations referenced"],
  "reliefs": ["Reliefs or outcomes"],
  "confidence": 0.9,
  "extractedAt": "${new Date().toISOString().substring(0, 10)}"
}`;
    }

    try {
      const result = await this.aiProvider.complete({
        temperature: 0.1,
        maxTokens: 4000,
        module: 'notebook',
        preferredModel: 'GPT-4o-Mini',
        jsonMode: true,
        userId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text.substring(0, 18000) }
        ]
      });

      let contentStr = result.content || '{}';
      if (contentStr.includes('```json')) {
        contentStr = contentStr.split('```json')[1].split('```')[0].trim();
      } else if (contentStr.includes('```')) {
        contentStr = contentStr.split('```')[1].split('```')[0].trim();
      }

      const extracted = JSON.parse(contentStr);
      if (extracted.documentType || extracted.title || extracted.summary || extracted.facts) {
        extracted.documentType = extracted.documentType || this.detectDocumentType(text, docName);
        extracted.court = extracted.court || null;
        extracted.judge = extracted.judge || extracted.bench || null;
        extracted.citation = extracted.citation || (extracted.importantCitations && extracted.importantCitations[0]) || (extracted.citations && extracted.citations[0]) || null;
        extracted.sections = extracted.sections || extracted.importantSections || [];
        extracted.articles = extracted.articles || extracted.importantArticles || [];
        extracted.legalIssues = extracted.legalIssues || extracted.issues || [];
        extracted.issues = extracted.issues || extracted.legalIssues || [];
        extracted.cases = extracted.cases || this.extractCaseNames(text);
        extracted.legalConcepts = extracted.legalConcepts || this.extractLegalConcepts(text);
        extracted.subjectMatter = extracted.subjectMatter || this.inferSubjectMatter(text, extracted.title || docName, extracted.legalConcepts || []);
        extracted.organizations = extracted.organizations || this.extractOrganizations(text);
        extracted.people = extracted.people || this.extractPeople(text);
        extracted.keywords = extracted.keywords || this.extractKeywords(text);
        extracted.jurisdiction = extracted.jurisdiction || this.inferJurisdiction(text);
        extracted.holdings = extracted.holdings || extracted.finalHolding || '';
        extracted.summary = extracted.summary || extracted.facts || '';
        extracted.confidence = extracted.confidence || 0.8;
        extracted.extractedAt = extracted.extractedAt || new Date().toISOString().substring(0, 10);
        extracted.version = extracted.version || 'v1.0';
        extracted.processingStatus = extracted.processingStatus || 'completed';

        // Normalize the 7 required fields as arrays of strings
        extracted.parties = Array.isArray(extracted.parties) ? extracted.parties : (extracted.caseName ? [extracted.caseName] : (extracted.title ? [extracted.title] : []));
        extracted.judges = Array.isArray(extracted.judges) ? extracted.judges : (extracted.bench ? String(extracted.bench).split(',').map((j: any) => String(j).trim()) : (extracted.judge ? [extracted.judge] : []));
        extracted.issues = Array.isArray(extracted.issues) ? extracted.issues : (extracted.legalIssues ? extracted.legalIssues : (extracted.issues ? [extracted.issues] : []));
        extracted.sections = Array.isArray(extracted.sections) ? extracted.sections : (extracted.importantSections ? extracted.importantSections : (extracted.sectionsExtracted ? extracted.sectionsExtracted : []));
        extracted.acts = Array.isArray(extracted.acts) ? extracted.acts : (extracted.statutes ? extracted.statutes : (extracted.statute ? [extracted.statute] : []));
        extracted.citations = Array.isArray(extracted.citations) ? extracted.citations : (extracted.importantCitations ? extracted.importantCitations : (extracted.citations ? extracted.citations : (extracted.citation ? [extracted.citation] : [])));
        extracted.reliefs = Array.isArray(extracted.reliefs) ? extracted.reliefs : (extracted.relief ? [extracted.relief] : (extracted.prayer ? [extracted.prayer] : (extracted.reliefs ? [extracted.reliefs] : [])));
        
        this.logger.log(`Legal intelligence successfully extracted via unified AI provider.`);
        return extracted;
      }
    } catch (err: any) {
      this.logger.error(`Unified legal intelligence extraction failed: ${err.message}.`);
    }

    this.logger.warn('No configured legal AI provider returned valid JSON. Using deterministic legal extraction fallback.');
    return this.buildRuleBasedLegalExtraction(text, docName);
  }

  private buildRuleBasedLegalExtraction(text: string, docName: string): any {
    const compactText = text.replace(/\s+/g, ' ').trim();
    const documentType = this.detectDocumentType(text, docName);
    const title = this.extractTitle(text, docName);
    const citations = this.uniqueMatches(compactText, /\b(?:AIR|SCC|SCR)\s*[0-9A-Z()\/.\s-]{4,40}|\b\d{4}\s+\d+\s+SCC\s+\d+\b/g, 15);
    const sections = this.uniqueMatches(compactText, /\b(?:Section|Sec\.?)\s+\d+[A-Z]?(?:\([^)]+\))?/gi, 15);
    const articles = this.uniqueMatches(compactText, /\bArticle\s+\d+[A-Z]?(?:\([^)]+\))?/gi, 15);
    const dates = this.uniqueMatches(compactText, /\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b|\b\d{4}\b/g, 8);
    const issues = this.extractIssueLikeLines(text);
    const cases = this.extractCaseNames(text);
    const legalConcepts = this.extractLegalConcepts(text);
    const organizations = this.extractOrganizations(text);
    const people = this.extractPeople(text);
    const keywords = this.extractKeywords(text);
    const summary = this.summarizeText(compactText);
    const facts = this.extractSectionText(text, ['facts', 'factual background', 'background']) || summary;
    const prayer = this.extractSectionText(text, ['prayer', 'relief']) || '';
    const ratio = this.extractSectionText(text, ['ratio decidendi', 'holding', 'held']) || '';
    const statutes = this.uniqueMatches(compactText, /\b[A-Z][A-Za-z\s]+ Act,?\s+\d{4}\b/g, 10);
    const parties = this.extractParties(title);
    const judges = this.extractJudges(text);
    const reliefs = this.extractReliefs(text);

    return {
      documentType,
      title,
      subjectMatter: this.inferSubjectMatter(text, title, legalConcepts),
      parties,
      judges,
      jurisdiction: this.inferJurisdiction(text),
      dates,
      people,
      organizations,
      court: this.extractCourt(compactText),
      bench: judges.join(', '),
      judge: judges[0] || null,
      citation: citations[0] || null,
      citations,
      cases,
      sections,
      statutes,
      articles,
      authorities: Array.from(new Set([...cases, ...citations])).slice(0, 8),
      legalConcepts,
      legalIssues: issues,
      issues,
      keywords,
      facts,
      arguments: this.extractBulletLikeLines(text, ['argument', 'submission', 'contention']),
      petitionerArguments: this.extractBulletLikeLines(text, ['petitioner', 'appellant', 'plaintiff']),
      respondentArguments: this.extractBulletLikeLines(text, ['respondent', 'defendant']),
      prayer,
      ratioDecidendi: ratio,
      obiterDicta: '',
      holdings: ratio,
      relief: prayer,
      reliefs,
      sectionsExtracted: sections,
      definitions: this.extractBulletLikeLines(text, ['means', 'definition', 'defined']),
      penalties: this.extractBulletLikeLines(text, ['penalty', 'punishment', 'imprisonment', 'fine']),
      amendments: this.extractBulletLikeLines(text, ['amendment', 'amended']),
      complianceRequirements: this.extractBulletLikeLines(text, ['shall', 'must', 'required']),
      abstract: documentType === 'Research Paper' ? summary : '',
      methodology: this.extractSectionText(text, ['methodology', 'method']) || '',
      findings: this.extractBulletLikeLines(text, ['finding', 'conclusion']),
      references: citations,
      conclusions: this.extractBulletLikeLines(text, ['conclusion', 'therefore']),
      summary,
      confidence: 0.62,
      extractedAt: new Date().toISOString().substring(0, 10),
      version: 'fallback-v1.0',
      processingStatus: 'completed',
      courtAnalysis: this.extractSectionText(text, ['analysis', 'reasoning', 'observations']) || '',
      finalHolding: ratio,
      importantSections: sections,
      importantArticles: articles,
      importantCitations: citations,
      acts: statutes,
    };
  }

  private extractJudges(text: string): string[] {
    const judges: string[] = [];
    const coramMatch = text.match(/(?:CORAM|Coram|BENCH|Bench|JUDGES|Judges)\s*:?\s*([^\n\r.]+)/i);
    if (coramMatch && coramMatch[1]) {
      const parts = coramMatch[1].split(/,|&|and/).map(j => j.trim()).filter(j => j.length > 5 && !/date|present|order|judgment/i.test(j));
      judges.push(...parts);
    }
    const honbleMatches = text.match(/(?:Hon'ble|HON'BLE|Hon’ble)\s+(?:Mr\.\s+|Ms\.\s+|Mrs\.\s+)?Justice\s+([A-Z][a-zA-Z.\s]+)/g);
    if (honbleMatches) {
      honbleMatches.forEach(m => {
        const name = m.replace(/(?:Hon'ble|HON'BLE|Hon’ble)\s+(?:Mr\.\s+|Ms\.\s+|Mrs\.\s+)?Justice\s+/i, '').trim();
        if (name && name.length > 3 && name.length < 40 && !judges.includes(name)) {
          judges.push(name);
        }
      });
    }
    return Array.from(new Set(judges)).slice(0, 5);
  }

  private extractReliefs(text: string): string[] {
    const prayer = this.extractSectionText(text, ['prayer', 'relief', 'reliefs', 'conclusion', 'held']);
    if (prayer) {
      return prayer.split(/[.;]|\r?\n/).map(s => s.trim()).filter(s => s.length > 15 && s.length < 200).slice(0, 6);
    }
    const lines = text.split(/\r?\n/).map(l => l.trim());
    const reliefLines = lines.filter(l => /(?:allow|dismiss|grant|direct|decree|pray|relief|petition)/i.test(l) && l.length > 20 && l.length < 150);
    return Array.from(new Set(reliefLines)).map(l => l.replace(/^[-*\d.)\s]+/, '').trim()).slice(0, 5);
  }

  private extractLegalConcepts(text: string): string[] {
    const concepts = [
      'Offer', 'Acceptance', 'Consideration', 'Contract', 'Agreement', 'Breach of Contract',
      'Damages', 'Specific Performance', 'Injunction', 'Arbitration', 'Indemnity', 'Guarantee',
      'Confidentiality', 'Termination', 'Liability', 'Negligence', 'Mens Rea', 'Natural Justice',
      'Due Process', 'Fundamental Rights', 'Equality', 'Dignity', 'Privacy', 'Judicial Review',
      'Jurisdiction', 'Ratio Decidendi', 'Obiter Dicta', 'Precedent', 'Authority',
      'Compliance', 'Workplace Harassment', 'Sexual Harassment', 'Constitutional Validity',
      'Legislative Intent', 'Burden of Proof', 'Cause of Action', 'Limitation',
    ];
    const haystack = text.toLowerCase();
    return concepts
      .filter((concept) => haystack.includes(concept.toLowerCase()))
      .slice(0, 12);
  }

  private extractCaseNames(text: string): string[] {
    return this.uniqueMatches(
      text.replace(/\s+/g, ' '),
      /\b[A-Z][A-Za-z.&'\s]{2,70}\s+v(?:s\.?|ersus)?\.?\s+[A-Z][A-Za-z.&'\s]{2,70}\b/g,
      8,
    );
  }

  private extractOrganizations(text: string): string[] {
    const compact = text.replace(/\s+/g, ' ');
    const orgs = [
      ...this.uniqueMatches(compact, /\b(?:Supreme Court of India|High Court of [A-Za-z ]+|District Court of [A-Za-z ]+|National Company Law Tribunal|NCLT|NCLAT|Union of India|State of [A-Za-z ]+|Ministry of [A-Za-z ]+|Law Commission of India)\b/gi, 8),
      ...this.uniqueMatches(compact, /\b[A-Z][A-Za-z&.\s]{2,70}\s+(?:Ltd\.?|Limited|LLP|Corporation|Company|Authority|Commission|Board|University|Council|Tribunal|Court)\b/g, 8),
    ];
    return Array.from(new Set(orgs)).slice(0, 10);
  }

  private extractPeople(text: string): string[] {
    const compact = text.replace(/\s+/g, ' ');
    const titledNames = this.uniqueMatches(
      compact,
      /\b(?:Mr\.|Ms\.|Mrs\.|Dr\.|Prof\.|Justice|Hon'?ble Justice|Shri|Smt\.)\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3}\b/g,
      8,
    );
    const caseParties = this.extractCaseNames(text)
      .flatMap((caseName) => caseName.split(/\s+v(?:s\.?|ersus)?\.?\s+/i))
      .map((part) => part.trim())
      .filter((part) => part.length > 2 && part.length < 80);
    return Array.from(new Set([...titledNames, ...caseParties])).slice(0, 10);
  }

  private extractKeywords(text: string): string[] {
    const counts = new Map<string, number>();
    for (const term of this.tokenize(text)) {
      if (this.isStopword(term) || term.length < 4) continue;
      counts.set(term, (counts.get(term) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([term]) => this.toTitleCase(term));
  }

  private inferSubjectMatter(text: string, title: string, concepts: string[]): string {
    const combined = `${title}\n${text}`.toLowerCase();
    if (combined.includes('contract')) return 'Contract law';
    if (combined.includes('constitution') || combined.includes('article ')) return 'Constitutional law';
    if (combined.includes('criminal') || combined.includes('penal')) return 'Criminal law';
    if (combined.includes('company') || combined.includes('corporate')) return 'Corporate law';
    if (combined.includes('arbitration')) return 'Arbitration law';
    if (combined.includes('harassment') || combined.includes('workplace')) return 'Employment and workplace law';
    if (concepts.length > 0) return concepts.slice(0, 3).join(', ');
    return this.detectDocumentType(text, title);
  }

  private inferJurisdiction(text: string): string | null {
    const court = this.extractCourt(text);
    if (court) return court;
    const jurisdiction = text.match(/\b(?:India|Indian law|State of [A-Za-z ]+|Union of India|[A-Za-z ]+ jurisdiction)\b/i);
    return jurisdiction ? jurisdiction[0] : null;
  }

  private isStopword(term: string): boolean {
    return new Set([
      'about', 'above', 'after', 'again', 'against', 'also', 'among', 'been', 'being', 'between',
      'could', 'does', 'from', 'have', 'into', 'more', 'most', 'only', 'other', 'over', 'same',
      'shall', 'should', 'such', 'than', 'that', 'their', 'there', 'these', 'this', 'those',
      'through', 'under', 'upon', 'were', 'what', 'when', 'where', 'which', 'while', 'with',
      'would', 'document', 'uploaded', 'question', 'answer', 'legal',
    ]).has(term.toLowerCase());
  }

  private toTitleCase(term: string): string {
    return term
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  private extractTitle(text: string, fallbackName: string): string {
    if (/constitution of india/i.test(text)) {
      return 'The Constitution of India';
    }

    const firstMeaningfulLine = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 8 && line.length < 180 && this.isReadableStudyText(line));
    return firstMeaningfulLine || fallbackName.replace(/\.[^.]+$/, '');
  }

  private summarizeText(text: string): string {
    const sentences = text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => this.cleanExtractionArtifact(sentence))
      .filter((sentence) => sentence.length > 40 && this.isReadableStudyText(sentence));
    return sentences.slice(0, 5).join(' ') || this.cleanExtractionArtifact(text.substring(0, 900));
  }

  private cleanExtractionArtifact(value: string): string {
    return value
      .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isReadableStudyText(value: string): boolean {
    const compact = value.replace(/\s+/g, ' ').trim();
    if (compact.length < 8) return false;
    const letters = compact.match(/[A-Za-z]/g)?.length || 0;
    const visible = compact.replace(/\s/g, '').length || 1;
    const asciiRatio = this.cleanExtractionArtifact(compact).replace(/\s/g, '').length / visible;
    const hasStudyWords = /\b(constitution|india|article|part|schedule|amendment|government|ministry|law|justice|rights|parliament|court|state|union|preface|edition)\b/i.test(compact);
    return asciiRatio > 0.75 && letters >= 8 && (hasStudyWords || letters / visible > 0.55);
  }

  private extractConstitutionStudyTopics(text: string): {
    parts: string[];
    schedules: string[];
    amendments: string[];
    concepts: string[];
  } {
    const compact = this.cleanExtractionArtifact(text);
    const concepts = [
      'Preamble',
      'Fundamental Rights',
      'Directive Principles of State Policy',
      'Fundamental Duties',
      'Union and State structure',
      'Parliamentary government',
      'Judiciary',
      'Federal distribution of powers',
      'Constitutional amendments',
    ].filter((topic) => new RegExp(topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(compact));

    return {
      parts: this.uniqueMatches(compact, /\bPart\s+[IVXLCDM]+(?:\s*[-:]\s*[A-Za-z][A-Za-z\s]{2,50})?/gi, 8),
      schedules: this.uniqueMatches(compact, /\b(?:First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth|Tenth|Eleventh|Twelfth)\s+Schedule\b/gi, 8),
      amendments: this.uniqueMatches(compact, /\b(?:One Hundred(?: and)? [A-Za-z-]+|[A-Za-z-]+)\s+Amendment\)?\s+Act,?\s+\d{4}\b/gi, 8),
      concepts,
    };
  }

  private describeDocumentForStudents(docType: string, text: string): string {
    if (docType === 'Constitution') {
      const version = /\bAs on\s+[^.\]\n]{4,40}/i.exec(text)?.[0];
      const update = /\bup-to-date by incorporating[^.]{20,220}\./i.exec(text)?.[0];
      return [
        'This is an official text of the Constitution of India intended for reference and study.',
        version ? `The retrieved text identifies the version as "${this.cleanExtractionArtifact(version)}".` : '',
        update ? this.cleanExtractionArtifact(update) : '',
      ].filter(Boolean).join(' ');
    }
    return 'This is a legal source document. Read it as primary material and separate the extracted rule, issue, authority, and conclusion while making notes.';
  }

  private buildStudyGuidance(docType: string): string {
    if (docType === 'Constitution') {
      return [
        '- Start with the structure: Preamble, Parts, Articles, Schedules, and Amendments.',
        '- For every Article, note the rule, constitutional purpose, limitations, and related doctrine.',
        '- Keep a separate chart for Fundamental Rights, Directive Principles, Union-State relations, Judiciary, Emergency provisions, and Amendment power.',
      ].join('\n');
    }
    if (docType === 'Judgment') {
      return [
        '- Extract facts, issues, holding, ratio decidendi, and relief.',
        '- Mark the paragraph/page where the court states the governing principle.',
        '- Separate binding ratio from background facts and obiter observations.',
      ].join('\n');
    }
    return [
      '- Identify the source type, operative provisions, definitions, obligations, exceptions, and consequences.',
      '- Convert each important provision into short exam notes: rule, condition, effect, and example.',
      '- Preserve page references for every point you may cite later.',
    ].join('\n');
  }

  private buildExamRelevance(docType: string, concepts: string[], constitutionTopics: { concepts: string[] }): string {
    if (docType === 'Constitution') {
      const focus = Array.from(new Set([...concepts, ...constitutionTopics.concepts])).slice(0, 5);
      return [
        '- Useful for bare-act reading, constitutional law notes, article-wise revision, and preliminary issue spotting.',
        focus.length ? `- Priority themes from retrieved text: ${focus.join('; ')}.` : '',
        '- For answer writing, use the uploaded text as the base authority and attach case law separately only when asked.',
      ].filter(Boolean).join('\n');
    }
    return [
      '- Useful for making short notes, issue lists, and source-backed answers.',
      '- Focus on provisions and extracted concepts that can become direct exam questions.',
    ].join('\n');
  }

  private uniqueMatches(text: string, regex: RegExp, limit: number): string[] {
    return Array.from(new Set((text.match(regex) || []).map((match) => match.trim())))
      .filter(Boolean)
      .slice(0, limit);
  }

  private extractParties(title: string): string[] {
    const parts = title.split(/\s+v(?:s\.?|ersus)?\s+/i).map((part) => part.trim()).filter(Boolean);
    return parts.length > 1 ? parts.slice(0, 2) : [];
  }

  private extractCourt(text: string): string | null {
    const match = text.match(/\b(?:Supreme Court of India|High Court of [A-Za-z ]+|District Court of [A-Za-z ]+|National Company Law Tribunal|NCLT|NCLAT)\b/i);
    return match ? match[0] : null;
  }

  private extractIssueLikeLines(text: string): string[] {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return lines
      .filter((line) => /issue|whether|question/i.test(line))
      .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
      .filter((line) => line.length > 8)
      .slice(0, 8);
  }

  private extractBulletLikeLines(text: string, keywords: string[]): string[] {
    const pattern = new RegExp(keywords.join('|'), 'i');
    return text
      .split(/\r?\n|(?<=[.!?])\s+/)
      .map((line) => line.trim())
      .filter((line) => pattern.test(line) && line.length > 20)
      .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
      .slice(0, 8);
  }

  private extractSectionText(text: string, headings: string[]): string {
    const lines = text.split(/\r?\n/);
    const headingPattern = new RegExp(`^\\s*(${headings.join('|')})\\s*:?\\s*$`, 'i');
    const start = lines.findIndex((line) => headingPattern.test(line));
    if (start < 0) return '';

    const collected: string[] = [];
    for (const line of lines.slice(start + 1)) {
      if (/^[A-Z][A-Z\s]{3,}:?\s*$/.test(line.trim()) && collected.length > 0) break;
      if (line.trim()) collected.push(line.trim());
      if (collected.join(' ').length > 1200) break;
    }
    return collected.join(' ');
  }

  async generateStudyForgeForDocument(documentId: string, userId: string): Promise<any> {
    // Grounded validation: Ensure the Study Library has study materials
    const totalDocs = await this.listAll(userId);
    if (!totalDocs || totalDocs.length === 0) {
      throw new Error('Please upload study material first.');
    }

    const doc = await this.getOneForUser(documentId, userId);
    if (!doc) throw new Error('Document not found');
    if (!['Indexed', 'Ready', 'Indexed Successfully', 'Limited Text Extracted'].includes(doc.status)) {
      throw new Error('Document must finish extraction, chunking, and embedding before study assets can be generated.');
    }

    if (doc.studyForge && doc.studyForge.status === 'Ready') {
      this.logger.log(`[Study Forge] Returning cached study forge assets for document [${documentId}] instantly.`);
      return doc.studyForge;
    }

    await this.docRepo.update(documentId, { studyForge: this.buildStudyForgeProcessingState(doc.name) });
    const chunks = await this.getChunks(documentId);
    const text = chunks.map((chunk) => chunk.text).join('\n\n').trim();
    if (!text) throw new Error('No extracted document text is available for Study Forge generation.');

    const studyForge = await this.generateStudyForge(text, doc.name, userId, chunks);
    await this.docRepo.update(documentId, { studyForge });
    return studyForge;
  }

  async rateStudyForgeFlashcard(
    documentId: string,
    userId: string,
    cardId: string,
    rating: 'Hard' | 'Good' | 'Easy',
  ): Promise<any> {
    const doc = await this.getOneForUser(documentId, userId);
    if (!doc) throw new Error('Document not found');
    if (!doc.studyForge?.flashcards?.length) throw new Error('No generated flashcards exist for this document.');

    const now = new Date();
    const scoreDelta = rating === 'Hard' ? 0 : rating === 'Good' ? 8 : 14;
    const nextDays = rating === 'Hard' ? 1 : rating === 'Good' ? 3 : 7;
    const flashcards = doc.studyForge.flashcards.map((card) => {
      if ((card.id || card.q) !== cardId) return card;
      const reviews = Number(card.reviews || 0) + 1;
      const mastery = Math.min(100, Number(card.mastery || 0) + scoreDelta);
      return {
        ...card,
        reviews,
        lastRating: rating,
        mastery,
        nextReviewAt: new Date(now.getTime() + nextDays * 24 * 60 * 60 * 1000).toISOString(),
      };
    });

    const masteryScore = this.calculateMastery(flashcards, doc.studyForge?.progress?.quizAccuracy || 0);
    const studyForge = {
      ...doc.studyForge,
      flashcards,
      progress: {
        ...(doc.studyForge.progress || {}),
        masteryScore,
        flashcardsReviewed: flashcards.reduce((sum, card) => sum + Number(card.reviews || 0), 0),
        updatedAt: now.toISOString(),
      },
    };

    await this.docRepo.update(documentId, { studyForge });
    return studyForge;
  }

  async recordStudyForgeQuizAttempt(
    documentId: string,
    userId: string,
    answers: Record<string, number>,
  ): Promise<any> {
    const doc = await this.getOneForUser(documentId, userId);
    if (!doc) throw new Error('Document not found');
    const questions = doc.studyForge?.quizQuestions || [];
    if (!questions.length) throw new Error('No generated MCQs exist for this document.');

    let correct = 0;
    const weakTopics: string[] = [];
    questions.forEach((question, index) => {
      const selected = answers[String(index)] ?? answers[index];
      if (selected === question.correct) {
        correct += 1;
      } else {
        weakTopics.push(question.topic || question.type || 'Document concept');
      }
    });

    const accuracy = questions.length ? Math.round((correct / questions.length) * 100) : 0;
    const attempts = [
      ...(doc.studyForge.progress?.quizAttempts || []),
      { attemptedAt: new Date().toISOString(), correct, total: questions.length, accuracy, weakTopics },
    ].slice(-20);

    const updatedWeakAreas = Array.from(new Set([
      ...weakTopics,
      ...(doc.studyForge?.smartRevision?.weakAreas || [])
    ])).slice(0, 10);

    const baseOrder = doc.studyForge?.smartRevision?.revisionOrder || [];
    const ordered = Array.from(new Set([
      ...updatedWeakAreas,
      ...baseOrder
    ])).slice(0, 15);

    const studyForge = {
      ...doc.studyForge,
      smartRevision: {
        ...(doc.studyForge?.smartRevision || {}),
        weakAreas: updatedWeakAreas,
        revisionOrder: ordered
      },
      progress: {
        ...(doc.studyForge.progress || {}),
        lastScore: accuracy,
        quizAccuracy: accuracy,
        weakTopics: updatedWeakAreas,
        completion: Math.round((Object.keys(answers).length / questions.length) * 100),
        quizAttempts: attempts,
        masteryScore: this.calculateMastery(doc.studyForge.flashcards || [], accuracy),
        updatedAt: new Date().toISOString(),
      },
    };

    await this.docRepo.update(documentId, { studyForge });
    return studyForge;
  }

  private buildStudyForgeProcessingState(docName: string): any {
    return {
      status: 'Generating',
      generationStatus: 'Extracting text, chunking content, generating embeddings, storing context, and creating study assets.',
      sourceDocument: docName,
      flashcards: [],
      quizQuestions: [],
      revisionNotes: '',
      onePageNotes: '',
      topicSummary: [],
      memoryTricks: [],
      importantCases: [],
      importantSections: [],
      previousYearQuestions: [],
      expectedUniversityQuestions: [],
      difficultyLevels: [],
      personalizedWeakAreas: [],
      studyPlanner: [],
      studySchedule: [],
      adaptiveQuiz: [],
      generatedAt: null,
      progress: {
        masteryScore: 0,
        quizAccuracy: 0,
        completion: 0,
        weakTopics: [],
        flashcardsReviewed: 0,
      },
    };
  }

  private calculateMastery(flashcards: any[], quizAccuracy: number): number {
    const cardMastery = flashcards.length
      ? flashcards.reduce((sum, card) => sum + Number(card.mastery || 0), 0) / flashcards.length
      : 0;
    return Math.round(cardMastery * 0.65 + Number(quizAccuracy || 0) * 0.35);
  }

  // Smart Study Forge Automated Generation Engine
  async generateStudyForge(text: string, docName: string, userId?: string, chunks?: DocumentChunk[]): Promise<any> {
    const useExternalStudyForge = process.env.STUDY_FORGE_USE_LLM === 'true';
    if (!useExternalStudyForge) {
      this.logger.log('Generating Study Forge assets with the grounded uploaded-document engine.');
      return this.generateGroundedStudyForgeFallback(text, docName, chunks);
    }

    const systemPrompt = `You are an elite legal educator and expert compiler of legal study aids. Analyze only the provided uploaded document text and generate a comprehensive study kit containing:
1. 10 to 20 spaced repetition flashcards for definitions, articles, sections, case laws, principles, and important facts. Each flashcard MUST have a specific 'sourceDocument' and 'pageReference' representing where in the text it was found.
2. 10 to 20 multiple choice quiz questions (MCQs) with concept-based, case-based, fact-based, and scenario-based coverage, each containing 4 options, the 0-based index of the correct answer, a detailed explanation, and a specific 'source' reference pointing to the section or page.
3. Revision notes organized with sections for Topic-wise Notes, Definitions, Cases, and Sections.
4. One page notes representing an exam-ready summary.
5. Topic summary cards with a concise explanation of each major topic derived from the document.
6. Memory tricks that are grounded in the document's terminology, sections, or cases.
7. Important cases and important sections extracted from the uploaded text.
8. Previous year questions and expected university questions based on the document's content.
9. Difficulty levels for each major topic.
10. Personalized weak areas inferred from the uploaded material and document complexity.
11. A study planner and study schedule tailored to the document's main topics.
12. An adaptive quiz built from the document's own concepts and provisions.
13. Study deck consisting of topic cards. Each topic card should represent a topic and have a 'topic' name, 'summary', and 'keyPoints' (array of bullet strings).
14. Smart Revision Mode structure including 'revisionOrder' (array of topic names in priority order) and 'highYieldTopics' (array of objects with 'topic' and 'explanation' keys).

Ensure the output is EXACTLY in this JSON format:
{
  "status": "Ready",
  "generationStatus": "Generated from uploaded document content",
  "flashcards": [
    { "id": "fc_1", "category": "Definition|Article|Section|Case Law|Principle|Important Fact", "q": "Question text?", "a": "Answer text.", "sourceExcerpt": "Excerpt.", "sourceDocument": "${docName}", "pageReference": "Page X", "mastery": 0, "reviews": 0, "nextReviewAt": null }
  ],
  "quizQuestions": [
    { "type": "Concept Based|Case Based|Fact Based|Scenario Based", "topic": "Topic Name", "q": "Question text?", "opts": ["Opt 1", "Opt 2", "Opt 3", "Opt 4"], "correct": 1, "exp": "Explanation.", "source": "Section X or Page Y" }
  ],
  "revisionNotes": "# Topic-wise Notes\\n...\\n# Definitions\\n...\\n# Cases\\n...\\n# Sections\\n...",
  "onePageNotes": "# Exam-Ready Summary\\n...",
  "topicSummary": [{ "topic": "Topic Name", "summary": "Brief summary.", "keyPoints": ["Key point 1", "Key point 2"] }],
  "memoryTricks": ["Memory trick 1", "Memory trick 2"],
  "importantCases": [{ "caseName": "Case Name", "whyImportant": "Reason", "source": "Source reference" }],
  "importantSections": [{ "section": "Section X", "summary": "Why it matters", "source": "Source reference" }],
  "previousYearQuestions": ["Question 1", "Question 2"],
  "expectedUniversityQuestions": ["Question 1", "Question 2"],
  "difficultyLevels": [{ "topic": "Topic Name", "level": "Easy|Medium|Hard", "reason": "Reason" }],
  "personalizedWeakAreas": ["Topic that needs more attention"],
  "studyPlanner": [{ "day": "Day 1", "focus": "Topic", "tasks": ["Task 1", "Task 2"] }],
  "studySchedule": [{ "day": "Day 1", "topic": "Topic", "activity": "Activity" }],
  "adaptiveQuiz": [{ "id": "aq_1", "topic": "Topic Name", "q": "Question", "opts": ["Opt 1", "Opt 2", "Opt 3", "Opt 4"], "correct": 1, "exp": "Explanation", "difficulty": "Easy|Medium|Hard" }],
  "studyDeck": [
    { "id": "sd_1", "topic": "Topic Name", "summary": "Brief summary.", "keyPoints": ["Key point 1", "Key point 2"] }
  ],
  "smartRevision": {
    "revisionOrder": ["Topic Name 1", "Topic Name 2"],
    "highYieldTopics": [
      { "topic": "Topic Name 1", "explanation": "Why this topic is high yield." }
    ],
    "weakAreas": []
  },
  "progress": { "masteryScore": 0, "quizAccuracy": 0, "completion": 0, "weakTopics": [], "flashcardsReviewed": 0 }
}
Return ONLY raw valid JSON. Do not wrap in markdown blocks. Never invent facts outside the uploaded text. Every element must be fully grounded in the provided text.`;

    try {
      this.logger.log(`Attempting study forge generation via unified AI provider.`);
      const result = await this.aiProvider.complete({
        temperature: 0.2,
        maxTokens: 3000,
        module: 'studyforge',
        preferredModel: 'GPT-4o-Mini',
        jsonMode: true,
        userId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text.substring(0, 18000) }
        ]
      });

      let contentStr = result.content || '{}';
      if (contentStr.includes('```json')) {
        contentStr = contentStr.split('```json')[1].split('```')[0].trim();
      } else if (contentStr.includes('```')) {
        contentStr = contentStr.split('```')[1].split('```')[0].trim();
      }

      const extracted = JSON.parse(contentStr);
      if (extracted.flashcards && extracted.quizQuestions) {
        this.logger.log(`Study forge successfully generated.`);
        return this.normalizeStudyForge(extracted, docName, 'AI-generated from uploaded document content');
      }
    } catch (err: any) {
      this.logger.error(`Unified study generation failed: ${err.message}. Using grounded fallback...`);
    }

    this.logger.warn('No configured legal AI provider returned valid Study Forge JSON. Using grounded local generator.');
    return this.generateGroundedStudyForgeFallback(text, docName, chunks);
  }

  private normalizeStudyForge(raw: any, docName: string, generationStatus: string): any {
    const now = new Date().toISOString();
    const flashcards = (raw.flashcards || []).map((card, index) => ({
      id: card.id || `fc_${index + 1}`,
      category: card.category || 'Document Concept',
      q: String(card.q || card.question || '').trim(),
      a: String(card.a || card.answer || '').trim(),
      sourceExcerpt: String(card.sourceExcerpt || card.source || card.a || card.answer || '').trim(),
      sourceDocument: String(card.sourceDocument || docName).trim(),
      pageReference: String(card.pageReference || 'Page 1').trim(),
      mastery: Number(card.mastery || 0),
      reviews: Number(card.reviews || 0),
      nextReviewAt: card.nextReviewAt || null,
    })).filter((card) => card.q && card.a);

    const quizQuestions = (raw.quizQuestions || raw.mcqs || []).map((question, index) => ({
      type: question.type || ['Concept Based', 'Case Based', 'Fact Based', 'Scenario Based'][index % 4],
      topic: question.topic || 'Document concept',
      q: String(question.q || question.question || '').trim(),
      opts: Array.isArray(question.opts || question.options) ? (question.opts || question.options).slice(0, 4) : [],
      correct: Number.isInteger(question.correct) ? question.correct : 0,
      exp: String(question.exp || question.explanation || '').trim(),
      source: String(question.source || question.exp || 'Document content').trim(),
    })).filter((question) => question.q && question.opts.length === 4);

    const studyDeck = (raw.studyDeck || []).map((deck, index) => ({
      id: deck.id || `sd_${index + 1}`,
      topic: String(deck.topic || 'General Topic').trim(),
      summary: String(deck.summary || 'Summary not provided').trim(),
      keyPoints: Array.isArray(deck.keyPoints) ? deck.keyPoints.map(p => String(p).trim()) : [],
    }));

    const smartRevision = {
      revisionOrder: Array.isArray(raw.smartRevision?.revisionOrder) ? raw.smartRevision.revisionOrder.map(t => String(t).trim()) : [],
      highYieldTopics: Array.isArray(raw.smartRevision?.highYieldTopics) ? raw.smartRevision.highYieldTopics.map(h => ({
        topic: String(h.topic || '').trim(),
        explanation: String(h.explanation || '').trim()
      })).filter(h => h.topic) : [],
      weakAreas: Array.isArray(raw.smartRevision?.weakAreas) ? raw.smartRevision.weakAreas.map(t => String(t).trim()) : []
    };

    // Self-healing check for empty structures
    if (studyDeck.length === 0) {
      const uniqueTopics = Array.from(new Set([
        ...flashcards.map(c => c.category),
        ...quizQuestions.map(q => q.topic)
      ])).filter((t) => t && t !== 'Document concept' && t !== 'Document Concept').slice(0, 5);
      
      uniqueTopics.forEach((topic, idx) => {
        studyDeck.push({
          id: `sd_${idx + 1}`,
          topic,
          summary: `Core concepts and key rules related to ${topic}.`,
          keyPoints: flashcards.filter(c => c.category === topic).slice(0, 3).map(c => c.q)
        });
      });
      if (studyDeck.length === 0) {
        studyDeck.push({
          id: 'sd_1',
          topic: 'Key Legal Summary',
          summary: `General outline of legal concepts derived from ${docName}.`,
          keyPoints: flashcards.slice(0, 3).map(c => c.q)
        });
      }
    }

    if (smartRevision.highYieldTopics.length === 0) {
      smartRevision.highYieldTopics = studyDeck.map(deck => ({
        topic: deck.topic,
        explanation: `Frequently referenced in interpretations and case references within the document.`
      }));
    }

    if (smartRevision.revisionOrder.length === 0) {
      smartRevision.revisionOrder = studyDeck.map(deck => deck.topic);
    }

    const topicSummary = Array.isArray(raw.topicSummary) ? raw.topicSummary.map((item, index) => ({
      topic: String(item.topic || item.title || `Topic ${index + 1}`).trim(),
      summary: String(item.summary || item.description || '').trim(),
      keyPoints: Array.isArray(item.keyPoints) ? item.keyPoints.map((point: any) => String(point).trim()).filter(Boolean) : [],
    })).filter((item) => item.topic) : [];

    const memoryTricks = Array.isArray(raw.memoryTricks)
      ? raw.memoryTricks.map((item: any) => String(item).trim()).filter(Boolean)
      : [];

    const importantCases = Array.isArray(raw.importantCases)
      ? raw.importantCases.map((item: any) => ({
          caseName: String(item.caseName || item.name || item.title || '').trim(),
          whyImportant: String(item.whyImportant || item.reason || item.summary || '').trim(),
          source: String(item.source || docName).trim(),
        })).filter((item) => item.caseName)
      : [];

    const importantSections = Array.isArray(raw.importantSections)
      ? raw.importantSections.map((item: any) => ({
          section: String(item.section || item.heading || item.title || '').trim(),
          summary: String(item.summary || item.description || '').trim(),
          source: String(item.source || docName).trim(),
        })).filter((item) => item.section)
      : [];

    const previousYearQuestions = Array.isArray(raw.previousYearQuestions)
      ? raw.previousYearQuestions.map((item: any) => String(item).trim()).filter(Boolean)
      : [];

    const expectedUniversityQuestions = Array.isArray(raw.expectedUniversityQuestions)
      ? raw.expectedUniversityQuestions.map((item: any) => String(item).trim()).filter(Boolean)
      : [];

    const difficultyLevels = Array.isArray(raw.difficultyLevels)
      ? raw.difficultyLevels.map((item: any) => ({
          topic: String(item.topic || '').trim(),
          level: String(item.level || 'Medium').trim(),
          reason: String(item.reason || '').trim(),
        })).filter((item) => item.topic)
      : [];

    const personalizedWeakAreas = Array.isArray(raw.personalizedWeakAreas)
      ? raw.personalizedWeakAreas.map((item: any) => String(item).trim()).filter(Boolean)
      : [];

    const studyPlanner = Array.isArray(raw.studyPlanner)
      ? raw.studyPlanner.map((item: any) => ({
          day: String(item.day || item.title || '').trim(),
          focus: String(item.focus || item.topic || '').trim(),
          tasks: Array.isArray(item.tasks) ? item.tasks.map((task: any) => String(task).trim()).filter(Boolean) : [],
        })).filter((item) => item.day || item.focus)
      : [];

    const studySchedule = Array.isArray(raw.studySchedule)
      ? raw.studySchedule.map((item: any) => ({
          day: String(item.day || '').trim(),
          topic: String(item.topic || '').trim(),
          activity: String(item.activity || '').trim(),
        })).filter((item) => item.day || item.topic)
      : [];

    const adaptiveQuiz = Array.isArray(raw.adaptiveQuiz)
      ? raw.adaptiveQuiz.map((item: any, index: number) => ({
          id: String(item.id || `aq_${index + 1}`).trim(),
          topic: String(item.topic || '').trim(),
          q: String(item.q || item.question || '').trim(),
          opts: Array.isArray(item.opts || item.options) ? (item.opts || item.options).slice(0, 4).map((opt: any) => String(opt).trim()).filter(Boolean) : [],
          correct: Number.isInteger(item.correct) ? item.correct : 0,
          exp: String(item.exp || item.explanation || '').trim(),
          difficulty: String(item.difficulty || 'Medium').trim(),
        })).filter((item) => item.q && item.opts.length === 4)
      : [];

    return {
      status: 'Ready',
      generationStatus,
      sourceDocument: docName,
      flashcards,
      quizQuestions,
      revisionNotes: String(raw.revisionNotes || '').trim(),
      onePageNotes: String(raw.onePageNotes || '').trim(),
      topicSummary,
      memoryTricks,
      importantCases,
      importantSections,
      previousYearQuestions,
      expectedUniversityQuestions,
      difficultyLevels,
      personalizedWeakAreas,
      studyPlanner,
      studySchedule,
      adaptiveQuiz,
      studyDeck,
      smartRevision,
      generatedAt: now,
      progress: {
        masteryScore: 0,
        quizAccuracy: 0,
        completion: 0,
        weakTopics: [],
        flashcardsReviewed: 0,
        ...(raw.progress || {}),
      },
    };
  }

  private generateGroundedStudyForgeFallback(text: string, docName: string, chunks?: DocumentChunk[]): any {
    const sentenceMappings: { text: string; pageNumber: number }[] = [];
    const chunkList = chunks || [];
    
    chunkList.forEach(chunk => {
      const sentencesInChunk = chunk.text
        .replace(/\s+/g, ' ')
        .trim()
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length >= 45 && s.length <= 320);
      
      sentencesInChunk.forEach(s => {
        sentenceMappings.push({ text: s, pageNumber: chunk.pageNumber || 1 });
      });
    });

    // Fallback if no matching sentences parsed
    if (sentenceMappings.length === 0) {
      const normalized = text.replace(/\s+/g, ' ').trim();
      const sentencesRaw = normalized
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length >= 45 && sentence.length <= 320);
        
      sentencesRaw.forEach(s => {
        sentenceMappings.push({ text: s, pageNumber: 1 });
      });
    }

    if (sentenceMappings.length === 0) {
      // Emergency fallback if text is extremely short
      const segments = text.split('\n').map(s => s.trim()).filter(s => s.length > 10);
      segments.forEach(s => {
        sentenceMappings.push({ text: s.slice(0, 200), pageNumber: 1 });
      });
    }

    if (sentenceMappings.length === 0) {
      throw new Error('Uploaded document text is too short to generate study assets.');
    }

    const sentences = sentenceMappings.map(m => m.text);
    const findPageForSentence = (sentenceText: string): string => {
      const match = sentenceMappings.find(m => m.text === sentenceText);
      return match ? `Page ${match.pageNumber}` : 'Page 1';
    };

    const normalized = text.replace(/\s+/g, ' ').trim();
    const articles = this.uniqueMatches(normalized, /\bArticle\s+\d+[A-Z]?(?:\(\d+\))?(?:\([a-z]\))?/gi, 12);
    const sections = this.uniqueMatches(normalized, /\bSection\s+\d+[A-Z]?(?:\(\d+\))?/gi, 12);
    const cases = this.uniqueMatches(normalized, /\b[A-Z][A-Za-z.&() ]+\s+v(?:s\.?|ersus)?\s+[A-Z][A-Za-z.&() ]+(?:\(\d{4}\))?/g, 10);
    const definitionLines = this.uniqueStudyLines(sentences.filter((sentence) => /\bmeans\b|\bdefined as\b|\brefers to\b/i.test(sentence))).slice(0, 8);
    const targetCount = Math.min(20, Math.max(10, sentences.length));
    const principleLines = this.uniqueStudyLines(sentences.filter((sentence) => /\bheld\b|\bprinciple\b|\bdoctrine\b|\bratio\b|\brequires\b|\bmust\b|\bshall\b/i.test(sentence))).slice(0, 12);
    const factLines = this.uniqueStudyLines(sentences.filter((sentence) => /\bfact\b|\bpetitioner\b|\brespondent\b|\bappellant\b|\bcourt\b|\bcontract\b|\bagreement\b|\bconstitution\b|\bamendment\b|\bgovernment\b/i.test(sentence))).slice(0, 10);

    const flashcards: any[] = [];
    const usedQuestions = new Set<string>();
    const usedAnswers = new Set<string>();
    
    const addCard = (category: string, q: string, a: string) => {
      if (!q || !a || flashcards.length >= 20) return;
      const questionKey = this.studyKey(q);
      const answerKey = this.studyKey(a);
      if (usedQuestions.has(questionKey) || usedAnswers.has(answerKey)) return;
      usedQuestions.add(questionKey);
      usedAnswers.add(answerKey);
      flashcards.push({
        id: `fc_${flashcards.length + 1}`,
        category,
        q,
        a,
        sourceExcerpt: a,
        sourceDocument: docName,
        pageReference: findPageForSentence(a),
        mastery: 0,
        reviews: 0,
        nextReviewAt: null,
      });
    };

    definitionLines.forEach((line) => addCard('Definition', `Define or explain this term from the uploaded document: ${this.extractDefinitionTopic(line)}`, line));
    articles.forEach((article) => addCard('Article', `According to the uploaded document, what is stated in the passage mentioning ${article}?`, this.findSentenceContaining(sentences, article)));
    sections.forEach((section) => addCard('Section', `According to the uploaded document, what is stated in the passage mentioning ${section}?`, this.findSentenceContaining(sentences, section)));
    cases.forEach((caseName) => addCard('Case Law', `According to the uploaded document, why is ${caseName} relevant?`, this.findSentenceContaining(sentences, caseName)));
    principleLines.forEach((line) => addCard('Principle', `What principle is tested by: "${this.shorten(line, 70)}"?`, line));
    factLines.forEach((line) => addCard('Important Fact', `What important fact should you remember from: "${this.shorten(line, 70)}"?`, line));

    while (flashcards.length < targetCount) {
      const line = sentences.find((sentence) => !usedAnswers.has(this.studyKey(sentence))) || sentences[flashcards.length % sentences.length];
      if (usedAnswers.has(this.studyKey(line))) break;
      addCard('Important Fact', `What is the key takeaway from this passage: "${this.shorten(line, 70)}"?`, line);
    }

    const quizSources = [...principleLines, ...factLines, ...sentences];
    while (quizSources.length < targetCount) {
      quizSources.push(sentences[quizSources.length % sentences.length]);
    }
    const selectedQuizSources = quizSources.slice(0, targetCount);
    const quizQuestions = selectedQuizSources.map((source, index) => {
      const topic = this.extractTopic(source);
      const types = ['Concept Based', 'Case Based', 'Fact Based', 'Scenario Based'];
      const correct = index % 4;
      const correctOption = this.shorten(source, 130);
      const distractors = this.buildDistractors(sentences, source, 3);
      const opts = [correctOption, ...distractors];
      const rotated = [...opts.slice(0, 4)];
      const answer = rotated.splice(0, 1)[0];
      rotated.splice(correct, 0, answer);
      return {
        type: types[index % types.length],
        topic,
        q: `${types[index % types.length]}: According to the uploaded document, which statement is correct about ${topic}?`,
        opts: rotated,
        correct,
        exp: `Source excerpt: ${source}`,
        source: `${docName} - ${findPageForSentence(source)}`
      };
    });

    const keyPoints = sentences.slice(0, 10).map((sentence) => `- ${sentence}`).join('\n');
    const revisionNotes = [
      `# Revision Notes: ${docName}`,
      '',
      '## Topic-wise Notes',
      sentences.slice(0, 6).map((sentence) => `- **${this.extractTopic(sentence)}**: ${sentence}`).join('\n'),
      '',
      '## Definitions',
      definitionLines.length ? definitionLines.map((line) => `- **${this.extractDefinitionTopic(line)}**: ${line}`).join('\n') : '- No definitions could be explicitly parsed.',
      '',
      '## Cases',
      cases.length ? cases.map((item) => `- **${item}**: ${this.findSentenceContaining(sentences, item)}`).join('\n') : '- No case names were explicitly detected in the uploaded text.',
      '',
      '## Sections',
      sections.length ? sections.map((item) => `- **${item}**: ${this.findSentenceContaining(sentences, item)}`).join('\n') : '- No statutory sections were explicitly detected in the uploaded text.',
      '',
      '## Important Articles',
      articles.length ? articles.map((item) => `- ${item}`).join('\n') : '- No constitutional articles were explicitly detected in the uploaded text.',
      '',
      '## Critical Concepts',
      principleLines.slice(0, 6).map((sentence) => `- ${sentence}`).join('\n') || keyPoints,
    ].join('\n');

    const onePageNotes = [
      `# One Page Quick Revision: ${docName}`,
      '',
      '## High Yield Concepts',
      ...sentences.slice(0, 5).map((sentence) => `- ${sentence}`),
      '',
      '## Most Important Cases',
      ...(cases.length ? cases.slice(0, 5).map((item) => `- ${item}`) : ['- Not expressly detected in the uploaded text.']),
      '',
      '## Most Important Articles / Sections',
      ...[...articles.slice(0, 5), ...sections.slice(0, 5)].map((item) => `- ${item}`),
      '',
      '## Exam Quick Sheet',
      ...principleLines.slice(0, 5).map((sentence) => `- ${sentence}`),
    ].join('\n');

    const studyDeck: any[] = [];
    const uniqueTopics = Array.from(new Set([
      ...definitionLines.map(line => this.extractDefinitionTopic(line)),
      ...cases,
      ...articles,
      ...sections
    ])).filter(Boolean).slice(0, 6);

    uniqueTopics.forEach((topic, idx) => {
      const relatedSentences = sentences.filter(s => s.toLowerCase().includes(topic.toLowerCase()));
      const kp = relatedSentences.slice(0, 3);
      if (kp.length === 0) {
        kp.push(this.findSentenceContaining(sentences, topic));
      }
      studyDeck.push({
        id: `sd_${idx + 1}`,
        topic,
        summary: `Key legal concepts and rules surrounding ${topic}.`,
        keyPoints: kp.map(item => this.shorten(item, 150))
      });
    });

    if (studyDeck.length === 0) {
      studyDeck.push({
        id: 'sd_1',
        topic: 'Executive Summary',
        summary: `General legal framework outlined in ${docName}.`,
        keyPoints: sentences.slice(0, 3).map(kp => this.shorten(kp, 150))
      });
    }

    const topicSummary = studyDeck.map(deck => ({
      topic: deck.topic,
      summary: deck.summary,
      keyPoints: deck.keyPoints.slice(0, 3),
    }));

    const memoryTricks = [
      ...studyDeck.slice(0, 4).map((deck) => `Remember ${deck.topic} by linking it to the central passage in the uploaded document.`),
      ...(sections.length ? [`Use ${sections[0]} as the anchor point when revising the statutory rule.`] : []),
      ...(cases.length ? [`Link ${cases[0]} to the core proposition stated in the uploaded material.`] : []),
    ].slice(0, 6);

    const importantCases = cases.slice(0, 6).map((caseName) => ({
      caseName,
      whyImportant: this.findSentenceContaining(sentences, caseName),
      source: `${docName} - ${findPageForSentence(this.findSentenceContaining(sentences, caseName))}`,
    }));

    const importantSections = [...articles.slice(0, 4), ...sections.slice(0, 4)].map((item) => ({
      section: item,
      summary: this.findSentenceContaining(sentences, item),
      source: `${docName} - ${findPageForSentence(this.findSentenceContaining(sentences, item))}`,
    })).slice(0, 8);

    const previousYearQuestions = [
      ...studyDeck.slice(0, 4).map((deck) => `Discuss the legal significance of ${deck.topic} as explained in the uploaded document.`),
      ...(importantSections.length ? [`Explain the relevance of ${importantSections[0].section} in the context of the uploaded material.`] : []),
    ].slice(0, 6);

    const expectedUniversityQuestions = [
      ...studyDeck.slice(0, 4).map((deck) => `How would you answer an university-style question on ${deck.topic} based solely on the uploaded document?`),
      ...(importantCases.length ? [`Analyse the role of ${importantCases[0].caseName} in the uploaded material.`] : []),
    ].slice(0, 6);

    const difficultyLevels = studyDeck.map((deck) => ({
      topic: deck.topic,
      level: deck.topic.includes('Section') || deck.topic.includes('Article') || deck.keyPoints.length > 2 ? 'Hard' : 'Medium',
      reason: `The uploaded document gives a moderately detailed treatment of ${deck.topic}.`,
    })).slice(0, 6);

    const personalizedWeakAreas = studyDeck.filter((deck) => deck.keyPoints.length > 2).map((deck) => deck.topic).slice(0, 5);

    const studyPlanner = studyDeck.slice(0, 5).map((deck, index) => ({
      day: `Day ${index + 1}`,
      focus: deck.topic,
      tasks: [
        `Read the main explanation for ${deck.topic}`,
        `Revise the related flashcards and one-page notes for ${deck.topic}`,
      ],
    }));

    const studySchedule = studyPlanner.map((plan) => ({
      day: plan.day,
      topic: plan.focus,
      activity: `Review ${plan.focus} and complete the related quiz questions`,
    }));

    const adaptiveQuiz = quizQuestions.slice(0, 6).map((question, index) => ({
      id: `aq_${index + 1}`,
      topic: question.topic,
      q: question.q,
      opts: question.opts,
      correct: question.correct,
      exp: question.exp,
      difficulty: difficultyLevels[index]?.level || 'Medium',
    }));

    const highYieldTopics = studyDeck.map(deck => ({
      topic: deck.topic,
      explanation: `Frequently referenced in case interpretations and statutory applications in the uploaded document.`
    }));

    const smartRevision = {
      revisionOrder: studyDeck.map(deck => deck.topic),
      highYieldTopics,
      weakAreas: personalizedWeakAreas,
    };

    return this.normalizeStudyForge(
      {
        flashcards,
        quizQuestions,
        revisionNotes,
        onePageNotes,
        topicSummary,
        memoryTricks,
        importantCases,
        importantSections,
        previousYearQuestions,
        expectedUniversityQuestions,
        difficultyLevels,
        personalizedWeakAreas,
        studyPlanner,
        studySchedule,
        adaptiveQuiz,
        studyDeck,
        smartRevision,
      },
      docName,
      'Generated from uploaded document content using the local grounded study engine',
    );
  }

  private findSentenceContaining(sentences: string[], term: string): string {
    return sentences.find((sentence) => sentence.toLowerCase().includes(term.toLowerCase())) || term;
  }

  private uniqueStudyLines(lines: string[]): string[] {
    const seen = new Set<string>();
    return lines.filter((line) => {
      const key = this.studyKey(line);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private studyKey(value: string): string {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(?:according|uploaded|document|which|what|from|this|that|should|remembered|source|excerpt)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
  }

  private extractDefinitionTopic(line: string): string {
    const compact = this.shorten(line.replace(/\s+/g, ' ').trim(), 140);
    const quoted = compact.match(/["“']([^"”']{3,80})["”']/);
    if (quoted) return quoted[1].trim();

    const meansMatch = compact.match(/\b([A-Z][A-Za-z0-9 ,()/-]{2,80}?)\s+(?:means|refers to|is defined as)\b/i);
    if (meansMatch) {
      return this.shorten(meansMatch[1].replace(/^(the|a|an)\s+/i, '').trim(), 70);
    }

    const legalRef = compact.match(/\b(?:Article|Section|Part|Schedule)\s+[A-Za-z0-9()/-]+/i);
    if (legalRef) return legalRef[0];

    return this.extractTopic(compact);
  }

  private extractTopic(sentence: string): string {
    const match = sentence.match(/\b(?:Article|Section)\s+\d+[A-Z]?(?:\(\d+\))?/i);
    if (match) return match[0];
    return this.shorten(sentence.replace(/[^a-zA-Z0-9\s]/g, ' ').trim(), 48) || 'document concept';
  }

  private shorten(value: string, limit: number): string {
    const trimmed = String(value || '').replace(/\s+/g, ' ').trim();
    return trimmed.length > limit ? `${trimmed.slice(0, limit - 3)}...` : trimmed;
  }

  private buildDistractors(sentences: string[], source: string, count: number): string[] {
    const distractors = sentences
      .filter((sentence) => sentence !== source)
      .map((sentence) => this.shorten(sentence, 120))
      .filter(Boolean)
      .slice(0, count);
    while (distractors.length < count) {
      distractors.push(this.shorten(sentences[distractors.length % sentences.length] || source, 120));
    }
    return distractors;
  }

  async getDocumentIntelligence(
    documentId: string,
    action: string,
    userId: string,
    targetDocumentId?: string,
  ): Promise<any> {
    const doc = await this.getOneForUser(documentId, userId);
    if (!doc) {
      throw new Error('Document not found');
    }

    const chunks = await this.getChunks(documentId);
    const text = chunks.map((c) => c.text).join('\n\n').trim();

    let systemPrompt = '';
    let userText = `Document Name: ${doc.name}\n\nDocument Excerpt:\n${text.substring(0, 20000)}`;

    switch (action) {
      case 'summary':
        systemPrompt = `You are an elite legal intelligence assistant. Analyze the provided legal document and return a detailed, professional executive summary. Identify: 1) Document Type and Governing Law, 2) Key Background & Context, 3) Primary Obligations, Holdings, or Statutory Provisions, 4) Final Outcomes, reliefs, or conclusions. Format the response beautifully using Markdown.`;
        break;
      case 'important_clauses':
        systemPrompt = `You are a corporate legal counsel. Extract and analyze the most important clauses from the document (such as Liability, Indemnification, Termination, Warranties, Governing Law, Force Majeure, or key covenants). For each clause: 1) State the clause topic, 2) Quote or reference the specific section, 3) Explain the legal implication and business effect. Format clearly with headers in Markdown.`;
        break;
      case 'important_dates':
        systemPrompt = `You are a legal analyst. Extract all important dates (effective dates, termination dates, signing dates, filing dates, deadlines, or historical dates mentioned). For each date, list: 1) The exact date, 2) The associated event, obligation, or deadline. Format as a Markdown list or table.`;
        break;
      case 'important_persons':
        systemPrompt = `You are a legal researcher. Extract all key persons, entities, corporations, judges, advocates, or government bodies mentioned. List each entity and briefly explain their role, capacity, or significance within this document.`;
        break;
      case 'important_sections':
        systemPrompt = `You are a statutory analyst. Extract all specific legal acts, statutes, constitutional articles, section numbers, or regulatory provisions referenced in the text. For each section/act, summarize its relevance and application to the document.`;
        break;
      case 'important_definitions':
        systemPrompt = `You are a contract drafting specialist. Extract all key defined terms and definitions from the document. List the term and its exact defined meaning in a clear glossary-style Markdown layout.`;
        break;
      case 'risk_detection':
        systemPrompt = `You are a compliance officer and risk assessment specialist. Audit the document for potential liabilities, compliance risks, ambiguous terms, asymmetric obligations, or high-risk clauses. For each risk found: 1) Explain the risk, 2) Rate its severity (Low/Medium/High), 3) Recommend a mitigation strategy. Format with clear alert blocks.`;
        break;
      case 'entity_extraction':
        systemPrompt = `You are a legal data engineer. Extract all key named entities from the text and present them categorized in a clean, structured Markdown table. Categories should include: Parties, Jurisdiction/Courts, Referenced Statutes/Acts, Citations, and Organizations.`;
        break;
      case 'document_comparison': {
        if (!targetDocumentId) {
          throw new Error('Target document ID is required for comparison.');
        }
        const targetDoc = await this.getOneForUser(targetDocumentId, userId);
        if (!targetDoc) {
          throw new Error('Target document not found.');
        }
        const targetChunks = await this.getChunks(targetDocumentId);
        const targetText = targetChunks.map((c) => c.text).join('\n\n').trim();

        systemPrompt = `You are an elite legal intelligence analyst. Compare Document A and Document B. Perform a side-by-side comparative analysis. Highlight: 1) Key differences in covenants, obligations, or holdings, 2) Conflicting terms or provisions, 3) Liability differences, 4) Summary of which document is more favorable/precedential. Format with headers and tables.`;
        userText = `Document A Name: ${doc.name}\nDocument A Excerpt:\n${text.substring(0, 10000)}\n\nDocument B Name: ${targetDoc.name}\nDocument B Excerpt:\n${targetText.substring(0, 10000)}`;
        break;
      }
      case 'document_similarity': {
        if (!targetDocumentId) {
          throw new Error('Target document ID is required for similarity analysis.');
        }
        const targetDoc = await this.getOneForUser(targetDocumentId, userId);
        if (!targetDoc) {
          throw new Error('Target document not found.');
        }
        const targetChunks = await this.getChunks(targetDocumentId);
        const targetText = targetChunks.map((c) => c.text).join('\n\n').trim();

        systemPrompt = `You are a legal AI similarity analyst. Compare Document A and Document B. Provide: 1) A clear numerical similarity percentage score (0% to 100%), 2) Detailed reasoning explaining the structural, thematic, and legal overlap or divergence. Format in clean Markdown.`;
        userText = `Document A Name: ${doc.name}\nDocument A Excerpt:\n${text.substring(0, 10000)}\n\nDocument B Name: ${targetDoc.name}\nDocument B Excerpt:\n${targetText.substring(0, 10000)}`;
        break;
      }
      default:
        throw new Error(`Unsupported document intelligence action: ${action}`);
    }

    const response = await this.aiProvider.complete({
      temperature: 0.1,
      maxTokens: 3000,
      module: 'notebook',
      preferredModel: 'GPT-4o-Mini',
      userId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
    });

    return {
      action,
      documentId,
      targetDocumentId,
      result: response.content || 'Analysis failed to generate.',
    };
  }
}







