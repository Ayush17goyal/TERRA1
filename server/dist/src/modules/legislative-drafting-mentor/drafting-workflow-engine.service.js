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
exports.DraftingWorkflowEngineService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const drafting_session_entity_1 = require("./entities/drafting-session.entity");
const academy_curriculum_1 = require("./academy-curriculum");
const lesson_catalog_1 = require("./lesson-catalog");
let DraftingWorkflowEngineService = class DraftingWorkflowEngineService {
    constructor(sessions) {
        this.sessions = sessions;
    }
    async createSession(userId, topic) {
        const trimmedTopic = (topic || '').trim();
        if (!trimmedTopic) {
            throw new common_1.BadRequestException('A legislative topic is required to start a drafting session.');
        }
        const session = this.sessions.create({
            userId,
            topic: trimmedTopic,
            currentLessonIndex: 0,
            completedLessons: [],
            status: 'in_progress',
        });
        const saved = await this.sessions.save(session);
        return this.toView(saved);
    }
    async listSessions(userId) {
        const rows = await this.sessions.find({
            where: { userId },
            order: { updatedAt: 'DESC' },
        });
        return rows.map((row) => this.toView(row));
    }
    async resumeSession(userId, sessionId) {
        const session = await this.loadOwnedSession(userId, sessionId);
        return this.toView(session);
    }
    async advance(userId, sessionId) {
        const session = await this.loadOwnedSession(userId, sessionId);
        const completed = new Set(session.completedLessons);
        completed.add(session.currentLessonIndex);
        session.completedLessons = Array.from(completed).sort((a, b) => a - b);
        const isLastLesson = session.currentLessonIndex >= lesson_catalog_1.TOTAL_DRAFTING_LESSONS - 1;
        if (isLastLesson) {
            session.status = 'completed';
        }
        else {
            session.currentLessonIndex += 1;
            session.status = 'in_progress';
        }
        const saved = await this.sessions.save(session);
        return this.toView(saved);
    }
    async goBack(userId, sessionId) {
        const session = await this.loadOwnedSession(userId, sessionId);
        if (session.currentLessonIndex === 0) {
            return this.toView(session);
        }
        session.currentLessonIndex -= 1;
        session.status = 'in_progress';
        const saved = await this.sessions.save(session);
        return this.toView(saved);
    }
    async goToLesson(userId, sessionId, lessonIndex) {
        const session = await this.loadOwnedSession(userId, sessionId);
        if (!Number.isInteger(lessonIndex) || lessonIndex < 0 || lessonIndex >= lesson_catalog_1.TOTAL_DRAFTING_LESSONS) {
            throw new common_1.BadRequestException(`lessonIndex must be between 0 and ${lesson_catalog_1.TOTAL_DRAFTING_LESSONS - 1}.`);
        }
        const highestUnlocked = session.completedLessons.length
            ? Math.max(...session.completedLessons) + 1
            : session.currentLessonIndex;
        if (lessonIndex > highestUnlocked) {
            throw new common_1.BadRequestException('Cannot skip ahead to a lesson that has not been unlocked yet.');
        }
        session.currentLessonIndex = lessonIndex;
        session.status = 'in_progress';
        const saved = await this.sessions.save(session);
        return this.toView(saved);
    }
    async getAcademyState(userId) {
        const session = await this.getOrCreateAcademySession(userId);
        return {
            state: session.academyState || {},
            version: session.stateVersion || 0,
            updatedAt: session.updatedAt,
            lastActivityAt: session.lastActivityAt,
        };
    }
    async syncAcademyState(userId, input) {
        const session = await this.getOrCreateAcademySession(userId);
        const incoming = input?.state;
        if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
            throw new common_1.BadRequestException('A valid academy state object is required.');
        }
        const serialized = JSON.stringify(incoming);
        if (serialized.length > 2_000_000) {
            throw new common_1.BadRequestException('Academy state exceeds the 2 MB safety limit.');
        }
        const incomingVersion = Number(input?.version || 0);
        if (incomingVersion < (session.stateVersion || 0)) {
            return { conflict: true, state: session.academyState || {}, version: session.stateVersion, updatedAt: session.updatedAt };
        }
        this.validateAcademyState(incoming);
        session.academyState = incoming;
        session.stateVersion = (session.stateVersion || 0) + 1;
        session.lastActivityAt = new Date();
        const saved = await this.sessions.save(session);
        return { conflict: false, state: saved.academyState, version: saved.stateVersion, updatedAt: saved.updatedAt };
    }
    validateAcademyState(state) {
        const current = Number(state.current || 0);
        const completed = Array.isArray(state.completedLessons) ? state.completedLessons : [];
        if (!Number.isInteger(current) || current < 0 || current >= academy_curriculum_1.ACADEMY_TOTAL_LESSONS) {
            throw new common_1.BadRequestException('Invalid current lesson.');
        }
        if (completed.some((value) => !Number.isInteger(value) || Number(value) < 0 || Number(value) >= academy_curriculum_1.ACADEMY_TOTAL_LESSONS)) {
            throw new common_1.BadRequestException('Invalid completed lesson list.');
        }
        const ordered = Array.from(new Set(completed.map((value) => Number(value)))).sort((a, b) => a - b);
        if (ordered.some((value, index) => value !== index)) {
            throw new common_1.BadRequestException('Completed lessons must form a contiguous journey from lesson 1.');
        }
        const unlocked = ordered.length ? Math.min(academy_curriculum_1.ACADEMY_TOTAL_LESSONS - 1, ordered.length) : 0;
        if (current > unlocked) {
            throw new common_1.BadRequestException('Cannot unlock a lesson before completing the previous lesson.');
        }
    }
    async getOrCreateAcademySession(userId) {
        let session = await this.sessions.findOne({ where: { userId, topic: '__LEGISLATIVE_DRAFTING_ACADEMY__' } });
        if (!session) {
            session = this.sessions.create({
                userId,
                topic: '__LEGISLATIVE_DRAFTING_ACADEMY__',
                currentLessonIndex: 0,
                completedLessons: [],
                status: 'in_progress',
                academyState: {},
                stateVersion: 0,
                lastActivityAt: new Date(),
            });
            session = await this.sessions.save(session);
        }
        return session;
    }
    async loadOwnedSession(userId, sessionId) {
        const session = await this.sessions.findOne({ where: { id: sessionId } });
        if (!session) {
            throw new common_1.NotFoundException('Drafting session not found.');
        }
        if (session.userId !== userId) {
            throw new common_1.ForbiddenException('This drafting session does not belong to the current user.');
        }
        return session;
    }
    toView(session) {
        return {
            id: session.id,
            topic: session.topic,
            status: session.status,
            currentLesson: (0, lesson_catalog_1.getLessonByIndex)(session.currentLessonIndex),
            completedLessons: session.completedLessons,
            totalLessons: lesson_catalog_1.TOTAL_DRAFTING_LESSONS,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
        };
    }
    getLessonCatalog() {
        return lesson_catalog_1.DRAFTING_LESSON_CATALOG;
    }
};
exports.DraftingWorkflowEngineService = DraftingWorkflowEngineService;
exports.DraftingWorkflowEngineService = DraftingWorkflowEngineService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(drafting_session_entity_1.DraftingSession)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], DraftingWorkflowEngineService);
//# sourceMappingURL=drafting-workflow-engine.service.js.map