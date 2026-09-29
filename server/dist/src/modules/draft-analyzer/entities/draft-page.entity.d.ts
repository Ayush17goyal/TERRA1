import { Draft } from './draft.entity';
export declare class DraftPage {
    id: string;
    draftId: string;
    draft: Draft;
    pageNumber: number;
    widthPt: number;
    heightPt: number;
    rawText: string;
    blockCount: number;
    createdAt: Date;
}
