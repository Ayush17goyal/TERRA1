export declare class Exam {
    id: string;
    userId: string;
    clerkUserId: string;
    fullName: string;
    email: string;
    subjectName: string;
    subject: string;
    examDate: Date;
    examTime: string;
    prepLevel: 'Beginner' | 'Intermediate' | 'Expert';
    syllabusCompletion: number;
    emailReminderEnabled: boolean;
    emailReminderMinutes: number;
    reminderType: string;
    reminderEnabled: boolean;
    reminderTriggerAt: Date;
    reminderSentAt: Date;
    timezone: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare class Roadmap {
    id: string;
    examId: string;
    data: any;
    createdAt: Date;
    updatedAt: Date;
    exam: Exam;
}
export declare class RevisionPlan {
    id: string;
    examId: string;
    data: any;
    createdAt: Date;
    updatedAt: Date;
    exam: Exam;
}
export declare class MockTest {
    id: string;
    examId: string;
    subject: string;
    title: string;
    score: number;
    totalQuestions: number;
    date: Date;
    weakSubjects: any;
    createdAt: Date;
    updatedAt: Date;
    exam: Exam;
}
export declare class CalendarEvent {
    id: string;
    userId: string;
    examId: string;
    title: string;
    description: string;
    eventDate: string;
    endDate: string;
    eventTime: string;
    subject: string;
    eventType: 'class' | 'assignment' | 'moot' | 'internship' | 'exam' | 'study' | 'research' | 'revision';
    category: string;
    priority: string;
    moduleSource: string;
    googleEventId: string;
    isSynced: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare class Notification {
    id: string;
    userId: string;
    examId: string;
    clerkUserId: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    emailSent: boolean;
    deliveryChannel: string;
    priority: string;
    triggerTime: Date;
    emailSubject: string;
    emailBody: string;
    deliveredAt: Date;
    failedAt: Date;
    deliveryError: string;
    createdAt: Date;
}
export declare class ReadinessSnapshot {
    id: string;
    examId: string;
    syllabusCompletion: number;
    mockScoresAvg: number;
    studyHoursTotal: number;
    revisionProgress: number;
    habitCompliance: number;
    readinessScore: number;
    expected7Days: number;
    expected14Days: number;
    expected30Days: number;
    createdAt: Date;
}
export declare class GoogleOAuthToken {
    id: string;
    userId: string;
    googleAccessToken: string;
    googleRefreshToken: string;
    tokenExpiry: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare class Recommendation {
    id: string;
    userId: string;
    content: string;
    targetDate: string;
    createdAt: Date;
}
