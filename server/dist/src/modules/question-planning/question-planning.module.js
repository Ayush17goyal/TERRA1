"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionPlanningModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const topic_knowledge_unit_entity_1 = require("../knowledge-engine/entities/topic-knowledge-unit.entity");
const question_bank_module_1 = require("../question-bank/question-bank.module");
const question_plan_entity_1 = require("./entities/question-plan.entity");
const question_slot_entity_1 = require("./entities/question-slot.entity");
const question_planning_controller_1 = require("./question-planning.controller");
const question_planning_service_1 = require("./question-planning.service");
const question_planning_queue_service_1 = require("./question-planning-queue.service");
let QuestionPlanningModule = class QuestionPlanningModule {
};
exports.QuestionPlanningModule = QuestionPlanningModule;
exports.QuestionPlanningModule = QuestionPlanningModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([topic_knowledge_unit_entity_1.TopicKnowledgeUnitEntity, question_plan_entity_1.QuestionPlanEntity, question_slot_entity_1.QuestionSlotEntity]), question_bank_module_1.QuestionBankModule],
        controllers: [question_planning_controller_1.QuestionPlanningController],
        providers: [question_planning_service_1.QuestionPlanningService, question_planning_queue_service_1.QuestionPlanningQueueService],
        exports: [question_planning_service_1.QuestionPlanningService, question_planning_queue_service_1.QuestionPlanningQueueService],
    })
], QuestionPlanningModule);
//# sourceMappingURL=question-planning.module.js.map