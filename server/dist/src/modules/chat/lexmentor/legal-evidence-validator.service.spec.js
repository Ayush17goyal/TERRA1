"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const legal_evidence_validator_service_1 = require("./legal-evidence-validator.service");
const baseAuthority = {
    id: 'a1',
    collection: 'Bare Acts',
    collectionName: 'Bare Acts',
    title: 'Indian Contract Act, 1872',
    sourceDocument: 'Indian Contract Act.pdf',
    section: '10',
    chunkText: 'Section 10 of the Indian Contract Act, 1872 states which agreements are contracts. Free consent, lawful consideration, lawful object, and competency are described in the provision.',
    retrievalScore: 0.91,
    rerankerScore: 0.88,
    authorityStrength: 0.8,
    metadata: {},
};
function context(authorities) {
    return {
        contextBlock: authorities.map((authority) => authority.chunkText).join('\n'),
        authorities,
        hasAuthoritativeSources: authorities.length > 0,
        tokenEstimate: 100,
    };
}
describe('LegalEvidenceValidator', () => {
    const validator = new legal_evidence_validator_service_1.LegalEvidenceValidator();
    it('allows definitive generation when retrieved evidence verifies the requested section', () => {
        const result = validator.validate({
            query: 'Explain Section 10 of Indian Contract Act',
            intent: 'Bare Act',
            context: context([baseAuthority]),
            retrievalConfidence: 0.9,
        });
        expect(result.confidence).toBe('high');
        expect(result.canGenerateDefinitiveAnswer).toBe(true);
        expect(result.sectionOrArticleExists).toBe(true);
    });
    it('blocks generation when the requested section is not present in retrieved sources', () => {
        const result = validator.validate({
            query: 'Explain Section 99 of Indian Contract Act',
            intent: 'Bare Act',
            context: context([baseAuthority]),
            retrievalConfidence: 0.9,
        });
        expect(result.canGenerateDefinitiveAnswer).toBe(false);
        expect(result.sectionOrArticleExists).toBe(false);
        expect(result.userMessage).toBe('I could not verify this information from the available legal sources.');
    });
    it('blocks generation when conflict signals are present in retrieved material', () => {
        const conflicted = {
            ...baseAuthority,
            chunkText: `${baseAuthority.chunkText} This view has been overruled and is no longer good law.`,
        };
        const result = validator.validate({
            query: 'Explain Section 10 of Indian Contract Act',
            intent: 'Bare Act',
            context: context([conflicted]),
            retrievalConfidence: 0.9,
        });
        expect(result.canGenerateDefinitiveAnswer).toBe(false);
        expect(result.hasConflictingSources).toBe(true);
        expect(result.userMessage).toContain('conflict or adverse-status signals');
    });
});
//# sourceMappingURL=legal-evidence-validator.service.spec.js.map