import { PlannedQuestionType, QuestionMarkValue } from '../../question-planning/question-planning.types';
import { QuestionDifficulty } from '../../question-bank/question-bank.types';
export declare class MockTestPaperQuestionEntity {
    id: string;
    paperId: string;
    userId: string;
    questionId: string;
    questionNumber: number;
    sectionLabel: string;
    question: string;
    questionType: PlannedQuestionType;
    difficulty: QuestionDifficulty;
    topic: string;
    subtopic: string;
    markValue: QuestionMarkValue;
    qualityScore: number;
    createdAt: Date;
}
