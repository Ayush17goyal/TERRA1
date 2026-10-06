"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiUsageProtectionInterceptor = exports.PROTECTED_API_ROUTES = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const feature_entitlement_service_1 = require("./feature-entitlement.service");
exports.PROTECTED_API_ROUTES = [
    { method: 'POST', pattern: /^\/chat\/message$/, feature: 'lexmentor_ai' },
    { method: 'POST', pattern: /^\/chat\/guidebot\/(message|stt|tts)$/, feature: 'guidebot_ai' },
    { method: 'POST', pattern: /^\/chat\/search$/, feature: 'legal_research' },
    { method: 'POST', pattern: /^\/legal-intelligence\/case-reasoning-simulator\/analyze$/, feature: 'case_law_reasoning' },
    { method: 'POST', pattern: /^\/legal-intelligence\/case-simulator\/analyze$/, feature: 'case_law_reasoning' },
    { method: 'POST', pattern: /^\/legal-intelligence\/research-(assistant|mentor)\//, feature: 'legal_research' },
    { method: 'POST', pattern: /^\/legal-intelligence\/(authority-verification|research-guide)$/, feature: 'legal_research' },
    { method: 'POST', pattern: /^\/legal-intelligence\/bare-act\//, feature: 'bare_act_ai' },
    { method: 'POST', pattern: /^\/legal-intelligence\/drafting\/check$/, feature: 'drafting_academy' },
    { method: 'POST', pattern: /^\/drafting-mentor\/academy\//, feature: 'drafting_mentor' },
    { method: 'POST', pattern: /^\/research\/(generate|judgment-intelligence|legal-brief|bare-act|challenge)$/, feature: 'legal_research' },
    { method: 'POST', pattern: /^\/judgments\/[^/]+\/(analyze|explain|evaluate-verdict|revision-notes|moot-court-kit|alternative-reasoning|mastery)$/, feature: 'judgment_ai' },
    { method: 'POST', pattern: /^\/exam\/mock-paper\/(generate|evaluate)$/, feature: 'mock_test' },
    { method: 'POST', pattern: /^\/exam\/study-library\/(generate-test|generate-answer|insights)$/, feature: 'mock_test' },
    { method: 'POST', pattern: /^\/exam\/(assistant|doubt-solve)$/, feature: 'academic_ai' },
    { method: 'GET', pattern: /^\/exam\/lexmentor\/strategy$/, feature: 'academic_ai' },
    { method: 'POST', pattern: /^\/learning-workspace\/mock-tests\/(generate|analyze-structure)$/, feature: 'mock_test' },
    { method: 'POST', pattern: /^\/learning-workspace\/mock-tests\/[^/]+\/handwritten-ocr$/, feature: 'document_processing' },
    { method: 'POST', pattern: /^\/learning-workspace\/(mind-maps|study-kits|revision-plan)\/generate$/, feature: 'academic_ai' },
    { method: 'POST', pattern: /^\/learning-workspace\/sources\/(text|upload|bulk-upload)$/, feature: 'document_processing' },
    { method: 'POST', pattern: /^\/learning-workspace\/sources\/[^/]+\/reprocess$/, feature: 'document_processing' },
    { method: 'POST', pattern: /^\/notebook\/(upload|bulk-upload|url-ingest|chat)$/, feature: 'document_processing' },
    { method: 'POST', pattern: /^\/notebook\/documents\/[^/]+\/(reprocess|extraction|intelligence|study-forge\/generate)$/, feature: 'document_processing' },
    { method: 'POST', pattern: /^\/draft-analyzer\/[^/]+\/(extract)$/, feature: 'document_processing' },
    { method: 'POST', pattern: /^\/draft-analyzer\/[^/]+\/(review|analyze)$/, feature: 'draft_analysis' },
    { method: 'POST', pattern: /^\/document-engine\/upload$/, feature: 'document_processing' },
    { method: 'POST', pattern: /^\/contracts\/(review|[^/]+\/clauses)$/, feature: 'draft_analysis' },
    { method: 'POST', pattern: /^\/exam-engine\/mock-tests\/(generate|questions\/[^/]+\/model-answer)$/, feature: 'mock_test' },
    { method: 'POST', pattern: /^\/exam-engine\/(model-answers\/create|question-bank\/create|question-planning\/build)$/, feature: 'academic_ai' },
    { method: 'POST', pattern: /^\/memorial-workflow\/(blueprint|run)$/, feature: 'memorial_ai' },
];
let ApiUsageProtectionInterceptor = class ApiUsageProtectionInterceptor {
    constructor(entitlements) {
        this.entitlements = entitlements;
    }
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        const feature = this.resolveFeature(request.method, request.originalUrl || request.url || '');
        if (!feature)
            return next.handle();
        const userId = request.user?.id;
        if (!userId)
            return (0, rxjs_1.throwError)(() => new common_1.UnauthorizedException('Sign in is required to use this feature.'));
        return (0, rxjs_1.from)(this.entitlements.reserve(userId, feature)).pipe((0, rxjs_1.mergeMap)((reservation) => next.handle().pipe((0, rxjs_1.catchError)((error) => (0, rxjs_1.from)(this.handleFailure(userId, feature, reservation, error)).pipe((0, rxjs_1.mergeMap)((safeError) => (0, rxjs_1.throwError)(() => safeError)))))));
    }
    resolveFeature(method, rawUrl) {
        const path = rawUrl.split('?')[0].replace(/^\/api\/v1/, '') || '/';
        return exports.PROTECTED_API_ROUTES.find((route) => route.method === method.toUpperCase() && route.pattern.test(path))?.feature || null;
    }
    async handleFailure(userId, feature, reservation, error) {
        await Promise.allSettled([this.entitlements.refund(reservation), this.entitlements.recordApiError(userId, feature, error)]);
        if (error instanceof common_1.HttpException && error.getStatus() < 500 && error.getStatus() !== 429)
            return error;
        return new common_1.ServiceUnavailableException({ code: 'API_TEMPORARILY_UNAVAILABLE', message: 'LEGATRIXON is temporarily unable to process this request. Please try again shortly.', retryable: true });
    }
};
exports.ApiUsageProtectionInterceptor = ApiUsageProtectionInterceptor;
exports.ApiUsageProtectionInterceptor = ApiUsageProtectionInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [feature_entitlement_service_1.FeatureEntitlementService])
], ApiUsageProtectionInterceptor);
//# sourceMappingURL=api-usage-protection.interceptor.js.map