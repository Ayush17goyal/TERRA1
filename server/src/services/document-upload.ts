import { DocumentProcessor, ExtractedContent, DocumentMetadata } from './document-processor';
import { VectorStoreService } from './vector-store';

export interface UploadResult {
  success: boolean;
  documentId: string;
  fileName: string;
  documentType: string;
  extractedWordCount: number;
  chunkCount: number;
  qualityScore: number;
  vectorsStored: number;
  extractionStatus: string;
  message: string;
  previewContent: string;
  metadata: DocumentMetadata;
  error?: string;
}

export class DocumentUploadService {
  constructor(
    private documentProcessor: DocumentProcessor,
    private vectorStore: VectorStoreService
  ) {}

  /**
   * Process uploaded document end-to-end
   */
  async processUpload(
    fileBuffer: Buffer,
    fileName: string,
    documentType: string,
    userId: string
  ): Promise<UploadResult> {
    const startTime = Date.now();
    const documentId = this.generateDocumentId();

    try {
      // Step 1: Extract text based on file type
      const fileType = this.documentProcessor.normalizeFileType(fileName);
      let extractedContent: ExtractedContent;

      switch (fileType) {
        case 'PDF':
          extractedContent = await this.documentProcessor.extractFromPDF(fileBuffer, fileName);
          break;
        case 'DOCX':
          extractedContent = await this.documentProcessor.extractFromDOCX(fileBuffer, fileName);
          break;
        case 'TXT':
        case 'MD':
          extractedContent = await this.documentProcessor.extractFromText(fileBuffer, fileName);
          break;
        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

      // Step 2: Validate extraction quality
      const validation = this.documentProcessor.validateExtraction(
        extractedContent.text,
        extractedContent.metadata
      );

      if (!validation.isValid) {
        return {
          success: false,
          documentId,
          fileName,
          documentType,
          extractedWordCount: 0,
          chunkCount: 0,
          qualityScore: validation.qualityScore,
          vectorsStored: 0,
          extractionStatus: 'Extraction Failed',
          message: `Extraction failed: ${validation.message}`,
          previewContent: '',
          metadata: extractedContent.metadata,
          error: validation.message,
        };
      }

      // Step 3: Create intelligent chunks
      const chunks = this.documentProcessor.createChunks(
        extractedContent.text,
        documentId,
        fileName,
        { chunkSize: 2000, overlapSize: 300 }
      );

      if (chunks.length === 0) {
        return {
          success: false,
          documentId,
          fileName,
          documentType,
          extractedWordCount: 0,
          chunkCount: 0,
          qualityScore: validation.qualityScore,
          vectorsStored: 0,
          extractionStatus: 'Chunking Failed',
          message: 'Failed to create document chunks',
          previewContent: '',
          metadata: extractedContent.metadata,
          error: 'No chunks created',
        };
      }

      // Step 4: Store vectors in vector database
      const vectorStoreResult = await this.vectorStore.storeChunks(
        documentId,
        chunks,
        {
          document_type: documentType,
          user_id: userId,
          source_file: fileName,
          quality_score: validation.qualityScore,
        }
      );

      if (!vectorStoreResult.success) {
        console.warn(`Vector storage failed: ${vectorStoreResult.error}`);
        // Continue without vectors - document is still indexed in SQL
      }

      // Step 5: Prepare result
      const wordCount = extractedContent.text.split(/\s+/).filter(Boolean).length;
      const processingTime = Date.now() - startTime;

      return {
        success: true,
        documentId,
        fileName,
        documentType,
        extractedWordCount: wordCount,
        chunkCount: chunks.length,
        qualityScore: validation.qualityScore,
        vectorsStored: vectorStoreResult.vectorsGenerated || 0,
        extractionStatus: 'Indexed Successfully',
        message: `Document processed successfully in ${processingTime}ms. ${chunks.length} chunks created with embeddings.`,
        previewContent: extractedContent.text.slice(0, 1200),
        metadata: extractedContent.metadata,
      };
    } catch (error: any) {
      console.error(`Document upload failed: ${error.message}`);
      return {
        success: false,
        documentId,
        fileName,
        documentType,
        extractedWordCount: 0,
        chunkCount: 0,
        qualityScore: 0,
        vectorsStored: 0,
        extractionStatus: 'Error',
        message: `Processing error: ${error.message}`,
        previewContent: '',
        metadata: {
          fileName,
          fileType: this.documentProcessor.normalizeFileType(fileName),
          fileSize: fileBuffer.length,
          uploadedAt: new Date().toISOString(),
        },
        error: error.message,
      };
    }
  }

  /**
   * Generate unique document ID
   */
  private generateDocumentId(): string {
    const prefix = 'doc';
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 10);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Count words in text
   */
  countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
}
