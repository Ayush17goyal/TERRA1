"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var DocumentUploadServiceNest_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentUploadServiceNest = void 0;
const common_1 = require("@nestjs/common");
const document_processor_1 = require("./document-processor");
const vector_store_1 = require("./vector-store");
const document_upload_1 = require("./document-upload");
const embedding_service_1 = require("../modules/retrieval/embedding.service");
let DocumentUploadServiceNest = DocumentUploadServiceNest_1 = class DocumentUploadServiceNest {
    constructor(embeddingService, vectorStore) {
        this.embeddingService = embeddingService;
        this.vectorStore = vectorStore;
        this.logger = new common_1.Logger(DocumentUploadServiceNest_1.name);
        const documentProcessor = new document_processor_1.DocumentProcessor();
        this.uploadService = new document_upload_1.DocumentUploadService(documentProcessor, vectorStore);
    }
    async handleUpload(fileBuffer, fileName, documentType, userId) {
        try {
            if (!fileBuffer || fileBuffer.length === 0) {
                throw new common_1.BadRequestException('File buffer is empty');
            }
            if (!fileName || fileName.trim().length === 0) {
                throw new common_1.BadRequestException('File name is required');
            }
            if (!userId) {
                throw new common_1.BadRequestException('User ID is required');
            }
            this.logger.log(`Processing upload: ${fileName} (${fileBuffer.length} bytes) for user ${userId}`);
            const result = await this.uploadService.processUpload(fileBuffer, fileName, documentType, userId);
            if (!result.success) {
                throw new common_1.BadRequestException(result.message || 'Upload failed');
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
        }
        catch (error) {
            this.logger.error(`Upload failed: ${error.message}`);
            throw new common_1.BadRequestException(error.message || 'Document upload failed');
        }
    }
    async getUploadStatus(documentId, userId) {
        try {
            const stats = await this.vectorStore.getDocumentStats(documentId);
            return {
                documentId,
                status: stats.vectorCount > 0 ? 'Indexed' : 'Pending',
                vectorCount: stats.vectorCount,
                avgConfidence: stats.avgConfidence,
                storageSize: stats.storageSize,
            };
        }
        catch (error) {
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
};
exports.DocumentUploadServiceNest = DocumentUploadServiceNest;
exports.DocumentUploadServiceNest = DocumentUploadServiceNest = DocumentUploadServiceNest_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [embedding_service_1.EmbeddingService,
        vector_store_1.VectorStoreService])
], DocumentUploadServiceNest);
//# sourceMappingURL=document-upload-nest.service.js.map