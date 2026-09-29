import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { CaseEntry, CaseStructured, SectionNode, SourceDocumentType } from '../types/document-graph.types';

// "Petitioner v. Respondent" / "Petitioner vs. Respondent" — the canonical case-name shape.
const CASE_NAME_REGEX = /\b([A-Z][A-Za-z.&\s]{2,80}?)\s+v\.?s?\.?\s+([A-Z][A-Za-z.&\s]{2,80}?)(?=[,.\n]|\s+\(|\s+on\s+\d)/g;
const YEAR_REGEX = /\b(1[89]\d{2}|20\d{2})\b/;
const COURT_REGEX = /\b(Supreme Court|High Court(?: of [A-Za-z]+)?)\b/i;

const STRUCTURE_SECTION_PATTERNS: Record<keyof CaseStructured, RegExp> = {
  facts: /^\s*(?:FACTS|FACTUAL\s+BACKGROUND|BRIEF\s+FACTS|THE\s+FACTS)\s*[:.\-]?\s*/im,
  issues: /^\s*(?:ISSUES?\s+(?:FOR\s+)?(?:CONSIDERATION|DETERMINATION|FRAMED)|QUESTIONS?\s+(?:OF\s+LAW|FOR\s+CONSIDERATION))\s*[:.\-]?\s*/im,
  held: /^\s*(?:HELD|DECISION|JUDGMENT)\s*[:.\-]?\s*/im,
  ratio: /^\s*(?:RATIO\s+DECIDENDI|HOLDING|CONCLUSION|FINDINGS?)\s*[:.\-]?\s*/im,
};

// architecture.md §3 Stage 9 (Case Extraction):
// "Identify discrete case discussions ... Case boundary detection in compilations (title,
// citation block, facts, issues, holding, ratio — segmented as sub-structure) ... shorter
// in-line case references elsewhere."
@Injectable()
export class CaseExtractionStage {
  extract(section: SectionNode, documentType: SourceDocumentType): CaseEntry[] {
    const results: CaseEntry[] = [];
    const matches = [...section.text.matchAll(CASE_NAME_REGEX)];

    for (const match of matches) {
      const petitioner = this.stripLeadingDiscourseWords(match[1].trim());
      const respondent = this.stripLeadingDiscourseWords(match[2].trim());
      const caseName = `${petitioner} v. ${respondent}`;
      const surroundingStart = Math.max(0, (match.index || 0) - 100);
      const surroundingEnd = Math.min(section.text.length, (match.index || 0) + 300);
      const context = section.text.slice(surroundingStart, surroundingEnd);

      const yearMatch = context.match(YEAR_REGEX);
      const courtMatch = context.match(COURT_REGEX);

      const isFullCompilation = documentType === 'case_compilation' && section.text.length > 800;
      const structured = isFullCompilation ? this.extractStructure(section.text) : null;

      results.push({
        id: crypto.randomUUID(),
        sectionId: section.id,
        caseName,
        parties: { petitioner, respondent },
        court: courtMatch ? courtMatch[0] : null,
        year: yearMatch ? yearMatch[0] : null,
        mentionType: isFullCompilation ? 'full' : 'mention',
        structured,
        context,
      });
    }

    return results;
  }

  // The case-name regex's leading capture group can backtrack into a preceding sentence-initial
  // capitalized discourse word ("In Kesavananda Bharati v. ..." captures "In Kesavananda Bharati"
  // as the party name) since it has no way to distinguish a proper-noun party name from any other
  // capitalized run of words. Trimming known non-party leading words is more robust than trying
  // to make the regex itself aware of English discourse markers.
  private stripLeadingDiscourseWords(name: string): string {
    return name.replace(/^(?:In|As|See|The|Held|Ref(?:er(?:red|ence)?)?|Also|Regarding|Consider)\s+/i, '').trim();
  }

  private extractStructure(text: string): CaseStructured {
    const structured: CaseStructured = {};
    const entries = Object.entries(STRUCTURE_SECTION_PATTERNS) as Array<[keyof CaseStructured, RegExp]>;
    const positions = entries
      .map(([key, regex]) => ({ key, match: text.match(regex) }))
      .filter((e) => e.match)
      .map((e) => ({ key: e.key, index: e.match!.index!, length: e.match![0].length }))
      .sort((a, b) => a.index - b.index);

    for (let i = 0; i < positions.length; i++) {
      const current = positions[i];
      const next = positions[i + 1];
      const start = current.index + current.length;
      const end = next ? next.index : text.length;
      structured[current.key] = text.slice(start, end).trim().slice(0, 2000);
    }
    return structured;
  }
}
