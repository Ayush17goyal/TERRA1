import type { PromptIntent, StudentLevel, TeachingStrategy } from '../ai/prompts/types';
import type { RuntimeDecisionPacket } from '../llm/types';
import { EducationalReasoningEngine } from '../ai/reasoning/EducationalReasoningEngine';
import type { KnowledgeRetrievalRequest } from '../knowledge/types';
import type { WorkflowContext } from './WorkflowContext';
import type {
  AssessmentModeDetection,
  DocumentProcessingPort,
  DraftingArtifact,
  NormalizedWorkflowRequest,
  RuntimeOrchestratorPort,
  WorkflowSnapshot,
} from './WorkflowTypes';
import { WorkflowCancelledError } from './WorkflowErrors';

const LEVELS: StudentLevel[] = ['beginner', 'developing', 'intermediate', 'advanced', 'capstone', 'professional_review'];

export interface DecisionPipelineOptions {
  documentProcessor?: DocumentProcessingPort;
  runtimeOrchestrator: RuntimeOrchestratorPort;
}

export class DecisionPipeline {
  private readonly documentProcessor?: DocumentProcessingPort;
  private readonly runtimeOrchestrator: RuntimeOrchestratorPort;
  private readonly reasoningEngine = new EducationalReasoningEngine();

  constructor(options: DecisionPipelineOptions) {
    this.documentProcessor = options.documentProcessor;
    this.runtimeOrchestrator = options.runtimeOrchestrator;
  }

  async prepareContext(context: WorkflowContext): Promise<void> {
    this.throwIfCancelled(context);
    context.documents = await this.processDocuments(context);
    context.normalized = this.normalize(context);
    context.artifacts = this.detectArtifacts(context);
    context.assessment = this.detectAssessmentMode(context.normalized);
  }

  buildKnowledgeRequest(snapshot: WorkflowSnapshot): KnowledgeRetrievalRequest {
    return {
      userId: snapshot.user.id,
      courseId: snapshot.curriculum.courseId,
      moduleId: snapshot.normalized.moduleId ?? snapshot.curriculum.moduleId,
      lessonId: snapshot.normalized.lessonId ?? snapshot.curriculum.lessonId,
      projectId: snapshot.normalized.projectId,
      userMessage: snapshot.normalized.message,
      normalizedMessage: snapshot.normalized.normalizedMessage,
      intent: snapshot.normalized.intent,
      teachingStrategy: snapshot.normalized.teachingStrategy,
      studentLevel: snapshot.normalized.studentLevel,
      currentLessonTitle: snapshot.curriculum.lessonTitle,
      currentModuleTitle: snapshot.curriculum.moduleTitle,
      patternNames: snapshot.normalized.patternNames,
      componentTypes: snapshot.normalized.componentTypes,
      jurisdiction: snapshot.normalized.jurisdiction,
      masteryState: snapshot.mastery.confidenceEstimate,
    };
  }

  buildRuntimePacket(snapshot: WorkflowSnapshot): RuntimeDecisionPacket {
    const normalized = snapshot.normalized;
    const educationalReasoning = this.reasoningEngine.analyze({
      message: normalized.normalizedMessage,
      intent: normalized.intent,
      teachingStrategy: normalized.teachingStrategy,
      studentLevel: normalized.studentLevel,
      draftText: normalized.draftText,
      bareActTitle: normalized.bareActTitle,
      bareActExcerpt: normalized.bareActExcerpt,
      analysisFocus: normalized.analysisFocus,
      currentLessonTitle: snapshot.curriculum.lessonTitle,
      knownWeaknesses: snapshot.weaknesses.knownWeaknesses,
      masteredSkills: snapshot.mastery.masteredSkills,
      patternNames: normalized.patternNames,
      componentTypes: normalized.componentTypes,
    });
    return {
      requestId: snapshot.requestId,
      interactionId: snapshot.interactionId,
      studentId: snapshot.user.id,
      sessionId: normalized.sessionId,
      intent: normalized.intent,
      teachingStrategy: normalized.teachingStrategy,
      abortSignal: undefined,
      promptRequest: {
        userMessage: normalized.message,
        normalizedMessage: normalized.normalizedMessage,
        intent: normalized.intent,
        teachingStrategy: normalized.teachingStrategy,
        productName: 'Bare Act Drafting Mentor',
        platformName: 'LEGATRIXON',
        defaultJurisdiction: normalized.jurisdiction,
        curriculum: {
          moduleId: normalized.moduleId ?? snapshot.curriculum.moduleId,
          moduleTitle: snapshot.curriculum.moduleTitle,
          lessonId: normalized.lessonId ?? snapshot.curriculum.lessonId,
          lessonTitle: snapshot.curriculum.lessonTitle,
          learningOutcomes: snapshot.curriculum.learningOutcomes,
          prerequisites: snapshot.curriculum.prerequisites,
          masteryCriteria: snapshot.curriculum.masteryCriteria,
          nextModule: snapshot.curriculum.nextModule,
          blockingGaps: snapshot.curriculum.blockingGaps,
        },
        student: {
          level: normalized.studentLevel,
          masteredSkills: snapshot.mastery.masteredSkills,
          knownWeaknesses: snapshot.weaknesses.knownWeaknesses,
          confidenceEstimate: snapshot.mastery.confidenceEstimate,
          currentProject: normalized.projectId,
          previousFeedbackSummary: normalized.previousFeedback,
          stuckStatus: snapshot.weaknesses.stuckStatus,
          revisionNeeded: snapshot.weaknesses.revisionNeeded,
        },
        patterns: normalized.patternNames?.map((name) => ({ name })),
        draft: normalized.draftText ? {
          text: normalized.draftText,
          objective: normalized.draftObjective,
          componentType: normalized.componentTypes?.[0],
          previousFeedback: normalized.previousFeedback,
          reviewDepth: normalized.intent === 'capstone' ? 'qa' : 'standard',
        } : undefined,
        bareAct: normalized.bareActTitle || normalized.bareActExcerpt ? {
          title: normalized.bareActTitle,
          excerpt: normalized.bareActExcerpt,
          analysisFocus: normalized.analysisFocus,
        } : undefined,
        capstone: normalized.intent === 'capstone' ? {
          objective: normalized.draftObjective,
          actStructure: normalized.actStructure,
          completedComponents: normalized.completedComponents,
          pendingComponents: normalized.pendingComponents,
          independenceLevel: snapshot.mastery.confidenceEstimate === 'mastery' ? 'high' : 'moderate',
        } : undefined,
        safety: {
          assessmentMode: snapshot.assessment.active,
          allowedAssistanceLevel: snapshot.assessment.active ? 'hint_only' : 'demonstration_allowed',
          riskFlags: snapshot.assessment.restrictions,
          sourceGroundingStatus: normalized.intent === 'bare_act_analysis' ? 'partial' : 'none',
        },
        output: this.outputFor(normalized.intent),
        educationalReasoning,
      },
      metadata: {
        correlationId: snapshot.correlationId,
        documentIds: snapshot.documents.map((result) => result.document.id),
        artifacts: snapshot.artifacts.map((artifact) => artifact.kind),
        assessmentRestrictions: snapshot.assessment.restrictions,
        draftingIntent: educationalReasoning.draftingIntent,
        smallestNextSkill: educationalReasoning.smallestNextSkill,
      },
    };
  }

  async runRuntimeOrchestrator(packet: RuntimeDecisionPacket, snapshot: WorkflowSnapshot): Promise<RuntimeDecisionPacket> {
    return this.runtimeOrchestrator.run(packet, snapshot);
  }

  private async processDocuments(context: WorkflowContext) {
    const uploads = context.request.uploadedDocuments ?? [];
    if (!uploads.length || !this.documentProcessor) return [];
    const results = [];
    for (const upload of uploads) {
      this.throwIfCancelled(context);
      results.push(await this.documentProcessor.process({ ...upload, userId: context.user?.id ?? upload.userId }));
    }
    return results;
  }

  private normalize(context: WorkflowContext): NormalizedWorkflowRequest {
    const body = context.request.body;
    const rawMessage = this.string(body.message) ?? this.string(body.draftObjective) ?? this.string(body.analysisFocus) ?? 'Continue the Bare Act drafting lesson.';
    const normalizedMessage = rawMessage.trim().replace(/\s+/g, ' ');
    const draftText = this.string(body.draftText) ?? this.string(body.submissionText);
    const bareActExcerpt = this.string(body.excerpt) ?? this.string(body.bareActExcerpt);
    const declaredIntent = this.string(body.intent) as PromptIntent | undefined;
    const intent = this.intent(declaredIntent, normalizedMessage, body, draftText, bareActExcerpt);
    const studentLevel = this.studentLevel(this.string(body.studentLevel), context.profile?.level);

    return {
      message: rawMessage,
      normalizedMessage,
      intent,
      teachingStrategy: this.strategy(intent, normalizedMessage, context.weaknesses?.stuckStatus),
      studentLevel,
      jurisdiction: this.string(body.jurisdiction),
      moduleId: this.string(body.moduleId) ?? context.curriculum?.moduleId,
      lessonId: this.string(body.lessonId) ?? context.curriculum?.lessonId,
      projectId: this.string(body.projectId),
      sessionId: this.string(body.sessionId),
      patternNames: this.stringArray(body.patternNames),
      componentTypes: this.stringArray(body.componentTypes) ?? (this.string(body.componentType) ? [this.string(body.componentType) as string] : undefined),
      draftText,
      draftObjective: this.string(body.draftObjective),
      previousFeedback: this.string(body.previousFeedback),
      bareActTitle: this.string(body.bareActTitle),
      bareActExcerpt,
      analysisFocus: this.string(body.analysisFocus),
      actStructure: this.string(body.actStructure),
      completedComponents: this.stringArray(body.completedComponents),
      pendingComponents: this.stringArray(body.pendingComponents),
    };
  }

  private detectArtifacts(context: WorkflowContext): DraftingArtifact[] {
    const normalized = context.normalized;
    if (!normalized) return [];
    const artifacts: DraftingArtifact[] = [];
    if (normalized.draftText) {
      artifacts.push({
        kind: normalized.intent === 'revision' ? 'revision' : normalized.intent === 'capstone' ? 'capstone' : 'draft_text',
        text: normalized.draftText,
        componentType: normalized.componentTypes?.[0],
        confidence: 0.95,
      });
    }
    if (normalized.bareActExcerpt) artifacts.push({ kind: 'bare_act_excerpt', text: normalized.bareActExcerpt, confidence: 0.9 });
    for (const document of context.documents) {
      artifacts.push({ kind: 'uploaded_document', documentId: document.document.id, confidence: document.classification.confidence });
    }
    return artifacts;
  }

  private detectAssessmentMode(normalized: NormalizedWorkflowRequest): AssessmentModeDetection {
    if (normalized.intent === 'quiz') return { active: true, kind: 'quiz', restrictions: ['Do not reveal complete answers before student attempt.'] };
    if (normalized.intent === 'assessment') return { active: true, kind: 'assessment', restrictions: ['Respect assessment boundaries.', 'Give feedback without completing the assessment for the student.'] };
    if (normalized.intent === 'capstone') return { active: true, kind: 'capstone', restrictions: ['Review and guide; preserve student authorship.'] };
    return { active: false, restrictions: [] };
  }

  private intent(declared: PromptIntent | undefined, message: string, body: Record<string, unknown>, draftText?: string, bareActExcerpt?: string): PromptIntent {
    const supported: PromptIntent[] = ['learning', 'drafting', 'review', 'revision', 'quiz', 'assessment', 'capstone', 'bare_act_analysis', 'out_of_scope', 'mixed', 'low_confidence'];
    if (declared && supported.includes(declared)) return declared;
    const lower = message.toLowerCase();
    if (body.assessmentId || lower.includes('assessment')) return 'assessment';
    if (body.answers || lower.includes('quiz')) return 'quiz';
    if (body.actStructure || lower.includes('capstone')) return 'capstone';
    if (bareActExcerpt || body.bareActTitle || lower.includes('analyse bare act') || lower.includes('analyze bare act')) return 'bare_act_analysis';
    if (draftText && (body.previousFeedback || lower.includes('revise'))) return 'revision';
    if (draftText || lower.includes('review my draft')) return 'review';
    if (lower.includes('draft') || lower.includes('clause') || lower.includes('section')) return 'drafting';
    if (lower.includes('answer immediately') || lower.includes('just give')) return 'learning';
    return 'learning';
  }

  private strategy(intent: PromptIntent, message: string, stuck?: boolean): TeachingStrategy {
    if (intent === 'review') return 'review';
    if (intent === 'revision') return 'revision_guidance';
    if (intent === 'quiz') return 'quiz';
    if (intent === 'assessment') return 'assessment_feedback';
    if (intent === 'capstone') return 'capstone_review';
    if (intent === 'out_of_scope') return 'safe_redirect';
    if (stuck) return 'hint';
    if (message.toLowerCase().includes('why') || message.toLowerCase().includes('explain')) return 'teach';
    if (intent === 'drafting') return 'question';
    return 'teach';
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
    return { includeNextAction: true, maxLength: intent === 'assessment' ? 'short' : 'medium' };
  }

  private studentLevel(value?: string, fallback?: StudentLevel): StudentLevel {
    return value && LEVELS.includes(value as StudentLevel) ? value as StudentLevel : fallback ?? 'beginner';
  }

  private string(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
  }

  private stringArray(value: unknown): string[] | undefined {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : undefined;
  }

  private throwIfCancelled(context: WorkflowContext): void {
    if (context.request.abortSignal?.aborted) throw new WorkflowCancelledError('decision');
  }
}

