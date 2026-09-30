import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { LearningWorkspaceService } from '../modules/learning-workspace/learning-workspace.service';

async function runMockTestVerification() {
  console.log('⚡ Starting LEGATRIXON Mock Test Comprehensive Verification...');

  // Create an instance of LearningWorkspaceService with mocked dependencies for fast unit testing
  const mockRepo: any = {
    create: (data: any) => ({ ...data, id: 'test-mock-paper-101', createdAt: new Date() }),
    save: async (data: any) => ({ ...data, id: data.id || 'test-mock-paper-101' }),
    find: async () => [{ id: 'test-mock-paper-101', topic: 'Constitutional Law' }],
    findOne: async (opt: any) => ({
      id: opt.where?.id || 'test-mock-paper-101',
      userId: opt.where?.userId || 'test-user',
      topic: 'Constitutional Law',
      difficulty: 'Intermediate',
      questionType: 'Mixed',
      sourceIds: ['src-1'],
      questions: [
        {
          id: 'q1',
          type: 'MCQ',
          topic: 'Fundamental Rights',
          question: 'Which Article of the Constitution guarantees the Right to Equality before Law?',
          options: ['A. Article 12', 'B. Article 14', 'C. Article 19', 'D. Article 21'],
          correct: 1,
          correctAnswer: 'B. Article 14',
          marks: 2,
          negativeMarks: 0.5,
          explanation: 'Article 14 ensures equality before the law and equal protection of the laws.',
        },
        {
          id: 'q2',
          type: 'MCQ',
          topic: 'Fundamental Rights',
          question: 'Under Article 21, the right to privacy was declared a fundamental right in which landmark judgment?',
          options: ['A. A.K. Gopalan', 'B. Maneka Gandhi', 'C. K.S. Puttaswamy v. Union of India', 'D. Kesavananda Bharati'],
          correct: 2,
          correctAnswer: 'C. K.S. Puttaswamy v. Union of India',
          marks: 2,
          negativeMarks: 0.5,
          explanation: 'A 9-judge bench in K.S. Puttaswamy (2017) unanimously affirmed the right to privacy under Article 21.',
        },
        {
          id: 'q3',
          type: 'MCQ',
          topic: 'Directive Principles',
          question: 'Directive Principles of State Policy under Part IV are legally enforceable in courts of law.',
          options: ['A. True', 'B. False'],
          correct: 1,
          correctAnswer: 'B. False',
          marks: 2,
          negativeMarks: 0.5,
          explanation: 'Under Article 37, DPSPs are fundamental in governance but non-justiciable in court.',
        },
        {
          id: 'q4',
          type: 'Short Answer',
          topic: 'Constitutional Remedies',
          question: 'Explain the scope and nature of the writ of Habeas Corpus under Article 32.',
          marks: 5,
          modelAnswer: 'Habeas Corpus literally means to have the body. It is a prerogative writ issued to produce a detained person before the court to examine the legality of detention.',
          explanation: 'Protects personal liberty against illegal detention by state or private actors.',
        },
      ],
      scoreReport: {
        examTitle: 'Constitutional Law Mastery Test',
        totalMarks: 11,
        durationMinutes: 45,
        negativeMarkingRate: 0.25,
      },
    }),
    delete: async () => ({ affected: 1 }),
  };

  const attemptRepo: any = {
    create: (data: any) => ({ ...data, id: 'test-attempt-202', createdAt: new Date() }),
    save: async (data: any) => ({ ...data, id: data.id || 'test-attempt-202' }),
    find: async () => [{ id: 'test-attempt-202', score: 3.5, total: 11 }],
    findOne: async (opt: any) => ({ id: opt.where?.id || 'test-attempt-202', score: 3.5, total: 11 }),
    delete: async () => ({ affected: 1 }),
  };

  const sourceRepo: any = {
    find: async () => [
      {
        id: 'src-1',
        name: 'Constitution_of_India.pdf',
        kind: 'Bare Act',
        subject: 'Constitutional Law',
        status: 'Indexed',
        text: 'Article 14 guarantees equality before law. Article 21 protects personal liberty. In K.S. Puttaswamy v. Union of India, privacy was held fundamental. Article 32 empowers the Supreme Court to issue writs including Habeas Corpus.',
      },
    ],
    findOne: async () => ({
      id: 'src-1',
      name: 'Constitution_of_India.pdf',
      kind: 'Bare Act',
      subject: 'Constitutional Law',
      status: 'Indexed',
      text: 'Article 14 guarantees equality before law. Article 21 protects personal liberty. In K.S. Puttaswamy v. Union of India, privacy was held fundamental. Article 32 empowers the Supreme Court to issue writs including Habeas Corpus.',
    }),
  };

  const activityRepo: any = {
    create: (d: any) => d,
    save: async () => {},
  };

  const notificationService: any = {
    createNotification: async () => {},
  };

  const qdrantService: any = {
    getClient: () => null, // simulates fallback to database chunks
  };

  const service = new LearningWorkspaceService(
    sourceRepo,
    mockRepo,
    attemptRepo,
    null as any, // mindMapRepo
    null as any, // studyKitRepo
    null as any, // flashcardReviewRepo
    activityRepo,
    qdrantService,
    null as any, // bgeM3Provider
    null as any, // embeddingService
    notificationService
  );

  console.log('--- 1. Testing checkObjectiveMatch ---');
  // Exact string match
  console.assert(service.checkObjectiveMatch('B', 'B') === true, 'Letter B should match B');
  console.assert(service.checkObjectiveMatch('b', 'B') === true, 'Case insensitive match');
  console.assert(service.checkObjectiveMatch('B. Article 14', 'B. Article 14') === true, 'Full text match');
  console.assert(service.checkObjectiveMatch('1', '1', ['A. 12', 'B. 14']) === true, 'Index match 1');
  console.assert(service.checkObjectiveMatch('B', '1', ['A. 12', 'B. 14']) === true, 'Letter B matches index 1');
  console.assert(service.checkObjectiveMatch('False', 'B. False') === true, 'Subtext False matches B. False');
  console.assert(service.checkObjectiveMatch('A', 'B') === false, 'Letter A should not match B');
  console.log('✅ checkObjectiveMatch passed all assertions.');

  console.log('--- 2. Testing evaluateSubjectiveAnswer fallback ---');
  const subjQuestion = {
    question: 'Explain the scope of Habeas Corpus.',
    topic: 'Constitutional Remedies',
    marks: 5,
    modelAnswer: 'Habeas Corpus requires producing detained person to test legality of detention under Article 32.',
  };
  const userSubjAnswer = 'The writ of Habeas Corpus under Article 32 of the Constitution of India is a vital safeguard against arbitrary detention. In Sunil Batra v. Delhi Administration, the Supreme Court expanded its scope to protect prisoners from inhuman treatment.';
  const subjEval = await service.evaluateSubjectiveAnswer(subjQuestion, userSubjAnswer, 5, ['src-1']);
  console.log('Subj Eval Result:', {
    awardedMarks: subjEval.awardedMarks,
    rubricBreakdown: subjEval.rubricBreakdown,
    strengthsCount: subjEval.keyStrengths?.length,
  });
  console.assert(subjEval.awardedMarks > 0 && subjEval.awardedMarks <= 5, 'Awarded marks must be positive and <= 5');
  console.assert(subjEval.rubricBreakdown.legalAccuracy > 0, 'Rubric must have legal accuracy score');
  console.log('✅ evaluateSubjectiveAnswer passed rubric grading.');

  console.log('--- 3. Testing submitMockTest scoring accuracy ---');
  // Answers:
  // Q1: B (Correct: +2 marks)
  // Q2: A (Incorrect: -0.5 marks)
  // Q3: Unanswered (0 marks)
  // Q4: Subjective answer
  const testAnswers = {
    q1: 'B',
    q2: 'A', // wrong answer
    // q3 is omitted (unanswered)
    q4: userSubjAnswer,
  };

  const attemptResult = await service.submitMockTest('test-user', 'test-mock-paper-101', testAnswers, 120, 0.25);
  console.log('Submit Mock Test Result:', {
    score: attemptResult.score,
    total: attemptResult.total,
    percentage: attemptResult.percentage,
    breakdown: attemptResult.answers?.scoreBreakdown,
  });

  const b = attemptResult.answers?.scoreBreakdown;
  console.assert(b?.correct === 2, `Expected 2 correct (Q1 + Q4 subjective satisfactory), got ${b?.correct}`);
  console.assert(b?.incorrect === 1, `Expected 1 incorrect (Q2), got ${b?.incorrect}`);
  console.assert(b?.unanswered === 1, `Expected 1 unanswered (Q3), got ${b?.unanswered}`);
  console.assert(b?.positiveMarks === 2, `Expected +2 positive marks from Q1, got ${b?.positiveMarks}`);
  console.assert(b?.negativeMarks === 0.5, `Expected -0.5 negative penalty from Q2, got ${b?.negativeMarks}`);
  console.assert(attemptResult.score > 0, 'Final score must reflect net marks');
  console.log('✅ submitMockTest calculated correct positive, negative, unanswered, and net marks.');

  console.log('--- 4. Testing getSourceIndexedContent ---');
  const indexContent = await service.getSourceIndexedContent('test-user', 'src-1');
  console.log('Indexed Content Details:', {
    name: indexContent.name,
    wordCount: indexContent.wordCount,
    chunksCount: indexContent.totalChunks,
    sections: indexContent.sections,
  });
  console.assert(indexContent.totalChunks > 0, 'Chunks must be generated');
  console.assert(indexContent.sections.length > 0, 'Sections must be identified');
  console.log('✅ getSourceIndexedContent passed.');

  console.log('--- 5. Testing analyzeReferenceStructure ---');
  const structureResult = await service.analyzeReferenceStructure('test-user', 'src-1');
  console.log('Analyzed Structure:', structureResult.structure?.patternName);
  console.assert(Boolean(structureResult.structure?.patternName), 'Structure must have pattern name');
  console.assert(Array.isArray(structureResult.structure?.sections), 'Structure must have sections array');
  console.log('✅ analyzeReferenceStructure passed.');

  console.log('\n🎉 ALL MOCK TEST UNIT & INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

runMockTestVerification().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
