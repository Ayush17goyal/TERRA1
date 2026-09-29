"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var OcrRecoveryStage_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrRecoveryStage = void 0;
const common_1 = require("@nestjs/common");
let OcrRecoveryStage = OcrRecoveryStage_1 = class OcrRecoveryStage {
    constructor() {
        this.logger = new common_1.Logger(OcrRecoveryStage_1.name);
    }
    async recover(doc, buffer) {
        const flagged = doc.blocks.filter((b) => b.needsOCR);
        if (flagged.length === 0) {
            return { blocks: [], ocrUsed: false };
        }
        if (doc.sourceFormat === 'image') {
            const result = await this.runTesseract(buffer);
            return {
                ocrUsed: true,
                blocks: [
                    {
                        index: 0,
                        text: result.text,
                        confidence: result.confidence,
                        region: 'body',
                    },
                ],
            };
        }
        if (doc.sourceFormat === 'pdf') {
            return {
                ocrUsed: false,
                unavailableReason: 'scanned_pdf_ocr_unavailable',
                blocks: [],
            };
        }
        return { blocks: [], ocrUsed: false };
    }
    async runTesseract(buffer) {
        try {
            const { createWorker } = require('tesseract.js');
            const worker = await createWorker('eng');
            try {
                const { data } = await worker.recognize(buffer);
                return { text: data.text || '', confidence: (data.confidence ?? 0) / 100 };
            }
            finally {
                await worker.terminate();
            }
        }
        catch (error) {
            this.logger.error(`OCR failed: ${error.message}`);
            return { text: '', confidence: 0 };
        }
    }
};
exports.OcrRecoveryStage = OcrRecoveryStage;
exports.OcrRecoveryStage = OcrRecoveryStage = OcrRecoveryStage_1 = __decorate([
    (0, common_1.Injectable)()
], OcrRecoveryStage);
//# sourceMappingURL=ocr-recovery.stage.js.map