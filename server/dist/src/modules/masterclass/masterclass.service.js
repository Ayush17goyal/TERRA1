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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterclassService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const masterclass_entity_1 = require("./masterclass.entity");
let MasterclassService = class MasterclassService {
    constructor(courseRepo, lessonRepo, enrollRepo, progressRepo) {
        this.courseRepo = courseRepo;
        this.lessonRepo = lessonRepo;
        this.enrollRepo = enrollRepo;
        this.progressRepo = progressRepo;
    }
    async adminListCourses() {
        const courses = await this.courseRepo.find({ order: { createdAt: 'DESC' } });
        return courses.map((c) => this.serializeCourse(c));
    }
    async adminCreateCourse(dto) {
        const course = this.courseRepo.create({
            title: dto.title,
            description: dto.description,
            difficulty: dto.difficulty ?? 'Intermediate',
            category: dto.category ?? 'Contract Drafting',
            thumbnailUrl: dto.thumbnailUrl,
            instructor: dto.instructor ?? 'The Founder',
            duration: dto.duration,
            isFree: dto.isFree ?? true,
            takeawaysJson: dto.takeaways ? JSON.stringify(dto.takeaways) : null,
            assignment: dto.assignment,
            status: 'draft',
        });
        const saved = await this.courseRepo.save(course);
        return this.serializeCourse(saved);
    }
    async adminUpdateCourse(id, dto) {
        const course = await this.courseRepo.findOne({ where: { id } });
        if (!course)
            throw new common_1.NotFoundException('Course not found');
        Object.assign(course, {
            title: dto.title ?? course.title,
            description: dto.description ?? course.description,
            difficulty: dto.difficulty ?? course.difficulty,
            category: dto.category ?? course.category,
            thumbnailUrl: dto.thumbnailUrl ?? course.thumbnailUrl,
            instructor: dto.instructor ?? course.instructor,
            duration: dto.duration ?? course.duration,
            isFree: dto.isFree ?? course.isFree,
            takeawaysJson: dto.takeaways ? JSON.stringify(dto.takeaways) : course.takeawaysJson,
            assignment: dto.assignment ?? course.assignment,
        });
        const saved = await this.courseRepo.save(course);
        return this.serializeCourse(saved);
    }
    async adminDeleteCourse(id) {
        const course = await this.courseRepo.findOne({ where: { id } });
        if (!course)
            throw new common_1.NotFoundException('Course not found');
        await this.lessonRepo.delete({ courseId: id });
        await this.courseRepo.remove(course);
        return { ok: true };
    }
    async adminPublishCourse(id, publish) {
        const course = await this.courseRepo.findOne({ where: { id } });
        if (!course)
            throw new common_1.NotFoundException('Course not found');
        course.status = publish ? 'published' : 'draft';
        const saved = await this.courseRepo.save(course);
        return this.serializeCourse(saved);
    }
    async adminListLessons(courseId) {
        const lessons = await this.lessonRepo.find({ where: { courseId }, order: { sortOrder: 'ASC' } });
        return lessons.map((l) => this.serializeLesson(l));
    }
    async adminCreateLesson(courseId, dto) {
        const count = await this.lessonRepo.count({ where: { courseId } });
        const lesson = this.lessonRepo.create({
            courseId,
            title: dto.title,
            description: dto.description,
            videoUrl: dto.videoUrl,
            duration: dto.duration,
            sortOrder: dto.sortOrder ?? count,
            isPreview: dto.isPreview ?? false,
            attachmentsJson: dto.attachments ? JSON.stringify(dto.attachments) : null,
        });
        const saved = await this.lessonRepo.save(lesson);
        return this.serializeLesson(saved);
    }
    async adminUpdateLesson(id, dto) {
        const lesson = await this.lessonRepo.findOne({ where: { id } });
        if (!lesson)
            throw new common_1.NotFoundException('Lesson not found');
        Object.assign(lesson, {
            title: dto.title ?? lesson.title,
            description: dto.description ?? lesson.description,
            videoUrl: dto.videoUrl ?? lesson.videoUrl,
            duration: dto.duration ?? lesson.duration,
            sortOrder: dto.sortOrder ?? lesson.sortOrder,
            isPreview: dto.isPreview ?? lesson.isPreview,
            attachmentsJson: dto.attachments ? JSON.stringify(dto.attachments) : lesson.attachmentsJson,
        });
        const saved = await this.lessonRepo.save(lesson);
        return this.serializeLesson(saved);
    }
    async adminDeleteLesson(id) {
        const lesson = await this.lessonRepo.findOne({ where: { id } });
        if (!lesson)
            throw new common_1.NotFoundException('Lesson not found');
        await this.lessonRepo.remove(lesson);
        return { ok: true };
    }
    async studentListCourses() {
        const courses = await this.courseRepo.find({
            where: { status: 'published' },
            order: { createdAt: 'DESC' },
        });
        return courses.map((c) => this.serializeCourse(c));
    }
    async studentGetCourseWithLessons(courseId) {
        const course = await this.courseRepo.findOne({ where: { id: courseId, status: 'published' } });
        if (!course)
            throw new common_1.NotFoundException('Course not found');
        const lessons = await this.lessonRepo.find({ where: { courseId }, order: { sortOrder: 'ASC' } });
        return {
            ...this.serializeCourse(course),
            lessons: lessons.map((l) => this.serializeLesson(l)),
        };
    }
    async enroll(courseId, userId) {
        const existing = await this.enrollRepo.findOne({ where: { courseId, userId } });
        if (existing)
            return existing;
        const enrollment = this.enrollRepo.create({ courseId, userId });
        return this.enrollRepo.save(enrollment);
    }
    async getEnrollment(courseId, userId) {
        return this.enrollRepo.findOne({ where: { courseId, userId } });
    }
    async updateProgress(userId, lessonId, courseId, dto) {
        let progress = await this.progressRepo.findOne({ where: { userId, lessonId } });
        if (!progress) {
            progress = this.progressRepo.create({ userId, lessonId, courseId });
        }
        if (dto.completed !== undefined) {
            progress.completed = dto.completed;
            if (dto.completed && !progress.completedAt) {
                progress.completedAt = new Date().toISOString();
            }
        }
        if (dto.lastPosition !== undefined)
            progress.lastPosition = dto.lastPosition;
        return this.progressRepo.save(progress);
    }
    serializeCourse(c) {
        return {
            id: c.id,
            title: c.title,
            description: c.description,
            status: c.status,
            difficulty: c.difficulty,
            category: c.category,
            thumbnailUrl: c.thumbnailUrl,
            instructor: c.instructor,
            duration: c.duration,
            isFree: c.isFree,
            takeaways: c.takeawaysJson ? JSON.parse(c.takeawaysJson) : [],
            assignment: c.assignment,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
        };
    }
    serializeLesson(l) {
        return {
            id: l.id,
            courseId: l.courseId,
            title: l.title,
            description: l.description,
            videoUrl: l.videoUrl,
            duration: l.duration,
            sortOrder: l.sortOrder,
            isPreview: l.isPreview,
            attachments: l.attachmentsJson ? JSON.parse(l.attachmentsJson) : [],
            createdAt: l.createdAt,
        };
    }
};
exports.MasterclassService = MasterclassService;
exports.MasterclassService = MasterclassService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(masterclass_entity_1.MasterclassCourse)),
    __param(1, (0, typeorm_1.InjectRepository)(masterclass_entity_1.MasterclassLesson)),
    __param(2, (0, typeorm_1.InjectRepository)(masterclass_entity_1.MasterclassEnrollment)),
    __param(3, (0, typeorm_1.InjectRepository)(masterclass_entity_1.MasterclassLessonProgress)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], MasterclassService);
//# sourceMappingURL=masterclass.service.js.map