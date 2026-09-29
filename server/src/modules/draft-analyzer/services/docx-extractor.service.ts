import { Injectable, Logger } from '@nestjs/common';
import * as AdmZip from 'adm-zip';
import type { PageData, BlockData } from './extraction.types';

// Standard US Letter dimensions in points (1pt = 1/72 in)
const DEFAULT_PAGE_WIDTH_PT = 612;   // 8.5 in
const DEFAULT_PAGE_HEIGHT_PT = 792;  // 11 in
const DEFAULT_MARGIN_PT = 72;        // 1 in
const CONTENT_WIDTH_PT = DEFAULT_PAGE_WIDTH_PT - DEFAULT_MARGIN_PT * 2;
const APPROX_LINE_HEIGHT_PT = 14;    // fallback line height when font size unknown

@Injectable()
export class DocxExtractorService {
  private readonly logger = new Logger(DocxExtractorService.name);

  extract(buffer: Buffer): PageData[] {
    const zip = new AdmZip(buffer as any);
    const docEntry = zip.getEntry('word/document.xml');
    if (!docEntry) throw new Error('Invalid DOCX: word/document.xml not found');

    const xml = docEntry.getData().toString('utf-8');
    const { pageWidth, pageHeight, marginTop, marginLeft } = this.extractPageDimensions(xml);

    const rawParagraphs = this.extractParagraphs(xml);
    return this.buildPages(rawParagraphs, pageWidth, pageHeight, marginTop, marginLeft);
  }

  // ─── page dimensions ──────────────────────────────────────────────────────

  private extractPageDimensions(xml: string) {
    const pgSzMatch = xml.match(/<w:pgSz[^/]*w:w="(\d+)"[^/]*w:h="(\d+)"/);
    const pgMarMatch = xml.match(/<w:pgMar[^/]*w:top="(\d+)"[^>]*w:left="(\d+)"/);

    const twip = (v: string) => parseFloat(v) / 20; // twips → points

    const pageWidth = pgSzMatch ? twip(pgSzMatch[1]) : DEFAULT_PAGE_WIDTH_PT;
    const pageHeight = pgSzMatch ? twip(pgSzMatch[2]) : DEFAULT_PAGE_HEIGHT_PT;
    const marginTop = pgMarMatch ? twip(pgMarMatch[1]) : DEFAULT_MARGIN_PT;
    const marginLeft = pgMarMatch ? twip(pgMarMatch[2]) : DEFAULT_MARGIN_PT;

    return { pageWidth, pageHeight, marginTop, marginLeft };
  }

  // ─── paragraph extraction ─────────────────────────────────────────────────

  private extractParagraphs(xml: string): RawParagraph[] {
    const paragraphs: RawParagraph[] = [];
    const pRegex = /<w:p[ >]([\s\S]*?)<\/w:p>/g;
    let pMatch: RegExpExecArray | null;

    while ((pMatch = pRegex.exec(xml)) !== null) {
      const pXml = pMatch[0];

      // Detect explicit page break before this paragraph
      const hasPageBreak =
        /<w:br[^/]*w:type="page"/.test(pXml) ||
        /<w:lastRenderedPageBreak\/>/.test(pXml);

      const runs = this.extractRuns(pXml);
      const paraText = runs.map(r => r.text).join('');

      // Skip empty paragraphs that aren't page breaks
      if (!paraText.trim() && !hasPageBreak) {
        paragraphs.push({ text: '', runs: [], hasPageBreak, isEmpty: true });
        continue;
      }

      paragraphs.push({ text: paraText, runs, hasPageBreak, isEmpty: false });
    }

    return paragraphs;
  }

  private extractRuns(pXml: string): RawRun[] {
    const runs: RawRun[] = [];
    const rRegex = /<w:r[ >]([\s\S]*?)<\/w:r>/g;
    let rMatch: RegExpExecArray | null;

    while ((rMatch = rRegex.exec(pXml)) !== null) {
      const rXml = rMatch[0];

      // Text content (preserve spaces)
      const textMatch = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/.exec(rXml);
      const text = textMatch ? textMatch[1] : '';
      if (!text) continue;

      // Font size: <w:sz w:val="24"/> → 24 half-points → 12pt
      const szMatch = /<w:sz\s+w:val="(\d+)"/.exec(rXml);
      const fontSize = szMatch ? parseInt(szMatch[1], 10) / 2 : 12;

      // Font name: <w:rFonts w:ascii="Times New Roman"/>
      const fontMatch = /<w:rFonts[^/]*w:ascii="([^"]+)"/.exec(rXml);
      const fontName = fontMatch ? fontMatch[1] : null;

      const isBold = /<w:b\/>|<w:b\s/.test(rXml);
      const isItalic = /<w:i\/>|<w:i\s/.test(rXml);

      runs.push({ text, fontSize, fontName, isBold, isItalic });
    }

    return runs;
  }

  // ─── page / block assembly ────────────────────────────────────────────────

  private buildPages(
    paragraphs: RawParagraph[],
    pageWidth: number,
    pageHeight: number,
    marginTop: number,
    marginLeft: number,
  ): PageData[] {
    const pages: PageData[] = [];
    const contentWidth = pageWidth - marginLeft * 2;
    const usableHeight = pageHeight - marginTop * 2;

    let currentPageNum = 1;
    let cursorY = marginTop;
    let pageParas: { para: RawParagraph; y: number }[] = [];

    const flushPage = () => {
      const blocks = this.buildBlocksForPage(
        pageParas, currentPageNum, marginLeft, contentWidth,
      );
      const rawText = pageParas.map(p => p.para.text).filter(Boolean).join('\n');
      pages.push({
        pageNumber: currentPageNum,
        widthPt: round2(pageWidth),
        heightPt: round2(pageHeight),
        rawText,
        blocks,
      });
      currentPageNum++;
      cursorY = marginTop;
      pageParas = [];
    };

    for (const para of paragraphs) {
      if (para.hasPageBreak && pageParas.length > 0) {
        flushPage();
      }

      const lineHeight = this.estimateParaHeight(para, contentWidth);

      // Page overflow check
      if (cursorY + lineHeight > pageHeight - marginTop && pageParas.length > 0) {
        flushPage();
      }

      pageParas.push({ para, y: cursorY });
      cursorY += lineHeight;
    }

    if (pageParas.length > 0) flushPage();
    if (pages.length === 0) {
      pages.push({ pageNumber: 1, widthPt: round2(pageWidth), heightPt: round2(pageHeight), rawText: '', blocks: [] });
    }

    return pages;
  }

  private estimateParaHeight(para: RawParagraph, contentWidth: number): number {
    if (!para.text.trim()) return APPROX_LINE_HEIGHT_PT * 0.5;
    const avgFontSize = para.runs.length
      ? para.runs.reduce((s, r) => s + r.fontSize, 0) / para.runs.length
      : 12;
    const lineHeight = avgFontSize * 1.3;
    // Estimate number of lines from character count
    const charsPerLine = Math.max(1, Math.floor(contentWidth / (avgFontSize * 0.5)));
    const estimatedLines = Math.max(1, Math.ceil(para.text.length / charsPerLine));
    return lineHeight * estimatedLines + avgFontSize * 0.3; // + spacing
  }

  private buildBlocksForPage(
    pageParas: { para: RawParagraph; y: number }[],
    pageNumber: number,
    marginLeft: number,
    contentWidth: number,
  ): BlockData[] {
    const blocks: BlockData[] = [];
    let blockIndex = 0;

    pageParas.forEach(({ para, y }, paraIdx) => {
      if (!para.text.trim()) return;

      const avgFontSize = para.runs.length
        ? para.runs.reduce((s, r) => s + r.fontSize, 0) / para.runs.length
        : 12;
      const paraHeight = this.estimateParaHeight(para, contentWidth);

      // Dominant font info
      const domRun = para.runs.reduce(
        (a, b) => (a.text.length >= b.text.length ? a : b),
        para.runs[0] || { text: '', fontSize: 12, fontName: null, isBold: false, isItalic: false },
      );

      // Paragraph block
      blocks.push({
        blockType: 'paragraph',
        blockIndex: blockIndex++,
        paragraphIndex: paraIdx,
        lineIndex: null,
        textContent: para.text,
        x: round2(marginLeft),
        y: round2(y),
        width: round2(contentWidth),
        height: round2(paraHeight),
        fontSize: round2(avgFontSize),
        fontName: domRun.fontName,
        isBold: domRun.isBold,
        isItalic: domRun.isItalic,
      });

      // Line blocks — one per run (preserves font/style per segment)
      let lineY = y;
      const lineHeight = avgFontSize * 1.3;

      para.runs.forEach((run, runIdx) => {
        if (!run.text.trim()) return;
        blocks.push({
          blockType: 'line',
          blockIndex: blockIndex++,
          paragraphIndex: paraIdx,
          lineIndex: runIdx,
          textContent: run.text,
          x: round2(marginLeft),
          y: round2(lineY),
          width: round2(run.text.length * run.fontSize * 0.5), // estimated
          height: round2(run.fontSize * 1.3),
          fontSize: round2(run.fontSize),
          fontName: run.fontName,
          isBold: run.isBold,
          isItalic: run.isItalic,
        });
        lineY += lineHeight;
      });
    });

    return blocks;
  }
}

// ─── local types ─────────────────────────────────────────────────────────────

interface RawRun {
  text: string;
  fontSize: number;
  fontName: string | null;
  isBold: boolean;
  isItalic: boolean;
}

interface RawParagraph {
  text: string;
  runs: RawRun[];
  hasPageBreak: boolean;
  isEmpty: boolean;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
