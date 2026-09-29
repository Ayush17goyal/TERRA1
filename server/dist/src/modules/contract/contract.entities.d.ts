export declare class ContractConfig {
    id: string;
    contractVersion: string;
    contractContent: string;
    lastUpdated: Date;
}
export declare class ContractAcceptance {
    id: string;
    userId: string;
    email: string;
    timestamp: Date;
    ipAddress: string;
    browserUserAgent: string;
    contractVersion: string;
    accepted: boolean;
}
