"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JudgmentModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const judgment_controller_1 = require("./judgment.controller");
const judgment_service_1 = require("./judgment.service");
const judgment_analysis_entity_1 = require("./judgment-analysis.entity");
const chunk_entity_1 = require("../notebook/chunk.entity");
const notebook_entity_1 = require("../notebook/notebook.entity");
const chat_module_1 = require("../chat/chat.module");
let JudgmentModule = class JudgmentModule {
};
exports.JudgmentModule = JudgmentModule;
exports.JudgmentModule = JudgmentModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([judgment_analysis_entity_1.JudgmentAnalysis, chunk_entity_1.DocumentChunk, notebook_entity_1.NotebookDocument]),
            chat_module_1.ChatModule,
        ],
        controllers: [judgment_controller_1.JudgmentController],
        providers: [judgment_service_1.JudgmentService],
        exports: [judgment_service_1.JudgmentService],
    })
], JudgmentModule);
//# sourceMappingURL=judgment.module.js.map