import { MasterclassService } from './masterclass.service';
export declare class MasterclassController {
    private readonly svc;
    constructor(svc: MasterclassService);
    adminListCourses(): Promise<{
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
        takeaways: any;
        assignment: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    adminCreateCourse(dto: any): Promise<{
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
        takeaways: any;
        assignment: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    adminUpdateCourse(id: string, dto: any): Promise<{
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
        takeaways: any;
        assignment: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    adminDeleteCourse(id: string): Promise<{
        ok: boolean;
    }>;
    adminPublishCourse(id: string): Promise<{
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
        takeaways: any;
        assignment: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    adminUnpublishCourse(id: string): Promise<{
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
        takeaways: any;
        assignment: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    adminListLessons(courseId: string): Promise<{
        id: string;
        courseId: string;
        title: string;
        description: string;
        videoUrl: string;
        duration: string;
        sortOrder: number;
        isPreview: boolean;
        attachments: any;
        createdAt: Date;
    }[]>;
    adminCreateLesson(courseId: string, dto: any): Promise<{
        id: string;
        courseId: string;
        title: string;
        description: string;
        videoUrl: string;
        duration: string;
        sortOrder: number;
        isPreview: boolean;
        attachments: any;
        createdAt: Date;
    }>;
    adminUpdateLesson(id: string, dto: any): Promise<{
        id: string;
        courseId: string;
        title: string;
        description: string;
        videoUrl: string;
        duration: string;
        sortOrder: number;
        isPreview: boolean;
        attachments: any;
        createdAt: Date;
    }>;
    adminDeleteLesson(id: string): Promise<{
        ok: boolean;
    }>;
    adminGrantPlan(dto: {
        email: string;
        plan?: string;
    }): Promise<{
        error: string;
        success?: undefined;
        userId?: undefined;
        email?: undefined;
        plan?: undefined;
    } | {
        success: boolean;
        userId: string;
        email: string;
        plan: string;
        error?: undefined;
    }>;
    adminRevokePlan(dto: {
        email: string;
    }): Promise<{
        error: string;
        success?: undefined;
        userId?: undefined;
        email?: undefined;
    } | {
        success: boolean;
        userId: string;
        email: string;
        error?: undefined;
    }>;
    studentListCourses(): Promise<{
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
        takeaways: any;
        assignment: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    studentGetCourse(id: string): Promise<{
        lessons: {
            id: string;
            courseId: string;
            title: string;
            description: string;
            videoUrl: string;
            duration: string;
            sortOrder: number;
            isPreview: boolean;
            attachments: any;
            createdAt: Date;
        }[];
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
        takeaways: any;
        assignment: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    enroll(courseId: string, req: any): Promise<import("./masterclass.entity").MasterclassEnrollment>;
    updateProgress(lessonId: string, dto: any, req: any): Promise<import("./masterclass.entity").MasterclassLessonProgress>;
}
