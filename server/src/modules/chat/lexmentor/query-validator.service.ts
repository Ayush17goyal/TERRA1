/**
 * Stage 2b — Query Validator
 *
 * Detects ambiguous or potentially incorrect legal references before retrieval.
 * When ambiguity is detected, returns a clarification prompt instead of guessing.
 */

import { Injectable, Logger } from '@nestjs/common';

export type QueryValidationResult = {
  isValid: boolean;
  needsClarification: boolean;
  clarificationMessage?: string;
  normalizedQuery: string;
  detectedIssues: string[];
};

/** Known act aliases and common misspellings */
const ACT_ALIASES: Record<string, string> = {
  ipc: 'Indian Penal Code / Bharatiya Nyaya Sanhita (BNS)',
  crpc: 'Code of Criminal Procedure / Bharatiya Nagarik Suraksha Sanhita (BNSS)',
  'code of criminal procedure': 'Bharatiya Nagarik Suraksha Sanhita (BNSS)',
  'indian panel code': 'Indian Penal Code / Bharatiya Nyaya Sanhita (BNS)',
  'indian penal code': 'Indian Penal Code / Bharatiya Nyaya Sanhita (BNS)',
  cpc: 'Code of Civil Procedure, 1908',
  'evidence act': 'Bharatiya Sakshya Adhiniyam (BSA) / Indian Evidence Act, 1872',
  bsa: 'Bharatiya Sakshya Adhiniyam (BSA)',
  bns: 'Bharatiya Nyaya Sanhita (BNS)',
  bnss: 'Bharatiya Nagarik Suraksha Sanhita (BNSS)',
};

/**
 * Sections that commonly appear in student queries with nearby valid alternatives.
 * Key: "actKey:section" → suggested correction message fragment.
 */
const COMMON_SECTION_CLARIFICATIONS: Array<{
  actPattern: RegExp;
  suspiciousSection: number;
  suggestedSection: number;
  actLabel: string;
  note?: string;
}> = [
  {
    actPattern: /\bbns\b|\bbharatiya nyaya\b|\bipc\b|\bpenal\b/i,
    suspiciousSection: 399,
    suggestedSection: 299,
    actLabel: 'BNS/IPC',
    note: 'Section 399 relates to preparation; Section 299 relates to culpable homicide.',
  },
  {
    actPattern: /\bbns\b|\bbharatiya nyaya\b|\bipc\b/i,
    suspiciousSection: 302,
    suggestedSection: 103,
    actLabel: 'BNS',
    note: 'Under BNS, murder is Section 103 (formerly IPC Section 302).',
  },
  {
    actPattern: /\bbns\b|\bbharatiya nyaya\b|\bipc\b/i,
    suspiciousSection: 376,
    suggestedSection: 64,
    actLabel: 'BNS',
    note: 'Under BNS, the corresponding offence provisions were renumbered.',
  },
];

@Injectable()
export class QueryValidator {
  private readonly logger = new Logger(QueryValidator.name);

  validate(query: string): QueryValidationResult {
    const trimmed = (query || '').replace(/\s+/g, ' ').trim();
    const detectedIssues: string[] = [];
    const clarifications: string[] = [];

    if (!trimmed) {
      return {
        isValid: false,
        needsClarification: true,
        clarificationMessage: 'Please enter a legal question.',
        normalizedQuery: trimmed,
        detectedIssues: ['empty-query'],
      };
    }

    // Act name typo detection
    const actTypo = this.detectActTypo(trimmed);
    if (actTypo) {
      detectedIssues.push('act-typo');
      clarifications.push(`Did you mean **${actTypo.correct}** instead of "${actTypo.typo}"?`);
    }

    // Section number ambiguity within known acts
    const sectionClarification = this.detectSectionAmbiguity(trimmed);
    if (sectionClarification) {
      detectedIssues.push('section-ambiguity');
      clarifications.push(sectionClarification);
    }

    // Detect references to repealed acts without specifying current statute
    const legacyActNote = this.detectLegacyActReference(trimmed);
    if (legacyActNote) {
      detectedIssues.push('legacy-act-reference');
      clarifications.push(legacyActNote);
    }

    if (clarifications.length > 0) {
      const message = [
        '## Clarification Needed',
        '',
        'Before I search the legal knowledge base, please confirm:',
        '',
        ...clarifications.map((c, i) => `${i + 1}. ${c}`),
        '',
        'Please resubmit your question with the correct Act, Section, Article, or Case Name so I can retrieve verified legal material.',
        '',
        '---',
        'LexMentor AI does not assume incorrect references. Clarification helps prevent unreliable answers.',
      ].join('\n');

      this.logger.debug(`Query validation flagged: ${detectedIssues.join(', ')}`);

      return {
        isValid: false,
        needsClarification: true,
        clarificationMessage: message,
        normalizedQuery: trimmed,
        detectedIssues,
      };
    }

    return {
      isValid: true,
      needsClarification: false,
      normalizedQuery: trimmed,
      detectedIssues,
    };
  }

  private detectActTypo(query: string): { typo: string; correct: string } | null {
    const lower = query.toLowerCase();
    for (const [typo, correct] of Object.entries(ACT_ALIASES)) {
      if (typo.includes(' ') && lower.includes(typo)) continue;
      // Exact typo patterns
      if (typo === 'indian panel code' && lower.includes('indian panel code')) {
        return { typo: 'Indian Panel Code', correct };
      }
    }
    if (/\bindian panel code\b/i.test(query)) {
      return { typo: 'Indian Panel Code', correct: ACT_ALIASES['indian panel code'] };
    }
    return null;
  }

  private detectSectionAmbiguity(query: string): string | null {
    const sectionMatch = query.match(/\b(?:section|sec\.?|s\.)\s*(\d+[A-Z]?)\b/i);
    if (!sectionMatch) return null;

    const sectionNum = parseInt(sectionMatch[1], 10);
    if (Number.isNaN(sectionNum)) return null;

    for (const rule of COMMON_SECTION_CLARIFICATIONS) {
      if (sectionNum === rule.suspiciousSection && rule.actPattern.test(query)) {
        const note = rule.note ? ` ${rule.note}` : '';
        return `Did you mean **Section ${rule.suggestedSection} ${rule.actLabel}** instead of Section ${rule.suspiciousSection}?${note}`;
      }
    }

    // Flag unusually high section numbers that may be typos
    if (sectionNum > 500 && /\bbns\b|\bbnss\b|\bbsa\b/i.test(query)) {
      return `Section ${sectionNum} appears unusually high for the cited statute. Please verify the section number.`;
    }

    return null;
  }

  private detectLegacyActReference(query: string): string | null {
    const lower = query.toLowerCase();
    const citesLegacy =
      /\b(ipc|indian penal code|crpc|code of criminal procedure|indian evidence act)\b/i.test(
        query,
      );
    const citesNew =
      /\b(bns|bnss|bsa|bharatiya nyaya|bharatiya nagarik|bharatiya sakshya)\b/i.test(query);

    if (citesLegacy && !citesNew) {
      if (/\bipc\b|\bindian penal code\b/i.test(lower)) {
        return 'You referenced the IPC. For offences after 1 July 2024, please specify whether you mean **IPC** or the **Bharatiya Nyaya Sanhita (BNS)**.';
      }
      if (/\bcrpc\b|\bcode of criminal procedure\b/i.test(lower)) {
        return 'You referenced the CrPC. For procedure after 1 July 2024, please specify whether you mean **CrPC** or the **Bharatiya Nagarik Suraksha Sanhita (BNSS)**.';
      }
      if (/\bindian evidence act\b/i.test(lower)) {
        return 'You referenced the Indian Evidence Act. Please specify whether you mean the **Indian Evidence Act, 1872** or the **Bharatiya Sakshya Adhiniyam (BSA)**.';
      }
    }
    return null;
  }
}
