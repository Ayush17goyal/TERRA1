export type AcademyLesson = {
    index: number;
    number: number;
    moduleIndex: number;
    module: string;
    title: string;
    concept: string;
};
export declare const ACADEMY_CURRICULUM: AcademyLesson[];
export declare const ACADEMY_TOTAL_LESSONS: number;
export declare function academyLesson(index: number): AcademyLesson;
