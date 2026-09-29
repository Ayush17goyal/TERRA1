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
exports.Recommendation = exports.GoogleOAuthToken = exports.ReadinessSnapshot = exports.Notification = exports.CalendarEvent = exports.MockTest = exports.RevisionPlan = exports.Roadmap = exports.Exam = void 0;
const typeorm_1 = require("typeorm");
let Exam = class Exam {
};
exports.Exam = Exam;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Exam.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], Exam.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'clerk_user_id', nullable: true }),
    __metadata("design:type", String)
], Exam.prototype, "clerkUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'full_name', nullable: true }),
    __metadata("design:type", String)
], Exam.prototype, "fullName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Exam.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'subject_name', nullable: true }),
    __metadata("design:type", String)
], Exam.prototype, "subjectName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Exam.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'exam_date', type: 'datetime' }),
    __metadata("design:type", Date)
], Exam.prototype, "examDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'exam_time', type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], Exam.prototype, "examTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'prep_level' }),
    __metadata("design:type", String)
], Exam.prototype, "prepLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'syllabus_completion', default: 0 }),
    __metadata("design:type", Number)
], Exam.prototype, "syllabusCompletion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_reminder_enabled', default: false }),
    __metadata("design:type", Boolean)
], Exam.prototype, "emailReminderEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_reminder_minutes', default: 1440 }),
    __metadata("design:type", Number)
], Exam.prototype, "emailReminderMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reminder_type', nullable: true }),
    __metadata("design:type", String)
], Exam.prototype, "reminderType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reminder_enabled', default: true }),
    __metadata("design:type", Boolean)
], Exam.prototype, "reminderEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reminder_trigger_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], Exam.prototype, "reminderTriggerAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reminder_sent_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], Exam.prototype, "reminderSentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'Asia/Kolkata' }),
    __metadata("design:type", String)
], Exam.prototype, "timezone", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Exam.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Exam.prototype, "updatedAt", void 0);
exports.Exam = Exam = __decorate([
    (0, typeorm_1.Entity)('exams')
], Exam);
let Roadmap = class Roadmap {
};
exports.Roadmap = Roadmap;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Roadmap.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'exam_id', type: 'uuid', unique: true }),
    __metadata("design:type", String)
], Roadmap.prototype, "examId", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '{}' }),
    __metadata("design:type", Object)
], Roadmap.prototype, "data", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Roadmap.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Roadmap.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => Exam, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'exam_id' }),
    __metadata("design:type", Exam)
], Roadmap.prototype, "exam", void 0);
exports.Roadmap = Roadmap = __decorate([
    (0, typeorm_1.Entity)('roadmaps')
], Roadmap);
let RevisionPlan = class RevisionPlan {
};
exports.RevisionPlan = RevisionPlan;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], RevisionPlan.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'exam_id', type: 'uuid', unique: true }),
    __metadata("design:type", String)
], RevisionPlan.prototype, "examId", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '{}' }),
    __metadata("design:type", Object)
], RevisionPlan.prototype, "data", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], RevisionPlan.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], RevisionPlan.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => Exam, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'exam_id' }),
    __metadata("design:type", Exam)
], RevisionPlan.prototype, "exam", void 0);
exports.RevisionPlan = RevisionPlan = __decorate([
    (0, typeorm_1.Entity)('revision_plans')
], RevisionPlan);
let MockTest = class MockTest {
};
exports.MockTest = MockTest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MockTest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'exam_id', type: 'uuid' }),
    __metadata("design:type", String)
], MockTest.prototype, "examId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MockTest.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MockTest.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], MockTest.prototype, "score", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_questions', default: 20 }),
    __metadata("design:type", Number)
], MockTest.prototype, "totalQuestions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime' }),
    __metadata("design:type", Date)
], MockTest.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { name: 'weak_subjects', default: '[]' }),
    __metadata("design:type", Object)
], MockTest.prototype, "weakSubjects", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], MockTest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], MockTest.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Exam, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'exam_id' }),
    __metadata("design:type", Exam)
], MockTest.prototype, "exam", void 0);
exports.MockTest = MockTest = __decorate([
    (0, typeorm_1.Entity)('mock_tests')
], MockTest);
let CalendarEvent = class CalendarEvent {
};
exports.CalendarEvent = CalendarEvent;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], CalendarEvent.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], CalendarEvent.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'exam_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], CalendarEvent.prototype, "examId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], CalendarEvent.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], CalendarEvent.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'event_date', type: 'date' }),
    __metadata("design:type", String)
], CalendarEvent.prototype, "eventDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'end_date', type: 'date', nullable: true }),
    __metadata("design:type", String)
], CalendarEvent.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'event_time', type: 'time' }),
    __metadata("design:type", String)
], CalendarEvent.prototype, "eventTime", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], CalendarEvent.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'event_type' }),
    __metadata("design:type", String)
], CalendarEvent.prototype, "eventType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], CalendarEvent.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'Medium' }),
    __metadata("design:type", String)
], CalendarEvent.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'module_source', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], CalendarEvent.prototype, "moduleSource", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'google_event_id', nullable: true }),
    __metadata("design:type", String)
], CalendarEvent.prototype, "googleEventId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_synced', default: false }),
    __metadata("design:type", Boolean)
], CalendarEvent.prototype, "isSynced", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], CalendarEvent.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], CalendarEvent.prototype, "updatedAt", void 0);
exports.CalendarEvent = CalendarEvent = __decorate([
    (0, typeorm_1.Entity)('calendar_events')
], CalendarEvent);
let Notification = class Notification {
};
exports.Notification = Notification;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Notification.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], Notification.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'exam_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Notification.prototype, "examId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'clerk_user_id', nullable: true }),
    __metadata("design:type", String)
], Notification.prototype, "clerkUserId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Notification.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Notification.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'alert' }),
    __metadata("design:type", String)
], Notification.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_read', default: false }),
    __metadata("design:type", Boolean)
], Notification.prototype, "isRead", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_sent', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Notification.prototype, "emailSent", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delivery_channel', default: 'all' }),
    __metadata("design:type", String)
], Notification.prototype, "deliveryChannel", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'normal' }),
    __metadata("design:type", String)
], Notification.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'trigger_time', type: 'datetime' }),
    __metadata("design:type", Date)
], Notification.prototype, "triggerTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_subject', nullable: true }),
    __metadata("design:type", String)
], Notification.prototype, "emailSubject", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_body', type: 'text', nullable: true }),
    __metadata("design:type", String)
], Notification.prototype, "emailBody", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delivered_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], Notification.prototype, "deliveredAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'failed_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], Notification.prototype, "failedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delivery_error', type: 'text', nullable: true }),
    __metadata("design:type", String)
], Notification.prototype, "deliveryError", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Notification.prototype, "createdAt", void 0);
exports.Notification = Notification = __decorate([
    (0, typeorm_1.Entity)('notifications')
], Notification);
let ReadinessSnapshot = class ReadinessSnapshot {
};
exports.ReadinessSnapshot = ReadinessSnapshot;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ReadinessSnapshot.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'exam_id', type: 'uuid' }),
    __metadata("design:type", String)
], ReadinessSnapshot.prototype, "examId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'syllabus_completion' }),
    __metadata("design:type", Number)
], ReadinessSnapshot.prototype, "syllabusCompletion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mock_scores_avg', type: 'numeric' }),
    __metadata("design:type", Number)
], ReadinessSnapshot.prototype, "mockScoresAvg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'study_hours_total', type: 'numeric' }),
    __metadata("design:type", Number)
], ReadinessSnapshot.prototype, "studyHoursTotal", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'revision_progress' }),
    __metadata("design:type", Number)
], ReadinessSnapshot.prototype, "revisionProgress", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'habit_compliance' }),
    __metadata("design:type", Number)
], ReadinessSnapshot.prototype, "habitCompliance", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'readiness_score' }),
    __metadata("design:type", Number)
], ReadinessSnapshot.prototype, "readinessScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expected_7_days' }),
    __metadata("design:type", Number)
], ReadinessSnapshot.prototype, "expected7Days", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expected_14_days' }),
    __metadata("design:type", Number)
], ReadinessSnapshot.prototype, "expected14Days", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expected_30_days' }),
    __metadata("design:type", Number)
], ReadinessSnapshot.prototype, "expected30Days", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ReadinessSnapshot.prototype, "createdAt", void 0);
exports.ReadinessSnapshot = ReadinessSnapshot = __decorate([
    (0, typeorm_1.Entity)('readiness_snapshots')
], ReadinessSnapshot);
let GoogleOAuthToken = class GoogleOAuthToken {
};
exports.GoogleOAuthToken = GoogleOAuthToken;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], GoogleOAuthToken.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid', unique: true }),
    __metadata("design:type", String)
], GoogleOAuthToken.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'google_access_token' }),
    __metadata("design:type", String)
], GoogleOAuthToken.prototype, "googleAccessToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'google_refresh_token', nullable: true }),
    __metadata("design:type", String)
], GoogleOAuthToken.prototype, "googleRefreshToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'token_expiry', type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], GoogleOAuthToken.prototype, "tokenExpiry", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], GoogleOAuthToken.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], GoogleOAuthToken.prototype, "updatedAt", void 0);
exports.GoogleOAuthToken = GoogleOAuthToken = __decorate([
    (0, typeorm_1.Entity)('google_oauth_tokens')
], GoogleOAuthToken);
let Recommendation = class Recommendation {
};
exports.Recommendation = Recommendation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Recommendation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], Recommendation.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Recommendation.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'target_date', type: 'date' }),
    __metadata("design:type", String)
], Recommendation.prototype, "targetDate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Recommendation.prototype, "createdAt", void 0);
exports.Recommendation = Recommendation = __decorate([
    (0, typeorm_1.Entity)('recommendations')
], Recommendation);
//# sourceMappingURL=exam.entities.js.map