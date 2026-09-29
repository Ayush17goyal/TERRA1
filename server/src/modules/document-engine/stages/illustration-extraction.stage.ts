import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { DefinitionEntry, ExamConstruct, IllustrationEntry, SectionNode } from '../types/document-graph.types';

const STATUTORY_ILLUSTRATION_REGEX = /Illustration[s]?\s*[:.\-]?\s*([^.]{10,500}\.)/gi;
const HYPOTHETICAL_REGEX = /\b(?:for example|for instance|suppose|consider the case where|say)\b[,:]?\s*([^.]{10,500}\.)/gi;

// architecture.md §3 Stage 8 (Illustration/Example Extraction):
// "Extract worked examples and illustrations ... linking each illustration back to the
// definition/section/construct it demonstrates."
@Injectable()
export class IllustrationExtractionStage {
  extract(section: SectionNode, definitionsInSection: DefinitionEntry[], constructsInSection: ExamConstruct[]): IllustrationEntry[] {
    const results: IllustrationEntry[] = [];
    const nearestDefinitionId = definitionsInSection[0]?.id ?? null;
    const nearestConstructSectionId = constructsInSection[0]?.sectionId ?? null;

    for (const match of section.text.matchAll(STATUTORY_ILLUSTRATION_REGEX)) {
      results.push({
        id: crypto.randomUUID(),
        sectionId: section.id,
        text: match[1].trim(),
        illustrationType: 'statutory',
        linkedDefinitionId: nearestDefinitionId,
        linkedConstructSectionId: nearestConstructSectionId,
      });
    }

    for (const match of section.text.matchAll(HYPOTHETICAL_REGEX)) {
      results.push({
        id: crypto.randomUUID(),
        sectionId: section.id,
        text: match[1].trim(),
        illustrationType: 'instructional_hypothetical',
        linkedDefinitionId: nearestDefinitionId,
        linkedConstructSectionId: nearestConstructSectionId,
      });
    }

    return results;
  }
}
