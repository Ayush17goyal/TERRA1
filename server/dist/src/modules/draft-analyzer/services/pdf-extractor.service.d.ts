import type { PageData } from './extraction.types';
export declare class PdfExtractorService {
    private readonly logger;
    extract(buffer: Buffer): Promise<PageData[]>;
}
