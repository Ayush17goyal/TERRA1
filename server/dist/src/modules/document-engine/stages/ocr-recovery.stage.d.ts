import { NormalizedDocument, OCRBlock } from '../types/document-graph.types';
export declare class OcrRecoveryStage {
    private readonly logger;
    recover(doc: NormalizedDocument, buffer: Buffer): Promise<{
        blocks: OCRBlock[];
        ocrUsed: boolean;
        unavailableReason?: string;
    }>;
    private runTesseract;
}
