import { NotebookDocument } from './notebook.entity';
export declare class DocumentChunk {
    id: string;
    documentId: string;
    documentName: string;
    chunkIndex: number;
    text: string;
    pageNumber: number;
    section: string;
    createdAt: Date;
    document: NotebookDocument;
}
