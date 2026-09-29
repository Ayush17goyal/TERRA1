"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const retrieval_module_1 = require("../retrieval/retrieval.module");
const chat_module_1 = require("../chat/chat.module");
const ingestion_service_1 = require("./ingestion.service");
const ingestion_controller_1 = require("./ingestion.controller");
const corpus_scanner_service_1 = require("./corpus-scanner.service");
const legal_act_entity_1 = require("./entities/legal-act.entity");
const parsed_provision_entity_1 = require("./entities/parsed-provision.entity");
let IngestionModule = class IngestionModule {
};
exports.IngestionModule = IngestionModule;
exports.IngestionModule = IngestionModule = __decorate([
    (0, common_1.Module)({
        imports: [
            retrieval_module_1.RetrievalModule,
            chat_module_1.ChatModule,
            typeorm_1.TypeOrmModule.forFeature([legal_act_entity_1.LegalActEntity, parsed_provision_entity_1.ParsedProvisionEntity]),
        ],
        controllers: [ingestion_controller_1.IngestionController],
        providers: [ingestion_service_1.IngestionService, corpus_scanner_service_1.CorpusScannerService],
        exports: [ingestion_service_1.IngestionService, corpus_scanner_service_1.CorpusScannerService],
    })
], IngestionModule);
//# sourceMappingURL=ingestion.module.js.map