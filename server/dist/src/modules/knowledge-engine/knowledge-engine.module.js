"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeEngineModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const document_knowledge_record_entity_1 = require("../document-engine/entities/document-knowledge-record.entity");
const ingested_document_entity_1 = require("../document-engine/entities/ingested-document.entity");
const question_planning_module_1 = require("../question-planning/question-planning.module");
const knowledge_engine_controller_1 = require("./knowledge-engine.controller");
const knowledge_engine_queue_service_1 = require("./knowledge-engine-queue.service");
const knowledge_engine_service_1 = require("./knowledge-engine.service");
const personal_exam_library_entity_1 = require("./entities/personal-exam-library.entity");
const topic_graph_edge_entity_1 = require("./entities/topic-graph-edge.entity");
const topic_knowledge_unit_entity_1 = require("./entities/topic-knowledge-unit.entity");
let KnowledgeEngineModule = class KnowledgeEngineModule {
};
exports.KnowledgeEngineModule = KnowledgeEngineModule;
exports.KnowledgeEngineModule = KnowledgeEngineModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                ingested_document_entity_1.IngestedDocumentEntity,
                document_knowledge_record_entity_1.DocumentKnowledgeRecordEntity,
                personal_exam_library_entity_1.PersonalExamLibraryEntity,
                topic_knowledge_unit_entity_1.TopicKnowledgeUnitEntity,
                topic_graph_edge_entity_1.TopicGraphEdgeEntity,
            ]),
            question_planning_module_1.QuestionPlanningModule,
        ],
        controllers: [knowledge_engine_controller_1.KnowledgeEngineController],
        providers: [knowledge_engine_service_1.KnowledgeEngineService, knowledge_engine_queue_service_1.KnowledgeEngineQueueService],
        exports: [knowledge_engine_service_1.KnowledgeEngineService, knowledge_engine_queue_service_1.KnowledgeEngineQueueService],
    })
], KnowledgeEngineModule);
//# sourceMappingURL=knowledge-engine.module.js.map