"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningIntelligenceModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const analytics_engine_module_1 = require("../analytics-engine/analytics-engine.module");
const answer_evaluation_attempt_entity_1 = require("../answer-evaluation/entities/answer-evaluation-attempt.entity");
const mock_test_paper_entity_1 = require("../mock-test-engine/entities/mock-test-paper.entity");
const question_bank_entry_entity_1 = require("../question-bank/entities/question-bank-entry.entity");
const learning_intelligence_controller_1 = require("./learning-intelligence.controller");
const learning_intelligence_service_1 = require("./learning-intelligence.service");
let LearningIntelligenceModule = class LearningIntelligenceModule {
};
exports.LearningIntelligenceModule = LearningIntelligenceModule;
exports.LearningIntelligenceModule = LearningIntelligenceModule = __decorate([
    (0, common_1.Module)({
        imports: [
            analytics_engine_module_1.AnalyticsEngineModule,
            typeorm_1.TypeOrmModule.forFeature([answer_evaluation_attempt_entity_1.AnswerEvaluationAttemptEntity, question_bank_entry_entity_1.QuestionBankEntryEntity, mock_test_paper_entity_1.MockTestPaperEntity]),
        ],
        controllers: [learning_intelligence_controller_1.LearningIntelligenceController],
        providers: [learning_intelligence_service_1.LearningIntelligenceService],
        exports: [learning_intelligence_service_1.LearningIntelligenceService],
    })
], LearningIntelligenceModule);
//# sourceMappingURL=learning-intelligence.module.js.map