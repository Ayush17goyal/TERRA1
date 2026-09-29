export declare class JudgmentAnalysis {
    id: string;
    documentId: string;
    userId: string;
    title: string;
    citation: string;
    court: string;
    bench: string;
    dateOfJudgment: string;
    judges: string[];
    facts: string;
    issues: string[];
    argumentsPetitioner: string[];
    argumentsRespondent: string[];
    statutes: string[];
    precedents: string[];
    ratioDecidendi: string;
    obiterDicta: string;
    holding: string;
    finalVerdict: string;
    timeline: {
        year: string;
        event: string;
    }[];
    citationNetwork: {
        case: string;
        relationship: string;
        relevance: string;
    }[];
    examRelevanceScore: number;
    landmarkImpactScore: number;
    sourceChunkRefs: {
        field: string;
        chunkIndex: number;
        pageNumber: number;
        excerpt: string;
    }[];
    revisionNotes: string;
    mootCourtKit: any;
    createdAt: Date;
}
