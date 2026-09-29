import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionBankEntryEntity } from '../question-bank/entities/question-bank-entry.entity';
import { QuestionPlanEntity } from '../question-planning/entities/question-plan.entity';
import { PlannedQuestionType, QuestionMarkValue } from '../question-planning/question-planning.types';
import { MockTestPaperEntity } from './entities/mock-test-paper.entity';
import { MockTestPaperQuestionEntity } from './entities/mock-test-paper-question.entity';
import { MockTestEngineService } from './mock-test-engine.service';

describe('MockTestEngineService (integration)', () => {
  let service: MockTestEngineService;
  let bank: Repository<QuestionBankEntryEntity>;
  let plans: Repository<QuestionPlanEntity>;
  let papers: Repository<MockTestPaperEntity>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [QuestionBankEntryEntity, QuestionPlanEntity, MockTestPaperEntity, MockTestPaperQuestionEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([QuestionBankEntryEntity, QuestionPlanEntity, MockTestPaperEntity, MockTestPaperQuestionEntity]),
      ],
      providers: [MockTestEngineService],
    }).compile();

    service = module.get(MockTestEngineService);
    bank = module.get(getRepositoryToken(QuestionBankEntryEntity));
    plans = module.get(getRepositoryToken(QuestionPlanEntity));
    papers = module.get(getRepositoryToken(MockTestPaperEntity));
  });

  async function seedCoverage(userId = 'user-1') {
    await plans.save(
      plans.create({
        userId,
        status: 'ready',
        coverageMatrix: [
          { tkuId: 'tku-contract', topic: 'Contract Law', subtopic: 'Offer', coverageScore: 0.9, confidenceScore: 0.86, eligibleCells: 4, blockedCells: 0, cells: [] },
          { tkuId: 'tku-tort', topic: 'Tort Law', subtopic: 'Negligence', coverageScore: 0.82, confidenceScore: 0.8, eligibleCells: 4, blockedCells: 0, cells: [] },
        ],
        markDistribution: [],
        typeDistribution: [],
        questionRequirements: [],
        summary: { totalSlots: 8, totalMarks: 80, topicCount: 2, generatedFromTkuVersions: {} },
      }),
    );
  }

  async function seedQuestion(
    userId: string,
    index: number,
    markValue: QuestionMarkValue,
    questionType: PlannedQuestionType,
    topic = index % 2 === 0 ? 'Contract Law' : 'Tort Law',
  ) {
    return bank.save(
      bank.create({
        userId,
        planId: `plan-${userId}`,
        slotId: `slot-${userId}-${index}`,
        tkuId: topic === 'Contract Law' ? 'tku-contract' : 'tku-tort',
        question: `Question ${index}: Discuss ${topic} issue ${index} with grounded authorities.`,
        questionType,
        difficulty: index % 3 === 0 ? 'hard' : index % 2 === 0 ? 'medium' : 'easy',
        topic,
        subtopic: topic === 'Contract Law' ? 'Offer' : 'Negligence',
        markValue,
        rubric: [{ label: 'Core answer', marks: markValue, criteria: 'Grounded analysis', boundEntityRefs: ['ref-1'] }],
        boundEntityRefs: [{ entityId: `entity-${index}`, entityType: 'principle', label: 'Principle', tkuId: topic === 'Contract Law' ? 'tku-contract' : 'tku-tort' }],
        groundingSources: [{ documentId: 'doc-1', sourceType: 'document' }],
        qualityScore: 0.75 + index * 0.01,
        validationStatus: 'valid',
        validationReasons: [],
        sourceTkuVersion: 1,
      }),
    );
  }

  async function seedRevisionBank(userId = 'user-1') {
    await seedCoverage(userId);
    const types: PlannedQuestionType[] = ['short', 'analytical', 'case_based', 'long'];
    for (let index = 1; index <= 4; index++) await seedQuestion(userId, index, 5, types[index - 1]);
    for (let index = 5; index <= 8; index++) await seedQuestion(userId, index, 10, types[index - 5]);
  }

  it('assembles a mock test from existing validated questions and generates a PDF', async () => {
    await seedRevisionBank();

    const result = await service.generatePaper('user-1', { prompt: 'revision paper for 30 marks in 60 minutes', mode: 'revision' });
    const pdf = await service.getPaperPdf('user-1', result.paperId);
    const saved = await papers.findOneByOrFail({ id: result.paperId });

    expect(result.status).toBe('ready');
    expect(result.selectedQuestions).toHaveLength(4);
    expect(result.totalMarks).toBe(30);
    expect(result.generationTimeMs).toBeLessThan(3000);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(saved.pdfBase64.length).toBeGreaterThan(100);
  });

  it('keeps mock test generation isolated by user', async () => {
    await seedRevisionBank('user-1');
    await seedCoverage('user-2');

    const result = await service.generatePaper('user-2', { prompt: 'revision 30 marks', mode: 'revision' });

    expect(result.status).toBe('failed');
    expect(result.selectedQuestions).toHaveLength(0);
    expect((await service.listPapers('user-1')).length).toBe(0);
    expect((await service.listPapers('user-2')).length).toBe(1);
  });

  it('prevents duplicate question reuse when enough alternatives exist', async () => {
    await seedRevisionBank();

    const first = await service.generatePaper('user-1', { prompt: 'revision 30 marks', mode: 'revision' });
    const second = await service.generatePaper('user-1', { prompt: 'revision 30 marks', mode: 'revision' });
    const firstIds = new Set(first.selectedQuestions.map((question) => question.questionId));
    const overlap = second.selectedQuestions.filter((question) => firstIds.has(question.questionId));

    expect(first.status).toBe('ready');
    expect(second.status).toBe('ready');
    expect(overlap).toHaveLength(0);
  });

  it('records shortfalls instead of generating missing questions', async () => {
    await seedCoverage();
    await seedQuestion('user-1', 1, 5, 'short');

    const result = await service.generatePaper('user-1', { prompt: 'university paper 100 marks', mode: 'university' });

    expect(result.status).toBe('partial');
    expect(result.selectedQuestions).toHaveLength(1);
    expect(result.shortfalls.length).toBeGreaterThan(0);
    expect(result.totalMarks).toBe(5);
  });
});
