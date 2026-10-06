"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const learning_workspace_service_1 = require("../modules/learning-workspace/learning-workspace.service");
async function testSubmissionScoring() {
    console.log('🧪 Testing Mock Test Submission Choice-Based Scoring...\n');
    let savedAttempt = null;
    const mockRepo = {
        findOne: async () => ({
            id: 'test-mock-paper-101',
            userId: 'test-user',
            topic: 'Constitutional Law',
            questions: [
                { id: 'q1', sectionName: 'Section A', questionNumber: 1, marks: 5, type: 'Descriptive', question: 'Q1' },
                { id: 'q2', sectionName: 'Section A', questionNumber: 2, marks: 5, type: 'Descriptive', question: 'Q2' },
                { id: 'q3', sectionName: 'Section A', questionNumber: 3, marks: 5, type: 'Descriptive', question: 'Q3' },
                { id: 'q4', sectionName: 'Section A', questionNumber: 4, marks: 5, type: 'Descriptive', question: 'Q4' },
                { id: 'q5', sectionName: 'Section A', questionNumber: 5, marks: 5, type: 'Descriptive', question: 'Q5' },
                { id: 'q6', sectionName: 'Section B', questionNumber: 6, marks: 10, type: 'Descriptive', question: 'Q6' },
                { id: 'q7', sectionName: 'Section B', questionNumber: 7, marks: 10, type: 'Descriptive', question: 'Q7' },
                { id: 'q8', sectionName: 'Section B', questionNumber: 8, marks: 10, type: 'Descriptive', question: 'Q8' },
                { id: 'q9', sectionName: 'Section C', questionNumber: 9, marks: 15, type: 'Descriptive', question: 'Q9', isCompulsorySection: true },
            ],
            scoreReport: {
                totalMarks: 55,
                totalPaperMarks: 70,
                totalQuestions: 9,
                questionsToAttempt: 7,
                sections: [
                    { name: 'Section A', questionsGenerated: 5, questionsToAttempt: 4, marksPerQuestion: 5, isCompulsory: false },
                    { name: 'Section B', questionsGenerated: 3, questionsToAttempt: 2, marksPerQuestion: 10, isCompulsory: false },
                    { name: 'Section C', questionsGenerated: 1, questionsToAttempt: 1, marksPerQuestion: 15, isCompulsory: true },
                ],
            }
        }),
    };
    const attemptRepo = {
        create: (data) => data,
        save: async (data) => {
            savedAttempt = data;
            return { ...data, id: 'attempt-123' };
        }
    };
    const service = new learning_workspace_service_1.LearningWorkspaceService({}, mockRepo, attemptRepo, {}, {}, {}, {}, {}, {}, {}, {});
    service.log = async () => { };
    service.evaluateSubjectiveAnswer = async (_q, _ans, marks) => ({
        awardedMarks: marks,
        rubricBreakdown: { legalAccuracy: 100, issueIdentification: 100, reasoningAnalysis: 100, useOfAuthorities: 100, structureClarity: 100 },
        feedback: 'Excellent response.',
        keyStrengths: ['Comprehensive legal authority cited'],
        missingPoints: [],
    });
    const answers = {
        q1: 'Answer to Q1',
        q2: 'Answer to Q2',
        q3: 'Answer to Q3',
        q4: 'Answer to Q4',
        q6: 'Answer to Q6',
        q7: 'Answer to Q7',
    };
    const result = await service.submitMockTest('test-user', 'test-mock-paper-101', answers);
    console.log(`Score: ${result.score} (Expected: 40)`);
    console.log(`Total Possible Marks: ${result.total} (Expected: 55, NOT 70!)`);
    console.log(`Percentage: ${result.percentage}% (Expected: 73%)`);
    if (result.score !== 40)
        throw new Error(`Score mismatch: got ${result.score}`);
    if (result.total !== 55)
        throw new Error(`Total possible marks mismatch: got ${result.total}`);
    const evals = result.answers.questionEvaluations;
    const q5Eval = evals.find((e) => e.questionId === 'q5');
    const q8Eval = evals.find((e) => e.questionId === 'q8');
    const q9Eval = evals.find((e) => e.questionId === 'q9');
    console.log(`Q5 result: "${q5Eval?.result}" (Expected: Optional / Not Selected)`);
    console.log(`Q8 result: "${q8Eval?.result}" (Expected: Optional / Not Selected)`);
    console.log(`Q9 result: "${q9Eval?.result}" (Expected: Unanswered)`);
    if (!q5Eval?.result?.includes('Optional') && !q5Eval?.result?.includes('Not Selected')) {
        throw new Error('Q5 was not treated as optional choice!');
    }
    if (!q8Eval?.result?.includes('Optional') && !q8Eval?.result?.includes('Not Selected')) {
        throw new Error('Q8 was not treated as optional choice!');
    }
    if (q9Eval?.result !== 'Unanswered') {
        throw new Error('Q9 (compulsory) was not marked as Unanswered!');
    }
    console.log('\n✅ SUBMISSION SCORING & CHOICE RULES TEST PASSED WITH 100% ACCURACY!\n');
}
testSubmissionScoring().catch(err => {
    console.error('❌ Submission test failed:', err);
    process.exit(1);
});
//# sourceMappingURL=test-submission-scoring.js.map