import { describe, expect, it } from 'vitest';
import { LegalIntelligenceService } from '../../../server/src/modules/legal-intelligence/legal-intelligence.service';

function classifier() {
  const service = Object.create(LegalIntelligenceService.prototype) as any;
  return (request: string, topic = request, actName = 'the Act', sectionRef = '') => service.classifyDraftingIntent(request, topic, actName, sectionRef);
}

describe('Bare Act Drafting Mentor intent classification', () => {
  it('does not turn declaratory relief into a fictional new Act', () => {
    const classify = classifier();
    const result = classify('How to write Bare Act on Declaratory Relief', 'Declaratory Relief');

    expect(result.code).toBe('UNDERSTAND_EXISTING_DOCTRINE');
    expect(result.shouldCreateNewAct).toBe(false);
    expect(result.existingLaw).toContain('Specific Relief Act');
  });

  it('classifies a new policy field as a new Act drafting task', () => {
    const classify = classifier();
    const result = classify('Cyber Bullying in Universities', 'Cyber Bullying in Universities');

    expect(result.code).toBe('DRAFT_NEW_ACT');
    expect(result.shouldCreateNewAct).toBe(true);
  });

  it('classifies specific provision, amendment, rules, and proviso requests narrowly', () => {
    const classify = classifier();

    expect(classify('Section 34 Specific Relief Act').code).toBe('ANALYSE_EXISTING_PROVISION');
    expect(classify('Draft an amendment to the Companies Act').code).toBe('DRAFT_AMENDMENT_BILL');
    expect(classify('Write Rule regarding digital filing').code).toBe('DRAFT_RULES');
    expect(classify('Draft a proviso').code).toBe('DRAFT_PROVISO');
  });
});
