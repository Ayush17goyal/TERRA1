"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var FormatNormalizerStage_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormatNormalizerStage = void 0;
const common_1 = require("@nestjs/common");
const AdmZip = require("adm-zip");
let FormatNormalizerStage = FormatNormalizerStage_1 = class FormatNormalizerStage {
    constructor() {
        this.logger = new common_1.Logger(FormatNormalizerStage_1.name);
    }
    async normalize(buffer, mimeType, filename) {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        if (ext === 'pdf' || mimeType === 'application/pdf') {
            return this.normalizePdf(buffer);
        }
        if (ext === 'docx' || mimeType.includes('wordprocessingml')) {
            return this.normalizeDocx(buffer);
        }
        if (ext === 'pptx' || ext === 'ppt' || mimeType.includes('presentationml')) {
            return this.normalizePptx(buffer);
        }
        if (['png', 'jpg', 'jpeg', 'tiff'].includes(ext) || mimeType.startsWith('image/')) {
            return this.normalizeImage();
        }
        return this.normalizeText(buffer);
    }
    async normalizePdf(buffer) {
        let text = '';
        let numPages = 1;
        try {
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(buffer);
            text = data.text || '';
            numPages = data.numpages || 1;
        }
        catch (error) {
            this.logger.error(`PDF parsing failed: ${error.message}`);
            throw new Error(`Unable to parse PDF: ${error.message}`);
        }
        const charsPerPage = text.length / Math.max(numPages, 1);
        const likelyScanned = charsPerPage < 40;
        const rawParagraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
        const blocks = rawParagraphs.map((paragraph, index) => ({
            index,
            text: paragraph,
            page: undefined,
            styleHints: {},
            needsOCR: likelyScanned,
        }));
        if (blocks.length === 0) {
            blocks.push({ index: 0, text: '', styleHints: {}, needsOCR: true });
        }
        return { blocks, sourceFormat: 'pdf' };
    }
    normalizeDocx(buffer) {
        const zip = new AdmZip(buffer);
        const entry = zip.getEntry('word/document.xml');
        if (!entry)
            throw new Error('Invalid DOCX: word/document.xml not found');
        const xml = entry.getData().toString('utf8');
        const paragraphXmls = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
        const blocks = [];
        paragraphXmls.forEach((paragraphXml, index) => {
            const runs = paragraphXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
            const text = runs
                .map((r) => r.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, ''))
                .join('')
                .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
                .trim();
            if (!text)
                return;
            const headingMatch = paragraphXml.match(/w:pStyle w:val="Heading(\d)"/);
            const isBold = /<w:b\/>|<w:b w:val="(1|true)"\/>/.test(paragraphXml);
            blocks.push({
                index,
                text,
                styleHints: {
                    bold: isBold,
                    nativeHeadingLevel: headingMatch ? Number(headingMatch[1]) : undefined,
                    isListItem: /<w:numPr>/.test(paragraphXml),
                },
                needsOCR: false,
            });
        });
        return { blocks, sourceFormat: 'docx' };
    }
    normalizePptx(buffer) {
        const zip = new AdmZip(buffer);
        const slideEntries = zip
            .getEntries()
            .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
            .sort((a, b) => {
            const na = Number(a.entryName.match(/slide(\d+)\.xml/)?.[1] || 0);
            const nb = Number(b.entryName.match(/slide(\d+)\.xml/)?.[1] || 0);
            return na - nb;
        });
        const blocks = [];
        let index = 0;
        slideEntries.forEach((entry, slideIdx) => {
            const xml = entry.getData().toString('utf8');
            const isTitleShape = (shapeXml) => /<p:ph[^>]*type="(title|ctrTitle)"/.test(shapeXml);
            const shapes = xml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) || [];
            shapes.forEach((shapeXml) => {
                const runs = shapeXml.match(/<a:t>([\s\S]*?)<\/a:t>/g) || [];
                const text = runs
                    .map((r) => r.replace(/<a:t>/, '').replace(/<\/a:t>/, ''))
                    .join(' ')
                    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                    .trim();
                if (!text)
                    return;
                blocks.push({
                    index: index++,
                    text,
                    slide: slideIdx + 1,
                    styleHints: { nativeHeadingLevel: isTitleShape(shapeXml) ? 1 : undefined },
                    needsOCR: false,
                });
            });
        });
        return { blocks, sourceFormat: 'pptx' };
    }
    normalizeImage() {
        return { blocks: [{ index: 0, text: '', styleHints: {}, needsOCR: true }], sourceFormat: 'image' };
    }
    normalizeText(buffer) {
        const text = buffer.toString('utf8');
        const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
        const blocks = paragraphs.map((paragraph, index) => ({
            index,
            text: paragraph,
            styleHints: { nativeHeadingLevel: /^#{1,6}\s/.test(paragraph) ? paragraph.match(/^#+/)[0].length : undefined },
            needsOCR: false,
        }));
        return { blocks, sourceFormat: 'text' };
    }
};
exports.FormatNormalizerStage = FormatNormalizerStage;
exports.FormatNormalizerStage = FormatNormalizerStage = FormatNormalizerStage_1 = __decorate([
    (0, common_1.Injectable)()
], FormatNormalizerStage);
//# sourceMappingURL=format-normalizer.stage.js.map