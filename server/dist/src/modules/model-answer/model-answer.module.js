"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelAnswerModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const topic_knowledge_unit_entity_1 = require("../knowledge-engine/entities/topic-knowledge-unit.entity");
const question_bank_entry_entity_1 = require("../question-bank/entities/question-bank-entry.entity");
const chat_module_1 = require("../chat/chat.module");
const model_answer_entry_entity_1 = require("./entities/model-answer-entry.entity");
const model_answer_controller_1 = require("./model-answer.controller");
const model_answer_service_1 = require("./model-answer.service");
const model_answer_queue_service_1 = require("./model-answer-queue.service");
let ModelAnswerModule = class ModelAnswerModule {
};
exports.ModelAnswerModule = ModelAnswerModule;
exports.ModelAnswerModule = ModelAnswerModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([question_bank_entry_entity_1.QuestionBankEntryEntity, topic_knowledge_unit_entity_1.TopicKnowledgeUnitEntity, model_answer_entry_entity_1.ModelAnswerEntryEntity]), chat_module_1.ChatModule],
        controllers: [model_answer_controller_1.ModelAnswerController],
        providers: [model_answer_service_1.ModelAnswerService, model_answer_queue_service_1.ModelAnswerQueueService],
        exports: [model_answer_service_1.ModelAnswerService, model_answer_queue_service_1.ModelAnswerQueueService],
    })
], ModelAnswerModule);
//# sourceMappingURL=model-answer.module.js.map