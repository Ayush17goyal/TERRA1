import type { BareActStructureComponent, DocumentChunk, PipelineDocumentType } from '../types';

export class DocumentChunker {
  chunk(input: {
    documentId: string;
    documentType: PipelineDocumentType;
    components: BareActStructureComponent[];
    jurisdiction?: string;
    embeddingVersion: string;
  }): DocumentChunk[] {
    const maxTokens = this.maxTokens(input.documentType);
    const chunks: DocumentChunk[] = [];
    for (const component of input.components) {
      const segments = this.segment(component.text, maxTokens);
      segments.forEach((content, segmentIndex) => {
        chunks.push({
          id: `${input.documentId}:${component.id}:${segmentIndex}`,
          documentId: input.documentId,
          documentType: input.documentType,
          componentType: component.componentType,
          content,
          heading: component.heading,
          sectionNumber: component.sectionNumber,
          jurisdiction: input.jurisdiction,
          tokenCount: this.estimateTokens(content),
          embeddingVersion: input.embeddingVersion,
          metadata: {
            component_order: component.order,
            segment_index: segmentIndex,
          },
        });
      });
    }
    return chunks;
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private maxTokens(type: PipelineDocumentType): number {
    if (type === 'bare_act') return 900;
    if (type === 'student_draft') return 700;
    if (type === 'rubric' || type === 'assignment') return 500;
    return 650;
  }

  private segment(text: string, maxTokens: number): string[] {
    if (this.estimateTokens(text) <= maxTokens) return [text];
    const words = text.split(/\s+/);
    const wordsPerChunk = Math.max(80, Math.floor(maxTokens * 0.75));
    const overlap = 40;
    const segments: string[] = [];
    for (let i = 0; i < words.length; i += wordsPerChunk - overlap) {
      segments.push(words.slice(i, i + wordsPerChunk).join(' '));
    }
    return segments;
  }
}
