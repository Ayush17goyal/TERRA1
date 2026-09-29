"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetrievalModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const qdrant_service_1 = require("./qdrant.service");
const embedding_service_1 = require("./embedding.service");
const vector_search_service_1 = require("./vector-search.service");
const bge_m3_provider_1 = require("./bge-m3.provider");
const legal_retrieval_service_1 = require("./legal-retrieval.service");
const retrieval_controller_1 = require("./retrieval.controller");
const parsed_provision_entity_1 = require("../ingestion/entities/parsed-provision.entity");
let RetrievalModule = class RetrievalModule {
};
exports.RetrievalModule = RetrievalModule;
exports.RetrievalModule = RetrievalModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([parsed_provision_entity_1.ParsedProvisionEntity]),
        ],
        controllers: [retrieval_controller_1.RetrievalController],
        providers: [
            qdrant_service_1.QdrantService,
            embedding_service_1.EmbeddingService,
            vector_search_service_1.VectorSearchService,
            bge_m3_provider_1.BgeM3Provider,
            legal_retrieval_service_1.LegalRetrievalService,
        ],
        exports: [
            qdrant_service_1.QdrantService,
            embedding_service_1.EmbeddingService,
            vector_search_service_1.VectorSearchService,
            bge_m3_provider_1.BgeM3Provider,
            legal_retrieval_service_1.LegalRetrievalService,
        ],
    })
], RetrievalModule);
//# sourceMappingURL=retrieval.module.js.map