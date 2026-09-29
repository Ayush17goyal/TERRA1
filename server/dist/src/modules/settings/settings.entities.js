"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationLog = exports.UserFeedback = exports.AccountDeletionRequest = exports.UserAchievement = exports.UserNotificationPreference = exports.UserSubscription = exports.UserSettingsProfile = exports.UserActivityLog = void 0;
const typeorm_1 = require("typeorm");
let UserActivityLog = class UserActivityLog {
};
exports.UserActivityLog = UserActivityLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserActivityLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], UserActivityLog.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserActivityLog.prototype, "module", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserActivityLog.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], UserActivityLog.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], UserActivityLog.prototype, "createdAt", void 0);
exports.UserActivityLog = UserActivityLog = __decorate([
    (0, typeorm_1.Entity)('user_activity_logs')
], UserActivityLog);
let UserSettingsProfile = class UserSettingsProfile {
};
exports.UserSettingsProfile = UserSettingsProfile;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserSettingsProfile.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', unique: true }),
    __metadata("design:type", String)
], UserSettingsProfile.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserSettingsProfile.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'full_name', nullable: true }),
    __metadata("design:type", String)
], UserSettingsProfile.prototype, "fullName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'profile_photo_url', nullable: true }),
    __metadata("design:type", String)
], UserSettingsProfile.prototype, "profilePhotoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserSettingsProfile.prototype, "university", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'year_of_study', nullable: true }),
    __metadata("design:type", String)
], UserSettingsProfile.prototype, "yearOfStudy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'learning_goal', nullable: true }),
    __metadata("design:type", String)
], UserSettingsProfile.prototype, "learningGoal", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ai_provider_onboarding_completed', default: false }),
    __metadata("design:type", Boolean)
], UserSettingsProfile.prototype, "aiProviderOnboardingCompleted", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ai_provider_onboarding_completed_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], UserSettingsProfile.prototype, "aiProviderOnboardingCompletedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deleted_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], UserSettingsProfile.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], UserSettingsProfile.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], UserSettingsProfile.prototype, "updatedAt", void 0);
exports.UserSettingsProfile = UserSettingsProfile = __decorate([
    (0, typeorm_1.Entity)('user_settings_profiles')
], UserSettingsProfile);
let UserSubscription = class UserSubscription {
};
exports.UserSubscription = UserSubscription;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserSubscription.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', unique: true }),
    __metadata("design:type", String)
], UserSubscription.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'plan_name' }),
    __metadata("design:type", String)
], UserSubscription.prototype, "planName", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'inactive' }),
    __metadata("design:type", String)
], UserSubscription.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'renewal_date', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], UserSubscription.prototype, "renewalDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ai_credits_used', default: 0 }),
    __metadata("design:type", Number)
], UserSubscription.prototype, "aiCreditsUsed", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ai_credits_limit', default: 0 }),
    __metadata("design:type", Number)
], UserSubscription.prototype, "aiCreditsLimit", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], UserSubscription.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], UserSubscription.prototype, "updatedAt", void 0);
exports.UserSubscription = UserSubscription = __decorate([
    (0, typeorm_1.Entity)('user_subscriptions')
], UserSubscription);
let UserNotificationPreference = class UserNotificationPreference {
};
exports.UserNotificationPreference = UserNotificationPreference;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserNotificationPreference.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', unique: true }),
    __metadata("design:type", String)
], UserNotificationPreference.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_notifications', default: false }),
    __metadata("design:type", Boolean)
], UserNotificationPreference.prototype, "emailNotifications", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'study_reminders', default: false }),
    __metadata("design:type", Boolean)
], UserNotificationPreference.prototype, "studyReminders", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quiz_reminders', default: false }),
    __metadata("design:type", Boolean)
], UserNotificationPreference.prototype, "quizReminders", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'revision_alerts', default: false }),
    __metadata("design:type", Boolean)
], UserNotificationPreference.prototype, "revisionAlerts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'weekly_reports', default: false }),
    __metadata("design:type", Boolean)
], UserNotificationPreference.prototype, "weeklyReports", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delivery_email', default: true }),
    __metadata("design:type", Boolean)
], UserNotificationPreference.prototype, "deliveryEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delivery_browser', default: true }),
    __metadata("design:type", Boolean)
], UserNotificationPreference.prototype, "deliveryBrowser", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delivery_mobile', default: false }),
    __metadata("design:type", Boolean)
], UserNotificationPreference.prototype, "deliveryMobile", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delivery_digest', default: false }),
    __metadata("design:type", Boolean)
], UserNotificationPreference.prototype, "deliveryDigest", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'browser_push', default: true }),
    __metadata("design:type", Boolean)
], UserNotificationPreference.prototype, "browserPush", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mobile_push', default: false }),
    __metadata("design:type", Boolean)
], UserNotificationPreference.prototype, "mobilePush", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'weekly_digest', default: false }),
    __metadata("design:type", Boolean)
], UserNotificationPreference.prototype, "weeklyDigest", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quiet_start', default: '22:00' }),
    __metadata("design:type", String)
], UserNotificationPreference.prototype, "quietStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quiet_end', default: '07:00' }),
    __metadata("design:type", String)
], UserNotificationPreference.prototype, "quietEnd", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quiet_hours_start', default: '22:00' }),
    __metadata("design:type", String)
], UserNotificationPreference.prototype, "quietHoursStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quiet_hours_end', default: '07:00' }),
    __metadata("design:type", String)
], UserNotificationPreference.prototype, "quietHoursEnd", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'priority', default: 'All Notifications' }),
    __metadata("design:type", String)
], UserNotificationPreference.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'notification_priority', default: 'All Notifications' }),
    __metadata("design:type", String)
], UserNotificationPreference.prototype, "notificationPriority", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fcm_token', nullable: true }),
    __metadata("design:type", String)
], UserNotificationPreference.prototype, "fcmToken", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], UserNotificationPreference.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], UserNotificationPreference.prototype, "updatedAt", void 0);
exports.UserNotificationPreference = UserNotificationPreference = __decorate([
    (0, typeorm_1.Entity)('user_notification_preferences')
], UserNotificationPreference);
let UserAchievement = class UserAchievement {
};
exports.UserAchievement = UserAchievement;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserAchievement.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], UserAchievement.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'badge_key' }),
    __metadata("design:type", String)
], UserAchievement.prototype, "badgeKey", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserAchievement.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserAchievement.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'unlocked_at' }),
    __metadata("design:type", Date)
], UserAchievement.prototype, "unlockedAt", void 0);
exports.UserAchievement = UserAchievement = __decorate([
    (0, typeorm_1.Entity)('user_achievements')
], UserAchievement);
let AccountDeletionRequest = class AccountDeletionRequest {
};
exports.AccountDeletionRequest = AccountDeletionRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AccountDeletionRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], AccountDeletionRequest.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'requested' }),
    __metadata("design:type", String)
], AccountDeletionRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AccountDeletionRequest.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AccountDeletionRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], AccountDeletionRequest.prototype, "updatedAt", void 0);
exports.AccountDeletionRequest = AccountDeletionRequest = __decorate([
    (0, typeorm_1.Entity)('account_deletion_requests')
], AccountDeletionRequest);
let UserFeedback = class UserFeedback {
};
exports.UserFeedback = UserFeedback;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserFeedback.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], UserFeedback.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserFeedback.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserFeedback.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], UserFeedback.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'int' }),
    __metadata("design:type", Number)
], UserFeedback.prototype, "rating", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserFeedback.prototype, "module", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'issue_type', nullable: true }),
    __metadata("design:type", String)
], UserFeedback.prototype, "issueType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'screenshot_url', nullable: true }),
    __metadata("design:type", String)
], UserFeedback.prototype, "screenshotUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserFeedback.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_helpful', nullable: true }),
    __metadata("design:type", Boolean)
], UserFeedback.prototype, "isHelpful", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Submitted' }),
    __metadata("design:type", String)
], UserFeedback.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0, type: 'int' }),
    __metadata("design:type", Number)
], UserFeedback.prototype, "votes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], UserFeedback.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], UserFeedback.prototype, "updatedAt", void 0);
exports.UserFeedback = UserFeedback = __decorate([
    (0, typeorm_1.Entity)('user_feedbacks')
], UserFeedback);
let NotificationLog = class NotificationLog {
};
exports.NotificationLog = NotificationLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], NotificationLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], NotificationLog.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'notification_type', nullable: true }),
    __metadata("design:type", String)
], NotificationLog.prototype, "notificationType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delivery_method', nullable: true }),
    __metadata("design:type", String)
], NotificationLog.prototype, "deliveryMethod", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], NotificationLog.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], NotificationLog.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], NotificationLog.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'sent_at' }),
    __metadata("design:type", Date)
], NotificationLog.prototype, "sentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'opened_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], NotificationLog.prototype, "openedAt", void 0);
exports.NotificationLog = NotificationLog = __decorate([
    (0, typeorm_1.Entity)('notification_logs')
], NotificationLog);
//# sourceMappingURL=settings.entities.js.map