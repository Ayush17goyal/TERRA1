import { Injectable, Logger } from '@nestjs/common';
import { NormalizedDocument, OCRBlock } from '../types/document-graph.types';

// architecture.md §3 Stage 1 (OCR & Layout Recovery):
// "For flagged pages/images, recover text and spatial layout ... Data produced: OCRBlock[] with
// per-word/line confidence scores, bounding boxes, region classification, and a page-level
// confidence score."
//
// SCOPE NOTE (documented limitation, not silently faked): this repo has no server-side PDF page
// rasterization (would require a native canvas/poppler dependency not currently installed).
// Standalone image uploads (PNG/JPG/TIFF, e.g. a photographed single-page notice) are run
// through real OCR via tesseract.js (pure WASM, no native build step). A scanned/image-only PDF
// is detected (Stage 0's `needsOCR` flag) but its pages cannot be rasterized here, so it is
// passed through with zero recovered text and an explicit `needsReview: scanned_pdf_ocr_unavailable`
// flag surfaced by the metadata-assembly stage — never presented as if OCR had silently succeeded.
@Injectable()
export class OcrRecoveryStage {
  private readonly logger = new Logger(OcrRecoveryStage.name);

  async recover(doc: NormalizedDocument, buffer: Buffer): Promise<{ blocks: OCRBlock[]; ocrUsed: boolean; unavailableReason?: string }> {
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
      // See SCOPE NOTE above.
      return {
        ocrUsed: false,
        unavailableReason: 'scanned_pdf_ocr_unavailable',
        blocks: [],
      };
    }

    return { blocks: [], ocrUsed: false };
  }

  private async runTesseract(buffer: Buffer): Promise<{ text: string; confidence: number }> {
    try {
      // Lazy require, mirroring this codebase's dynamic-require convention for optional heavy
      // dependencies (see FormatNormalizerStage's pdf-parse usage).
      const { createWorker } = require('tesseract.js');
      const worker = await createWorker('eng');
      try {
        const { data } = await worker.recognize(buffer);
        return { text: data.text || '', confidence: (data.confidence ?? 0) / 100 };
      } finally {
        await worker.terminate();
      }
    } catch (error: any) {
      this.logger.error(`OCR failed: ${error.message}`);
      return { text: '', confidence: 0 };
    }
  }
}
