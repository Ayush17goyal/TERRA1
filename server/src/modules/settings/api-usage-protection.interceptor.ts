import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Observable, catchError, from, mergeMap, throwError } from 'rxjs';
import { FeatureEntitlementService, FeatureReservation } from './feature-entitlement.service';
import { DemoFeature } from './subscription-plans';

type ProtectedRoute = { method: string; pattern: RegExp; feature: DemoFeature };

// This is the single server-side inventory of user-triggered routes that can reach
// paid AI, search, embedding, OCR, speech, or document-processing providers.
export const PROTECTED_API_ROUTES: ProtectedRoute[] = [
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
  { method: 'POST', pattern: /^\/research\/command-center\/bare-act$/, feature: 'legal_research' },
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

@Injectable()
export class ApiUsageProtectionInterceptor implements NestInterceptor {
  constructor(private readonly entitlements: FeatureEntitlementService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const feature = this.resolveFeature(request.method, request.originalUrl || request.url || '');
    if (!feature) return next.handle();
    const userId = request.user?.id;
    if (!userId) return throwError(() => new UnauthorizedException('Sign in is required to use this feature.'));

    return from(this.entitlements.reserve(userId, feature, request.user)).pipe(
      mergeMap((reservation) => next.handle().pipe(
        catchError((error) => from(this.handleFailure(userId, feature, reservation, error)).pipe(
          mergeMap((safeError) => throwError(() => safeError)),
        )),
      )),
    );
  }

  private resolveFeature(method: string, rawUrl: string): DemoFeature | null {
    const path = rawUrl.split('?')[0].replace(/^\/api\/v1/, '') || '/';
    return PROTECTED_API_ROUTES.find((route) => route.method === method.toUpperCase() && route.pattern.test(path))?.feature || null;
  }

  private async handleFailure(userId: string, feature: DemoFeature, reservation: FeatureReservation, error: any) {
    await Promise.allSettled([this.entitlements.refund(reservation), this.entitlements.recordApiError(userId, feature, error)]);
    if (error instanceof HttpException && error.getStatus() < 500 && error.getStatus() !== 429) return error;
    return new ServiceUnavailableException({ code: 'API_TEMPORARILY_UNAVAILABLE', message: 'LEGATRIXON is temporarily unable to process this request. Please try again shortly.', retryable: true });
  }
}
