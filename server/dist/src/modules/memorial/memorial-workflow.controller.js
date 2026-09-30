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
const memorial_workflow_service_1 = require("./memorial-workflow.service");
let MemorialWorkflowController = class MemorialWorkflowController {
    constructor(workflow) {
        this.workflow = workflow;
    }
    async blueprint(file, body) {
        return this.workflow.extractBlueprint(this.toInput(file, body));
    }
    async run(file, body) {
        return this.workflow.run(this.toInput(file, body));
    }
    toInput(file, body) {
        return {
            file,
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
            userId: body.userId,
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
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MemorialWorkflowController.prototype, "blueprint", null);
__decorate([
    (0, common_1.Post)('run'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MemorialWorkflowController.prototype, "run", null);
exports.MemorialWorkflowController = MemorialWorkflowController = __decorate([
    (0, common_1.Controller)('memorial-workflow'),
    __metadata("design:paramtypes", [memorial_workflow_service_1.MemorialWorkflowService])
], MemorialWorkflowController);
//# sourceMappingURL=memorial-workflow.controller.js.map