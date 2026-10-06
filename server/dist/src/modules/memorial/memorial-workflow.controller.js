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
exports.MemorialWorkflowController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const clerk_auth_guard_1 = require("../../guards/clerk-auth.guard");
const memorial_workflow_service_1 = require("./memorial-workflow.service");
let MemorialWorkflowController = class MemorialWorkflowController {
    constructor(workflow) {
        this.workflow = workflow;
    }
    async blueprint(req, files, body) {
        return this.workflow.extractBlueprint(this.toInput(files?.file?.[0], files?.references || [], body, req.user.id));
    }
    async run(req, files, body) {
        return this.workflow.run(this.toInput(files?.file?.[0], files?.references || [], body, req.user.id));
    }
    toInput(file, referenceFiles, body, authenticatedUserId) {
        return {
            file,
            referenceFiles,
            propositionText: body.propositionText,
            side: body.side || 'both',
            sourceName: body.sourceName,
            depth: body.depth || 'exhaustive',
            citationStyle: body.citationStyle || 'bluebook',
            preferredModel: body.preferredModel,
            selectedSources: this.parseStringArray(body.selectedSources),
            competitionRulesText: body.competitionRulesText,
            maxPages: this.parseOptionalNumber(body.maxPages),
            maxWords: this.parseOptionalNumber(body.maxWords),
            qualityThreshold: this.parseOptionalNumber(body.qualityThreshold) || 92,
            allowUnverifiedAuthorities: body.allowUnverifiedAuthorities === true || String(body.allowUnverifiedAuthorities).toLowerCase() === 'true',
            userId: authenticatedUserId,
        };
    }
    parseStringArray(value) {
        if (Array.isArray(value))
            return value.map(String).filter(Boolean);
        if (!value)
            return [];
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed))
                return parsed.map(String).filter(Boolean);
        }
        catch { }
        return String(value).split(',').map((item) => item.trim()).filter(Boolean);
    }
    parseOptionalNumber(value) {
        if (value === undefined || value === null || value === '')
            return undefined;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
};
exports.MemorialWorkflowController = MemorialWorkflowController;
__decorate([
    (0, common_1.Post)('blueprint'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'file', maxCount: 1 },
        { name: 'references', maxCount: 12 },
    ])),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], MemorialWorkflowController.prototype, "blueprint", null);
__decorate([
    (0, common_1.Post)('run'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'file', maxCount: 1 },
        { name: 'references', maxCount: 12 },
    ])),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], MemorialWorkflowController.prototype, "run", null);
exports.MemorialWorkflowController = MemorialWorkflowController = __decorate([
    (0, common_1.Controller)('memorial-workflow'),
    (0, common_1.UseGuards)(clerk_auth_guard_1.ClerkAuthGuard),
    __metadata("design:paramtypes", [memorial_workflow_service_1.MemorialWorkflowService])
], MemorialWorkflowController);
//# sourceMappingURL=memorial-workflow.controller.js.map