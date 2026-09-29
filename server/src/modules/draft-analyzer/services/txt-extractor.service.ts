import { Injectable } from '@nestjs/common';
import type { PageData, BlockData } from './extraction.types';

const PAGE_WIDTH_PT = 612;
const PAGE_HEIGHT_PT = 792;
const MARGIN_PT = 72;
const CONTENT_WIDTH_PT = PAGE_WIDTH_PT - MARGIN_PT * 2;
const FONT_SIZE_PT = 12;
const LINE_HEIGHT_PT = FONT_SIZE_PT * 1.5;
const LINES_PER_PAGE = Math.floor((PAGE_HEIGHT_PT - MARGIN_PT * 2) / LINE_HEIGHT_PT);

@Injectable()
export class TxtExtractorService {
  extract(buffer: Buffer): PageData[] {
    const text = buffer.toString('utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split into paragraphs on blank lines
    const rawParagraphs = text
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean);

    // Split each paragraph into individual lines
    interface Para { text: string; lines: string[] }
    const paragraphs: Para[] = rawParagraphs.map(p => ({
      text: p,
      lines: p.split('\n'),
    }));

    // Paginate by estimated line count
    const pages: PageData[] = [];
    let linesSoFar = 0;
    let pageParas: Para[] = [];
    let currentPageNum = 1;

    const flushPage = () => {
      pages.push(buildPage(pageParas, currentPageNum));
      currentPageNum++;
      linesSoFar = 0;
      pageParas = [];
    };

    for (const para of paragraphs) {
      const lineCount = para.lines.length;
      if (linesSoFar + lineCount > LINES_PER_PAGE && pageParas.length > 0) {
        flushPage();
      }
      pageParas.push(para);
      linesSoFar += lineCount + 1; // +1 for blank line between paragraphs
    }

    if (pageParas.length > 0) flushPage();
    if (pages.length === 0) {
      pages.push({
        pageNumber: 1,
        widthPt: PAGE_WIDTH_PT,
        heightPt: PAGE_HEIGHT_PT,
        rawText: '',
        blocks: [],
      });
    }

    return pages;
  }
}

function buildPage(
  paragraphs: { text: string; lines: string[] }[],
  pageNumber: number,
): PageData {
  const blocks: BlockData[] = [];
  let blockIndex = 0;
  let cursorY = MARGIN_PT;

  paragraphs.forEach((para, paraIdx) => {
    const paraHeight = para.lines.length * LINE_HEIGHT_PT;

    blocks.push({
      blockType: 'paragraph',
      blockIndex: blockIndex++,
      paragraphIndex: paraIdx,
      lineIndex: null,
      textContent: para.text,
      x: MARGIN_PT,
      y: round2(cursorY),
      width: CONTENT_WIDTH_PT,
      height: round2(paraHeight),
      fontSize: FONT_SIZE_PT,
      fontName: null,
      isBold: false,
      isItalic: false,
    });

    para.lines.forEach((lineText, lineIdx) => {
      blocks.push({
        blockType: 'line',
        blockIndex: blockIndex++,
        paragraphIndex: paraIdx,
        lineIndex: lineIdx,
        textContent: lineText,
        x: MARGIN_PT,
        y: round2(cursorY + lineIdx * LINE_HEIGHT_PT),
        width: round2(Math.min(lineText.length * FONT_SIZE_PT * 0.5, CONTENT_WIDTH_PT)),
        height: round2(LINE_HEIGHT_PT),
        fontSize: FONT_SIZE_PT,
        fontName: null,
        isBold: false,
        isItalic: false,
      });
    });

    cursorY += paraHeight + LINE_HEIGHT_PT; // paragraph spacing
  });

  const rawText = paragraphs.map(p => p.text).join('\n\n');
  return {
    pageNumber,
    widthPt: PAGE_WIDTH_PT,
    heightPt: PAGE_HEIGHT_PT,
    rawText,
    blocks,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
