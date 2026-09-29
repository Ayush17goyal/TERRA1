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
exports.DocumentEngineController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const document_engine_service_1 = require("./document-engine.service");
const upload_document_dto_1 = require("./dto/upload-document.dto");
const document_engine_constants_1 = require("./document-engine.constants");
let DocumentEngineController = class DocumentEngineController {
    constructor(documentEngineService) {
        this.documentEngineService = documentEngineService;
    }
    async upload(file, body, req) {
        return this.documentEngineService.submit(req.user.id, file, body.documentTypeHint);
    }
    async list(req) {
        return this.documentEngineService.listForUser(req.user.id);
    }
    async status(id, req) {
        return this.documentEngineService.getStatus(req.user.id, id);
    }
    async record(id, req) {
        return this.documentEngineService.getKnowledgeRecord(req.user.id, id);
    }
};
exports.DocumentEngineController = DocumentEngineController;
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', { limits: { fileSize: document_engine_constants_1.MAX_UPLOAD_BYTES } })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, upload_document_dto_1.UploadDocumentDto, Object]),
    __metadata("design:returntype", Promise)
], DocumentEngineController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)('documents'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], DocumentEngineController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('documents/:id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DocumentEngineController.prototype, "status", null);
__decorate([
    (0, common_1.Get)('documents/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DocumentEngineController.prototype, "record", null);
exports.DocumentEngineController = DocumentEngineController = __decorate([
    (0, common_1.Controller)('document-engine'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [document_engine_service_1.DocumentEngineService])
], DocumentEngineController);
//# sourceMappingURL=document-engine.controller.js.map