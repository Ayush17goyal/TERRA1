import { LegalRetrievalService } from './legal-retrieval.service';
export declare class RetrievalController {
    private readonly legalRetrievalService;
    constructor(legalRetrievalService: LegalRetrievalService);
    search(query: string, limit?: string): Promise<import("./legal-retrieval.service").LegalRetrievalResponse>;
}
