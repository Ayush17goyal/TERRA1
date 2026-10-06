"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const typeorm_1 = require("@nestjs/typeorm");
const exam_entities_1 = require("../exam/exam.entities");
const notebook_entity_1 = require("../notebook/notebook.entity");
const research_entities_1 = require("../research/research.entities");
const settings_entities_1 = require("./settings.entities");
const byok_entity_1 = require("./byok.entity");
const credit_entity_1 = require("./credit.entity");
const feature_usage_entity_1 = require("./feature-usage.entity");
const feature_entitlement_service_1 = require("./feature-entitlement.service");
const api_usage_protection_interceptor_1 = require("./api-usage-protection.interceptor");
const provider_management_entity_1 = require("./provider-management.entity");
const settings_controller_1 = require("./settings.controller");
const byok_controller_1 = require("./byok.controller");
const provider_management_controller_1 = require("./provider-management.controller");
const settings_service_1 = require("./settings.service");
const byok_service_1 = require("./byok.service");
const credit_service_1 = require("./credit.service");
const provider_management_service_1 = require("./provider-management.service");
const clerk_account_service_1 = require("./clerk-account.service");
const supabase_service_1 = require("./supabase.service");
const exam_module_1 = require("../exam/exam.module");
const admin_role_guard_1 = require("../../guards/admin-role.guard");
let SettingsModule = class SettingsModule {
};
exports.SettingsModule = SettingsModule;
exports.SettingsModule = SettingsModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            exam_module_1.ExamModule,
            typeorm_1.TypeOrmModule.forFeature([
                settings_entities_1.UserActivityLog,
                settings_entities_1.UserSettingsProfile,
                settings_entities_1.UserSubscription,
                settings_entities_1.UserNotificationPreference,
                settings_entities_1.UserAchievement,
                settings_entities_1.AccountDeletionRequest,
                settings_entities_1.UserFeedback,
                settings_entities_1.NotificationLog,
                exam_entities_1.Exam,
                exam_entities_1.MockTest,
                exam_entities_1.CalendarEvent,
                exam_entities_1.ReadinessSnapshot,
                notebook_entity_1.NotebookDocument,
                research_entities_1.ResearchUser,
                research_entities_1.ResearchQuery,
                research_entities_1.ResearchReport,
                research_entities_1.ResearchSource,
                research_entities_1.ResearchNote,
                research_entities_1.SavedReport,
                research_entities_1.ResearchAsset,
                research_entities_1.ResearchDocument,
                byok_entity_1.UserApiKey,
                byok_entity_1.UserByokUsageMetric,
                credit_entity_1.AiPlanEntitlement,
                credit_entity_1.UserAiCreditBalance,
                credit_entity_1.AiCreditTransaction,
                feature_usage_entity_1.FeatureUsageCounter,
                feature_usage_entity_1.DemoModeSetting,
                feature_usage_entity_1.DemoModeAuditLog,
                feature_usage_entity_1.ApiUsageError,
                provider_management_entity_1.AiProvider,
                provider_management_entity_1.AiProviderKey,
                provider_management_entity_1.AiProviderFailure,
                provider_management_entity_1.AiProviderAlert,
                provider_management_entity_1.AiProviderUsageMetric,
            ]),
        ],
        controllers: [settings_controller_1.SettingsController, byok_controller_1.ByokController, provider_management_controller_1.ProviderManagementController],
        providers: [settings_service_1.SettingsService, byok_service_1.ByokService, credit_service_1.CreditService, feature_entitlement_service_1.FeatureEntitlementService, provider_management_service_1.ProviderManagementService, clerk_account_service_1.ClerkAccountService, supabase_service_1.SupabaseService, admin_role_guard_1.AdminRoleGuard, { provide: core_1.APP_INTERCEPTOR, useClass: api_usage_protection_interceptor_1.ApiUsageProtectionInterceptor }],
        exports: [settings_service_1.SettingsService, byok_service_1.ByokService, credit_service_1.CreditService, feature_entitlement_service_1.FeatureEntitlementService, provider_management_service_1.ProviderManagementService, supabase_service_1.SupabaseService],
    })
], SettingsModule);
//# sourceMappingURL=settings.module.js.map