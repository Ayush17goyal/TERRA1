import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { DocumentGraph, KnowledgeBaseRecord, RetrievableUnit, SourceDocumentType } from '../types/document-graph.types';

export interface MetadataAssemblyInput {
  documentId: string;
  documentType: SourceDocumentType;
  documentTypeConfidence: number;
  language: string;
  languageFlag?: string; // set when LanguageDetectionGate flagged mixed/unsupported content
  ocrUnavailableReason?: string; // set when OcrRecoveryStage couldn't recover a scanned PDF
  graph: DocumentGraph;
}

// architecture.md §3 Stage 12 (Metadata Creation & Knowledge Base Assembly):
// "Package the graph into retrievable units + document-level metadata and confidence/review
// flags ... each SectionNode/DefinitionEntry/CaseEntry becomes an independently retrievable,
// independently embeddable unit — not a fixed-length chunk — carrying its own hierarchy path
// as context."
@Injectable()
export class MetadataAssemblyStage {
  assemble(input: MetadataAssemblyInput): KnowledgeBaseRecord {
    const { graph } = input;
    const reviewReasons: string[] = [];

    const retrievableUnits: RetrievableUnit[] = [];
    for (const section of graph.sections) {
      retrievableUnits.push({
        id: crypto.randomUUID(),
        type: 'section',
        hierarchyPath: section.hierarchyPath,
        text: section.text,
        refId: section.id,
      });
      if (section.needsReview) reviewReasons.push(`low_confidence_section:${section.id}`);
    }
    for (const definition of graph.definitions) {
      const section = graph.sections.find((s) => s.id === definition.sectionId);
      retrievableUnits.push({
        id: crypto.randomUUID(),
        type: 'definition',
        hierarchyPath: section?.hierarchyPath || '(unknown)',
        text: `"${definition.term}" ${definition.definitionType === 'statutory' ? 'means' : '—'} ${definition.definitionText}`,
        refId: definition.id,
      });
    }
    for (const caseEntry of graph.cases) {
      const section = graph.sections.find((s) => s.id === caseEntry.sectionId);
      retrievableUnits.push({
        id: crypto.randomUUID(),
        type: 'case',
        hierarchyPath: section?.hierarchyPath || '(unknown)',
        text: [caseEntry.caseName, caseEntry.structured?.held, caseEntry.structured?.ratio].filter(Boolean).join(' — '),
        refId: caseEntry.id,
      });
    }
    for (const illustration of graph.illustrations) {
      const section = graph.sections.find((s) => s.id === illustration.sectionId);
      retrievableUnits.push({
        id: crypto.randomUUID(),
        type: 'illustration',
        hierarchyPath: section?.hierarchyPath || '(unknown)',
        text: illustration.text,
        refId: illustration.id,
      });
    }

    // Document-level confidence aggregates every upstream signal (§3.4 Confidence Propagation):
    // structural detection confidence, section-extraction confidence, and any gate-level flags.
    const sectionConfidences = graph.sections.map((s) => s.confidence);
    const avgSectionConfidence = sectionConfidences.length
      ? sectionConfidences.reduce((a, b) => a + b, 0) / sectionConfidences.length
      : 0;
    const confidenceScore = Math.min(
      1,
      avgSectionConfidence * 0.6 + input.documentTypeConfidence * 0.4,
    );

    if (input.documentTypeConfidence < 0.3) reviewReasons.push('low_confidence_document_type_classification');
    if (input.languageFlag) reviewReasons.push(input.languageFlag);
    if (input.ocrUnavailableReason) reviewReasons.push(input.ocrUnavailableReason);
    if (graph.unresolvedReferences.length > 0) reviewReasons.push(`unresolved_references:${graph.unresolvedReferences.length}`);

    const dominantTopics = this.computeDominantTopics(graph.topicTags);

    return {
      documentId: input.documentId,
      documentType: input.documentType,
      language: input.language,
      dominantTopics,
      graph,
      retrievableUnits,
      confidenceScore,
      needsReview: reviewReasons.length > 0 || confidenceScore < 0.5,
      reviewReasons,
    };
  }

  private computeDominantTopics(topicTagsBySection: Record<string, { topic: string; confidence: number }[]>): string[] {
    const totals = new Map<string, number>();
    for (const tags of Object.values(topicTagsBySection)) {
      for (const tag of tags) {
        totals.set(tag.topic, (totals.get(tag.topic) || 0) + tag.confidence);
      }
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([topic]) => topic);
  }
}
