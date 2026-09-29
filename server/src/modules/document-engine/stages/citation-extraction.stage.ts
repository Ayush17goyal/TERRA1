import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { CaseEntry, CitationEntry, SectionNode } from '../types/document-graph.types';

// Neutral/reporter case citation formats: AIR 1973 SC 1461, (1978) 4 SCC 494, 1994 SCR 5.
const CASE_CITATION_REGEX = /\b(AIR\s+\d{4}\s+[A-Z]{2,5}\s+\d+|\(?\d{4}\)?\s+\d+\s+SCC\s+\d+|\d{4}\s+SCR\s+\d+)\b/g;
// Statutory citation: "Section 12 of the Indian Contract Act, 1872" / "Article 19 of the Constitution".
const STATUTE_CITATION_REGEX = /\b(?:Section|Article|Sec\.)\s+\d+[A-Za-z]?\s+of\s+the\s+([A-Z][A-Za-z\s,]+?(?:Act|Constitution)),?\s*(\d{4})?/g;
// Internal cross-references: "as defined in Section 3 above" / "under clause (a) of this section".
const CROSS_REFERENCE_REGEX = /\b(?:as\s+(?:defined|provided|stated)\s+in|under|pursuant\s+to)\s+(Section\s+\d+[A-Za-z]?|clause\s+\([a-z]\)|Article\s+\d+[A-Za-z]?)\b(?:\s+(?:above|below|of\s+this\s+(?:Act|section)))?/gi;

// architecture.md §3 Stage 10 (Citation Extraction):
// "Extract formal legal citations as structured, resolvable references ... Normalizes citation
// variants of the same authority to a canonical form."
@Injectable()
export class CitationExtractionStage {
  extract(section: SectionNode, casesInDocument: CaseEntry[]): CitationEntry[] {
    const results: CitationEntry[] = [];

    for (const match of section.text.matchAll(CASE_CITATION_REGEX)) {
      const normalized = this.normalizeCaseCitation(match[0]);
      results.push({
        id: crypto.randomUUID(),
        sectionId: section.id,
        rawText: match[0],
        citationType: 'case',
        normalizedForm: normalized,
        resolvedTargetId: this.resolveToNearbyCase(section, match.index || 0, casesInDocument),
      });
    }

    for (const match of section.text.matchAll(STATUTE_CITATION_REGEX)) {
      const actName = match[1].trim();
      const year = match[2] || '';
      results.push({
        id: crypto.randomUUID(),
        sectionId: section.id,
        rawText: match[0],
        citationType: 'statute',
        normalizedForm: `${actName}${year ? `, ${year}` : ''}`.trim(),
        resolvedTargetId: null, // resolved externally against the shared Legal Authority Index (architecture.md §5), out of this module's scope
      });
    }

    for (const match of section.text.matchAll(CROSS_REFERENCE_REGEX)) {
      results.push({
        id: crypto.randomUUID(),
        sectionId: section.id,
        rawText: match[0],
        citationType: 'cross_reference',
        normalizedForm: match[1].trim(),
        resolvedTargetId: null, // resolved during Stage 11 cross-linking, against this document's own sections
      });
    }

    return results;
  }

  private normalizeCaseCitation(raw: string): string {
    return raw.replace(/\s+/g, ' ').trim();
  }

  private resolveToNearbyCase(section: SectionNode, matchIndex: number, cases: CaseEntry[]): string | null {
    const sameSectionCases = cases.filter((c) => c.sectionId === section.id);
    if (sameSectionCases.length === 0) return null;
    // Citation immediately following a case name within the same section is assumed to cite
    // that case (a common pattern: "Kesavananda Bharati v. State of Kerala, AIR 1973 SC 1461").
    return sameSectionCases[sameSectionCases.length - 1].id;
  }
}
