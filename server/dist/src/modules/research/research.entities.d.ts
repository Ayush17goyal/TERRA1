export declare class ResearchUser {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare class ResearchQuery {
    id: string;
    userId: string;
    topic: string;
    researchMode: string;
    status: 'pending' | 'processing' | 'completed';
    createdAt: Date;
    updatedAt: Date;
    user: ResearchUser;
}
export declare class ResearchReport {
    id: string;
    queryId: string;
    userId: string;
    title: string;
    summary: string;
    researchOutline: Record<string, unknown>;
    researchMode: string;
    createdAt: Date;
    updatedAt: Date;
    query: ResearchQuery;
}
export declare class ResearchSource {
    id: string;
    reportId: string;
    sourceType: 'case' | 'act' | 'article' | 'note';
    title: string;
    citation: string;
    court: string;
    year: number;
    summary: string;
    sourceUrl: string;
    metadata: Record<string, unknown>;
    createdAt: Date;
    report: ResearchReport;
}
export declare class ResearchNote {
    id: string;
    reportId: string;
    userId: string;
    title: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    report: ResearchReport;
}
export declare class SavedReport {
    id: string;
    userId: string;
    reportId: string;
    createdAt: Date;
    report: ResearchReport;
}
export declare class ResearchAsset {
    id: string;
    reportId: string;
    assetType: 'case_matrix' | 'issue_checklist' | 'argument_map';
    assetData: Record<string, unknown>;
    createdAt: Date;
    report: ResearchReport;
}
export declare class ResearchDocument {
    id: string;
    queryId: string;
    userId: string;
    name: string;
    type: string;
    docCategory: string;
    content: string;
    status: string;
    createdAt: Date;
    query: ResearchQuery;
}
export declare class JudgmentReport {
    id: string;
    userId: string;
    researchTopic: string;
    caseName: string;
    citation: string;
    court: string;
    judge: string;
    facts: any;
    issues: any;
    holdings: any;
    ratioDecidendi: string;
    obiterDicta: string;
    reliefGranted: string;
    impactAnalysis: string;
    researchMatrix: any;
    generatedReport: string;
    fileName: string;
    metadata: any;
    createdAt: Date;
    updatedAt: Date;
}
