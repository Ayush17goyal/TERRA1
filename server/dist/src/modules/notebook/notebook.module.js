"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotebookModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const notebook_controller_1 = require("./notebook.controller");
const notebook_service_1 = require("./notebook.service");
const notebook_entity_1 = require("./notebook.entity");
const chunk_entity_1 = require("./chunk.entity");
const chat_message_entity_1 = require("./chat-message.entity");
const search_history_entity_1 = require("./search-history.entity");
const retrieval_module_1 = require("../retrieval/retrieval.module");
const legal_domain_module_1 = require("../legal-domain/legal-domain.module");
const chat_module_1 = require("../chat/chat.module");
const document_processor_1 = require("../../services/document-processor");
const vector_store_1 = require("../../services/vector-store");
const document_upload_nest_service_1 = require("../../services/document-upload-nest.service");
let NotebookModule = class NotebookModule {
};
exports.NotebookModule = NotebookModule;
exports.NotebookModule = NotebookModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                notebook_entity_1.NotebookDocument,
                chunk_entity_1.DocumentChunk,
                chat_message_entity_1.NotebookChatMessage,
                search_history_entity_1.NotebookSearchHistory,
            ]),
            retrieval_module_1.RetrievalModule,
            legal_domain_module_1.LegalDomainModule,
            chat_module_1.ChatModule,
        ],
        controllers: [notebook_controller_1.NotebookController],
        providers: [
            notebook_service_1.NotebookService,
            document_processor_1.DocumentProcessor,
            vector_store_1.VectorStoreService,
            document_upload_nest_service_1.DocumentUploadServiceNest,
        ],
        exports: [notebook_service_1.NotebookService, document_upload_nest_service_1.DocumentUploadServiceNest],
    })
], NotebookModule);
//# sourceMappingURL=notebook.module.js.map