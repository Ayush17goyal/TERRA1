export interface DraftingLesson {
    index: number;
    id: string;
    title: string;
    objective: string;
}
export declare const DRAFTING_LESSON_CATALOG: DraftingLesson[];
export declare const TOTAL_DRAFTING_LESSONS: number;
export declare function getLessonByIndex(index: number): DraftingLesson;
