"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionBankModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const topic_knowledge_unit_entity_1 = require("../knowledge-engine/entities/topic-knowledge-unit.entity");
const question_plan_entity_1 = require("../question-planning/entities/question-plan.entity");
const question_slot_entity_1 = require("../question-planning/entities/question-slot.entity");
const model_answer_module_1 = require("../model-answer/model-answer.module");
const question_bank_entry_entity_1 = require("./entities/question-bank-entry.entity");
const question_bank_controller_1 = require("./question-bank.controller");
const question_bank_service_1 = require("./question-bank.service");
const question_bank_queue_service_1 = require("./question-bank-queue.service");
let QuestionBankModule = class QuestionBankModule {
};
exports.QuestionBankModule = QuestionBankModule;
exports.QuestionBankModule = QuestionBankModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([question_plan_entity_1.QuestionPlanEntity, question_slot_entity_1.QuestionSlotEntity, topic_knowledge_unit_entity_1.TopicKnowledgeUnitEntity, question_bank_entry_entity_1.QuestionBankEntryEntity]),
            model_answer_module_1.ModelAnswerModule,
        ],
        controllers: [question_bank_controller_1.QuestionBankController],
        providers: [question_bank_service_1.QuestionBankService, question_bank_queue_service_1.QuestionBankQueueService],
        exports: [question_bank_service_1.QuestionBankService, question_bank_queue_service_1.QuestionBankQueueService],
    })
], QuestionBankModule);
//# sourceMappingURL=question-bank.module.js.map