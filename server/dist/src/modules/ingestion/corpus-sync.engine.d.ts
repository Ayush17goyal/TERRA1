import { DataSource } from 'typeorm';
import { ParsedProvisionEntity } from './entities/parsed-provision.entity';
export interface ParsedSectionsJson {
    actName: string;
    officialName?: string;
    shortName?: string;
    category: string;
    year?: number;
    summary?: Record<string, number>;
    structure: any[];
}
export interface ActManifest {
    actFolder: string;
    category: string;
    folderName: string;
    parsedSectionsPath: string;
    pdfPath: string | null;
    parsedData: ParsedSectionsJson;
    contentHash: string;
    officialName: string;
    shortName: string;
    year?: number;
    actId: string;
    pdfSource: string;
}
export interface SyncReport {
    actsFound: number;
    actsUpdated: number;
    actsSkipped: number;
    actsDeleted: number;
    sectionsAdded: number;
    sectionsUpdated: number;
    embeddingsGenerated: number;
    embeddingsRepaired: number;
    duplicateRowsRemoved: number;
    duplicateEmbeddingsRemoved: number;
    failedActs: string[];
    overallHealthPercent: number;
    details: ActSyncDetail[];
}
export interface ActSyncDetail {
    actName: string;
    status: 'synced' | 'skipped' | 'deleted' | 'failed' | 'empty';
    reason?: string;
    provisionsAdded?: number;
    embeddingsGenerated?: number;
}
export interface ValidationReport {
    totalActs: number;
    actsInDb: number;
    actsMissingFromDb: number;
    totalProvisions: number;
    provisionsMissingActId: number;
    provisionsMissingContent: number;
    provisionsNotEmbedded: number;
    dbCount: number;
    qdrantCount: number;
    countMismatch: boolean;
    duplicateProvisions: number;
    healthy: boolean;
    issues: string[];
}
export interface RepairReport {
    embeddingsRepaired: number;
    actIdRepaired: number;
    duplicatesRemoved: number;
    failedRepairs: string[];
}
export interface SyncEngineOptions {
    corpusDir: string;
    collection: string;
    embeddingVersion: string;
    batchSize?: number;
}
export interface QdrantClientLike {
    count(collection: string, params?: any): Promise<{
        count: number;
    }>;
    upsert(collection: string, params: any): Promise<any>;
    delete(collection: string, params: any): Promise<any>;
    getCollections(): Promise<any>;
    createCollection?(collection: string, params: any): Promise<any>;
    search?(collection: string, params: any): Promise<any[]>;
}
export declare class CorpusSyncEngine {
    private readonly dataSource;
    private readonly qdrant;
    private readonly embed;
    private readonly options;
    private readonly legalActRepo;
    private readonly provisionRepo;
    constructor(dataSource: DataSource, qdrant: QdrantClientLike, embed: (texts: string[]) => Promise<number[][]>, options: SyncEngineOptions);
    sync(): Promise<SyncReport>;
    validate(): Promise<ValidationReport>;
    repair(): Promise<RepairReport>;
    discoverActs(): ActManifest[];
    detectChanges(manifest: ActManifest[]): Promise<{
        newActs: ActManifest[];
        updated: ActManifest[];
        unchanged: ActManifest[];
        deleted: string[];
    }>;
    syncAct(act: ActManifest): Promise<{
        provisionsAdded: number;
        embeddingsGenerated: number;
        duplicatesRemoved: number;
    }>;
    deleteAct(filePath: string): Promise<void>;
    generateAndUpsert(entities: ParsedProvisionEntity[], act: ActManifest): Promise<number>;
    repairMissingEmbeddings(): Promise<number>;
    removeDuplicateProvisions(): Promise<number>;
    private upsertActRecord;
}
export declare function computeContentHash(input: string): string;
export declare function computeFileHash(filePath: string): string;
export declare function qdrantPointId(contentHash: string): string;
export declare function extractKeywords(text: string): string[];
