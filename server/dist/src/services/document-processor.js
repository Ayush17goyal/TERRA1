"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var DocumentProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentProcessor = void 0;
const common_1 = require("@nestjs/common");
const pdfParse = require("pdf-parse");
let DocumentProcessor = DocumentProcessor_1 = class DocumentProcessor {
    constructor() {
        this.logger = new common_1.Logger(DocumentProcessor_1.name);
    }
    async extractFromPDF(buffer, fileName) {
        try {
            const pdfData = await pdfParse(buffer);
            const text = String(pdfData.text || '').trim();
            const isScanned = this.isScannedPDF(text, pdfData);
            return {
                text,
                metadata: {
                    fileName,
                    fileType: 'PDF',
                    fileSize: buffer.length,
                    uploadedAt: new Date().toISOString(),
                    pageCount: pdfData.numpages || 1,
                    isScanned,
                    extractionMethod: isScanned ? 'OCR_FALLBACK' : 'PDF_TEXT_EXTRACTION',
                    confidence: isScanned ? 0.75 : 0.95,
                },
                isScanned,
                hasImages: Boolean(pdfData.version),
                language: 'en',
            };
        }
        catch (error) {
            this.logger.error(`PDF extraction failed: ${error.message}`);
            throw new Error(`Failed to extract text from PDF: ${error.message}`);
        }
    }
    async extractFromDOCX(buffer, fileName) {
        try {
            const { Document } = await Promise.resolve().then(() => require('docx'));
            const AdmZip = (await Promise.resolve().then(() => require('adm-zip'))).default;
            const zip = new AdmZip(buffer);
            let text = '';
            try {
                const documentXml = zip.readAsText('word/document.xml');
                text = this.extractTextFromDocumentXml(documentXml);
            }
            catch {
                text = buffer
                    .toString('utf8')
                    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            }
            return {
                text: text.trim(),
                metadata: {
                    fileName,
                    fileType: 'DOCX',
                    fileSize: buffer.length,
                    uploadedAt: new Date().toISOString(),
                    extractionMethod: 'DOCX_XML_PARSING',
                    confidence: 0.9,
                },
                isScanned: false,
                hasImages: false,
                language: 'en',
            };
        }
        catch (error) {
            this.logger.error(`DOCX extraction failed: ${error.message}`);
            throw new Error(`Failed to extract text from DOCX: ${error.message}`);
        }
    }
    async extractFromText(buffer, fileName) {
        try {
            const text = buffer.toString('utf8').trim();
            return {
                text,
                metadata: {
                    fileName,
                    fileType: 'TXT',
                    fileSize: buffer.length,
                    uploadedAt: new Date().toISOString(),
                    extractionMethod: 'TEXT_ENCODING',
                    confidence: 1.0,
                },
                isScanned: false,
                hasImages: false,
                language: 'en',
            };
        }
        catch (error) {
            this.logger.error(`Text extraction failed: ${error.message}`);
            throw new Error(`Failed to extract text: ${error.message}`);
        }
    }
    normalizeFileType(fileName, mimeType = '') {
        const extension = fileName.split('.').pop()?.toLowerCase() || '';
        if (extension === 'pdf' || mimeType.includes('pdf'))
            return 'PDF';
        if (extension === 'docx' || extension === 'doc' || mimeType.includes('word'))
            return 'DOCX';
        if (extension === 'md' || mimeType.includes('markdown'))
            return 'MD';
        if (extension === 'txt' || mimeType.includes('text'))
            return 'TXT';
        return 'UNKNOWN';
    }
    isScannedPDF(text, pdfData) {
        if (!text || text.length < 100)
            return true;
        const avgTextPerPage = text.length / Math.max(1, pdfData.numpages || 1);
        const isLikelyScanned = avgTextPerPage < 500;
        return isLikelyScanned;
    }
    extractTextFromDocumentXml(xmlContent) {
        try {
            const textMatches = xmlContent.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
            const texts = textMatches
                .map(match => match.replace(/<w:t[^>]*>/g, '').replace(/<\/w:t>/g, ''))
                .filter(Boolean);
            return texts.join(' ');
        }
        catch (error) {
            this.logger.warn('Failed to parse DOCX XML, returning empty');
            return '';
        }
    }
    createChunks(text, documentId, fileName, options = {}) {
        const chunkSize = options.chunkSize || 2000;
        const overlapSize = options.overlapSize || 300;
        const cleaned = String(text || '')
            .replace(/\s+/g, ' ')
            .trim();
        if (!cleaned)
            return [];
        const chunks = [];
        let offset = 0;
        let chunkIndex = 0;
        while (offset < cleaned.length) {
            const endIndex = Math.min(offset + chunkSize, cleaned.length);
            const chunkText = cleaned.slice(offset, endIndex).trim();
            if (!chunkText) {
                offset += chunkSize;
                continue;
            }
            const lastDot = chunkText.lastIndexOf('.');
            const breakPoint = lastDot > chunkSize * 0.7 ? lastDot + 1 : chunkText.length;
            const finalText = chunkText.slice(0, breakPoint).trim();
            if (finalText.length > 100) {
                chunks.push({
                    id: `${documentId}_chunk_${chunkIndex + 1}`,
                    text: finalText,
                    pageNumber: Math.floor(offset / (chunkSize * 3)) + 1,
                    chunkIndex,
                    confidence: 0.95,
                    startOffset: offset,
                    endOffset: offset + finalText.length,
                });
                chunkIndex++;
                offset += finalText.length - overlapSize;
            }
            else {
                offset += chunkSize;
            }
        }
        return chunks;
    }
    validateExtraction(text, metadata) {
        const cleaned = text.replace(/\s+/g, ' ').trim();
        const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
        const charCount = cleaned.length;
        const hasMinimumLength = charCount >= 450;
        const hasGoodWordCount = wordCount >= 50;
        const hasAlphaChars = /[A-Za-z]{3,}/.test(cleaned);
        const hasSentences = /[.!?]\s+[A-Z]/.test(cleaned);
        let qualityScore = 0;
        let message = '';
        if (!hasMinimumLength) {
            message = 'Document too short (< 450 characters)';
        }
        else if (!hasGoodWordCount) {
            message = 'Insufficient word count for processing';
        }
        else if (!hasAlphaChars) {
            message = 'No readable text detected (invalid encoding)';
        }
        else {
            qualityScore = Math.min(100, 30 + Math.min(40, wordCount / 50) + Math.min(30, charCount / 5000));
            message = `Quality score: ${Math.round(qualityScore)}`;
            if (hasSentences)
                qualityScore += 10;
            qualityScore = Math.min(100, qualityScore);
        }
        const isValid = hasMinimumLength && hasGoodWordCount && hasAlphaChars;
        return { isValid, qualityScore: Math.round(qualityScore), message };
    }
};
exports.DocumentProcessor = DocumentProcessor;
exports.DocumentProcessor = DocumentProcessor = DocumentProcessor_1 = __decorate([
    (0, common_1.Injectable)()
], DocumentProcessor);
//# sourceMappingURL=document-processor.js.map