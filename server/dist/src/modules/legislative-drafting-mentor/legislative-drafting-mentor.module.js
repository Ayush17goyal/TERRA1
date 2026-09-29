"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegislativeDraftingMentorModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const drafting_session_entity_1 = require("./entities/drafting-session.entity");
const drafting_workflow_engine_service_1 = require("./drafting-workflow-engine.service");
const legislative_drafting_mentor_controller_1 = require("./legislative-drafting-mentor.controller");
const academy_professor_service_1 = require("./academy-professor.service");
const chat_module_1 = require("../chat/chat.module");
let LegislativeDraftingMentorModule = class LegislativeDraftingMentorModule {
};
exports.LegislativeDraftingMentorModule = LegislativeDraftingMentorModule;
exports.LegislativeDraftingMentorModule = LegislativeDraftingMentorModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([drafting_session_entity_1.DraftingSession]), chat_module_1.ChatModule],
        controllers: [legislative_drafting_mentor_controller_1.LegislativeDraftingMentorController],
        providers: [drafting_workflow_engine_service_1.DraftingWorkflowEngineService, academy_professor_service_1.AcademyProfessorService],
        exports: [drafting_workflow_engine_service_1.DraftingWorkflowEngineService],
    })
], LegislativeDraftingMentorModule);
//# sourceMappingURL=legislative-drafting-mentor.module.js.map