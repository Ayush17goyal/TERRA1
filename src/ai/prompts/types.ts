export type PromptIntent =
  | 'learning'
  | 'drafting'
  | 'review'
  | 'revision'
  | 'quiz'
  | 'assessment'
  | 'capstone'
  | 'bare_act_analysis'
  | 'out_of_scope'
  | 'mixed'
  | 'low_confidence';

export type TeachingStrategy =
  | 'teach'
  | 'question'
  | 'hint'
  | 'review'
  | 'demonstrate'
  | 'quiz'
  | 'assessment_feedback'
  | 'revision_guidance'
  | 'capstone_review'
  | 'safe_redirect';

export type StudentLevel =
  | 'beginner'
  | 'developing'
  | 'intermediate'
  | 'advanced'
  | 'capstone'
  | 'professional_review';

export type PromptModuleName =
  | 'core'
  | 'safety'
  | 'behaviour'
  | 'teaching_strategy'
  | 'curriculum'
  | 'student_context'
  | 'lesson'
  | 'draft_review'
  | 'pattern'
  | 'bare_act_analysis'
  | 'capstone'
  | 'output_formatting';

export type PromptPriority = 'critical' | 'high' | 'medium' | 'low';

export interface PromptTokenBudget {
  target: number;
  max: number;
}

export interface CurriculumContext {
  moduleId?: string;
  moduleTitle?: string;
  lessonId?: string;
  lessonTitle?: string;
  learningOutcomes?: string[];
  prerequisites?: string[];
  masteryCriteria?: string[];
  nextModule?: string;
  blockingGaps?: string[];
}

export interface StudentPromptContext {
  level: StudentLevel;
  masteredSkills?: string[];
  knownWeaknesses?: string[];
  confidenceEstimate?: 'low' | 'developing' | 'functional' | 'strong' | 'mastery';
  currentProject?: string;
  previousDraftSummary?: string;
  previousFeedbackSummary?: string;
  stuckStatus?: boolean;
  revisionNeeded?: boolean;
}

export interface PatternContext {
  name: string;
  purpose?: string;
  typicalLocation?: string;
  structuralTemplate?: string;
  draftingPrinciples?: string[];
  legislativeReasoning?: string[];
  sequencingReason?: string;
  interpretationRiskPrevented?: string;
  commonMistakes?: string[];
  reviewChecklist?: string[];
  misconceptions?: string[];
}

export interface BareActContext {
  title?: string;
  componentType?: string;
  excerpt?: string;
  analysisFocus?: string;
  sourceMetadata?: string;
}

export interface DraftContext {
  text?: string;
  objective?: string;
  componentType?: string;
  previousFeedback?: string;
  reviewDepth?: 'light' | 'standard' | 'deep' | 'qa';
}

export interface CapstoneContext {
  objective?: string;
  actStructure?: string;
  completedComponents?: string[];
  pendingComponents?: string[];
  unresolvedDefects?: string[];
  independenceLevel?: 'low' | 'moderate' | 'high';
}

export interface SafetyContext {
  riskFlags?: string[];
  assessmentMode?: boolean;
  allowedAssistanceLevel?: 'answer' | 'hint_only' | 'review_only' | 'demonstration_allowed';
  jurisdictionConfidence?: 'unknown' | 'low' | 'medium' | 'high';
  sourceGroundingStatus?: 'none' | 'partial' | 'grounded';
}

export interface OutputFormatContext {
  responseFormat?: string;
  requiredSections?: string[];
  maxLength?: 'short' | 'medium' | 'long';
  includeNextAction?: boolean;
  includeReflectionQuestions?: boolean;
  includeStrengthsWeaknesses?: boolean;
}


export type DraftingIntentClassification =
  | 'understand_legal_concept'
  | 'analyse_existing_bare_act'
  | 'analyse_existing_statutory_provision'
  | 'learn_legislative_drafting'
  | 'review_draft'
  | 'improve_draft'
  | 'draft_new_act'
  | 'draft_amendment'
  | 'draft_section'
  | 'draft_clause'
  | 'draft_definitions'
  | 'draft_rules'
  | 'draft_regulations'
  | 'draft_notifications'
  | 'draft_government_orders'
  | 'draft_penalty_provision'
  | 'draft_schedule'
  | 'draft_form'
  | 'draft_explanation'
  | 'draft_proviso'
  | 'draft_saving_clause'
  | 'draft_repeal_clause'
  | 'redraft_existing_provision'
  | 'compare_statutes'
  | 'compare_drafting_styles'
  | 'learn_drafting_conventions'
  | 'unknown';

export interface ExistingLawContext {
  concept?: string;
  statute?: string;
  provision?: string;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
}


export type LegalContextKind =
  | 'existing_statute'
  | 'existing_bill'
  | 'proposed_new_act'
  | 'delegated_legislation'
  | 'subordinate_legislation'
  | 'hypothetical_classroom_exercise'
  | 'comparative_law_topic'
  | 'policy_proposal'
  | 'ambiguous_title'
  | 'unknown';

export interface LegalContextResolutionContext {
  kind: LegalContextKind;
  isExistingLegalInstrument: boolean;
  isHypotheticalTitle: boolean;
  jurisdictionStatus: 'identified' | 'missing' | 'ambiguous';
  jurisdiction?: string;
  requiresClarification: boolean;
  canBeginHypotheticalExercise: boolean;
  legalInstrument?: string;
  parentAct?: string;
  clarificationQuestion?: string;
  educationalAssumption?: string;
  reason: string;
  parentAuthorityStatus?: 'identified' | 'not_applicable' | 'not_identified' | 'unverified';
  authorityVerificationStatement?: string;
}
export interface EducationalReasoningContext {
  studentObjective: string;
  draftingIntent: DraftingIntentClassification;
  intentReason: string;
  classificationConfidence: number;
  classificationLabel: string;
  shouldAskClarification: boolean;
  legalContext: LegalContextResolutionContext;
  isExistingLawTopic: boolean;
  existingLaw?: ExistingLawContext;
  requiresNewLegislation: boolean;
  currentMasteryLevel: StudentLevel;
  smallestNextSkill: string;
  requiredKnowledgeSources: string[];
  requiredDraftingPatterns: string[];
  selectedTeachingStrategy: TeachingStrategy;
  firstSocraticQuestion: string;
  expectedStudentOutput: string;
  responseBoundaries: string[];
}
export interface PromptAssemblyRequest {
  userMessage: string;
  intent: PromptIntent;
  teachingStrategy: TeachingStrategy;
  productName?: string;
  platformName?: string;
  defaultJurisdiction?: string;
  normalizedMessage?: string;
  curriculum?: CurriculumContext;
  student?: StudentPromptContext;
  patterns?: PatternContext[];
  bareAct?: BareActContext;
  draft?: DraftContext;
  capstone?: CapstoneContext;
  safety?: SafetyContext;
  output?: OutputFormatContext;
  educationalReasoning?: EducationalReasoningContext;
  totalTokenBudget?: number;
}

export interface PromptModuleFragment {
  moduleName: PromptModuleName;
  priority: PromptPriority;
  tokenBudget: PromptTokenBudget;
  includedReason: string;
  instructions: string;
  contextVariables?: Record<string, unknown>;
  omissionRules?: string[];
  compressionSummary?: string;
}

export interface AssembledPrompt {
  prompt: string;
  fragments: PromptModuleFragment[];
  estimatedTokens: number;
  omittedModules: PromptModuleName[];
  warnings: string[];
}









