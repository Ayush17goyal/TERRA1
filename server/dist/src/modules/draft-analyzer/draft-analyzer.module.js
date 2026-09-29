"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraftAnalyzerModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const chat_module_1 = require("../chat/chat.module");
const draft_entity_1 = require("./entities/draft.entity");
const draft_page_entity_1 = require("./entities/draft-page.entity");
const draft_text_block_entity_1 = require("./entities/draft-text-block.entity");
const draft_review_finding_entity_1 = require("./entities/draft-review-finding.entity");
const draft_analyzer_service_1 = require("./draft-analyzer.service");
const draft_analyzer_controller_1 = require("./draft-analyzer.controller");
const extraction_service_1 = require("./services/extraction.service");
const pdf_extractor_service_1 = require("./services/pdf-extractor.service");
const docx_extractor_service_1 = require("./services/docx-extractor.service");
const txt_extractor_service_1 = require("./services/txt-extractor.service");
const ai_reviewer_service_1 = require("./services/ai-reviewer.service");
const progress_service_1 = require("./services/progress.service");
let DraftAnalyzerModule = class DraftAnalyzerModule {
};
exports.DraftAnalyzerModule = DraftAnalyzerModule;
exports.DraftAnalyzerModule = DraftAnalyzerModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([draft_entity_1.Draft, draft_page_entity_1.DraftPage, draft_text_block_entity_1.DraftTextBlock, draft_review_finding_entity_1.DraftReviewFinding]),
            chat_module_1.ChatModule,
        ],
        controllers: [draft_analyzer_controller_1.DraftAnalyzerController],
        providers: [
            draft_analyzer_service_1.DraftAnalyzerService,
            extraction_service_1.ExtractionService,
            pdf_extractor_service_1.PdfExtractorService,
            docx_extractor_service_1.DocxExtractorService,
            txt_extractor_service_1.TxtExtractorService,
            ai_reviewer_service_1.AiReviewerService,
            progress_service_1.ProgressService,
        ],
    })
], DraftAnalyzerModule);
//# sourceMappingURL=draft-analyzer.module.js.map