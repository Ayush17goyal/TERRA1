"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResearchModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const research_entities_1 = require("./research.entities");
const research_controller_1 = require("./research.controller");
const research_service_1 = require("./research.service");
const retrieval_module_1 = require("../retrieval/retrieval.module");
const exam_module_1 = require("../exam/exam.module");
const chat_module_1 = require("../chat/chat.module");
let ResearchModule = class ResearchModule {
};
exports.ResearchModule = ResearchModule;
exports.ResearchModule = ResearchModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                research_entities_1.ResearchUser,
                research_entities_1.ResearchQuery,
                research_entities_1.ResearchReport,
                research_entities_1.ResearchSource,
                research_entities_1.ResearchNote,
                research_entities_1.SavedReport,
                research_entities_1.ResearchAsset,
                research_entities_1.ResearchDocument,
                research_entities_1.JudgmentReport,
            ]),
            retrieval_module_1.RetrievalModule,
            exam_module_1.ExamModule,
            chat_module_1.ChatModule,
        ],
        controllers: [research_controller_1.ResearchController],
        providers: [research_service_1.ResearchService],
        exports: [research_service_1.ResearchService],
    })
], ResearchModule);
//# sourceMappingURL=research.module.js.map