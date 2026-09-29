import { Repository } from 'typeorm';
import { ContractConfig, ContractAcceptance } from './contract.entities';
export declare class ContractService {
    private readonly configRepo;
    private readonly acceptanceRepo;
    private contractsCache;
    private risksCache;
    constructor(configRepo: Repository<ContractConfig>, acceptanceRepo: Repository<ContractAcceptance>);
    seedActiveContractConfig(): Promise<void>;
    getActiveConfig(): Promise<ContractConfig>;
    updateConfig(version: string, content: string): Promise<ContractConfig>;
    recordAcceptance(userId: string | null, email: string | null, ipAddress: string | null, userAgent: string | null, version: string): Promise<ContractAcceptance>;
    getAcceptanceStatus(userId: string, version: string): Promise<{
        accepted: boolean;
    }>;
    getAllAcceptances(): Promise<ContractAcceptance[]>;
    generatePdf(content: string, version: string, res: any): Promise<void>;
    review(userId: string, fileName: string, fileUrl: string): Promise<{
        contractId: string;
        status: string;
        overallRiskScore: number;
    }>;
    getRisks(id: string): Promise<{
        contractId: string;
        clauses: any[];
    }>;
    recommendClause(id: string, clauseTitle: string): Promise<{
        title: any;
        recommendation: any;
        reconciliationAdvice: any;
    }>;
    private seedContracts;
}
