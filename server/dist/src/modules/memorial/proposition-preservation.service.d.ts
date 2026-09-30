import { CaseDossier } from './memorial.types';
interface ExtractedDocument {
    rawText: string;
    pages: string[];
}
export declare class PropositionPreservationService {
    extractDocument(file?: any, fallbackText?: string): Promise<ExtractedDocument>;
    extractText(file?: any, fallbackText?: string): Promise<string>;
    buildDossier(documentOrText: ExtractedDocument | string, sourceName?: string): CaseDossier;
    private extractPdf;
    private extractDocx;
    private normalize;
    private splitFallbackPages;
    private classifyPage;
    private toParagraphs;
    private splitLongParagraph;
    private classifyParagraph;
    private isCompetitionRule;
    private isOrganiser;
    private isConcept;
    private caseFactScore;
    private count;
    private extractHeadings;
    private extractTables;
    private extractFootnotes;
    private extractTimeline;
    private extractParties;
    private extractLegalTriggers;
    private detectLawArea;
    private extractRules;
    private extractUnresolvedQuestions;
}
export {};
