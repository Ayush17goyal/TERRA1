import type { PromptIntent, TeachingStrategy } from '../../ai/prompts/types';
import type { RuntimeDecisionPacket } from '../../llm/types';
import { EducationalReasoningEngine } from '../../ai/reasoning/EducationalReasoningEngine';
import type {
  BareActAnalysisRequestDto,
  CapstoneReviewRequestDto,
  ChatRequestDto,
  DraftReviewRequestDto,
  DraftRevisionRequestDto,
} from '../dto/schemas';
import type { ApiRequestContext } from '../types';

type SupportedBody =
  | ChatRequestDto
  | DraftReviewRequestDto
  | DraftRevisionRequestDto
  | CapstoneReviewRequestDto
  | BareActAnalysisRequestDto;

export class RuntimePacketBuilder {
  private readonly reasoningEngine = new EducationalReasoningEngine();
  build(context: ApiRequestContext, body: SupportedBody, intent: PromptIntent, strategy: TeachingStrategy): RuntimeDecisionPacket {
    const draftBody = body as Partial<DraftReviewRequestDto & DraftRevisionRequestDto>;
    const bareActBody = body as Partial<BareActAnalysisRequestDto>;
    const capstoneBody = body as Partial<CapstoneReviewRequestDto>;
    const message = 'message' in body ? body.message : draftBody.draftObjective ?? 'Review submitted drafting work.';
    const studentLevel = 'studentLevel' in body ? body.studentLevel : 'beginner';
    const educationalReasoning = this.reasoningEngine.analyze({
      message: message.trim(),
      intent,
      teachingStrategy: strategy,
      studentLevel,
      draftText: draftBody.draftText,
      bareActTitle: bareActBody.bareActTitle,
      bareActExcerpt: bareActBody.excerpt,
      analysisFocus: bareActBody.analysisFocus,
      patternNames: 'patternNames' in body ? body.patternNames : undefined,
      componentTypes: draftBody.componentType ? [draftBody.componentType] : undefined,
    });

    return {
      requestId: context.requestId,
      interactionId: context.correlationId,
      studentId: context.user?.id,
      sessionId: 'sessionId' in body ? body.sessionId : undefined,
      intent,
      teachingStrategy: strategy,
      promptRequest: {
        userMessage: message,
        normalizedMessage: message.trim(),
        intent,
        teachingStrategy: strategy,
        defaultJurisdiction: 'jurisdiction' in body ? body.jurisdiction : undefined,
        curriculum: {
          moduleId: 'moduleId' in body ? body.moduleId : undefined,
          lessonId: 'lessonId' in body ? body.lessonId : undefined,
        },
        student: {
          level: studentLevel,
        },
        patterns: 'patternNames' in body ? body.patternNames?.map((name) => ({ name })) : undefined,
        draft: draftBody.draftText ? {
          text: draftBody.draftText,
          objective: draftBody.draftObjective,
          componentType: draftBody.componentType,
          previousFeedback: draftBody.previousFeedback,
          reviewDepth: intent === 'capstone' ? 'qa' : 'standard',
        } : undefined,
        bareAct: bareActBody.bareActTitle || bareActBody.excerpt ? {
          title: bareActBody.bareActTitle,
          excerpt: bareActBody.excerpt,
          analysisFocus: bareActBody.analysisFocus,
        } : undefined,
        capstone: intent === 'capstone' ? {
          objective: draftBody.draftObjective,
          actStructure: capstoneBody.actStructure,
          completedComponents: capstoneBody.completedComponents,
          pendingComponents: capstoneBody.pendingComponents,
        } : undefined,
        safety: {
          assessmentMode: intent === 'assessment',
          riskFlags: this.detectRiskFlags(message, draftBody.draftText, bareActBody.excerpt),
          sourceGroundingStatus: intent === 'bare_act_analysis' ? 'partial' : 'none',
        },
        output: this.outputFor(intent),
        educationalReasoning,
      },
      metadata: {
        path: context.path,
        correlationId: context.correlationId,
        expectedNextAction: 'Continue with the next student attempt or revision.',
        draftingIntent: educationalReasoning.draftingIntent,
        smallestNextSkill: educationalReasoning.smallestNextSkill,
      },
    };
  }

  private detectRiskFlags(...values: Array<string | undefined>): string[] {
    const text = values.filter(Boolean).join('\n');
    const flags = new Set<string>();
    if (/ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts)/i.test(text)) flags.add('prompt_injection');
    if (/(reveal|print|show|extract).{0,50}(system|developer|hidden).{0,30}(prompt|instruction)/is.test(text)) flags.add('prompt_extraction_request');
    if (/you\s+are\s+now\s+(system|developer|admin|dan)/i.test(text)) flags.add('role_takeover_attempt');
    if (/(draft|write|generate|create).{0,40}(complete|entire|full).{0,30}(bare act|act|statute)/i.test(text)) flags.add('complete_bare_act_request');
    return Array.from(flags);
  }
  private outputFor(intent: PromptIntent): RuntimeDecisionPacket['promptRequest']['output'] {
    if (intent === 'review' || intent === 'revision' || intent === 'capstone') {
      return {
        requiredSections: ['Strengths', 'Weaknesses', 'Drafting issues', 'Next action'],
        includeNextAction: true,
        includeReflectionQuestions: true,
        includeStrengthsWeaknesses: true,
      };
    }
    return {
      includeNextAction: true,
      maxLength: 'medium',
    };
  }
}

