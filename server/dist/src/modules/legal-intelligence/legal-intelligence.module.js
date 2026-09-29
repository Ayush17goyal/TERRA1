"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LegalIntelligenceModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const chat_module_1 = require("../chat/chat.module");
const retrieval_module_1 = require("../retrieval/retrieval.module");
const case_reasoning_simulator_controller_1 = require("./case-reasoning-simulator.controller");
const case_reasoning_simulator_service_1 = require("./case-reasoning-simulator.service");
const legal_intelligence_controller_1 = require("./legal-intelligence.controller");
const legal_intelligence_entities_1 = require("./legal-intelligence.entities");
const legal_intelligence_service_1 = require("./legal-intelligence.service");
const parsed_provision_entity_1 = require("../ingestion/entities/parsed-provision.entity");
let LegalIntelligenceModule = class LegalIntelligenceModule {
};
exports.LegalIntelligenceModule = LegalIntelligenceModule;
exports.LegalIntelligenceModule = LegalIntelligenceModule = __decorate([
    (0, common_1.Module)({
        imports: [
            retrieval_module_1.RetrievalModule,
            typeorm_1.TypeOrmModule.forFeature([
                legal_intelligence_entities_1.LegalAuthorityVerification,
                legal_intelligence_entities_1.LegalResearchGuideSession,
                legal_intelligence_entities_1.DraftingAcademyCourse,
                legal_intelligence_entities_1.DraftingAcademyCheck,
                legal_intelligence_entities_1.CaseSimulationSession,
                legal_intelligence_entities_1.ResearchMentorSession,
                parsed_provision_entity_1.ParsedProvisionEntity,
            ]),
            chat_module_1.ChatModule,
        ],
        controllers: [legal_intelligence_controller_1.LegalIntelligenceController, case_reasoning_simulator_controller_1.CaseReasoningSimulatorController],
        providers: [legal_intelligence_service_1.LegalIntelligenceService, case_reasoning_simulator_service_1.CaseReasoningSimulatorService],
        exports: [legal_intelligence_service_1.LegalIntelligenceService],
    })
], LegalIntelligenceModule);
//# sourceMappingURL=legal-intelligence.module.js.map