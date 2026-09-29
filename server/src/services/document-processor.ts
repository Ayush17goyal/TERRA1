import { Injectable, Logger } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';

export interface DocumentMetadata {
  fileName: string;
  fileType: 'PDF' | 'DOCX' | 'TXT' | 'MD' | 'UNKNOWN';
  fileSize: number;
  uploadedAt: string;
  pageCount?: number;
  language?: string;
  isScanned?: boolean;
  confidence?: number;
  extractionMethod?: string;
}

export interface ExtractedContent {
  text: string;
  metadata: DocumentMetadata;
  isScanned: boolean;
  hasImages: boolean;
  language: string;
}

export interface DocumentChunk {
  id: string;
  text: string;
  pageNumber: number;
  chunkIndex: number;
  confidence: number;
  startOffset: number;
  endOffset: number;
}

@Injectable()
export class DocumentProcessor {
  private readonly logger = new Logger(DocumentProcessor.name);

  /**
   * Extract text from PDF buffer
   */
  async extractFromPDF(buffer: Buffer, fileName: string): Promise<ExtractedContent> {
    try {
      const pdfData = await pdfParse(buffer);
      const text = String(pdfData.text || '').trim();
      
      // Detect if scanned (low text-to-image ratio or specific markers)
      const isScanned = this.isScannedPDF(text, pdfData);
      
      return {
        text,
        metadata: {
          fileName,
          fileType: 'PDF',
          fileSize: buffer.length,
          uploadedAt: new Date().toISOString(),
          pageCount: pdfData.numpages || 1,
          isScanned,
          extractionMethod: isScanned ? 'OCR_FALLBACK' : 'PDF_TEXT_EXTRACTION',
          confidence: isScanned ? 0.75 : 0.95,
        },
        isScanned,
        hasImages: Boolean(pdfData.version),
        language: 'en',
      };
    } catch (error: any) {
      this.logger.error(`PDF extraction failed: ${error.message}`);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  /**
   * Extract text from DOCX buffer
   */
  async extractFromDOCX(buffer: Buffer, fileName: string): Promise<ExtractedContent> {
    try {
      const { Document } = await import('docx');
      
      // For proper DOCX parsing, we need to use xml2js or unzip approach
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(buffer);
      
      let text = '';
      try {
        const documentXml = zip.readAsText('word/document.xml');
        // Extract text between XML tags
        text = this.extractTextFromDocumentXml(documentXml);
      } catch {
        // Fallback: extract all readable text
        text = buffer
          .toString('utf8')
          .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      return {
        text: text.trim(),
        metadata: {
          fileName,
          fileType: 'DOCX',
          fileSize: buffer.length,
          uploadedAt: new Date().toISOString(),
          extractionMethod: 'DOCX_XML_PARSING',
          confidence: 0.9,
        },
        isScanned: false,
        hasImages: false,
        language: 'en',
      };
    } catch (error: any) {
      this.logger.error(`DOCX extraction failed: ${error.message}`);
      throw new Error(`Failed to extract text from DOCX: ${error.message}`);
    }
  }

  /**
   * Extract text from plain text files
   */
  async extractFromText(buffer: Buffer, fileName: string): Promise<ExtractedContent> {
    try {
      const text = buffer.toString('utf8').trim();
      return {
        text,
        metadata: {
          fileName,
          fileType: 'TXT',
          fileSize: buffer.length,
          uploadedAt: new Date().toISOString(),
          extractionMethod: 'TEXT_ENCODING',
          confidence: 1.0,
        },
        isScanned: false,
        hasImages: false,
        language: 'en',
      };
    } catch (error: any) {
      this.logger.error(`Text extraction failed: ${error.message}`);
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  }

  /**
   * Normalize file type from filename and MIME type
   */
  normalizeFileType(fileName: string, mimeType = ''): 'PDF' | 'DOCX' | 'TXT' | 'MD' | 'UNKNOWN' {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    
    if (extension === 'pdf' || mimeType.includes('pdf')) return 'PDF';
    if (extension === 'docx' || extension === 'doc' || mimeType.includes('word')) return 'DOCX';
    if (extension === 'md' || mimeType.includes('markdown')) return 'MD';
    if (extension === 'txt' || mimeType.includes('text')) return 'TXT';
    
    return 'UNKNOWN';
  }

  /**
   * Detect if PDF is scanned (contains mostly images, little text)
   */
  private isScannedPDF(text: string, pdfData: any): boolean {
    // Heuristics: if text is very short relative to page count, likely scanned
    if (!text || text.length < 100) return true;
    
    const avgTextPerPage = text.length / Math.max(1, pdfData.numpages || 1);
    const isLikelyScanned = avgTextPerPage < 500; // Less than 500 chars per page
    
    return isLikelyScanned;
  }

  /**
   * Extract text from DOCX document XML
   */
  private extractTextFromDocumentXml(xmlContent: string): string {
    try {
      // Extract text between <w:t> tags (Word text elements)
      const textMatches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      const texts = textMatches
        .map(match => match.replace(/<w:t[^>]*>/g, '').replace(/<\/w:t>/g, ''))
        .filter(Boolean);
      
      return texts.join(' ');
    } catch (error) {
      this.logger.warn('Failed to parse DOCX XML, returning empty');
      return '';
    }
  }

  /**
   * Create intelligent chunks with overlap
   */
  createChunks(
    text: string,
    documentId: string,
    fileName: string,
    options: { chunkSize?: number; overlapSize?: number } = {}
  ): DocumentChunk[] {
    const chunkSize = options.chunkSize || 2000; // Increased from 1800
    const overlapSize = options.overlapSize || 300; // 15% overlap
    
    const cleaned = String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!cleaned) return [];
    
    const chunks: DocumentChunk[] = [];
    let offset = 0;
    let chunkIndex = 0;
    
    while (offset < cleaned.length) {
      const endIndex = Math.min(offset + chunkSize, cleaned.length);
      const chunkText = cleaned.slice(offset, endIndex).trim();
      
      if (!chunkText) {
        offset += chunkSize;
        continue;
      }
      
      // Try to break at sentence boundary
      const lastDot = chunkText.lastIndexOf('.');
      const breakPoint = lastDot > chunkSize * 0.7 ? lastDot + 1 : chunkText.length;
      const finalText = chunkText.slice(0, breakPoint).trim();
      
      if (finalText.length > 100) { // Minimum chunk size
        chunks.push({
          id: `${documentId}_chunk_${chunkIndex + 1}`,
          text: finalText,
          pageNumber: Math.floor(offset / (chunkSize * 3)) + 1,
          chunkIndex,
          confidence: 0.95,
          startOffset: offset,
          endOffset: offset + finalText.length,
        });
        
        chunkIndex++;
        offset += finalText.length - overlapSize;
      } else {
        offset += chunkSize;
      }
    }
    
    return chunks;
  }

  /**
   * Validate extraction quality
   */
  validateExtraction(text: string, metadata: DocumentMetadata): {
    isValid: boolean;
    qualityScore: number;
    message: string;
  } {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
    const charCount = cleaned.length;
    
    // Quality checks
    const hasMinimumLength = charCount >= 450;
    const hasGoodWordCount = wordCount >= 50;
    const hasAlphaChars = /[A-Za-z]{3,}/.test(cleaned);
    const hasSentences = /[.!?]\s+[A-Z]/.test(cleaned);
    
    let qualityScore = 0;
    let message = '';
    
    if (!hasMinimumLength) {
      message = 'Document too short (< 450 characters)';
    } else if (!hasGoodWordCount) {
      message = 'Insufficient word count for processing';
    } else if (!hasAlphaChars) {
      message = 'No readable text detected (invalid encoding)';
    } else {
      qualityScore = Math.min(100, 30 + Math.min(40, wordCount / 50) + Math.min(30, charCount / 5000));
      message = `Quality score: ${Math.round(qualityScore)}`;
      
      if (hasSentences) qualityScore += 10;
      qualityScore = Math.min(100, qualityScore);
    }
    
    const isValid = hasMinimumLength && hasGoodWordCount && hasAlphaChars;
    return { isValid, qualityScore: Math.round(qualityScore), message };
  }
}
