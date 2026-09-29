import { ContractService } from './contract.service';
import { SettingsService } from '../settings/settings.service';
import { Response } from 'express';
export declare class ContractController {
    private readonly contractService;
    private readonly settings;
    constructor(contractService: ContractService, settings: SettingsService);
    getActiveConfig(): Promise<import("./contract.entities").ContractConfig>;
    downloadPdf(res: Response): Promise<void>;
    getAcceptanceStatus(req: any): Promise<{
        accepted: boolean;
    }>;
    acceptContract(req: any, body: {
        contractVersion: string;
        email?: string;
    }): Promise<import("./contract.entities").ContractAcceptance>;
    updateConfig(req: any, body: {
        contractVersion: string;
        contractContent: string;
    }): Promise<import("./contract.entities").ContractConfig>;
    getAdminAcceptances(): Promise<import("./contract.entities").ContractAcceptance[]>;
    reviewContract(body: {
        fileName: string;
        fileUrl: string;
    }, req: any): Promise<{
        contractId: string;
        status: string;
        overallRiskScore: number;
    }>;
    getRisks(id: string): Promise<{
        contractId: string;
        clauses: any[];
    }>;
    generateClauseRecommendations(id: string, body: {
        clauseTitle: string;
    }): Promise<{
        title: any;
        recommendation: any;
        reconciliationAdvice: any;
    }>;
}
