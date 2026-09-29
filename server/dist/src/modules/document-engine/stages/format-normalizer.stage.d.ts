import { NormalizedDocument } from '../types/document-graph.types';
export declare class FormatNormalizerStage {
    private readonly logger;
    normalize(buffer: Buffer, mimeType: string, filename: string): Promise<NormalizedDocument>;
    private normalizePdf;
    private normalizeDocx;
    private normalizePptx;
    private normalizeImage;
    private normalizeText;
}
