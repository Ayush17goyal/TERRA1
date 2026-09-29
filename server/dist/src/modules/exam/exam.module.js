"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExamModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const exam_entities_1 = require("./exam.entities");
const learning_workspace_entities_1 = require("../learning-workspace/learning-workspace.entities");
const exam_controller_1 = require("./exam.controller");
const exam_service_1 = require("./exam.service");
const google_calendar_service_1 = require("./google-calendar.service");
const notification_service_1 = require("./notification.service");
const retrieval_module_1 = require("../retrieval/retrieval.module");
const legal_domain_module_1 = require("../legal-domain/legal-domain.module");
const chat_module_1 = require("../chat/chat.module");
const notebook_module_1 = require("../notebook/notebook.module");
let ExamModule = class ExamModule {
};
exports.ExamModule = ExamModule;
exports.ExamModule = ExamModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                exam_entities_1.Exam,
                exam_entities_1.Roadmap,
                exam_entities_1.RevisionPlan,
                exam_entities_1.MockTest,
                exam_entities_1.CalendarEvent,
                exam_entities_1.Notification,
                exam_entities_1.ReadinessSnapshot,
                exam_entities_1.GoogleOAuthToken,
                exam_entities_1.Recommendation,
                learning_workspace_entities_1.AiMockTest,
            ]),
            retrieval_module_1.RetrievalModule,
            legal_domain_module_1.LegalDomainModule,
            chat_module_1.ChatModule,
            notebook_module_1.NotebookModule,
        ],
        controllers: [exam_controller_1.ExamController],
        providers: [exam_service_1.ExamService, google_calendar_service_1.GoogleCalendarService, notification_service_1.NotificationService],
        exports: [exam_service_1.ExamService, google_calendar_service_1.GoogleCalendarService, notification_service_1.NotificationService],
    })
], ExamModule);
//# sourceMappingURL=exam.module.js.map