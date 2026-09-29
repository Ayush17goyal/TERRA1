"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnswerEvaluationModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const model_answer_entry_entity_1 = require("../model-answer/entities/model-answer-entry.entity");
const question_bank_entry_entity_1 = require("../question-bank/entities/question-bank-entry.entity");
const answer_evaluation_controller_1 = require("./answer-evaluation.controller");
const answer_evaluation_service_1 = require("./answer-evaluation.service");
const answer_evaluation_attempt_entity_1 = require("./entities/answer-evaluation-attempt.entity");
let AnswerEvaluationModule = class AnswerEvaluationModule {
};
exports.AnswerEvaluationModule = AnswerEvaluationModule;
exports.AnswerEvaluationModule = AnswerEvaluationModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([question_bank_entry_entity_1.QuestionBankEntryEntity, model_answer_entry_entity_1.ModelAnswerEntryEntity, answer_evaluation_attempt_entity_1.AnswerEvaluationAttemptEntity])],
        controllers: [answer_evaluation_controller_1.AnswerEvaluationController],
        providers: [answer_evaluation_service_1.AnswerEvaluationService],
        exports: [answer_evaluation_service_1.AnswerEvaluationService],
    })
], AnswerEvaluationModule);
//# sourceMappingURL=answer-evaluation.module.js.map