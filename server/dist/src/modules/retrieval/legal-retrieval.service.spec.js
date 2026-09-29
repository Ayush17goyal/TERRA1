"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const legal_retrieval_service_1 = require("./legal-retrieval.service");
function provision(overrides) {
    return {
        id: `${overrides.actId}-${overrides.section}`,
        actId: overrides.actId || '',
        actName: overrides.actName || '',
        category: overrides.category || 'Test',
        part: overrides.part || '',
        chapter: overrides.chapter || '',
        section: overrides.section || '',
        subsection: overrides.subsection || '',
        clause: overrides.clause || '',
        title: overrides.title || '',
        content: overrides.content || 'Verified statutory text',
        keywords: overrides.keywords || [],
        contentHash: overrides.contentHash || 'hash',
        pdfSource: overrides.pdfSource || 'corpus-data/test/parsed-sections.json',
        embeddingSynced: true,
        embeddingVersion: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}
function makeService(rows) {
    const qdrantClient = { search: jest.fn(), scroll: jest.fn(), count: jest.fn(async () => ({ count: 0 })) };
    const repo = {
        manager: {
            query: jest.fn(async () => []),
        },
        find: jest.fn(async ({ where }) => rows.filter((row) => {
            return (!where.actId || row.actId === where.actId)
                && (!where.section || row.section === where.section)
                && (!where.subsection || row.subsection === where.subsection)
                && (!where.clause || row.clause === where.clause);
        })),
    };
    const service = new legal_retrieval_service_1.LegalRetrievalService({ getClient: () => qdrantClient }, { generateEmbedding: jest.fn() }, repo);
    return { service, repo, qdrantClient };
}
describe('LegalRetrievalService statutory isolation', () => {
    const corpus = [
        provision({ actId: 'companies_act_2013', actName: 'Companies Act, 2013', section: '16', title: 'Rectification of name of company' }),
        provision({ actId: 'specific_relief_act_1963', actName: 'Specific Relief Act, 1963', section: '16', title: 'Personal bars to relief' }),
        provision({ actId: 'limitation_act_1963', actName: 'Limitation Act, 1963', section: '5', title: 'Extension of prescribed period' }),
        provision({ actId: 'bharatiya_nyaya_sanhita_2023', actName: 'Bharatiya Nyaya Sanhita, 2023', section: '63', title: 'Rape' }),
        provision({ actId: 'indian_contract_act_1872', actName: 'Indian Contract Act, 1872', section: '10', title: 'What agreements are contracts', content: 'Section 10 - What agreements are contracts. All agreements are contracts if they are made by the free consent of parties competent to contract, for a lawful consideration and with a lawful object.' }),
        provision({ actId: 'constitution_of_india', actName: 'Constitution of India', section: 'Article 21', title: 'Protection of life and personal liberty', content: 'Article 21 - No person shall be deprived of his life or personal liberty except according to procedure established by law.' }),
    ];
    it('retrieves only Section 16 of the Companies Act, 2013', async () => {
        const { service, qdrantClient } = makeService(corpus);
        const result = await service.retrieveLegalContext('Explain Section 16 of Companies Act', 5);
        expect(result.detectedActId).toBe('companies_act_2013');
        expect(result.log.strategy).toBe('exact-sql');
        expect(result.log.rowsReturned).toBe(1);
        expect(result.provisions).toHaveLength(1);
        expect(result.provisions[0].actName).toBe('Companies Act, 2013');
        expect(result.provisions[0].section).toBe('16');
        expect(result.provisions.every((p) => p.actId === 'companies_act_2013')).toBe(true);
        expect(qdrantClient.search).not.toHaveBeenCalled();
    });
    it('retrieves only Section 5 of the Limitation Act', async () => {
        const { service, qdrantClient } = makeService(corpus);
        const result = await service.retrieveLegalContext('Explain Section 5 of Limitation Act', 5);
        expect(result.detectedActId).toBe('limitation_act_1963');
        expect(result.log.rowsReturned).toBe(1);
        expect(result.provisions).toHaveLength(1);
        expect(result.provisions[0].actName).toBe('Limitation Act, 1963');
        expect(result.provisions[0].section).toBe('5');
        expect(result.provisions.every((p) => p.actId === 'limitation_act_1963')).toBe(true);
        expect(qdrantClient.search).not.toHaveBeenCalled();
    });
    it('retrieves only Section 63 of Bharatiya Nyaya Sanhita', async () => {
        const { service, qdrantClient } = makeService(corpus);
        const result = await service.retrieveLegalContext('Explain Section 63 of Bharatiya Nyaya Sanhita', 5);
        expect(result.detectedActId).toBe('bharatiya_nyaya_sanhita_2023');
        expect(result.log.rowsReturned).toBe(1);
        expect(result.provisions).toHaveLength(1);
        expect(result.provisions[0].actName).toBe('Bharatiya Nyaya Sanhita, 2023');
        expect(result.provisions[0].section).toBe('63');
        expect(result.provisions.every((p) => p.actId === 'bharatiya_nyaya_sanhita_2023')).toBe(true);
        expect(qdrantClient.search).not.toHaveBeenCalled();
    });
    it('retrieves exact Section 10 of the Indian Contract Act before vector search', async () => {
        const { service, qdrantClient } = makeService(corpus);
        const result = await service.retrieveLegalContext('Explain Section 10 of Indian Contract Act', 5);
        expect(result.detectedActId).toBe('indian_contract_act_1872');
        expect(result.detectedType).toBe('section');
        expect(result.log.strategy).toBe('exact-sql');
        expect(result.log.confidence).toBe('high');
        expect(result.log.metadataMatch).toBe(true);
        expect(result.provisions).toHaveLength(1);
        expect(result.provisions[0].actName).toBe('Indian Contract Act, 1872');
        expect(result.provisions[0].section).toBe('10');
        expect(result.provisions[0].title).toBe('What agreements are contracts');
        expect(qdrantClient.search).not.toHaveBeenCalled();
    });
    it('retrieves exact Article 21 of the Constitution before vector search', async () => {
        const { service, qdrantClient } = makeService(corpus);
        const result = await service.retrieveLegalContext('Explain Article 21 Constitution', 5);
        expect(result.detectedActId).toBe('constitution_of_india');
        expect(result.detectedType).toBe('article');
        expect(result.log.strategy).toBe('exact-sql');
        expect(result.log.confidence).toBe('high');
        expect(result.provisions).toHaveLength(1);
        expect(result.provisions[0].actName).toBe('Constitution of India');
        expect(result.provisions[0].section).toBe('Article 21');
        expect(result.provisions[0].article).toBe('21');
        expect(qdrantClient.search).not.toHaveBeenCalled();
    });
    it('falls back to corpus-data parsed sections for exact statutory provisions when DB and Qdrant miss', async () => {
        const { service, qdrantClient } = makeService([]);
        qdrantClient.scroll.mockResolvedValue({ points: [] });
        const result = await service.retrieveLegalContext('Explain Section 10 of Indian Contract Act', 5);
        expect(result.detectedActId).toBe('indian_contract_act_1872');
        expect(result.log.confidence).toBe('high');
        expect(result.log.retrievedCollection).toBe('corpus-data');
        expect(result.provisions).toHaveLength(1);
        expect(result.provisions[0].actName).toBe('Indian Contract Act, 1872');
        expect(result.provisions[0].section).toBe('10');
        expect(result.provisions[0].title).toMatch(/agreements are contracts/i);
    });
    it('returns no reliable statutory provision for invalid references', async () => {
        const { service } = makeService(corpus);
        const result = await service.retrieveLegalContext('Explain Section 999 of Indian Contract Act', 5);
        expect(result.detectedActId).toBe('indian_contract_act_1872');
        expect(result.provisions).toHaveLength(0);
        expect(result.log.confidence).toBe('none');
        expect(result.log.promptContext).toBe('');
    });
    it('uses corpus-data fallback instead of mismatched DB rows', async () => {
        const mismatchedRows = [
            provision({ actId: 'specific_relief_act_1963', actName: 'Specific Relief Act, 1963', section: '16' }),
        ];
        const { service } = makeService(mismatchedRows);
        const result = await service.retrieveLegalContext('Explain Section 16 of Companies Act', 5);
        expect(result.detectedActId).toBe('companies_act_2013');
        expect(result.provisions).toHaveLength(1);
        expect(result.provisions[0].actId).toBe('companies_act_2013');
        expect(result.provisions[0].actName).toBe('Companies Act, 2013');
        expect(result.provisions[0].section).toBe('16');
        expect(result.log.confidence).toBe('high');
        expect(result.log.retrievedCollection).toBe('corpus-data');
    });
});
//# sourceMappingURL=legal-retrieval.service.spec.js.map