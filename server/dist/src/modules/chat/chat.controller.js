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
exports.ChatController = void 0;
const common_1 = require("@nestjs/common");
const chat_service_1 = require("./chat.service");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const guidebot_service_1 = require("./guidebot.service");
const platform_express_1 = require("@nestjs/platform-express");
let ChatController = class ChatController {
    constructor(chatService, guideBotService) {
        this.chatService = chatService;
        this.guideBotService = guideBotService;
    }
    async sendMessage(body, req) {
        return this.chatService.sendMessage(req.user.id, body.sessionId, body.message, body.depth, body.references);
    }
    async sendGuideBotMessage(body, req) {
        return this.guideBotService.sendMessage(req.user.id, body.sessionId, body.message);
    }
    async speechToText(file) {
        if (!file) {
            throw new Error('No audio file provided.');
        }
        const text = await this.guideBotService.transcribeAudio(file.buffer, file.originalname || 'audio.webm');
        return { text };
    }
    async textToSpeech(body, res) {
        const audioBuffer = await this.guideBotService.textToSpeech(body.text);
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.length,
        });
        res.end(audioBuffer);
    }
    async getGuideBotHistory(sessionId, req) {
        return this.guideBotService.getHistory(req.user.id, sessionId);
    }
    async clearGuideBotSession(sessionId, req) {
        return this.guideBotService.clearSession(req.user.id, sessionId);
    }
    async getHistory(sessionId, req) {
        return this.chatService.getHistory(req.user.id, sessionId);
    }
    async clearSession(sessionId, req) {
        return this.chatService.clearSession(req.user.id, sessionId);
    }
    async getFallbackMetrics() {
        return this.chatService.getFallbackMetrics();
    }
    async getTokenAnalytics() {
        return this.chatService.getTokenAnalytics();
    }
    async getCacheAnalytics() {
        return this.chatService.getCacheAnalytics();
    }
    async vectorSearch(body) {
        return this.chatService.search(body.query);
    }
    async getCitations(messageId, req) {
        return this.chatService.getCitations(req.user.id, messageId);
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Post)('message'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Post)('guidebot/message'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "sendGuideBotMessage", null);
__decorate([
    (0, common_1.Post)('guidebot/stt'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "speechToText", null);
__decorate([
    (0, common_1.Post)('guidebot/tts'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "textToSpeech", null);
__decorate([
    (0, common_1.Get)('guidebot/history/:sessionId'),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getGuideBotHistory", null);
__decorate([
    (0, common_1.Delete)('guidebot/history/:sessionId'),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "clearGuideBotSession", null);
__decorate([
    (0, common_1.Get)('history/:sessionId'),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Delete)('history/:sessionId'),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "clearSession", null);
__decorate([
    (0, common_1.Get)('fallback-metrics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getFallbackMetrics", null);
__decorate([
    (0, common_1.Get)('token-analytics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getTokenAnalytics", null);
__decorate([
    (0, common_1.Get)('cache-analytics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getCacheAnalytics", null);
__decorate([
    (0, common_1.Post)('search'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "vectorSearch", null);
__decorate([
    (0, common_1.Get)('citations/:messageId'),
    __param(0, (0, common_1.Param)('messageId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "getCitations", null);
exports.ChatController = ChatController = __decorate([
    (0, common_1.Controller)('chat'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [chat_service_1.ChatService,
        guidebot_service_1.GuideBotService])
], ChatController);
//# sourceMappingURL=chat.controller.js.map