"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearningWorkspaceModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const learning_workspace_controller_1 = require("./learning-workspace.controller");
const learning_workspace_entities_1 = require("./learning-workspace.entities");
const learning_workspace_service_1 = require("./learning-workspace.service");
const retrieval_module_1 = require("../retrieval/retrieval.module");
const exam_module_1 = require("../exam/exam.module");
let LearningWorkspaceModule = class LearningWorkspaceModule {
};
exports.LearningWorkspaceModule = LearningWorkspaceModule;
exports.LearningWorkspaceModule = LearningWorkspaceModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                learning_workspace_entities_1.AiFlashcardReview,
                learning_workspace_entities_1.AiLearningActivity,
                learning_workspace_entities_1.AiLearningSource,
                learning_workspace_entities_1.AiMindMap,
                learning_workspace_entities_1.AiMockTest,
                learning_workspace_entities_1.AiMockTestAttempt,
                learning_workspace_entities_1.AiStudyKit,
                learning_workspace_entities_1.AiQuestionVaultItem,
            ]),
            retrieval_module_1.RetrievalModule,
            exam_module_1.ExamModule,
        ],
        controllers: [learning_workspace_controller_1.LearningWorkspaceController],
        providers: [learning_workspace_service_1.LearningWorkspaceService],
    })
], LearningWorkspaceModule);
//# sourceMappingURL=learning-workspace.module.js.map