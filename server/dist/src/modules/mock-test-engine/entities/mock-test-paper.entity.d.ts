import { MockTestAssemblySection, MockTestCoverageSnapshot, MockTestMode, MockTestSpecification, MockTestStatus } from '../mock-test-engine.types';
export declare class MockTestPaperEntity {
    id: string;
    userId: string;
    mode: MockTestMode;
    prompt: string;
    specification: MockTestSpecification;
    coverageSnapshot: MockTestCoverageSnapshot;
    assemblySections: MockTestAssemblySection[];
    questionIds: string[];
    totalMarks: number;
    durationMinutes: number;
    status: MockTestStatus;
    shortfalls: string[];
    pdfBase64: string;
    generationTimeMs: number;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}
