"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockTestEngineModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const question_bank_entry_entity_1 = require("../question-bank/entities/question-bank-entry.entity");
const question_plan_entity_1 = require("../question-planning/entities/question-plan.entity");
const mock_test_paper_entity_1 = require("./entities/mock-test-paper.entity");
const mock_test_paper_question_entity_1 = require("./entities/mock-test-paper-question.entity");
const mock_test_engine_controller_1 = require("./mock-test-engine.controller");
const mock_test_engine_service_1 = require("./mock-test-engine.service");
const retrieval_module_1 = require("../retrieval/retrieval.module");
let MockTestEngineModule = class MockTestEngineModule {
};
exports.MockTestEngineModule = MockTestEngineModule;
exports.MockTestEngineModule = MockTestEngineModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([question_bank_entry_entity_1.QuestionBankEntryEntity, question_plan_entity_1.QuestionPlanEntity, mock_test_paper_entity_1.MockTestPaperEntity, mock_test_paper_question_entity_1.MockTestPaperQuestionEntity]),
            retrieval_module_1.RetrievalModule,
        ],
        controllers: [mock_test_engine_controller_1.MockTestEngineController],
        providers: [mock_test_engine_service_1.MockTestEngineService],
        exports: [mock_test_engine_service_1.MockTestEngineService],
    })
], MockTestEngineModule);
//# sourceMappingURL=mock-test-engine.module.js.map