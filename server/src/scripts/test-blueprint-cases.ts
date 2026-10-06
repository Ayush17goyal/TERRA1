import { LearningWorkspaceService } from '../modules/learning-workspace/learning-workspace.service';

async function testBlueprintCompliance() {
  console.log('🧪 Testing Mock Test Blueprint Strict Compliance...\n');

  const service = new (LearningWorkspaceService as any)({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {});

  // TEST CASE 1: Section A: Generate 5, Attempt 4
  console.log('--- TEST CASE 1: Single Section (Generate 5, Attempt 4) ---');
  const bp1 = service.resolveMockBlueprint({
    sections: [
      { name: 'Section A', questionsGenerated: 5, questionsToAttempt: 4, marksPerQuestion: 5, questionTypes: ['Descriptive'] }
    ]
  });
  console.log(`Generated: ${bp1.totalQuestionsGenerated} (Expected: 5)`);
  console.log(`To Attempt: ${bp1.totalQuestionsToAttempt} (Expected: 4)`);
  console.log(`Max Marks: ${bp1.maximumObtainableMarks} (Expected: 20)`);
  if (bp1.totalQuestionsGenerated !== 5 || bp1.totalQuestionsToAttempt !== 4) throw new Error('Test Case 1 Failed!');

  // TEST CASE 2: Section A: Generate 3, Attempt 2
  console.log('\n--- TEST CASE 2: Single Section (Generate 3, Attempt 2) ---');
  const bp2 = service.resolveMockBlueprint({
    sections: [
      { name: 'Section A', questionsGenerated: 3, questionsToAttempt: 2, marksPerQuestion: 10, questionTypes: ['Long Answer'] }
    ]
  });
  console.log(`Generated: ${bp2.totalQuestionsGenerated} (Expected: 3)`);
  console.log(`To Attempt: ${bp2.totalQuestionsToAttempt} (Expected: 2)`);
  console.log(`Max Marks: ${bp2.maximumObtainableMarks} (Expected: 20)`);
  if (bp2.totalQuestionsGenerated !== 3 || bp2.totalQuestionsToAttempt !== 2) throw new Error('Test Case 2 Failed!');

  // TEST CASE 3: Section A: Generate 10, Attempt 5
  console.log('\n--- TEST CASE 3: Single Section (Generate 10, Attempt 5) ---');
  const bp3 = service.resolveMockBlueprint({
    sections: [
      { name: 'Section A', questionsGenerated: 10, questionsToAttempt: 5, marksPerQuestion: 2, questionTypes: ['MCQ'] }
    ]
  });
  console.log(`Generated: ${bp3.totalQuestionsGenerated} (Expected: 10)`);
  console.log(`To Attempt: ${bp3.totalQuestionsToAttempt} (Expected: 5)`);
  console.log(`Max Marks: ${bp3.maximumObtainableMarks} (Expected: 10)`);
  if (bp3.totalQuestionsGenerated !== 10 || bp3.totalQuestionsToAttempt !== 5) throw new Error('Test Case 3 Failed!');

  // TEST CASE 4: Section A: Generate 5, Attempt 5
  console.log('\n--- TEST CASE 4: Single Section (Generate 5, Attempt 5) ---');
  const bp4 = service.resolveMockBlueprint({
    sections: [
      { name: 'Section A', questionsGenerated: 5, questionsToAttempt: 5, marksPerQuestion: 5, questionTypes: ['Descriptive'] }
    ]
  });
  console.log(`Generated: ${bp4.totalQuestionsGenerated} (Expected: 5)`);
  console.log(`To Attempt: ${bp4.totalQuestionsToAttempt} (Expected: 5)`);
  console.log(`Max Marks: ${bp4.maximumObtainableMarks} (Expected: 25)`);
  if (bp4.totalQuestionsGenerated !== 5 || bp4.totalQuestionsToAttempt !== 5) throw new Error('Test Case 4 Failed!');

  // TEST CASE 5: The Primary User Blueprint
  // Section A: Gen 5, Att 4, 5M
  // Section B: Gen 3, Att 2, 10M
  // Section C: Gen 1, Att 1, 15M (Compulsory)
  console.log('\n--- TEST CASE 5: Primary User Blueprint (5/4 + 3/2 + 1/1) ---');
  const bp5 = service.resolveMockBlueprint({
    sections: [
      { name: 'Section A', questionsGenerated: 5, questionsToAttempt: 4, marksPerQuestion: 5, questionTypes: ['Descriptive'], isCompulsory: false },
      { name: 'Section B', questionsGenerated: 3, questionsToAttempt: 2, marksPerQuestion: 10, questionTypes: ['Long Answer'], isCompulsory: false },
      { name: 'Section C', questionsGenerated: 1, questionsToAttempt: 1, marksPerQuestion: 15, questionTypes: ['Case Based'], isCompulsory: true },
    ]
  });
  console.log(`Total Questions Generated: ${bp5.totalQuestionsGenerated} (Expected: 9)`);
  console.log(`Total Questions To Attempt: ${bp5.totalQuestionsToAttempt} (Expected: 7)`);
  console.log(`Maximum Obtainable Marks: ${bp5.maximumObtainableMarks} (Expected: 55)`);
  console.log(`Total Paper Marks: ${bp5.totalPaperMarks} (Expected: 70)`);

  if (bp5.totalQuestionsGenerated !== 9) throw new Error(`Test Case 5 Failed on Generated Questions: Got ${bp5.totalQuestionsGenerated}`);
  if (bp5.totalQuestionsToAttempt !== 7) throw new Error(`Test Case 5 Failed on Questions To Attempt: Got ${bp5.totalQuestionsToAttempt}`);
  if (bp5.maximumObtainableMarks !== 55) throw new Error(`Test Case 5 Failed on Max Marks: Got ${bp5.maximumObtainableMarks}`);
  if (bp5.totalPaperMarks !== 70) throw new Error(`Test Case 5 Failed on Paper Marks: Got ${bp5.totalPaperMarks}`);

  // Test slot creation and fulfillment
  const slots5 = service.createQuestionSlots(bp5);
  console.log(`Slots count: ${slots5.length} (Expected: 9)`);
  if (slots5.length !== 9) throw new Error('Slot count mismatch');

  const fulfilled5 = service.fulfillQuestionSlots([], slots5, [], 'Constitutional Law', 'Intermediate');
  console.log(`Fulfilled Questions: ${fulfilled5.length} (Expected: 9)`);
  const secACount = fulfilled5.filter((q: any) => q.sectionName === 'Section A').length;
  const secBCount = fulfilled5.filter((q: any) => q.sectionName === 'Section B').length;
  const secCCount = fulfilled5.filter((q: any) => q.sectionName === 'Section C').length;
  console.log(`Section A count: ${secACount} (Expected: 5, marks each: ${fulfilled5[0].marks})`);
  console.log(`Section B count: ${secBCount} (Expected: 3, marks each: ${fulfilled5[5].marks})`);
  console.log(`Section C count: ${secCCount} (Expected: 1, marks each: ${fulfilled5[8].marks})`);

  if (secACount !== 5 || secBCount !== 3 || secCCount !== 1) throw new Error('Section fulfillment count mismatch');
  if (fulfilled5[0].marks !== 5 || fulfilled5[5].marks !== 10 || fulfilled5[8].marks !== 15) throw new Error('Section marks mismatch');

  // TEST CASE 6: Dynamic blueprint changed to 8 + 4 + 2 = 14 questions
  console.log('\n--- TEST CASE 6: Dynamic Blueprint (8/5 + 4/2 + 2/1 = 14 Generated) ---');
  const bp6 = service.resolveMockBlueprint({
    sections: [
      { name: 'Section A', questionsGenerated: 8, questionsToAttempt: 5, marksPerQuestion: 5, questionTypes: ['Descriptive'], isCompulsory: false },
      { name: 'Section B', questionsGenerated: 4, questionsToAttempt: 2, marksPerQuestion: 10, questionTypes: ['Long Answer'], isCompulsory: false },
      { name: 'Section C', questionsGenerated: 2, questionsToAttempt: 1, marksPerQuestion: 15, questionTypes: ['Case Based'], isCompulsory: true },
    ]
  });
  console.log(`Total Questions Generated: ${bp6.totalQuestionsGenerated} (Expected: 14)`);
  console.log(`Total Questions To Attempt: ${bp6.totalQuestionsToAttempt} (Expected: 8)`);
  console.log(`Maximum Obtainable Marks: ${bp6.maximumObtainableMarks} (Expected: 60)`);
  console.log(`Total Paper Marks: ${bp6.totalPaperMarks} (Expected: 110)`);

  if (bp6.totalQuestionsGenerated !== 14) throw new Error(`Test Case 6 Failed on Generated Questions: Got ${bp6.totalQuestionsGenerated}`);
  if (bp6.totalQuestionsToAttempt !== 8) throw new Error(`Test Case 6 Failed on Questions To Attempt: Got ${bp6.totalQuestionsToAttempt}`);
  if (bp6.maximumObtainableMarks !== 60) throw new Error(`Test Case 6 Failed on Max Marks: Got ${bp6.maximumObtainableMarks}`);

  const slots6 = service.createQuestionSlots(bp6);
  const fulfilled6 = service.fulfillQuestionSlots([], slots6, [], 'Criminal Law', 'Advanced');
  if (fulfilled6.length !== 14) throw new Error('Test Case 6 Slot fulfillment count mismatch');

  console.log('\n✅ ALL 6 BLUEPRINT SPECIFICATION CASES PASSED WITH 100% COMPLIANCE!\n');
}

testBlueprintCompliance().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
