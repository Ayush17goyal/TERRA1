import { describe, expect, it } from 'vitest';
import { PromptAssemblyEngine } from '../../ai/prompts/assembler/PromptAssemblyEngine';
import { promptRequest } from '../fixtures/mentor-fixtures';

describe('PromptAssemblyEngine', () => {
  it('assembles modular educational prompts without ghostwriting defaults', () => {
    const prompt = new PromptAssemblyEngine().assemble(promptRequest());
    expect(prompt.prompt).toContain('Bare Act Drafting Mentor');
    expect(prompt.prompt).toContain('Definitions Basics');
    expect(prompt.fragments.map((fragment) => fragment.moduleName)).toEqual(expect.arrayContaining(['core', 'behaviour', 'teaching_strategy', 'curriculum', 'lesson', 'pattern', 'safety', 'output_formatting']));
    expect(prompt.prompt.toLowerCase()).toContain('do not generate a complete bare act');
    expect(prompt.estimatedTokens).toBeLessThanOrEqual(3500);
  });

  it('selects review and draft modules only when draft context exists', () => {
    const prompt = new PromptAssemblyEngine().assemble(promptRequest({ intent: 'review', teachingStrategy: 'review', draft: { text: 'Section 3. Authority shall...', componentType: 'powers', reviewDepth: 'deep' } }));
    expect(prompt.fragments.some((fragment) => fragment.moduleName === 'draft_review')).toBe(true);
    expect(prompt.prompt).toContain('review');
  });

  it('constrains teaching to Parliamentary Counsel micro-skill progression', () => {
    const assembled = new PromptAssemblyEngine().assemble(promptRequest({
      intent: 'drafting',
      teachingStrategy: 'teach',
      student: { level: 'beginner' },
      curriculum: { lessonId: 'purpose-1', lessonTitle: 'Identify Legislative Purpose', moduleTitle: 'Foundations' },
      userMessage: 'Teach me how to draft a Bare Act on cyber bullying in universities.',
    } as any));

    expect(assembled.prompt).toContain('Behave like a senior Parliamentary Counsel');
    expect(assembled.prompt).toContain('Teach one current drafting micro-skill only');
    expect(assembled.prompt).toContain('Preserve student authorship');
    expect(assembled.prompt).toContain('why would a drafter put this clause here and not elsewhere');
    expect(assembled.prompt).toContain('Do not use headings named "Learning Objective"');
    expect(assembled.prompt).toContain('End with a concrete next action for the student and then stop');
  });
});
