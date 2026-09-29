import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TopicKnowledgeUnitEntity } from '../knowledge-engine/entities/topic-knowledge-unit.entity';
import { QuestionBankEntryEntity } from '../question-bank/entities/question-bank-entry.entity';
import { ModelAnswerEntryEntity } from './entities/model-answer-entry.entity';
import { ModelAnswerService } from './model-answer.service';

describe('ModelAnswerService (integration)', () => {
  let service: ModelAnswerService;
  let tkus: Repository<TopicKnowledgeUnitEntity>;
  let questions: Repository<QuestionBankEntryEntity>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [TopicKnowledgeUnitEntity, QuestionBankEntryEntity, ModelAnswerEntryEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([TopicKnowledgeUnitEntity, QuestionBankEntryEntity, ModelAnswerEntryEntity]),
      ],
      providers: [ModelAnswerService],
    }).compile();

    service = module.get(ModelAnswerService);
    tkus = module.get(getRepositoryToken(TopicKnowledgeUnitEntity));
    questions = module.get(getRepositoryToken(QuestionBankEntryEntity));
  });

  async function seedValidatedQuestion(userId = 'user-1') {
    const source = { documentId: 'doc-1', sectionId: 's1', entityId: 'd1', sourceType: 'document' as const };
    const tku = await tkus.save(
      tkus.create({
        userId,
        topic: 'Contract Law',
        subtopic: 'Offer',
        summary: 'Offer under contract law.',
        definitions: [{ id: 'd1', term: 'Proposal', definitionText: 'willingness to do or abstain', definitionType: 'statutory', sourceRefs: [source] }],
        legalProvisions: [{ id: 'p1', text: 'Section 2(a) defines proposal.', normalizedKey: 'section 2 a', sourceRefs: [{ ...source, entityId: 'p1' }] }],
        principles: [{ id: 'pr1', text: 'Offer must be communicated.', constructType: 'principle', sourceRefs: [{ ...source, entityId: 'pr1' }] }],
        exceptions: [{ id: 'e1', text: 'Invitation to offer is not an offer.', qualifiesPrincipleId: 'pr1', sourceRefs: [{ ...source, entityId: 'e1' }] }],
        landmarkCases: [{ id: 'c1', caseName: 'Carlill v Carbolic Smoke Ball Co', court: null, year: '1893', structured: { held: 'Reward advertisement can be offer.' }, isLandmark: true, isReferenced: false, sourceRefs: [{ ...source, entityId: 'c1' }] }],
        referencedCases: [],
        illustrations: [{ id: 'i1', text: 'Reward advertisement example.', exampleType: 'instructional_hypothetical', illustratesEntityId: 'd1', sourceRefs: [{ ...source, entityId: 'i1' }] }],
        examples: [],
        comparisons: [],
        keywords: [{ value: 'offer', weight: 1 }, { value: 'proposal', weight: 0.8 }],
        references: [source],
        coverageScore: 0.9,
        confidenceScore: 0.86,
      }),
    );
    const question = await questions.save(
      questions.create({
        userId,
        planId: 'plan-1',
        slotId: 'slot-1',
        tkuId: tku.id,
        question: 'Explain Offer under Contract Law, covering Proposal and Section 2(a).',
        questionType: 'long',
        difficulty: 'medium',
        topic: tku.topic,
        subtopic: tku.subtopic,
        markValue: 10,
        rubric: [{ label: 'Legal basis', marks: 4, criteria: 'Identify law.', boundEntityRefs: ['d1'] }, { label: 'Explanation', marks: 4, criteria: 'Explain.', boundEntityRefs: ['pr1'] }, { label: 'Conclusion', marks: 2, criteria: 'Conclude.', boundEntityRefs: ['d1'] }],
        boundEntityRefs: [{ entityId: 'd1', entityType: 'definition', label: 'Proposal', tkuId: tku.id }, { entityId: 'p1', entityType: 'provision', label: 'Section 2(a)', tkuId: tku.id }, { entityId: 'pr1', entityType: 'principle', label: 'Offer must be communicated', tkuId: tku.id }],
        groundingSources: [source, { ...source, entityId: 'p1' }, { ...source, entityId: 'pr1' }],
        qualityScore: 0.86,
        validationStatus: 'valid',
        validationReasons: [],
        sourceTkuVersion: tku.version || 1,
      }),
    );
    return { tku, question };
  }

  it('creates grounded model answers for validated question bank entries', async () => {
    await seedValidatedQuestion();

    const summary = await service.createAnswerBank('user-1');
    const [answer] = await service.listForUser('user-1');

    expect(summary.generated).toBe(1);
    expect(summary.valid).toBe(1);
    expect(answer.validationStatus).toBe('valid');
    expect(answer.components.map((component) => component.type)).toEqual([
      'introduction',
      'relevant_sections',
      'legal_principles',
      'explanation',
      'case_law',
      'critical_analysis',
      'conclusion',
      'examiner_keywords',
    ]);
    expect(answer.components.every((component) => component.paragraphs.every((paragraph) => paragraph.boundEntityRefs.length > 0 && paragraph.groundingSources.length > 0))).toBe(true);
    expect(answer.examinerKeywords.length).toBeGreaterThan(0);
    expect(answer.qualityScore).toBeGreaterThan(0);
  });

  it('does not create answers for invalid questions or other users', async () => {
    await seedValidatedQuestion('user-1');
    await seedValidatedQuestion('user-2');
    await questions.update({ userId: 'user-2' }, { validationStatus: 'rejected' as any });

    await service.createAnswerBank('user-1');
    await service.createAnswerBank('user-2');

    expect(await service.listForUser('user-1')).toHaveLength(1);
    expect(await service.listForUser('user-2')).toHaveLength(0);
  });

  it('regenerates rejected answer drafts before storing the validated answer', async () => {
    await seedValidatedQuestion();

    const summary = await service.createAnswerBank('user-1');
    const [answer] = await service.listForUser('user-1');

    expect(summary.attempts).toBeGreaterThan(1);
    expect(summary.rejected).toBeGreaterThan(0);
    expect(answer.validationStatus).toBe('valid');
    expect(answer.validationReasons).toHaveLength(0);
  });

  it('rejects hallucinated case law and stores only the regenerated grounded answer', async () => {
    const { tku } = await seedValidatedQuestion();
    await tkus.update({ id: tku.id }, { landmarkCases: [], referencedCases: [] });

    const summary = await service.createAnswerBank('user-1');
    const [answer] = await service.listForUser('user-1');
    const caseLaw = answer.components.find((component) => component.type === 'case_law');

    expect(summary.rejected).toBeGreaterThan(0);
    expect(answer.validationStatus).toBe('valid');
    expect(caseLaw?.paragraphs[0].text).not.toContain('Kesavananda Bharati');
    expect(caseLaw?.paragraphs[0].groundingSources.length).toBeGreaterThan(0);
  });
});

