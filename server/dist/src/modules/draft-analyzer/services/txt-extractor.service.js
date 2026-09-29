"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TxtExtractorService = void 0;
const common_1 = require("@nestjs/common");
const PAGE_WIDTH_PT = 612;
const PAGE_HEIGHT_PT = 792;
const MARGIN_PT = 72;
const CONTENT_WIDTH_PT = PAGE_WIDTH_PT - MARGIN_PT * 2;
const FONT_SIZE_PT = 12;
const LINE_HEIGHT_PT = FONT_SIZE_PT * 1.5;
const LINES_PER_PAGE = Math.floor((PAGE_HEIGHT_PT - MARGIN_PT * 2) / LINE_HEIGHT_PT);
let TxtExtractorService = class TxtExtractorService {
    extract(buffer) {
        const text = buffer.toString('utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const rawParagraphs = text
            .split(/\n{2,}/)
            .map(p => p.trim())
            .filter(Boolean);
        const paragraphs = rawParagraphs.map(p => ({
            text: p,
            lines: p.split('\n'),
        }));
        const pages = [];
        let linesSoFar = 0;
        let pageParas = [];
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
            linesSoFar += lineCount + 1;
        }
        if (pageParas.length > 0)
            flushPage();
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
};
exports.TxtExtractorService = TxtExtractorService;
exports.TxtExtractorService = TxtExtractorService = __decorate([
    (0, common_1.Injectable)()
], TxtExtractorService);
function buildPage(paragraphs, pageNumber) {
    const blocks = [];
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
        cursorY += paraHeight + LINE_HEIGHT_PT;
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
function round2(n) {
    return Math.round(n * 100) / 100;
}
//# sourceMappingURL=txt-extractor.service.js.map