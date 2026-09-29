export declare class UserActivityLog {
    id: string;
    userId: string;
    module: string;
    action: string;
    metadata: Record<string, unknown>;
    createdAt: Date;
}
export declare class UserSettingsProfile {
    id: string;
    userId: string;
    email: string;
    fullName: string;
    profilePhotoUrl: string;
    university: string;
    yearOfStudy: string;
    learningGoal: string;
    aiProviderOnboardingCompleted: boolean;
    aiProviderOnboardingCompletedAt: Date;
    deletedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare class UserSubscription {
    id: string;
    userId: string;
    planName: string;
    status: string;
    renewalDate: Date;
    aiCreditsUsed: number;
    aiCreditsLimit: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare class UserNotificationPreference {
    id: string;
    userId: string;
    emailNotifications: boolean;
    studyReminders: boolean;
    quizReminders: boolean;
    revisionAlerts: boolean;
    weeklyReports: boolean;
    deliveryEmail: boolean;
    deliveryBrowser: boolean;
    deliveryMobile: boolean;
    deliveryDigest: boolean;
    browserPush: boolean;
    mobilePush: boolean;
    weeklyDigest: boolean;
    quietStart: string;
    quietEnd: string;
    quietHoursStart: string;
    quietHoursEnd: string;
    priority: string;
    notificationPriority: string;
    fcmToken: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare class UserAchievement {
    id: string;
    userId: string;
    badgeKey: string;
    title: string;
    description: string;
    unlockedAt: Date;
}
export declare class AccountDeletionRequest {
    id: string;
    userId: string;
    status: 'requested' | 'soft_deleted' | 'permanent_delete_pending' | 'completed';
    reason: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare class UserFeedback {
    id: string;
    userId: string;
    type: 'rating' | 'bug' | 'feature' | 'ai_feedback' | 'ticket';
    title: string;
    description: string;
    rating: number;
    module: string;
    issueType: string;
    screenshotUrl: string;
    priority: string;
    isHelpful: boolean;
    status: 'Submitted' | 'Under Review' | 'Planned' | 'Resolved';
    votes: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare class NotificationLog {
    id: string;
    userId: string;
    notificationType: string;
    deliveryMethod: string;
    title: string;
    message: string;
    status: string;
    sentAt: Date;
    openedAt: Date;
}
