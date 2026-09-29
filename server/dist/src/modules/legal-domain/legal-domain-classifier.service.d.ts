export declare const LEXMENTOR_REJECTION_RESPONSE = "LexMentor AI is designed exclusively for legal education and legal research. Please ask a question related to law.";
export declare const LEXMENTOR_WELCOME_MESSAGE = "Hello! Welcome to LEGATRIXON AI.\n\nI am your AI legal learning and research assistant. I can help you with legal research, case analysis, judgments, Bare Acts, drafting, mock tests, legal concepts, and other features available within the LEGATRIXON platform.\n\nMy responses are grounded in the legal resources available in LEGATRIXON, and I use the appropriate module based on your query.\n\nHow can I assist you today?";
type LegalClassification = {
    isLegal: boolean;
    confidence: number;
    reason: string;
};
export declare class LegalDomainClassifierService {
    classifySemantic(query: string): Promise<LegalClassification>;
    classify(query: string): LegalClassification;
    isLegalQuery(query: string): boolean;
    private isClearlyNonLegalDeliverable;
    private hasLegalSignal;
}
export {};
