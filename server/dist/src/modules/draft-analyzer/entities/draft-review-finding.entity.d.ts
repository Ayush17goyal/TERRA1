import { Draft } from './draft.entity';
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export declare class DraftReviewFinding {
    id: string;
    draftId: string;
    draft: Draft;
    page: number;
    line: number;
    exactText: string;
    severity: FindingSeverity;
    issue: string;
    legalReasoning: string;
    suggestion: string;
    confidenceScore: number;
    category: string | null;
    annotationType: string | null;
    evidenceText: string | null;
    nearbyText: string | null;
    paragraphNumber: number | null;
    batchIndex: number;
    createdAt: Date;
}
