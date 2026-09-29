import type { RuntimeDecisionPacket } from '../../llm/types';
import type { RepairResult, ValidationViolation } from '../types';

export class ResponseRepairer {
  repair(text: string, violations: ValidationViolation[], packet: RuntimeDecisionPacket): RepairResult {
    let next = text.trim();
    const actions: string[] = [];
    const repaired: string[] = [];

    for (const violation of violations) {
      if (!violation.repairable) continue;

      if (violation.ruleId === 'output_format' && violation.evidence) {
        next = this.ensureHeading(next, violation.evidence);
        actions.push(`Added missing heading: ${violation.evidence}`);
        repaired.push(violation.ruleId);
      }

      if (violation.ruleId === 'teaching_strategy' && packet.teachingStrategy === 'review') {
        for (const heading of ['Strengths', 'Weaknesses', 'Drafting issues', 'Next action']) {
          next = this.ensureHeading(next, heading);
        }
        actions.push('Added draft-review structural headings.');
        repaired.push(violation.ruleId);
      }

      if (violation.ruleId === 'next_action') {
        const configured = typeof packet.metadata?.expectedNextAction === 'string'
          ? packet.metadata.expectedNextAction
          : 'Submit your next attempt or revision for review.';
        next = `${next}\n\n**Next action**\n${configured}`;
        actions.push('Added procedural next-action section.');
        repaired.push(violation.ruleId);
      }
    }

    return {
      repaired: actions.length > 0,
      text: next,
      actions,
      violationsRepaired: [...new Set(repaired)],
    };
  }

  private ensureHeading(text: string, heading: string): string {
    const pattern = new RegExp(`(^|\\n)\\s{0,3}(#{1,6}\\s*)?${escapeRegExp(heading)}\\s*:?\\s*(\\n|$)`, 'i');
    if (pattern.test(text)) return text;
    return `${text}\n\n**${heading}**\n`;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

