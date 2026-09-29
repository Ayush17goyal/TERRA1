import type { PromptModule } from '../interfaces';
import type { PromptAssemblyRequest, PromptModuleFragment } from '../types';

const strategyInstructions: Record<string, string> = {
  teach: [
    'Teach one current drafting micro-skill only.',
    'Begin with the drafting choice, not a lecture. Ask or answer the counsel question: why would a drafter put this clause here and not elsewhere?',
    'Give a narrow explanation only after the student has a decision to make.',
    'End by asking the student to make one drafting move: name the mischief, choose the actor, choose the verb, define one term, place one clause, or revise one sentence.',
    'Do not continue to the next concept until the student attempts the move.',
  ].join(' '),
  question: 'Ask one focused Socratic drafting question. It must expose purpose, placement, legal actor, operative verb, ambiguity, consequence, or interpretation risk. Do not lecture unless the student cannot proceed.',
  hint: 'Give the smallest useful hint by pointing to the relevant drafting reason. Do not reveal a model answer, final wording, or completed clause before the student attempts the task.',
  review: 'Review only the submitted draft. Work sentence by sentence when text is available. Identify legal effect, actor, object, verb, ambiguity, enforceability, proportionality, terminology, cross-reference, and interpretation risk. Choose the highest-impact defect for revision.',
  demonstrate: 'Use one narrow fictional demonstration to expose a drafting choice and its legal effect. The demonstration must be incomplete enough that the student still has to draft their own answer.',
  quiz: 'Test only the current drafting judgment. Ask why a drafter would choose a structure, term, verb, proviso, explanation, schedule, or chapter order. Keep feedback brief.',
  assessment_feedback: 'Respect assessment boundaries. Give formative feedback on drafting reasoning and defects without completing the assessed work.',
  revision_guidance: 'Compare against prior feedback, identify one improved drafting choice and one remaining defect, then request a focused revision. Do not rewrite the student work unless explicitly permitted.',
  capstone_review: 'Review Act-level architecture: arrangement, chapter sequence, definitions, powers, duties, procedures, appeals, offences, penalties, rule-making, savings, schedules, and internal coherence. Do not become the primary author.',
  safe_redirect: 'Refuse briefly and redirect to an allowed drafting-judgment task such as analysing a specimen clause or revising a student-authored sentence.',
};

export class TeachingStrategyModule implements PromptModule {
  readonly name = 'teaching_strategy' as const;

  shouldInclude(): boolean {
    return true;
  }

  build(request: PromptAssemblyRequest): PromptModuleFragment {
    const reviewMode = ['review', 'revision', 'assessment_feedback', 'capstone_review'].includes(request.teachingStrategy);
    const reasoning = request.educationalReasoning;
    const existingLawInstruction = reasoning?.isExistingLawTopic
      ? [
        'Drafting intent classification: existing-law topic.',
        reasoning.existingLaw?.statute ? `Existing legal source: ${reasoning.existingLaw.statute}.` : '',
        reasoning.existingLaw?.provision ? `Relevant provision signal: ${reasoning.existingLaw.provision}.` : '',
        'Do not invent a new Act title, chapter plan, or fictional Bare Act for this topic.',
        'Teach the existing law setting first: where the concept sits, why it was enacted, how the provision operates, and what drafting convention it demonstrates.',
        'Only after that understanding may you ask for a narrow analogous drafting attempt.',
      ].filter(Boolean).join(' ')
      : '';
    const newLawInstruction = reasoning?.requiresNewLegislation
      ? 'Drafting intent classification: potential new legislation. Teach legislative purpose, policy mischief, competence, and architecture before any section wording.'
      : '';
    const legalContextInstruction = reasoning
      ? [
        `Legal context resolution: ${reasoning.legalContext.kind}.`,
        `Classification label: ${reasoning.classificationLabel}.`,
        `Confidence level: ${Math.round(reasoning.classificationConfidence * 100)}%.`,
        `Parent authority status: ${reasoning.legalContext.parentAuthorityStatus ?? 'not_applicable'}.`,
        reasoning.legalContext.authorityVerificationStatement ? `Authority verification: ${reasoning.legalContext.authorityVerificationStatement}` : '',
        reasoning.legalContext.educationalAssumption ? `Educational assumption: ${reasoning.legalContext.educationalAssumption}` : '',
        reasoning.shouldAskClarification ? 'Confidence or authority is insufficient. Do not begin mentoring content. Ask exactly one clarification question instead of giving a student exercise.' : '',
      ].filter(Boolean).join(' ')
      : '';
    const requiredResponseFormat = [
      'Every educational response must use exactly this structure:',
      '1. Drafting Request Analysis',
      '2. Legislative Classification',
      '3. Confidence Level',
      '4. Reasoning',
      '5. Parent Authority Status',
      '6. Next Drafting Task',
      '7. Student Exercise',
      'If confidence is below 80% or parent authority is missing, do not provide a drafting exercise. Under section 7, ask exactly one clarification question and stop.',
      'Never state or imply that an Act, Bill, parent Act, enabling provision, jurisdiction, or delegated authority exists unless the user supplied it or retrieved verified context supports it.',
    ].join('\n');

    return {
      moduleName: this.name,
      priority: 'critical',
      tokenBudget: { target: 560, max: 760 },
      includedReason: 'Every response needs one active Parliamentary Counsel teaching move.',
      instructions: [
        `Classified intent: ${request.intent}.`,
        `Selected teaching strategy: ${request.teachingStrategy}.`,
        reasoning ? `Drafting intent classification: ${reasoning.draftingIntent}.` : '',
        reasoning ? `Reason for classification: ${reasoning.intentReason}` : '',
        legalContextInstruction,
        requiredResponseFormat,
        reasoning ? `Smallest next drafting skill: ${reasoning.smallestNextSkill}.` : '',
        reasoning ? `First counsel question to consider: ${reasoning.firstSocraticQuestion}` : '',
        reasoning ? `Expected student output: ${reasoning.expectedStudentOutput}.` : '',
        existingLawInstruction,
        newLawInstruction,
        reasoning?.responseBoundaries?.length ? `Response boundaries: ${reasoning.responseBoundaries.join(' ')}` : '',
        strategyInstructions[request.teachingStrategy],
        reviewMode
          ? 'Because this is review/feedback mode, do not restart the lesson. Base the response on draft evidence and one next revision skill.'
          : 'Because this is teaching mode, do not answer with a multi-part lecture. Move the student one drafting judgment forward.',
        'Internal reasoning checklist before responding: What legal problem is being solved? Why this location in the Act? Why this wording? What ambiguity is avoided? What consequence follows? What should the student decide next?',
        request.safety?.allowedAssistanceLevel ? `Allowed assistance level: ${request.safety.allowedAssistanceLevel}.` : '',
      ].filter(Boolean).join('\n'),
      contextVariables: {
        intent: request.intent,
        teachingStrategy: request.teachingStrategy,
        allowedAssistanceLevel: request.safety?.allowedAssistanceLevel,
        reviewMode,
        educationalReasoning: reasoning,
      },
    };
  }
}


