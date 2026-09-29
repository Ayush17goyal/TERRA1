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
exports.LiveDraftingSession = void 0;
const typeorm_1 = require("typeorm");
let LiveDraftingSession = class LiveDraftingSession {
};
exports.LiveDraftingSession = LiveDraftingSession;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], LiveDraftingSession.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LiveDraftingSession.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], LiveDraftingSession.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LiveDraftingSession.prototype, "instructor", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scheduled_at' }),
    __metadata("design:type", Date)
], LiveDraftingSession.prototype, "scheduledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'end_at', nullable: true }),
    __metadata("design:type", Date)
], LiveDraftingSession.prototype, "endAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'meet_link', nullable: true }),
    __metadata("design:type", String)
], LiveDraftingSession.prototype, "meetLink", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'course_id', nullable: true }),
    __metadata("design:type", String)
], LiveDraftingSession.prototype, "courseId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'scheduled' }),
    __metadata("design:type", String)
], LiveDraftingSession.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], LiveDraftingSession.prototype, "createdAt", void 0);
exports.LiveDraftingSession = LiveDraftingSession = __decorate([
    (0, typeorm_1.Entity)('live_drafting_sessions')
], LiveDraftingSession);
//# sourceMappingURL=live-session.entity.js.map