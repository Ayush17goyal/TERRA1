import type {
  DraftingIntentClassification,
  EducationalReasoningContext,
  ExistingLawContext,
  LegalContextResolutionContext,
  PromptIntent,
  StudentLevel,
  TeachingStrategy,
} from '../prompts/types';

export interface EducationalReasoningInput {
  message: string;
  intent: PromptIntent;
  teachingStrategy: TeachingStrategy;
  studentLevel: StudentLevel;
  draftText?: string;
  bareActTitle?: string;
  bareActExcerpt?: string;
  analysisFocus?: string;
  currentLessonTitle?: string;
  knownWeaknesses?: string[];
  masteredSkills?: string[];
  patternNames?: string[];
  componentTypes?: string[];
}

interface KnownDoctrine {
  pattern: RegExp;
  concept: string;
  statute: string;
  provision?: string;
}

const KNOWN_DOCTRINES: KnownDoctrine[] = [
  { pattern: /\bdeclaratory\s+relief\b/i, concept: 'declaratory relief', statute: 'Specific Relief Act', provision: 'declaratory decree provisions' },
  { pattern: /\bspecific\s+performance\b/i, concept: 'specific performance', statute: 'Specific Relief Act' },
  { pattern: /\binjunctions?\b/i, concept: 'injunction', statute: 'Specific Relief Act' },
  { pattern: /\bres\s+judicata\b/i, concept: 'res judicata', statute: 'Code of Civil Procedure' },
  { pattern: /\bestoppel\b/i, concept: 'estoppel', statute: 'Indian Evidence Act' },
  { pattern: /\bconsideration\b/i, concept: 'consideration', statute: 'Indian Contract Act' },
  { pattern: /\bminor'?s?\s+agreement\b/i, concept: 'minor agreement', statute: 'Indian Contract Act' },
  { pattern: /\bbail\b/i, concept: 'bail', statute: 'Bharatiya Nagarik Suraksha Sanhita / Code of Criminal Procedure context' },
  { pattern: /\bmens\s+rea\b/i, concept: 'mens rea', statute: 'criminal law doctrine' },
  { pattern: /\btort\b/i, concept: 'tortious liability', statute: 'common law / statutory context depends on issue' },
];

export class EducationalReasoningEngine {
  analyze(input: EducationalReasoningInput): EducationalReasoningContext {
    const message = this.clean(input.message);
    const existingLaw = this.detectExistingLaw(message, input);
    const inferredIntent = this.classifyDraftingIntent(message, input, existingLaw);
    const legalContext = this.withAuthorityStatus(this.resolveLegalContext(message, input, inferredIntent, existingLaw));
    const classificationConfidence = this.classificationConfidence(inferredIntent, legalContext, existingLaw);
    const shouldAskClarification = classificationConfidence < 0.8 || legalContext.requiresClarification;
    const draftingIntent: DraftingIntentClassification = classificationConfidence < 0.8 ? 'unknown' : inferredIntent;
    const requiresNewLegislation = draftingIntent === 'draft_new_act' && !existingLaw;
    const isExistingLawTopic = Boolean(existingLaw) || legalContext.kind === 'existing_statute' || [
      'understand_legal_concept',
      'analyse_existing_bare_act',
      'analyse_existing_statutory_provision',
      'redraft_existing_provision',
    ].includes(draftingIntent);

    const smallestNextSkill = this.smallestNextSkill(draftingIntent, isExistingLawTopic, input, legalContext);
    const requiredDraftingPatterns = this.requiredPatterns(draftingIntent, isExistingLawTopic, input);

    return {
      studentObjective: this.studentObjective(message, draftingIntent),
      draftingIntent,
      intentReason: this.intentReason(draftingIntent, existingLaw, legalContext, message),
      classificationConfidence,
      classificationLabel: this.classificationLabel(draftingIntent),
      shouldAskClarification,
      legalContext,
      isExistingLawTopic,
      existingLaw,
      requiresNewLegislation,
      currentMasteryLevel: input.studentLevel,
      smallestNextSkill,
      requiredKnowledgeSources: this.requiredKnowledgeSources(draftingIntent, isExistingLawTopic, existingLaw, legalContext),
      requiredDraftingPatterns,
      selectedTeachingStrategy: this.teachingStrategyFor(draftingIntent, input.teachingStrategy, legalContext, shouldAskClarification),
      firstSocraticQuestion: this.socraticQuestion(draftingIntent, isExistingLawTopic, existingLaw, legalContext),
      expectedStudentOutput: this.expectedStudentOutput(draftingIntent, isExistingLawTopic, legalContext),
      responseBoundaries: this.responseBoundaries(draftingIntent, isExistingLawTopic, requiresNewLegislation, legalContext),
    };
  }

  private classifyDraftingIntent(
    message: string,
    input: EducationalReasoningInput,
    existingLaw?: ExistingLawContext,
  ): DraftingIntentClassification {
    if (input.draftText && /\b(improve|revise|redraft|fix)\b/i.test(message)) return 'improve_draft';
    if (input.draftText || input.intent === 'review') return 'review_draft';
    if (input.bareActExcerpt || input.bareActTitle || /\b(analy[sz]e|understand|explain).{0,40}\b(bare act|act)\b/i.test(message)) return 'analyse_existing_bare_act';
    if (/\bsection\s+\d+[a-z]?\b/i.test(message) || /\bs\.\s*\d+[a-z]?\b/i.test(message)) return 'analyse_existing_statutory_provision';
    if (/\bamend(ment)?\b|\bbill\s+to\s+amend\b/i.test(message)) return 'draft_amendment';
    if (/\bdraft\s+(?:the\s+)?rules?\b|\brules?\s+(?:for|under|on|regarding)\b/i.test(message)) return 'draft_rules';
    if (/\bdraft\s+(?:the\s+)?regulations?\b|\bregulations?\s+(?:for|under|on|regarding)\b/i.test(message)) return 'draft_regulations';
    if (/\bnotifications?\b/i.test(message)) return 'draft_notifications';
    if (/\b(government|executive)\s+orders?\b/i.test(message)) return 'draft_government_orders';
    if (/\bdefinitions?\b|\bdefine\b/i.test(message)) return 'draft_definitions';
    if (/\bpenalt(y|ies)\b|\bpunishment\b/i.test(message)) return 'draft_penalty_provision';
    if (/\bschedules?\b/i.test(message)) return 'draft_schedule';
    if (/\bforms?\b/i.test(message)) return 'draft_form';
    if (/\bexplanations?\b/i.test(message)) return 'draft_explanation';
    if (/\bprovisos?\b/i.test(message)) return 'draft_proviso';
    if (/\bsaving(s)?\s+clause\b|\bsavings?\b/i.test(message)) return 'draft_saving_clause';
    if (/\brepeal(s|ing)?\b/i.test(message)) return 'draft_repeal_clause';
    if (/\bclause\b/i.test(message)) return 'draft_clause';
    if (/\bsection\b/i.test(message)) return 'draft_section';
    if (/\bcompare\b.*\b(statutes?|acts?)\b/i.test(message)) return 'compare_statutes';
    if (/\bcompare\b.*\bdrafting\b/i.test(message)) return 'compare_drafting_styles';
    if (existingLaw) return 'understand_legal_concept';
    if (/\b(how\s+to\s+write|draft|create|prepare).{0,70}\b(bare act|act|statute|law)\b/i.test(message)) return 'draft_new_act';
    if (input.intent === 'drafting') return 'learn_legislative_drafting';
    if (/\b(convention|shall|may|provided that|notwithstanding|deeming)\b/i.test(message)) return 'learn_drafting_conventions';
    return existingLaw ? 'understand_legal_concept' : 'learn_legislative_drafting';
  }

  private resolveLegalContext(
    message: string,
    input: EducationalReasoningInput,
    draftingIntent: DraftingIntentClassification,
    existingLaw?: ExistingLawContext,
  ): LegalContextResolutionContext {
    const explicitJurisdiction = this.extractJurisdiction(message) ?? input.analysisFocus;
    const parentAct = this.extractParentAct(message);
    const title = this.extractActTitle(message);
    const section = message.match(/\b(?:section|s\.)\s*(\d+[a-z]?)\b/i)?.[1];

    if (existingLaw) {
      return {
        kind: 'existing_statute',
        isExistingLegalInstrument: true,
        isHypotheticalTitle: false,
        jurisdictionStatus: explicitJurisdiction || existingLaw.statute ? 'identified' : 'missing',
        jurisdiction: explicitJurisdiction,
        requiresClarification: false,
        canBeginHypotheticalExercise: false,
        legalInstrument: existingLaw.statute,
        reason: existingLaw.reason,
      };
    }

    if (draftingIntent === 'draft_rules' || draftingIntent === 'draft_regulations') {
      if (parentAct) {
        return {
          kind: 'delegated_legislation',
          isExistingLegalInstrument: false,
          isHypotheticalTitle: false,
          jurisdictionStatus: explicitJurisdiction ? 'identified' : 'missing',
          jurisdiction: explicitJurisdiction,
          requiresClarification: false,
          canBeginHypotheticalExercise: true,
          parentAct,
          legalInstrument: draftingIntent === 'draft_rules' ? 'rules' : 'regulations',
          educationalAssumption: `For teaching, proceed on the limited assumption that ${parentAct} contains the relevant enabling power; do not invent the provision number.`,
          reason: 'The request identifies a parent Act, so delegated legislation drafting can be taught without inventing authority.',
        };
      }

      return {
        kind: 'delegated_legislation',
        isExistingLegalInstrument: false,
        isHypotheticalTitle: false,
        jurisdictionStatus: explicitJurisdiction ? 'identified' : 'missing',
        jurisdiction: explicitJurisdiction,
        requiresClarification: true,
        canBeginHypotheticalExercise: false,
        legalInstrument: draftingIntent === 'draft_rules' ? 'rules' : 'regulations',
        clarificationQuestion: 'What parent Act provides the rule-making power?',
        reason: 'Subordinate legislation cannot be drafted responsibly without identifying the parent Act or enabling authority.',
      };
    }

    if (draftingIntent === 'draft_notifications' || draftingIntent === 'draft_government_orders') {
      return {
        kind: 'subordinate_legislation',
        isExistingLegalInstrument: false,
        isHypotheticalTitle: false,
        jurisdictionStatus: explicitJurisdiction ? 'identified' : 'missing',
        jurisdiction: explicitJurisdiction,
        requiresClarification: !parentAct,
        canBeginHypotheticalExercise: Boolean(parentAct),
        parentAct,
        legalInstrument: draftingIntent === 'draft_notifications' ? 'notification' : 'government order',
        clarificationQuestion: parentAct ? undefined : 'Which statute or delegated authority empowers this instrument?',
        reason: parentAct ? 'The legal source of subordinate authority is identified.' : 'The legal authority for the instrument is not identified.',
      };
    }

    if (section) {
      return {
        kind: 'existing_statute',
        isExistingLegalInstrument: true,
        isHypotheticalTitle: false,
        jurisdictionStatus: explicitJurisdiction ? 'identified' : 'missing',
        jurisdiction: explicitJurisdiction,
        requiresClarification: !title,
        canBeginHypotheticalExercise: false,
        legalInstrument: title,
        clarificationQuestion: title ? undefined : 'Which Act does this section belong to?',
        reason: title ? 'A statutory provision and Act title are identified.' : 'A section number is identified but its Act is missing.',
      };
    }

    if (title) {
      return {
        kind: 'ambiguous_title',
        isExistingLegalInstrument: false,
        isHypotheticalTitle: true,
        jurisdictionStatus: explicitJurisdiction ? 'identified' : 'missing',
        jurisdiction: explicitJurisdiction,
        requiresClarification: false,
        canBeginHypotheticalExercise: true,
        legalInstrument: title,
        educationalAssumption: `I cannot determine from the title alone whether ${title} is an existing Act, Bill, foreign statute, or proposed classroom exercise. For this lesson, treat it as a hypothetical drafting exercise unless the student specifies a jurisdiction or existing source.`,
        reason: 'A title ending in Act is not enough to prove legal existence or jurisdiction.',
      };
    }

    if (draftingIntent === 'compare_statutes' || draftingIntent === 'compare_drafting_styles') {
      return {
        kind: 'comparative_law_topic',
        isExistingLegalInstrument: false,
        isHypotheticalTitle: false,
        jurisdictionStatus: explicitJurisdiction ? 'identified' : 'ambiguous',
        jurisdiction: explicitJurisdiction,
        requiresClarification: !explicitJurisdiction,
        canBeginHypotheticalExercise: Boolean(explicitJurisdiction),
        clarificationQuestion: explicitJurisdiction ? undefined : 'Which jurisdictions or statutes should be compared?',
        reason: 'Comparative drafting requires source jurisdictions or statutes before analysis.',
      };
    }

    return {
      kind: draftingIntent === 'draft_new_act' ? 'hypothetical_classroom_exercise' : 'unknown',
      isExistingLegalInstrument: false,
      isHypotheticalTitle: draftingIntent === 'draft_new_act',
      jurisdictionStatus: explicitJurisdiction ? 'identified' : 'missing',
      jurisdiction: explicitJurisdiction,
      requiresClarification: false,
      canBeginHypotheticalExercise: true,
      educationalAssumption: draftingIntent === 'draft_new_act'
        ? 'No existing statute or jurisdiction has been identified; proceed as a hypothetical legislative drafting exercise.'
        : 'No existing legal instrument has been identified; proceed only with drafting-method education.',
      reason: draftingIntent === 'draft_new_act'
        ? 'The query names a policy subject without an existing legal instrument.'
        : 'The legal context is not specific enough to assert an existing source.',
    };
  }

  private withAuthorityStatus(context: LegalContextResolutionContext): LegalContextResolutionContext {
    if (context.parentAuthorityStatus && context.authorityVerificationStatement) return context;
    if (context.kind === 'delegated_legislation' || context.kind === 'subordinate_legislation') {
      if (context.parentAct) {
        return {
          ...context,
          parentAuthorityStatus: 'identified',
          authorityVerificationStatement: `Parent authority identified by user as ${context.parentAct}; enabling provision remains unverified unless supplied.`,
        };
      }
      return {
        ...context,
        parentAuthorityStatus: 'not_identified',
        authorityVerificationStatement: 'Existing legislative authority could not be determined from the user\'s request.',
      };
    }
    if (context.kind === 'ambiguous_title') {
      return {
        ...context,
        parentAuthorityStatus: 'unverified',
        authorityVerificationStatement: 'Existing legislative authority could not be determined from the user\'s request.',
      };
    }
    if (context.kind === 'existing_statute') {
      return {
        ...context,
        parentAuthorityStatus: 'not_applicable',
        authorityVerificationStatement: 'Principal statutory context is being analysed; no delegated parent authority is assumed.',
      };
    }
    return {
      ...context,
      parentAuthorityStatus: 'not_applicable',
      authorityVerificationStatement: 'No parent authority is required for the current drafting-learning step unless delegated legislation is requested.',
    };
  }

  private classificationConfidence(
    intent: DraftingIntentClassification,
    legalContext: LegalContextResolutionContext,
    existingLaw?: ExistingLawContext,
  ): number {
    if (existingLaw?.confidence === 'high') return 0.95;
    if (existingLaw?.confidence === 'medium') return 0.82;
    if (legalContext.kind === 'ambiguous_title') return 0.85;
    if (legalContext.requiresClarification) return intent === 'draft_rules' || intent === 'draft_regulations' ? 0.86 : 0.62;
    if (intent === 'draft_new_act' && legalContext.kind === 'hypothetical_classroom_exercise') return 0.84;
    if (intent === 'learn_legislative_drafting') return 0.78;
    if (intent === 'unknown') return 0.5;
    return 0.88;
  }

  private classificationLabel(intent: DraftingIntentClassification): string {
    const labels: Record<DraftingIntentClassification, string> = {
      understand_legal_concept: 'Understanding Existing Legal Concept',
      analyse_existing_bare_act: 'Analysing Existing Bare Act',
      analyse_existing_statutory_provision: 'Analysing Existing Statutory Provision',
      learn_legislative_drafting: 'Learning Legislative Drafting',
      review_draft: 'Draft Review',
      improve_draft: 'Draft Improvement',
      draft_new_act: 'New Principal Act',
      draft_amendment: 'Amendment Bill',
      draft_section: 'Section Drafting',
      draft_clause: 'Clause Drafting',
      draft_definitions: 'Definition Drafting',
      draft_rules: 'Rules',
      draft_regulations: 'Regulations',
      draft_notifications: 'Notification',
      draft_government_orders: 'Government Order',
      draft_penalty_provision: 'Penalty Provision',
      draft_schedule: 'Schedule',
      draft_form: 'Form',
      draft_explanation: 'Explanation',
      draft_proviso: 'Proviso',
      draft_saving_clause: 'Saving Clause',
      draft_repeal_clause: 'Repeal Clause',
      redraft_existing_provision: 'Redraft',
      compare_statutes: 'Comparative Statutory Analysis',
      compare_drafting_styles: 'Comparative Drafting Style',
      learn_drafting_conventions: 'Drafting Convention',
      unknown: 'Unknown',
    };
    return labels[intent];
  }

  private detectExistingLaw(message: string, input: EducationalReasoningInput): ExistingLawContext | undefined {
    const doctrine = KNOWN_DOCTRINES.find((item) => item.pattern.test(message));
    if (doctrine) {
      return {
        concept: doctrine.concept,
        statute: doctrine.statute,
        provision: doctrine.provision,
        confidence: 'high',
        reason: 'The topic is a recognized legal concept already governed by an existing legal source.',
      };
    }

    const section = message.match(/\b(?:section|s\.)\s*(\d+[a-z]?)\b/i)?.[1];
    const title = this.extractActTitle(message) ?? input.bareActTitle;
    if (section) {
      return {
        concept: `section ${section}`,
        statute: title,
        provision: `Section ${section}`,
        confidence: title ? 'high' : 'medium',
        reason: title ? 'The request points to an existing statutory provision.' : 'The request points to a section but does not identify the Act.',
      };
    }

    if (input.bareActTitle || input.bareActExcerpt) {
      return {
        concept: input.bareActTitle ?? 'uploaded Bare Act',
        statute: input.bareActTitle,
        confidence: input.bareActTitle ? 'high' : 'medium',
        reason: 'The request is grounded in an uploaded or explicitly supplied Bare Act context.',
      };
    }

    return undefined;
  }

  private extractActTitle(message: string): string | undefined {
    const matches = message.match(/\b[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*){0,8}\s+(?:Act|Code|Sanhita|Rules|Regulations)(?:,?\s+\d{4})?/g) ?? [];
    return matches.map((candidate) => candidate.trim()).find((candidate) => !/^bare\s+act$/i.test(candidate));
  }

  private extractParentAct(message: string): string | undefined {
    const match = message.match(/\bunder\s+(?:the\s+)?([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*){0,8}\s+Act(?:,?\s+\d{4})?)/);
    return match?.[1]?.trim();
  }

  private extractJurisdiction(message: string): string | undefined {
    const match = message.match(/\b(?:in|for|under)\s+(India|Indian|United Kingdom|UK|England|United States|US|USA|European Union|EU|Canada|Australia|Singapore)\b/i);
    if (!match) return undefined;
    return match[1].replace(/^Indian$/i, 'India');
  }

  private smallestNextSkill(
    intent: DraftingIntentClassification,
    existingLawTopic: boolean,
    input: EducationalReasoningInput,
    legalContext: LegalContextResolutionContext,
  ): string {
    if (legalContext.requiresClarification) return 'resolve legal context before drafting: instrument, jurisdiction, and authority';
    if (input.knownWeaknesses?.length) return `repair weakness: ${input.knownWeaknesses[0]}`;
    if (existingLawTopic) return 'locate the existing legal home and identify why the legislature placed the concept there';
    if (legalContext.kind === 'ambiguous_title') return 'state the educational assumption before beginning hypothetical Act architecture';
    if (intent === 'draft_amendment') return 'identify the target provision and the exact amendment operation';
    if (intent === 'draft_rules' || intent === 'draft_regulations') return 'identify the parent Act and enabling power before drafting subordinate legislation';
    if (intent === 'draft_notifications' || intent === 'draft_government_orders') return 'identify the statutory authority and legal effect of the instrument';
    if (intent === 'draft_proviso') return 'identify the main rule before carving the exception';
    if (intent === 'draft_definitions') return 'decide which term needs definition because ambiguity would affect legal operation';
    if (intent === 'draft_penalty_provision') return 'link the penalty to a clearly drafted obligation or offence';
    if (intent === 'review_draft' || intent === 'improve_draft') return 'identify the highest-impact drafting defect in one sentence';
    if (intent === 'draft_new_act') return 'state the legislative mischief before naming sections or penalties';
    return input.currentLessonTitle ? `continue the current lesson skill: ${input.currentLessonTitle}` : 'identify the immediate drafting decision before wording begins';
  }

  private requiredKnowledgeSources(
    intent: DraftingIntentClassification,
    existingLawTopic: boolean,
    existingLaw: ExistingLawContext | undefined,
    legalContext: LegalContextResolutionContext,
  ): string[] {
    const sources = ['student mastery', 'current lesson state', 'teaching rules', 'legal context resolution'];
    if (existingLawTopic) {
      sources.push('existing statute context', 'Bare Act component analysis', 'legislative drafting patterns');
      if (existingLaw?.statute) sources.push(`source law: ${existingLaw.statute}`);
      return sources;
    }
    if (legalContext.parentAct) sources.push(`parent Act signal: ${legalContext.parentAct}`);
    if (legalContext.kind === 'ambiguous_title') sources.push('hypothetical classroom exercise boundaries');
    if (intent === 'draft_new_act') sources.push('Act architecture patterns', 'Arrangement of Sections patterns', 'preliminary provisions patterns');
    if (intent.includes('draft_')) sources.push('relevant drafting pattern checklist');
    if (intent === 'review_draft' || intent === 'improve_draft') sources.push('draft review rubric', 'previous feedback');
    return sources;
  }

  private requiredPatterns(intent: DraftingIntentClassification, existingLawTopic: boolean, input: EducationalReasoningInput): string[] {
    const explicit = input.patternNames ?? [];
    if (explicit.length) return explicit;
    if (existingLawTopic) return ['statutory placement', 'definitions', 'operative language', 'cross references'];
    const byIntent: Partial<Record<DraftingIntentClassification, string[]>> = {
      draft_new_act: ['legislative purpose', 'arrangement of sections', 'preliminary provisions'],
      draft_amendment: ['amendment clauses', 'substitution', 'insertion', 'omission'],
      draft_rules: ['rule-making powers', 'delegated legislation'],
      draft_regulations: ['delegated legislation', 'procedures'],
      draft_notifications: ['commencement', 'delegated authority'],
      draft_definitions: ['definitions', 'interpretation clauses'],
      draft_penalty_provision: ['offences', 'penalties', 'civil consequences'],
      draft_proviso: ['provisos', 'exceptions'],
      draft_explanation: ['explanations', 'rule of construction provisions'],
      draft_saving_clause: ['savings', 'transitional provisions'],
      draft_repeal_clause: ['repeal', 'savings'],
      draft_schedule: ['schedules', 'cross references'],
    };
    return byIntent[intent] ?? input.componentTypes ?? ['legislative purpose'];
  }

  private teachingStrategyFor(intent: DraftingIntentClassification, fallback: TeachingStrategy, legalContext: LegalContextResolutionContext, shouldAskClarification = false): TeachingStrategy {
    if (shouldAskClarification || legalContext.requiresClarification) return 'question';
    if (intent === 'review_draft' || intent === 'improve_draft') return 'review';
    if (intent === 'understand_legal_concept' || intent === 'analyse_existing_statutory_provision') return 'question';
    return fallback;
  }

  private socraticQuestion(
    intent: DraftingIntentClassification,
    existingLawTopic: boolean,
    existingLaw: ExistingLawContext | undefined,
    legalContext: LegalContextResolutionContext,
  ): string {
    if (legalContext.requiresClarification && legalContext.clarificationQuestion) return legalContext.clarificationQuestion;
    if (legalContext.kind === 'ambiguous_title') return 'Are you referring to an existing Act/Bill in a jurisdiction, or should we treat this as a hypothetical classroom drafting exercise?';
    if (existingLawTopic) {
      const target = existingLaw?.concept ?? 'this concept';
      return `Before drafting anything new, what legal problem does ${target} already solve in its existing statutory setting?`;
    }
    if (intent === 'draft_amendment') return 'What exactly is wrong with the existing provision: its scope, words, procedure, penalty, or authority?';
    if (intent === 'draft_rules' || intent === 'draft_regulations') return 'Which parent Act power authorizes this subordinate rule, and what limit does that power impose?';
    if (intent === 'draft_proviso') return 'What is the main rule, and what narrow case deserves different treatment?';
    if (intent === 'draft_new_act') return 'What mischief is serious enough to justify a separate Act rather than a rule, policy, or amendment?';
    return 'What legal effect must this drafting choice create, and what ambiguity must it avoid?';
  }

  private expectedStudentOutput(intent: DraftingIntentClassification, existingLawTopic: boolean, legalContext: LegalContextResolutionContext): string {
    if (legalContext.requiresClarification) return legalContext.clarificationQuestion ?? 'one clarification identifying the legal instrument, jurisdiction, or authority';
    if (legalContext.kind === 'ambiguous_title') return 'confirmation whether this is an existing instrument or a hypothetical classroom exercise';
    if (existingLawTopic) return 'one sentence identifying the existing legal home and the drafting reason for that placement';
    if (intent === 'draft_new_act') return 'one sentence stating the legislative mischief, not a section or full Act';
    if (intent === 'draft_amendment') return 'one sentence naming the target provision and amendment operation';
    if (intent === 'review_draft' || intent === 'improve_draft') return 'one focused revision of the weakest sentence';
    if (intent === 'draft_proviso') return 'one sentence stating the main rule and the narrow exception';
    return 'one small drafting decision tied to the current micro-skill';
  }

  private responseBoundaries(
    intent: DraftingIntentClassification,
    existingLawTopic: boolean,
    requiresNewLegislation: boolean,
    legalContext: LegalContextResolutionContext,
  ): string[] {
    const boundaries = [
      'Do not produce a complete Bare Act.',
      'Do not complete the student assignment.',
      'Teach one drafting decision only.',
      'Explain why the drafting convention exists.',
      'Do not invent parent Acts, enabling provisions, jurisdictions, legal authorities, or statutory homes.',
    ];
    if (legalContext.educationalAssumption) boundaries.push(`State this assumption before teaching: ${legalContext.educationalAssumption}`);
    if (legalContext.requiresClarification && legalContext.clarificationQuestion) boundaries.push(`Ask this clarification before teaching drafting content: ${legalContext.clarificationQuestion}`);
    if (existingLawTopic) boundaries.push('Never invent a fictional Act title for an existing doctrine or provision.');
    if (!requiresNewLegislation) boundaries.push('Do not force this request into the new-Act architecture path.');
    if (intent === 'draft_amendment') boundaries.push('Do not draft an amendment until the target provision and operation are identified.');
    return boundaries;
  }

  private intentReason(
    intent: DraftingIntentClassification,
    existingLaw: ExistingLawContext | undefined,
    legalContext: LegalContextResolutionContext,
    message?: string,
  ): string {
    if (legalContext.requiresClarification) return legalContext.reason;
    if (legalContext.kind === 'ambiguous_title') return legalContext.reason;
    if (existingLaw) return existingLaw.reason;
    if (intent === 'draft_new_act') return 'The request appears to concern a policy subject that may need original legislative architecture.';
    if (intent.startsWith('draft_')) return 'The request asks for a specific drafting component rather than a full Act.';
    if (message && /\bwhy|explain|understand\b/i.test(message)) return 'The request seeks understanding before drafting.';
    return 'The request should be handled as a drafting-learning interaction until the student gives a narrower artifact.';
  }

  private studentObjective(message: string, intent: DraftingIntentClassification): string {
    if (message.length <= 160) return message;
    return `${intent}: ${message.slice(0, 157)}...`;
  }

  private clean(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }
}






