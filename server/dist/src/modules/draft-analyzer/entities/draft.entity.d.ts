export type DraftStatus = 'pending' | 'processing' | 'reviewed' | 'failed';
export declare class Draft {
    id: string;
    userId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storagePath: string;
    status: DraftStatus;
    extractedAt: Date | null;
    reviewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
