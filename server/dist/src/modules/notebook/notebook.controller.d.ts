import { NotebookService } from './notebook.service';
import { SettingsService } from '../settings/settings.service';
export declare class NotebookController {
    private readonly notebookService;
    private readonly settings;
    constructor(notebookService: NotebookService, settings: SettingsService);
    listDocuments(req: any): Promise<import("./notebook.entity").NotebookDocument[]>;
    getDocument(id: string, req: any): Promise<import("./notebook.entity").NotebookDocument>;
    previewDocument(id: string, req: any): Promise<any>;
    openDocumentFile(id: string, req: any, res: any): Promise<any>;
    getChunks(id: string, req: any): Promise<import("./chunk.entity").DocumentChunk[]>;
    getChatHistory(id: string, req: any): Promise<import("./chat-message.entity").NotebookChatMessage[]>;
    reprocessDocument(id: string, req: any): Promise<import("./notebook.entity").NotebookDocument>;
    getExtraction(id: string, req: any): Promise<any>;
    runExtraction(id: string, req: any): Promise<import("./notebook.entity").NotebookDocument>;
    generateStudyForge(id: string, req: any): Promise<any>;
    rateStudyForgeFlashcard(id: string, cardId: string, body: {
        rating: 'Hard' | 'Good' | 'Easy';
    }, req: any): Promise<any>;
    recordStudyForgeQuizAttempt(id: string, body: {
        answers: Record<string, number>;
    }, req: any): Promise<any>;
    getKnowledgeGraph(req: any, documentId?: string): Promise<any>;
    search(req: any, q: string, mode?: 'keyword' | 'vector' | 'hybrid', documentId?: string): Promise<any>;
    deleteDocument(id: string, req: any): Promise<{
        success: boolean;
        message: string;
    }>;
    uploadDocument(file: any, documentType: string, req: any): Promise<import("./notebook.entity").NotebookDocument>;
    uploadDocuments(files: any[], req: any): Promise<{
        accepted: number;
        documents: import("./notebook.entity").NotebookDocument[];
    }>;
    private isSupportedStudyMaterial;
    private validateUploadedFile;
    private validateBulkUpload;
    private validateIngestUrl;
    chatStream(body: {
        documentId: string;
        message: string;
        history: any[];
    }, req: any, res: any): Promise<void>;
    ingestFromUrl(body: {
        url: string;
        name?: string;
    }, req: any): Promise<import("./notebook.entity").NotebookDocument>;
    getDocumentIntelligence(id: string, body: {
        action: string;
        targetDocumentId?: string;
    }, req: any): Promise<any>;
}
