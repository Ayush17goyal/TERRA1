"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var DocxExtractorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocxExtractorService = void 0;
const common_1 = require("@nestjs/common");
const AdmZip = require("adm-zip");
const DEFAULT_PAGE_WIDTH_PT = 612;
const DEFAULT_PAGE_HEIGHT_PT = 792;
const DEFAULT_MARGIN_PT = 72;
const CONTENT_WIDTH_PT = DEFAULT_PAGE_WIDTH_PT - DEFAULT_MARGIN_PT * 2;
const APPROX_LINE_HEIGHT_PT = 14;
let DocxExtractorService = DocxExtractorService_1 = class DocxExtractorService {
    constructor() {
        this.logger = new common_1.Logger(DocxExtractorService_1.name);
    }
    extract(buffer) {
        const zip = new AdmZip(buffer);
        const docEntry = zip.getEntry('word/document.xml');
        if (!docEntry)
            throw new Error('Invalid DOCX: word/document.xml not found');
        const xml = docEntry.getData().toString('utf-8');
        const { pageWidth, pageHeight, marginTop, marginLeft } = this.extractPageDimensions(xml);
        const rawParagraphs = this.extractParagraphs(xml);
        return this.buildPages(rawParagraphs, pageWidth, pageHeight, marginTop, marginLeft);
    }
    extractPageDimensions(xml) {
        const pgSzMatch = xml.match(/<w:pgSz[^/]*w:w="(\d+)"[^/]*w:h="(\d+)"/);
        const pgMarMatch = xml.match(/<w:pgMar[^/]*w:top="(\d+)"[^>]*w:left="(\d+)"/);
        const twip = (v) => parseFloat(v) / 20;
        const pageWidth = pgSzMatch ? twip(pgSzMatch[1]) : DEFAULT_PAGE_WIDTH_PT;
        const pageHeight = pgSzMatch ? twip(pgSzMatch[2]) : DEFAULT_PAGE_HEIGHT_PT;
        const marginTop = pgMarMatch ? twip(pgMarMatch[1]) : DEFAULT_MARGIN_PT;
        const marginLeft = pgMarMatch ? twip(pgMarMatch[2]) : DEFAULT_MARGIN_PT;
        return { pageWidth, pageHeight, marginTop, marginLeft };
    }
    extractParagraphs(xml) {
        const paragraphs = [];
        const pRegex = /<w:p[ >]([\s\S]*?)<\/w:p>/g;
        let pMatch;
        while ((pMatch = pRegex.exec(xml)) !== null) {
            const pXml = pMatch[0];
            const hasPageBreak = /<w:br[^/]*w:type="page"/.test(pXml) ||
                /<w:lastRenderedPageBreak\/>/.test(pXml);
            const runs = this.extractRuns(pXml);
            const paraText = runs.map(r => r.text).join('');
            if (!paraText.trim() && !hasPageBreak) {
                paragraphs.push({ text: '', runs: [], hasPageBreak, isEmpty: true });
                continue;
            }
            paragraphs.push({ text: paraText, runs, hasPageBreak, isEmpty: false });
        }
        return paragraphs;
    }
    extractRuns(pXml) {
        const runs = [];
        const rRegex = /<w:r[ >]([\s\S]*?)<\/w:r>/g;
        let rMatch;
        while ((rMatch = rRegex.exec(pXml)) !== null) {
            const rXml = rMatch[0];
            const textMatch = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/.exec(rXml);
            const text = textMatch ? textMatch[1] : '';
            if (!text)
                continue;
            const szMatch = /<w:sz\s+w:val="(\d+)"/.exec(rXml);
            const fontSize = szMatch ? parseInt(szMatch[1], 10) / 2 : 12;
            const fontMatch = /<w:rFonts[^/]*w:ascii="([^"]+)"/.exec(rXml);
            const fontName = fontMatch ? fontMatch[1] : null;
            const isBold = /<w:b\/>|<w:b\s/.test(rXml);
            const isItalic = /<w:i\/>|<w:i\s/.test(rXml);
            runs.push({ text, fontSize, fontName, isBold, isItalic });
        }
        return runs;
    }
    buildPages(paragraphs, pageWidth, pageHeight, marginTop, marginLeft) {
        const pages = [];
        const contentWidth = pageWidth - marginLeft * 2;
        const usableHeight = pageHeight - marginTop * 2;
        let currentPageNum = 1;
        let cursorY = marginTop;
        let pageParas = [];
        const flushPage = () => {
            const blocks = this.buildBlocksForPage(pageParas, currentPageNum, marginLeft, contentWidth);
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
            if (cursorY + lineHeight > pageHeight - marginTop && pageParas.length > 0) {
                flushPage();
            }
            pageParas.push({ para, y: cursorY });
            cursorY += lineHeight;
        }
        if (pageParas.length > 0)
            flushPage();
        if (pages.length === 0) {
            pages.push({ pageNumber: 1, widthPt: round2(pageWidth), heightPt: round2(pageHeight), rawText: '', blocks: [] });
        }
        return pages;
    }
    estimateParaHeight(para, contentWidth) {
        if (!para.text.trim())
            return APPROX_LINE_HEIGHT_PT * 0.5;
        const avgFontSize = para.runs.length
            ? para.runs.reduce((s, r) => s + r.fontSize, 0) / para.runs.length
            : 12;
        const lineHeight = avgFontSize * 1.3;
        const charsPerLine = Math.max(1, Math.floor(contentWidth / (avgFontSize * 0.5)));
        const estimatedLines = Math.max(1, Math.ceil(para.text.length / charsPerLine));
        return lineHeight * estimatedLines + avgFontSize * 0.3;
    }
    buildBlocksForPage(pageParas, pageNumber, marginLeft, contentWidth) {
        const blocks = [];
        let blockIndex = 0;
        pageParas.forEach(({ para, y }, paraIdx) => {
            if (!para.text.trim())
                return;
            const avgFontSize = para.runs.length
                ? para.runs.reduce((s, r) => s + r.fontSize, 0) / para.runs.length
                : 12;
            const paraHeight = this.estimateParaHeight(para, contentWidth);
            const domRun = para.runs.reduce((a, b) => (a.text.length >= b.text.length ? a : b), para.runs[0] || { text: '', fontSize: 12, fontName: null, isBold: false, isItalic: false });
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
            let lineY = y;
            const lineHeight = avgFontSize * 1.3;
            para.runs.forEach((run, runIdx) => {
                if (!run.text.trim())
                    return;
                blocks.push({
                    blockType: 'line',
                    blockIndex: blockIndex++,
                    paragraphIndex: paraIdx,
                    lineIndex: runIdx,
                    textContent: run.text,
                    x: round2(marginLeft),
                    y: round2(lineY),
                    width: round2(run.text.length * run.fontSize * 0.5),
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
};
exports.DocxExtractorService = DocxExtractorService;
exports.DocxExtractorService = DocxExtractorService = DocxExtractorService_1 = __decorate([
    (0, common_1.Injectable)()
], DocxExtractorService);
function round2(n) {
    return Math.round(n * 100) / 100;
}
//# sourceMappingURL=docx-extractor.service.js.map