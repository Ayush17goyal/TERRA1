"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var PdfExtractorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfExtractorService = void 0;
const common_1 = require("@nestjs/common");
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = '';
let PdfExtractorService = PdfExtractorService_1 = class PdfExtractorService {
    constructor() {
        this.logger = new common_1.Logger(PdfExtractorService_1.name);
    }
    async extract(buffer) {
        const data = new Uint8Array(buffer);
        const pdfDoc = await pdfjsLib.getDocument({
            data,
            useSystemFonts: true,
            disableFontFace: true,
            isEvalSupported: false,
        }).promise;
        const pages = [];
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.0 });
            const pageWidth = viewport.width;
            const pageHeight = viewport.height;
            const textContent = await page.getTextContent({ includeMarkedContent: false });
            const spans = [];
            for (const item of textContent.items) {
                if (!item.str)
                    continue;
                const [a, b, , , tx, ty] = item.transform;
                const fontSize = Math.sqrt(a * a + b * b);
                if (fontSize < 0.5)
                    continue;
                const x = tx;
                const y = pageHeight - ty - (item.height || fontSize);
                const w = item.width || 0;
                const h = item.height || fontSize;
                spans.push({
                    str: item.str,
                    x: round2(x),
                    y: round2(y),
                    w: round2(w),
                    h: round2(h),
                    fontSize: round2(fontSize),
                    fontName: item.fontName || '',
                });
            }
            spans.sort((a, b) => a.y - b.y || a.x - b.x);
            const lines = groupSpansIntoLines(spans);
            const paraGroups = groupLinesIntoParagraphs(lines);
            const blocks = buildBlocks(paraGroups);
            const rawText = paraGroups
                .map(pg => pg.map(l => l.map(s => s.str).join('')).join('\n'))
                .join('\n\n');
            pages.push({
                pageNumber: pageNum,
                widthPt: round2(pageWidth),
                heightPt: round2(pageHeight),
                rawText,
                blocks,
            });
        }
        return pages;
    }
};
exports.PdfExtractorService = PdfExtractorService;
exports.PdfExtractorService = PdfExtractorService = PdfExtractorService_1 = __decorate([
    (0, common_1.Injectable)()
], PdfExtractorService);
function groupSpansIntoLines(spans) {
    if (!spans.length)
        return [];
    const lines = [];
    let current = [spans[0]];
    let lineY = spans[0].y;
    for (let i = 1; i < spans.length; i++) {
        const span = spans[i];
        const tolerance = Math.max(2, current[0].fontSize * 0.4);
        if (Math.abs(span.y - lineY) <= tolerance) {
            current.push(span);
        }
        else {
            lines.push(current);
            current = [span];
            lineY = span.y;
        }
    }
    lines.push(current);
    return lines;
}
function groupLinesIntoParagraphs(lines) {
    if (!lines.length)
        return [];
    const paragraphs = [];
    let current = [lines[0]];
    const avgFontSize = (l) => l.reduce((s, sp) => s + sp.fontSize, 0) / (l.length || 1);
    for (let i = 1; i < lines.length; i++) {
        const prevLineY = lines[i - 1][0].y;
        const prevH = lines[i - 1].reduce((m, s) => Math.max(m, s.h), 0);
        const curLineY = lines[i][0].y;
        const gap = curLineY - (prevLineY + prevH);
        const threshold = Math.max(4, avgFontSize(lines[i - 1]) * 0.8);
        if (gap > threshold) {
            paragraphs.push(current);
            current = [lines[i]];
        }
        else {
            current.push(lines[i]);
        }
    }
    paragraphs.push(current);
    return paragraphs;
}
function buildBlocks(paragraphs) {
    const blocks = [];
    let blockIndex = 0;
    paragraphs.forEach((lines, paraIdx) => {
        const allSpans = lines.flat();
        if (!allSpans.length)
            return;
        const paraBBox = boundingBox(allSpans);
        const paraText = lines.map(l => l.map(s => s.str).join('')).join('\n');
        const paraFont = dominantFont(allSpans);
        blocks.push({
            blockType: 'paragraph',
            blockIndex: blockIndex++,
            paragraphIndex: paraIdx,
            lineIndex: null,
            textContent: paraText,
            ...paraBBox,
            fontSize: paraFont.fontSize,
            fontName: paraFont.fontName,
            isBold: false,
            isItalic: false,
        });
        lines.forEach((lineSpans, lineIdx) => {
            if (!lineSpans.length)
                return;
            const lineBBox = boundingBox(lineSpans);
            const lineText = lineSpans.map(s => s.str).join('');
            const lineFont = dominantFont(lineSpans);
            blocks.push({
                blockType: 'line',
                blockIndex: blockIndex++,
                paragraphIndex: paraIdx,
                lineIndex: lineIdx,
                textContent: lineText,
                ...lineBBox,
                fontSize: lineFont.fontSize,
                fontName: lineFont.fontName,
                isBold: false,
                isItalic: false,
            });
        });
    });
    return blocks;
}
function boundingBox(spans) {
    const minX = Math.min(...spans.map(s => s.x));
    const minY = Math.min(...spans.map(s => s.y));
    const maxX = Math.max(...spans.map(s => s.x + s.w));
    const maxY = Math.max(...spans.map(s => s.y + s.h));
    return {
        x: round2(minX),
        y: round2(minY),
        width: round2(maxX - minX),
        height: round2(maxY - minY),
    };
}
function dominantFont(spans) {
    if (!spans.length)
        return { fontSize: null, fontName: null };
    const longest = spans.reduce((a, b) => (a.str.length >= b.str.length ? a : b));
    return { fontSize: longest.fontSize, fontName: longest.fontName || null };
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
//# sourceMappingURL=pdf-extractor.service.js.map