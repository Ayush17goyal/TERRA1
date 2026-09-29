import type { PageData } from './extraction.types';
export declare class DocxExtractorService {
    private readonly logger;
    extract(buffer: Buffer): PageData[];
    private extractPageDimensions;
    private extractParagraphs;
    private extractRuns;
    private buildPages;
    private estimateParaHeight;
    private buildBlocksForPage;
}
