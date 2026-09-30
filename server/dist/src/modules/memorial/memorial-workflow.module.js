"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorialWorkflowModule = void 0;
const common_1 = require("@nestjs/common");
const chat_module_1 = require("../chat/chat.module");
const retrieval_module_1 = require("../retrieval/retrieval.module");
const memorial_workflow_controller_1 = require("./memorial-workflow.controller");
const memorial_workflow_service_1 = require("./memorial-workflow.service");
const memorial_ai_service_1 = require("./memorial-ai.service");
const proposition_preservation_service_1 = require("./proposition-preservation.service");
const proposition_intelligence_service_1 = require("./proposition-intelligence.service");
const case_graph_service_1 = require("./case-graph.service");
const issue_engine_service_1 = require("./issue-engine.service");
const authority_engine_service_1 = require("./authority-engine.service");
const argument_engine_service_1 = require("./argument-engine.service");
const memorial_compiler_service_1 = require("./memorial-compiler.service");
const memorial_judge_service_1 = require("./memorial-judge.service");
let MemorialWorkflowModule = class MemorialWorkflowModule {
};
exports.MemorialWorkflowModule = MemorialWorkflowModule;
exports.MemorialWorkflowModule = MemorialWorkflowModule = __decorate([
    (0, common_1.Module)({
        imports: [chat_module_1.ChatModule, retrieval_module_1.RetrievalModule],
        controllers: [memorial_workflow_controller_1.MemorialWorkflowController],
        providers: [
            memorial_workflow_service_1.MemorialWorkflowService,
            memorial_ai_service_1.MemorialAiService,
            proposition_preservation_service_1.PropositionPreservationService,
            proposition_intelligence_service_1.PropositionIntelligenceService,
            case_graph_service_1.CaseGraphService,
            issue_engine_service_1.IssueEngineService,
            authority_engine_service_1.AuthorityEngineService,
            argument_engine_service_1.ArgumentEngineService,
            memorial_compiler_service_1.MemorialCompilerService,
            memorial_judge_service_1.MemorialJudgeService,
        ],
        exports: [memorial_workflow_service_1.MemorialWorkflowService],
    })
], MemorialWorkflowModule);
//# sourceMappingURL=memorial-workflow.module.js.map