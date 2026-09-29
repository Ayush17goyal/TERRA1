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
exports.CommunityController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const community_entity_1 = require("./community.entity");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
let CommunityController = class CommunityController {
    constructor(repo) {
        this.repo = repo;
    }
    async getMessages() {
        const messages = await this.repo.find({
            order: { createdAt: 'ASC' },
            take: 100,
        });
        return messages.map((m) => ({
            id: m.id,
            userName: m.userName,
            text: m.text,
            topic: m.topic,
            createdAt: m.createdAt,
        }));
    }
    async sendMessage(body, req) {
        const user = req.user || {};
        const fullName = String(user.fullName || '').trim();
        const parts = fullName.split(/\s+/).filter(Boolean);
        const displayName = parts.length >= 2
            ? `${parts[0]} ${parts[1][0]}.`
            : parts[0] || 'User';
        const text = String(body.text || '').trim();
        if (!text || text.length > 1000) {
            return { error: 'Message must be 1–1000 characters.' };
        }
        const msg = this.repo.create({
            userName: displayName,
            text,
            topic: body.topic || null,
        });
        const saved = await this.repo.save(msg);
        return {
            id: saved.id,
            userName: saved.userName,
            text: saved.text,
            topic: saved.topic,
            createdAt: saved.createdAt,
        };
    }
};
exports.CommunityController = CommunityController;
__decorate([
    (0, common_1.Get)('messages'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CommunityController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)('messages'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CommunityController.prototype, "sendMessage", null);
exports.CommunityController = CommunityController = __decorate([
    (0, common_1.Controller)('community'),
    __param(0, (0, typeorm_1.InjectRepository)(community_entity_1.CommunityMessage)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], CommunityController);
//# sourceMappingURL=community.controller.js.map