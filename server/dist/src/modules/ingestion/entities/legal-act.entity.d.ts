export declare class LegalActEntity {
    id: string;
    actName: string;
    actId: string;
    shortName: string;
    aliases: string[];
    year?: number;
    status: string;
    category: string;
    filePath: string;
    fileSizeBytes: number;
    lastModifiedDate: Date;
    pdfHash: string;
    createdAt: Date;
    updatedAt: Date;
}
