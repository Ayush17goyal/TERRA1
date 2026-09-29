import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DocumentProcessor } from './document-processor';
import { VectorStoreService } from './vector-store';
import { DocumentUploadService } from './document-upload';
import { EmbeddingService } from '../modules/retrieval/embedding.service';

export interface DocumentUploadDTO {
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
}

@Injectable()
export class DocumentUploadServiceNest {
  private readonly logger = new Logger(DocumentUploadServiceNest.name);
  private uploadService: DocumentUploadService;

  constructor(
    private embeddingService: EmbeddingService,
    private vectorStore: VectorStoreService
  ) {
    const documentProcessor = new DocumentProcessor();
    this.uploadService = new DocumentUploadService(
      documentProcessor,
      vectorStore
    );
  }

  /**
   * Handle document upload with multipart form data
   */
  async handleUpload(
    fileBuffer: Buffer,
    fileName: string,
    documentType: string,
    userId: string
  ): Promise<DocumentUploadDTO> {
    try {
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new BadRequestException('File buffer is empty');
      }

      if (!fileName || fileName.trim().length === 0) {
        throw new BadRequestException('File name is required');
      }

      if (!userId) {
        throw new BadRequestException('User ID is required');
      }

      this.logger.log(
        `Processing upload: ${fileName} (${fileBuffer.length} bytes) for user ${userId}`
      );

      const result = await this.uploadService.processUpload(
        fileBuffer,
        fileName,
        documentType,
        userId
      );

      if (!result.success) {
        throw new BadRequestException(result.message || 'Upload failed');
      }

      return {
        documentId: result.documentId,
        fileName: result.fileName,
        documentType: result.documentType,
        extractedWordCount: result.extractedWordCount,
        chunkCount: result.chunkCount,
        qualityScore: result.qualityScore,
        vectorsStored: result.vectorsStored,
        extractionStatus: result.extractionStatus,
        message: result.message,
        previewContent: result.previewContent,
      };
    } catch (error: any) {
      this.logger.error(`Upload failed: ${error.message}`);
      throw new BadRequestException(error.message || 'Document upload failed');
    }
  }

  /**
   * Get upload status for a document
   */
  async getUploadStatus(documentId: string, userId: string): Promise<{
    documentId: string;
    status: string;
    vectorCount: number;
    avgConfidence: number;
    storageSize: number;
  }> {
    try {
      const stats = await this.vectorStore.getDocumentStats(documentId);

      return {
        documentId,
        status: stats.vectorCount > 0 ? 'Indexed' : 'Pending',
        vectorCount: stats.vectorCount,
        avgConfidence: stats.avgConfidence,
        storageSize: stats.storageSize,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get upload status: ${error.message}`);
      return {
        documentId,
        status: 'Error',
        vectorCount: 0,
        avgConfidence: 0,
        storageSize: 0,
      };
    }
  }
}
