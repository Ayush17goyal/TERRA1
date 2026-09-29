import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { DefinitionEntry, SectionNode, SourceDocumentType } from '../types/document-graph.types';

const STATUTORY_DEFINITION_REGEX = /["“]([^"”]{2,60})["”]\s+(means|includes|shall mean|shall include)\s+([^.]{5,600})\./gi;
const DESCRIPTIVE_DEFINITION_REGEX = /\b([A-Z][A-Za-z\s]{2,40})\s+(?:is|refers to|can be defined as)\s+([^.]{10,400})\./g;

// architecture.md §3 Stage 7 (Definition Extraction):
// "Identify and isolate formal and informal definitions ... Formal statutory definitions
// (pattern: '"X" means...') ... inline conceptual definitions in notes/textbook prose ...
// distinguishing definition from mere usage of a term."
@Injectable()
export class DefinitionExtractionStage {
  extract(section: SectionNode, documentType: SourceDocumentType): DefinitionEntry[] {
    const results: DefinitionEntry[] = [];

    for (const match of section.text.matchAll(STATUTORY_DEFINITION_REGEX)) {
      results.push({
        id: crypto.randomUUID(),
        sectionId: section.id,
        term: match[1].trim(),
        definitionText: match[3].trim(),
        definitionType: 'statutory',
        // An interpretation-clause definition (typically found in a section literally titled
        // "Definitions"/"Interpretation") applies document-wide; anything else is local to
        // the section it appears in.
        scope: /definitions?|interpretation/i.test(section.hierarchyPath) ? 'document_wide' : 'local',
      });
    }

    if (documentType === 'notes' || documentType === 'textbook') {
      for (const match of section.text.matchAll(DESCRIPTIVE_DEFINITION_REGEX)) {
        const term = match[1].trim();
        if (term.split(' ').length > 6) continue; // guards against matching whole sentences
        results.push({
          id: crypto.randomUUID(),
          sectionId: section.id,
          term,
          definitionText: match[2].trim(),
          definitionType: 'descriptive',
          scope: 'local',
        });
      }
    }

    return results;
  }
}
