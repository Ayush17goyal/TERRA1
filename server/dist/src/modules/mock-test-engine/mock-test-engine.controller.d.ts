import { Response } from 'express';
import { MockTestGenerationRequest } from './mock-test-engine.types';
import { MockTestEngineService } from './mock-test-engine.service';
export declare class MockTestEngineController {
    private readonly mockTests;
    constructor(mockTests: MockTestEngineService);
    generate(body: MockTestGenerationRequest, req: any): Promise<import("./mock-test-engine.types").MockTestGenerationResult>;
    list(req: any): Promise<import("./entities/mock-test-paper.entity").MockTestPaperEntity[]>;
    get(id: string, req: any): Promise<{
        questions: import("./entities/mock-test-paper-question.entity").MockTestPaperQuestionEntity[];
        pdfBase64: any;
        id: string;
        userId: string;
        mode: import("./mock-test-engine.types").MockTestMode;
        prompt: string;
        specification: import("./mock-test-engine.types").MockTestSpecification;
        coverageSnapshot: import("./mock-test-engine.types").MockTestCoverageSnapshot;
        assemblySections: import("./mock-test-engine.types").MockTestAssemblySection[];
        questionIds: string[];
        totalMarks: number;
        durationMinutes: number;
        status: import("./mock-test-engine.types").MockTestStatus;
        shortfalls: string[];
        generationTimeMs: number;
        version: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    pdf(id: string, req: any, res: Response): Promise<void>;
    getModelAnswer(questionId: string, req: any): Promise<{
        questionId: string;
        modelAnswer: string | null;
        cached: boolean;
    }>;
    generateModelAnswer(questionId: string, body: {
        question: string;
        topic: string;
        markValue: number;
        force?: boolean;
    }, req: any): Promise<{
        questionId: string;
        modelAnswer: string;
        cached: boolean;
        wordCount: number;
    }>;
}
