import { Injectable } from '@nestjs/common';
import { GateResult, DocumentTree } from '../types/document-graph.types';
import { NON_LEGAL_GATE_KEYWORDS, NON_LEGAL_GATE_MIN_DENSITY } from '../document-engine.constants';

// architecture.md §3.3: "Non-legal content gate: after Stage 3 (structural detection) produces
// a document-type classification, documents that don't resolve to a recognized legal document
// type with reasonable confidence are halted before the expensive parallel extraction branch
// (5-10) runs, and flagged back to the user rather than processed at full cost."
@Injectable()
export class NonLegalContentGate {
  check(fullText: string, tree: DocumentTree): GateResult {
    const lower = fullText.toLowerCase();
    const totalChars = lower.length || 1;
    let hits = 0;
    for (const keyword of NON_LEGAL_GATE_KEYWORDS) {
      const occurrences = lower.split(keyword).length - 1;
      hits += occurrences;
    }
    const densityPer1000 = (hits / totalChars) * 1000;

    const structurallyUnclassified = tree.documentType === 'unknown' && tree.documentTypeConfidence < 0.3;

    if (densityPer1000 < NON_LEGAL_GATE_MIN_DENSITY && structurallyUnclassified) {
      return {
        passed: false,
        reason: 'non_legal_content_suspected',
        metadata: { keywordDensityPer1000: densityPer1000, documentType: tree.documentType },
      };
    }
    return { passed: true, metadata: { keywordDensityPer1000: densityPer1000 } };
  }
}
