import { DraftPage } from './draft-page.entity';
export type BlockType = 'paragraph' | 'line';
export declare class DraftTextBlock {
    id: string;
    draftId: string;
    pageId: string;
    page: DraftPage;
    pageNumber: number;
    blockType: BlockType;
    blockIndex: number;
    paragraphIndex: number;
    lineIndex: number | null;
    textContent: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number | null;
    fontName: string | null;
    isBold: boolean;
    isItalic: boolean;
    createdAt: Date;
}
