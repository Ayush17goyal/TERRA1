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
exports.MasterclassLessonProgress = exports.MasterclassEnrollment = exports.MasterclassLesson = exports.MasterclassCourse = void 0;
const typeorm_1 = require("typeorm");
let MasterclassCourse = class MasterclassCourse {
};
exports.MasterclassCourse = MasterclassCourse;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MasterclassCourse.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MasterclassCourse.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], MasterclassCourse.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'draft' }),
    __metadata("design:type", String)
], MasterclassCourse.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MasterclassCourse.prototype, "difficulty", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MasterclassCourse.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MasterclassCourse.prototype, "thumbnailUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MasterclassCourse.prototype, "instructor", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MasterclassCourse.prototype, "duration", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], MasterclassCourse.prototype, "isFree", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], MasterclassCourse.prototype, "takeawaysJson", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], MasterclassCourse.prototype, "assignment", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], MasterclassCourse.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], MasterclassCourse.prototype, "updatedAt", void 0);
exports.MasterclassCourse = MasterclassCourse = __decorate([
    (0, typeorm_1.Entity)('masterclass_courses')
], MasterclassCourse);
let MasterclassLesson = class MasterclassLesson {
};
exports.MasterclassLesson = MasterclassLesson;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MasterclassLesson.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MasterclassLesson.prototype, "courseId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MasterclassLesson.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], MasterclassLesson.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MasterclassLesson.prototype, "videoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MasterclassLesson.prototype, "duration", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], MasterclassLesson.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], MasterclassLesson.prototype, "isPreview", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], MasterclassLesson.prototype, "attachmentsJson", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], MasterclassLesson.prototype, "createdAt", void 0);
exports.MasterclassLesson = MasterclassLesson = __decorate([
    (0, typeorm_1.Entity)('masterclass_lessons')
], MasterclassLesson);
let MasterclassEnrollment = class MasterclassEnrollment {
};
exports.MasterclassEnrollment = MasterclassEnrollment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MasterclassEnrollment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MasterclassEnrollment.prototype, "courseId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MasterclassEnrollment.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], MasterclassEnrollment.prototype, "enrolledAt", void 0);
exports.MasterclassEnrollment = MasterclassEnrollment = __decorate([
    (0, typeorm_1.Entity)('masterclass_enrollments')
], MasterclassEnrollment);
let MasterclassLessonProgress = class MasterclassLessonProgress {
};
exports.MasterclassLessonProgress = MasterclassLessonProgress;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MasterclassLessonProgress.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MasterclassLessonProgress.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MasterclassLessonProgress.prototype, "lessonId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MasterclassLessonProgress.prototype, "courseId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], MasterclassLessonProgress.prototype, "completed", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], MasterclassLessonProgress.prototype, "lastPosition", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], MasterclassLessonProgress.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], MasterclassLessonProgress.prototype, "updatedAt", void 0);
exports.MasterclassLessonProgress = MasterclassLessonProgress = __decorate([
    (0, typeorm_1.Entity)('masterclass_lesson_progress')
], MasterclassLessonProgress);
//# sourceMappingURL=masterclass.entity.js.map