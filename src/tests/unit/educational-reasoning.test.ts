import { describe, expect, it } from 'vitest';
import { EducationalReasoningEngine } from '../../ai/reasoning/EducationalReasoningEngine';
import { PromptAssemblyEngine } from '../../ai/prompts/assembler/PromptAssemblyEngine';
import type { PromptAssemblyRequest } from '../../ai/prompts/types';

function analyze(message: string) {
  return new EducationalReasoningEngine().analyze({
    message,
    intent: /draft|write/i.test(message) ? 'drafting' : 'learning',
    teachingStrategy: 'teach',
    studentLevel: 'beginner',
  });
}

describe('EducationalReasoningEngine', () => {
  it('classifies Declaratory Relief as existing law instead of a new Act', () => {
    const reasoning = analyze('How to write Bare Act on Declaratory Relief');

    expect(reasoning.draftingIntent).toBe('understand_legal_concept');
    expect(reasoning.isExistingLawTopic).toBe(true);
    expect(reasoning.requiresNewLegislation).toBe(false);
    expect(reasoning.existingLaw?.statute).toContain('Specific Relief Act');
    expect(reasoning.responseBoundaries.join(' ')).toContain('Never invent a fictional Act title');
  });

  it('classifies cyber bullying in universities as potential new legislation', () => {
    const reasoning = analyze('Teach me how to write a Bare Act on cyber bullying in universities');

    expect(reasoning.draftingIntent).toBe('draft_new_act');
    expect(reasoning.requiresNewLegislation).toBe(true);
    expect(reasoning.smallestNextSkill).toContain('legislative mischief');
  });

  it('classifies component drafting without forcing a full Act workflow', () => {
    const reasoning = analyze('Draft a proviso');

    expect(reasoning.draftingIntent).toBe('draft_proviso');
    expect(reasoning.requiresNewLegislation).toBe(false);
    expect(reasoning.expectedStudentOutput).toContain('main rule');
  });


  it('does not treat an Act-style title as proof of an existing statute', () => {
    const reasoning = analyze('How to write Bare Act on Artificial Intelligence Regulation Act');

    expect(reasoning.draftingIntent).toBe('draft_new_act');
    expect(reasoning.legalContext.kind).toBe('ambiguous_title');
    expect(reasoning.legalContext.isExistingLegalInstrument).toBe(false);
    expect(reasoning.legalContext.canBeginHypotheticalExercise).toBe(true);
    expect(reasoning.legalContext.educationalAssumption).toContain('cannot determine from the title alone');
    expect(reasoning.responseBoundaries.join(' ')).toContain('Do not invent parent Acts');
  });

  it('requires the parent Act before teaching regulation drafting', () => {
    const reasoning = analyze('Draft Regulations for Digital Evidence');

    expect(reasoning.draftingIntent).toBe('draft_regulations');
    expect(reasoning.legalContext.kind).toBe('delegated_legislation');
    expect(reasoning.legalContext.requiresClarification).toBe(true);
    expect(reasoning.legalContext.clarificationQuestion).toBe('What parent Act provides the rule-making power?');
    expect(reasoning.expectedStudentOutput).toContain('parent Act');
  });

  it('proceeds with rules drafting when a parent Act is identified', () => {
    const reasoning = analyze('Draft Rules under the Consumer Protection Act');

    expect(reasoning.draftingIntent).toBe('draft_rules');
    expect(reasoning.legalContext.kind).toBe('delegated_legislation');
    expect(reasoning.legalContext.requiresClarification).toBe(false);
    expect(reasoning.legalContext.parentAct).toBe('Consumer Protection Act');
  });

  it('resolves a section reference with an Act title as existing statute analysis', () => {
    const reasoning = analyze('Section 34 Specific Relief Act');

    expect(reasoning.draftingIntent).toBe('analyse_existing_statutory_provision');
    expect(reasoning.legalContext.kind).toBe('existing_statute');
    expect(reasoning.legalContext.isExistingLegalInstrument).toBe(true);
    expect(reasoning.existingLaw?.provision).toBe('Section 34');
  });
  it('injects existing-law boundaries into assembled teaching prompts', () => {
    const educationalReasoning = analyze('How to write Bare Act on Declaratory Relief');
    const request: PromptAssemblyRequest = {
      userMessage: 'How to write Bare Act on Declaratory Relief',
      normalizedMessage: 'How to write Bare Act on Declaratory Relief',
      intent: 'drafting',
      teachingStrategy: 'teach',
      student: { level: 'beginner' },
      output: { includeNextAction: true },
      educationalReasoning,
    };

    const assembled = new PromptAssemblyEngine().assemble(request);

    expect(assembled.prompt).toContain('Drafting intent classification: understand_legal_concept');
    expect(assembled.prompt).toContain('Do not invent a new Act title');
    expect(assembled.prompt).toContain('Existing legal source: Specific Relief Act');
  });
});

