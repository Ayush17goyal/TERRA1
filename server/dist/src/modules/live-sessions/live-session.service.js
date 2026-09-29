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
exports.LiveSessionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const live_session_entity_1 = require("./live-session.entity");
const MEET_LINK_PATTERN = /^https:\/\/meet\.google\.com\/[a-z0-9-]+$/i;
let LiveSessionService = class LiveSessionService {
    constructor(repo) {
        this.repo = repo;
    }
    validateSchedule(dto) {
        if (!dto.title?.trim())
            throw new common_1.BadRequestException('Title is required.');
        if (!dto.scheduledAt)
            throw new common_1.BadRequestException('Start time is required.');
        if (!dto.endAt)
            throw new common_1.BadRequestException('End time is required.');
        if (!dto.meetLink?.trim())
            throw new common_1.BadRequestException('Google Meet link is required.');
        if (!MEET_LINK_PATTERN.test(dto.meetLink.trim())) {
            throw new common_1.BadRequestException('Google Meet link must look like https://meet.google.com/abc-defg-hij');
        }
        const start = new Date(dto.scheduledAt);
        const end = new Date(dto.endAt);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            throw new common_1.BadRequestException('Invalid start or end time.');
        }
        if (end <= start) {
            throw new common_1.BadRequestException('End time must be after start time.');
        }
    }
    async scheduleLiveClass(dto) {
        this.validateSchedule(dto);
        const session = this.repo.create({
            title: dto.title.trim(),
            description: dto.description ?? null,
            instructor: dto.instructor ?? null,
            scheduledAt: new Date(dto.scheduledAt),
            endAt: new Date(dto.endAt),
            meetLink: dto.meetLink.trim(),
            courseId: dto.courseId ?? null,
            status: 'scheduled',
        });
        return this.repo.save(session);
    }
    async updateLiveClass(id, dto) {
        const session = await this.getSessionOrThrow(id);
        this.validateSchedule({
            title: dto.title ?? session.title,
            scheduledAt: dto.scheduledAt ?? session.scheduledAt.toISOString(),
            endAt: dto.endAt ?? session.endAt?.toISOString(),
            meetLink: dto.meetLink ?? session.meetLink,
        });
        Object.assign(session, {
            title: dto.title?.trim() ?? session.title,
            description: dto.description ?? session.description,
            instructor: dto.instructor ?? session.instructor,
            scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : session.scheduledAt,
            endAt: dto.endAt ? new Date(dto.endAt) : session.endAt,
            meetLink: dto.meetLink?.trim() ?? session.meetLink,
            courseId: dto.courseId ?? session.courseId,
        });
        return this.repo.save(session);
    }
    async cancelSession(id) {
        const session = await this.getSessionOrThrow(id);
        session.status = 'cancelled';
        return this.repo.save(session);
    }
    async deleteSession(id) {
        const session = await this.getSessionOrThrow(id);
        await this.repo.remove(session);
        return { ok: true };
    }
    async getSessionOrThrow(id) {
        const session = await this.repo.findOne({ where: { id } });
        if (!session)
            throw new common_1.NotFoundException('Live session not found');
        return session;
    }
    computeLiveState(session) {
        if (session.status === 'cancelled')
            return 'cancelled';
        const now = Date.now();
        const start = new Date(session.scheduledAt).getTime();
        const end = session.endAt ? new Date(session.endAt).getTime() : start;
        if (now < start)
            return 'upcoming';
        if (now > end)
            return 'ended';
        return 'live';
    }
    serializeForStudent(session) {
        return {
            id: session.id,
            title: session.title,
            description: session.description,
            instructor: session.instructor,
            scheduledAt: session.scheduledAt,
            endAt: session.endAt,
            courseId: session.courseId,
            status: session.status,
            liveState: this.computeLiveState(session),
            createdAt: session.createdAt,
        };
    }
    serializeForAdmin(session) {
        return {
            ...this.serializeForStudent(session),
            meetLink: session.meetLink,
        };
    }
    async listSessions() {
        const sessions = await this.repo.find({ order: { scheduledAt: 'DESC' } });
        return sessions.map((s) => this.serializeForStudent(s));
    }
    async adminListSessions() {
        const sessions = await this.repo.find({ order: { scheduledAt: 'DESC' } });
        return sessions.map((s) => this.serializeForAdmin(s));
    }
    async getMeetLink(sessionId, _userId) {
        const session = await this.repo.findOne({ where: { id: sessionId } });
        if (!session)
            throw new common_1.NotFoundException('This class has been removed.');
        if (session.status === 'cancelled')
            throw new common_1.NotFoundException('This class has been cancelled.');
        const now = Date.now();
        const start = new Date(session.scheduledAt).getTime();
        const end = session.endAt ? new Date(session.endAt).getTime() : start;
        if (now < start)
            throw new common_1.ForbiddenException('This class has not started yet.');
        if (now > end)
            throw new common_1.ForbiddenException('This class has ended.');
        if (!session.meetLink)
            throw new common_1.NotFoundException('Meeting link unavailable.');
        return { meetLink: session.meetLink };
    }
};
exports.LiveSessionService = LiveSessionService;
exports.LiveSessionService = LiveSessionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(live_session_entity_1.LiveDraftingSession)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], LiveSessionService);
//# sourceMappingURL=live-session.service.js.map