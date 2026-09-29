"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const ingested_document_entity_1 = require("../document-engine/entities/ingested-document.entity");
const document_knowledge_record_entity_1 = require("../document-engine/entities/document-knowledge-record.entity");
const knowledge_engine_service_1 = require("./knowledge-engine.service");
const personal_exam_library_entity_1 = require("./entities/personal-exam-library.entity");
const topic_graph_edge_entity_1 = require("./entities/topic-graph-edge.entity");
const topic_knowledge_unit_entity_1 = require("./entities/topic-knowledge-unit.entity");
describe('KnowledgeEngineService (integration)', () => {
    let service;
    let documents;
    let records;
    let tkus;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            imports: [
                typeorm_1.TypeOrmModule.forRoot({
                    type: 'sqlite',
                    database: ':memory:',
                    entities: [
                        ingested_document_entity_1.IngestedDocumentEntity,
                        document_knowledge_record_entity_1.DocumentKnowledgeRecordEntity,
                        personal_exam_library_entity_1.PersonalExamLibraryEntity,
                        topic_knowledge_unit_entity_1.TopicKnowledgeUnitEntity,
                        topic_graph_edge_entity_1.TopicGraphEdgeEntity,
                    ],
                    synchronize: true,
                }),
                typeorm_1.TypeOrmModule.forFeature([
                    ingested_document_entity_1.IngestedDocumentEntity,
                    document_knowledge_record_entity_1.DocumentKnowledgeRecordEntity,
                    personal_exam_library_entity_1.PersonalExamLibraryEntity,
                    topic_knowledge_unit_entity_1.TopicKnowledgeUnitEntity,
                    topic_graph_edge_entity_1.TopicGraphEdgeEntity,
                ]),
            ],
            providers: [knowledge_engine_service_1.KnowledgeEngineService],
        }).compile();
        service = module.get(knowledge_engine_service_1.KnowledgeEngineService);
        documents = module.get((0, typeorm_1.getRepositoryToken)(ingested_document_entity_1.IngestedDocumentEntity));
        records = module.get((0, typeorm_1.getRepositoryToken)(document_knowledge_record_entity_1.DocumentKnowledgeRecordEntity));
        tkus = module.get((0, typeorm_1.getRepositoryToken)(topic_knowledge_unit_entity_1.TopicKnowledgeUnitEntity));
    });
    async function persistRecord(documentId, userId = 'user-1') {
        await documents.save(documents.create({
            id: documentId,
            userId,
            originalFilename: `${documentId}.txt`,
            mimeType: 'text/plain',
            sizeBytes: 1000,
            storagePath: `${documentId}.txt`,
            contentHash: `hash-${documentId}`,
            status: 'building_knowledge',
            confidenceScore: 0.86,
            stageProgress: {},
        }));
        const graph = {
            tree: { documentType: 'notes', documentTypeConfidence: 0.8, root: [] },
            sections: [
                {
                    id: 's1',
                    treeNodeId: null,
                    hierarchyPath: 'Contract Law > Offer',
                    sectionType: 'statutory_provision',
                    text: 'Section 2(a) defines proposal. A proposal is made when one person signifies willingness to do or abstain from doing anything.',
                    confidence: 0.9,
                    needsReview: false,
                },
                {
                    id: 's2',
                    treeNodeId: null,
                    hierarchyPath: 'Contract Law > Offer',
                    sectionType: 'notes_block',
                    text: 'The principle of offer is that willingness must be communicated. For example, an advertised reward can become an offer when acted upon.',
                    confidence: 0.85,
                    needsReview: false,
                },
            ],
            topicTags: { s1: [{ topic: 'Contract Law', confidence: 0.9 }], s2: [{ topic: 'Contract Law', confidence: 0.85 }] },
            subtopicTags: { s1: [{ topic: 'Contract Law', subtopic: 'Offer', confidence: 0.8 }], s2: [{ topic: 'Contract Law', subtopic: 'Offer', confidence: 0.8 }] },
            examConstructs: [
                { sectionId: 's2', constructType: 'principle', text: 'The principle of offer is that willingness must be communicated.' },
                { sectionId: 's2', constructType: 'exception', text: 'Exception: invitation to offer is not an offer.' },
            ],
            definitions: [
                { id: 'd1', sectionId: 's1', term: 'Proposal', definitionText: 'willingness to do or abstain from doing anything', definitionType: 'statutory', scope: 'local' },
                { id: 'd1-copy', sectionId: 's1', term: 'proposal', definitionText: 'willingness to do or abstain from doing anything', definitionType: 'statutory', scope: 'local' },
            ],
            illustrations: [
                { id: 'i1', sectionId: 's2', text: 'For example, an advertised reward can become an offer when acted upon.', illustrationType: 'instructional_hypothetical', linkedDefinitionId: 'd1', linkedConstructSectionId: null },
            ],
            cases: [
                { id: 'c1', sectionId: 's2', caseName: 'Carlill v Carbolic Smoke Ball Co', parties: null, court: null, year: '1893', mentionType: 'full', structured: { held: 'Reward advertisement could amount to an offer.' }, context: 'Carlill v Carbolic Smoke Ball Co (1893) held reward advertisement could amount to an offer.' },
                { id: 'c2', sectionId: 's2', caseName: 'Carlill vs. Carbolic Smoke Ball Co', parties: null, court: null, year: '1893', mentionType: 'mention', structured: null, context: 'Carlill mentioned again.' },
            ],
            citations: [],
            unresolvedReferences: [],
        };
        await records.save(records.create({ documentId, graph, retrievableUnits: [], dominantTopics: ['Contract Law'] }));
    }
    it('builds a user-isolated Personal Exam Library with deduplicated TKU entities', async () => {
        await persistRecord('doc-1');
        await service.buildFromDocument('doc-1');
        const library = await service.getLibrary('user-1');
        expect(library.status).toBe('ready');
        expect(library.topicsCount).toBe(1);
        expect(library.definitionsCount).toBe(1);
        const [tku] = await tkus.find({ where: { userId: 'user-1' } });
        expect(tku.topic).toBe('Contract Law');
        expect(tku.subtopic).toBe('Offer');
        expect(tku.definitions).toHaveLength(1);
        expect(tku.landmarkCases).toHaveLength(1);
        expect(tku.examples.length + tku.illustrations.length).toBeGreaterThan(0);
        expect(tku.coverageScore).toBeGreaterThan(0);
        expect(tku.version).toBeGreaterThan(1);
    });
    it('keeps identical material isolated across users', async () => {
        await persistRecord('doc-1', 'user-1');
        await persistRecord('doc-2', 'user-2');
        await service.buildFromDocument('doc-1');
        await service.buildFromDocument('doc-2');
        expect(await tkus.count({ where: { userId: 'user-1' } })).toBe(1);
        expect(await tkus.count({ where: { userId: 'user-2' } })).toBe(1);
    });
});
//# sourceMappingURL=knowledge-engine.service.spec.js.map