export declare class MasterclassCourse {
    id: string;
    title: string;
    description: string;
    status: string;
    difficulty: string;
    category: string;
    thumbnailUrl: string;
    instructor: string;
    duration: string;
    isFree: boolean;
    takeawaysJson: string;
    assignment: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare class MasterclassLesson {
    id: string;
    courseId: string;
    title: string;
    description: string;
    videoUrl: string;
    duration: string;
    sortOrder: number;
    isPreview: boolean;
    attachmentsJson: string;
    createdAt: Date;
}
export declare class MasterclassEnrollment {
    id: string;
    courseId: string;
    userId: string;
    enrolledAt: Date;
}
export declare class MasterclassLessonProgress {
    id: string;
    userId: string;
    lessonId: string;
    courseId: string;
    completed: boolean;
    lastPosition: number;
    completedAt: string;
    updatedAt: Date;
}
