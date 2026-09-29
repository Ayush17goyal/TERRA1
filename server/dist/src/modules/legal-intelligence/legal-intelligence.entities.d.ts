export declare class LegalAuthorityVerification {
    id: string;
    userId: string;
    query: string;
    answer: string;
    result: any;
    createdAt: Date;
}
export declare class LegalResearchGuideSession {
    id: string;
    userId: string;
    proposition: string;
    roadmap: any;
    createdAt: Date;
}
export declare class DraftingAcademyCourse {
    id: string;
    title: string;
    category: string;
    description: string;
    contentType: string;
    resourceUrl: string;
    status: string;
    metadata: any;
    createdAt: Date;
    updatedAt: Date;
}
export declare class DraftingAcademyCheck {
    id: string;
    userId: string;
    fileName: string;
    inputType: string;
    draftText: string;
    result: any;
    createdAt: Date;
}
export declare class ResearchMentorSession {
    id: string;
    userId: string;
    topic: string;
    sessionData: any;
    createdAt: Date;
    updatedAt: Date;
}
export declare class CaseSimulationSession {
    id: string;
    userId: string;
    caseName: string;
    customScenario: string;
    practiceMode: string;
    retrievedData: any;
    studentAnswers: any;
    evaluationResult: any;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}
