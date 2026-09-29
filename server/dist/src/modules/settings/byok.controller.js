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
exports.ByokController = void 0;
const common_1 = require("@nestjs/common");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const byok_service_1 = require("./byok.service");
let ByokController = class ByokController {
    constructor(byok) {
        this.byok = byok;
    }
    async saveKey(req, body) {
        return this.byok.saveKey(req.user.id, body.provider, body.apiKey);
    }
    async deleteKey(req, provider) {
        return this.byok.deleteKey(req.user.id, provider);
    }
    async listKeys(req) {
        return this.byok.listKeys(req.user.id);
    }
    async getUsage(req) {
        return this.byok.getUsageMetrics(req.user.id);
    }
    async getStatus(req) {
        const keys = await this.byok.listKeys(req.user.id);
        return {
            providers: ['groq', 'gemini', 'openai'].map((provider) => {
                const configured = keys.find((key) => key.provider === provider);
                return configured || {
                    provider,
                    status: 'Not Configured',
                    lastVerifiedAt: null,
                    fingerprint: null,
                };
            }),
        };
    }
};
exports.ByokController = ByokController;
__decorate([
    (0, common_1.Post)('keys'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ByokController.prototype, "saveKey", null);
__decorate([
    (0, common_1.Delete)('keys/:provider'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('provider')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ByokController.prototype, "deleteKey", null);
__decorate([
    (0, common_1.Get)('keys'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ByokController.prototype, "listKeys", null);
__decorate([
    (0, common_1.Get)('usage'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ByokController.prototype, "getUsage", null);
__decorate([
    (0, common_1.Get)('status'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ByokController.prototype, "getStatus", null);
exports.ByokController = ByokController = __decorate([
    (0, common_1.Controller)('settings/byok'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [byok_service_1.ByokService])
], ByokController);
//# sourceMappingURL=byok.controller.js.map