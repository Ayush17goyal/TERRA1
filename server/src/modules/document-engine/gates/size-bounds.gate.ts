import { Injectable } from '@nestjs/common';
import { GateResult, NormalizedDocument } from '../types/document-graph.types';
import { MIN_EXTRACTABLE_CHARACTERS } from '../document-engine.constants';

// architecture.md §3.3: "Size/degeneracy bounds: documents below a minimum extractable-content
// threshold ... do not proceed to full pipeline processing; documents above a size threshold
// are chunked into independently-processed sub-units at Stage 0."
// The chunking half of this gate is implemented as batching inside the understanding stages
// (see stages/topic-detection.stage.ts and friends, which already operate per-SectionNode and
// therefore naturally bound each unit of work regardless of overall document size).
@Injectable()
export class SizeBoundsGate {
  checkMinimumContent(doc: NormalizedDocument): GateResult {
    const totalChars = doc.blocks.reduce((sum, b) => sum + b.text.length, 0);
    if (totalChars < MIN_EXTRACTABLE_CHARACTERS) {
      return {
        passed: false,
        reason: 'insufficient_extractable_content',
        metadata: { extractedCharacters: totalChars, minimumRequired: MIN_EXTRACTABLE_CHARACTERS },
      };
    }
    return { passed: true, metadata: { extractedCharacters: totalChars } };
  }
}
