import type { KnowledgeChunk, KnowledgeDocument } from '../types';

export interface ChunkingOptions {
  maxTokens?: number;
  overlapTokens?: number;
}

export class KnowledgeChunker {
  private readonly options: ChunkingOptions;

  constructor(options: ChunkingOptions = {}) {
    this.options = options;
  }

  chunk(document: KnowledgeDocument): KnowledgeChunk[] {
    const maxTokens = this.options.maxTokens ?? this.defaultMaxTokens(document.kind);
    const overlapTokens = this.options.overlapTokens ?? 80;
    const paragraphs = document.content
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);

    const chunks: KnowledgeChunk[] = [];
    let buffer: string[] = [];
    let bufferTokens = 0;
    let chunkIndex = 0;

    for (const paragraph of paragraphs.length ? paragraphs : [document.content]) {
      const paragraphTokens = this.estimateTokens(paragraph);

      if (bufferTokens > 0 && bufferTokens + paragraphTokens > maxTokens) {
        chunks.push(this.buildChunk(document, buffer.join('\n\n'), chunkIndex++));
        buffer = this.tailOverlap(buffer.join('\n\n'), overlapTokens);
        bufferTokens = this.estimateTokens(buffer.join('\n\n'));
      }

      if (paragraphTokens > maxTokens) {
        for (const segment of this.splitLongText(paragraph, maxTokens, overlapTokens)) {
          chunks.push(this.buildChunk(document, segment, chunkIndex++));
        }
        buffer = [];
        bufferTokens = 0;
        continue;
      }

      buffer.push(paragraph);
      bufferTokens += paragraphTokens;
    }

    if (buffer.length > 0) {
      chunks.push(this.buildChunk(document, buffer.join('\n\n'), chunkIndex));
    }

    return chunks;
  }

  chunkMany(documents: KnowledgeDocument[]): KnowledgeChunk[] {
    return documents.flatMap((document) => this.chunk(document));
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private defaultMaxTokens(kind: KnowledgeDocument['kind']): number {
    if (kind === 'bare_act_component') return 900;
    if (kind === 'pattern') return 650;
    if (kind === 'curriculum' || kind === 'lesson') return 500;
    if (kind === 'teaching_rule' || kind === 'behaviour_rule') return 450;
    return 550;
  }

  private buildChunk(document: KnowledgeDocument, content: string, chunkIndex: number): KnowledgeChunk {
    return {
      ...document,
      id: `${document.id}::chunk-${chunkIndex}`,
      parentId: document.id,
      chunkIndex,
      content,
      tokenEstimate: this.estimateTokens(content),
      metadata: {
        ...document.metadata,
        parentId: document.id,
        chunkIndex,
      },
    };
  }

  private splitLongText(text: string, maxTokens: number, overlapTokens: number): string[] {
    const words = text.split(/\s+/);
    const approxWordsPerChunk = Math.max(50, Math.floor(maxTokens * 0.75));
    const overlapWords = Math.max(0, Math.floor(overlapTokens * 0.75));
    const segments: string[] = [];

    for (let start = 0; start < words.length; start += Math.max(1, approxWordsPerChunk - overlapWords)) {
      segments.push(words.slice(start, start + approxWordsPerChunk).join(' '));
    }

    return segments;
  }

  private tailOverlap(text: string, overlapTokens: number): string[] {
    const words = text.split(/\s+/);
    const overlapWords = Math.max(0, Math.floor(overlapTokens * 0.75));
    return overlapWords > 0 ? [words.slice(-overlapWords).join(' ')] : [];
  }
}

