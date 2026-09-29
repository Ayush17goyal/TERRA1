"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ocr_recovery_stage_1 = require("./ocr-recovery.stage");
jest.mock('tesseract.js', () => ({
    createWorker: jest.fn(),
}), { virtual: true });
describe('OcrRecoveryStage', () => {
    const stage = new ocr_recovery_stage_1.OcrRecoveryStage();
    it('returns no blocks and ocrUsed:false when nothing is flagged for OCR', async () => {
        const doc = {
            sourceFormat: 'text',
            blocks: [{ index: 0, text: 'hello', styleHints: {}, needsOCR: false }],
        };
        const result = await stage.recover(doc, Buffer.from(''));
        expect(result.blocks).toHaveLength(0);
        expect(result.ocrUsed).toBe(false);
    });
    it('runs tesseract for an image upload and returns a recovered OCRBlock', async () => {
        const { createWorker } = require('tesseract.js');
        const recognize = jest.fn().mockResolvedValue({ data: { text: 'recovered text', confidence: 87 } });
        const terminate = jest.fn().mockResolvedValue(undefined);
        createWorker.mockResolvedValue({ recognize, terminate });
        const doc = {
            sourceFormat: 'image',
            blocks: [{ index: 0, text: '', styleHints: {}, needsOCR: true }],
        };
        const result = await stage.recover(doc, Buffer.from('image bytes'));
        expect(result.ocrUsed).toBe(true);
        expect(result.blocks[0].text).toBe('recovered text');
        expect(result.blocks[0].confidence).toBeCloseTo(0.87);
        expect(terminate).toHaveBeenCalled();
    });
    it('reports scanned_pdf_ocr_unavailable for a flagged PDF (documented limitation, not faked)', async () => {
        const doc = {
            sourceFormat: 'pdf',
            blocks: [{ index: 0, text: '', styleHints: {}, needsOCR: true }],
        };
        const result = await stage.recover(doc, Buffer.from('pdf bytes'));
        expect(result.ocrUsed).toBe(false);
        expect(result.unavailableReason).toBe('scanned_pdf_ocr_unavailable');
        expect(result.blocks).toHaveLength(0);
    });
});
//# sourceMappingURL=ocr-recovery.stage.spec.js.map