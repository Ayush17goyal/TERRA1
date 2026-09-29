import { Repository } from 'typeorm';
import { LegalActEntity } from './entities/legal-act.entity';
import { ParsedProvisionEntity } from './entities/parsed-provision.entity';
import { QdrantService } from '../retrieval/qdrant.service';
import { BgeM3Provider } from '../retrieval/bge-m3.provider';
export interface IngestionReport {
    actsDiscovered: number;
    actsParsed: number;
    actsSkipped: number;
    sectionsStored: number;
    embeddingsGenerated: number;
    missingEmbeddings: number;
    errors: number;
    details: Array<{
        act: string;
        sections: number;
        embeddings: number;
        skipped: boolean;
        error?: string;
    }>;
}
export declare class CorpusScannerService {
    private readonly legalActRepository;
    private readonly parsedProvisionRepository;
    private readonly qdrantService;
    private readonly bgeM3Provider;
    private readonly logger;
    constructor(legalActRepository: Repository<LegalActEntity>, parsedProvisionRepository: Repository<ParsedProvisionEntity>, qdrantService: QdrantService, bgeM3Provider: BgeM3Provider);
    scanCorpus(corpusDir?: string): Promise<IngestionReport>;
    private generateAndUpsertEmbeddings;
    private auditAndRepair;
    private repairMissingEmbeddings;
    private printReport;
    private emptyReport;
    private extractOfficialTitle;
    private extractPdfPages;
    private cleanHeadersAndFooters;
    private parseLegalStructure;
    private flattenProvisions;
    private computeFileHash;
    private computeContentHash;
    private extractKeywords;
    private findPdfFiles;
}
