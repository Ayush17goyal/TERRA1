export interface BlockData {
  blockType: 'paragraph' | 'line';
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
}

export interface PageData {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  rawText: string;
  blocks: BlockData[];
}

export interface ExtractionResult {
  draftId: string;
  pageCount: number;
  totalBlocks: number;
  pages: PageData[];
}
