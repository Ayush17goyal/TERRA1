import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { CleanedDocument, DocumentTree, DocumentTreeNode, SourceDocumentType } from '../types/document-graph.types';

const NUMBERING_PATTERNS: Array<{ regex: RegExp; level: number }> = [
  { regex: /^(PART|Part)\s+[IVXLC0-9]+/, level: 1 },
  { regex: /^(CHAPTER|Chapter)\s+[IVXLC0-9]+/, level: 2 },
  { regex: /^(Article|ARTICLE)\s+\d+[A-Za-z]?/, level: 3 },
  { regex: /^(Section|SECTION|Sec\.?)\s+\d+[A-Za-z]?/, level: 3 },
  { regex: /^\(\d+\)/, level: 4 }, // sub-section "(1)"
  { regex: /^\([a-z]\)/, level: 5 }, // clause "(a)"
  { regex: /^\d+\.\d+/, level: 3 }, // "4.2" style notes numbering
  { regex: /^\d+\.\s/, level: 3 }, // "4. " style notes numbering
];

const DOC_TYPE_SIGNALS: Record<SourceDocumentType, RegExp[]> = {
  bare_act: [/\bhereby\s+enacted\b/i, /\bshort title\b/i, /\bcame into force\b/i, /\bAct,?\s+\d{4}\b/, /\bprovided\s+that\b/i, /\barticle\s+\d+/i],
  case_compilation: [/\bv\.?s?\.\s/i, /\bpetitioner\b/i, /\brespondent\b/i, /\bAIR\s+\d{4}/, /\bSCC\b/, /\bheld\s*:/i],
  notes: [/^unit\s+\d/im, /^class\s+\d/im, /^topic\s*:/im, /^notes\s*:/im],
  textbook: [/\bchapter\s+\d+\b/i, /\bintroduction\b/i, /\bsummary\b/i, /\bexercises?\b/i],
  unknown: [],
};

// architecture.md §3 Stage 3 (Structural Skeleton Detection):
// "Multi-signal heading detection ... fused into a single confidence-scored heading classifier
// ... Distinguishes document type up front, since hierarchy grammar differs."
@Injectable()
export class StructuralSkeletonStage {
  build(doc: CleanedDocument): DocumentTree {
    const documentType = this.classifyDocumentType(doc);

    const root: DocumentTreeNode[] = [];
    const stack: DocumentTreeNode[] = [];
    let offset = 0;

    for (const block of doc.blocks) {
      const blockStart = offset;
      const blockEnd = offset + block.text.length;
      offset = blockEnd + 1;

      const heading = this.detectHeading(block.text, block.styleHints);
      if (!heading) continue;

      const node: DocumentTreeNode = {
        id: crypto.randomUUID(),
        level: heading.level,
        title: block.text.slice(0, 200),
        startOffset: blockStart,
        endOffset: blockEnd,
        confidence: heading.confidence,
        children: [],
      };

      while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
        stack.pop();
      }
      if (stack.length === 0) {
        root.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }
      stack.push(node);
    }

    return { documentType: documentType.type, documentTypeConfidence: documentType.confidence, root };
  }

  private detectHeading(
    text: string,
    styleHints: { bold?: boolean; nativeHeadingLevel?: number; indentLevel?: number },
  ): { level: number; confidence: number } | null {
    // Native DOCX/PPTX style hints are the strongest signal — trust them directly.
    if (styleHints.nativeHeadingLevel) {
      return { level: styleHints.nativeHeadingLevel, confidence: 0.95 };
    }

    for (const { regex, level } of NUMBERING_PATTERNS) {
      if (regex.test(text.trim())) {
        // Numbering pattern survives OCR/poor formatting better than font-based signals, so it
        // is weighted heavily even without corroborating style hints.
        const corroborated = styleHints.bold ? 0.9 : 0.75;
        return { level, confidence: corroborated };
      }
    }

    // All-caps short line, no terminal punctuation — plausible heading, lower confidence since
    // this signal alone is weak (common false-positive on emphasis/quotes).
    const trimmed = text.trim();
    if (trimmed.length > 0 && trimmed.length < 80 && trimmed === trimmed.toUpperCase() && !/[.,;]$/.test(trimmed) && /[A-Z]/.test(trimmed)) {
      return { level: 2, confidence: styleHints.bold ? 0.6 : 0.4 };
    }

    if (styleHints.bold && trimmed.length < 100 && !/[.]$/.test(trimmed)) {
      return { level: 3, confidence: 0.5 };
    }

    return null;
  }

  private classifyDocumentType(doc: CleanedDocument): { type: SourceDocumentType; confidence: number } {
    const fullText = doc.blocks.map((b) => b.text).join('\n');
    const scores: Record<string, number> = { bare_act: 0, case_compilation: 0, notes: 0, textbook: 0 };

    for (const [type, patterns] of Object.entries(DOC_TYPE_SIGNALS)) {
      if (type === 'unknown') continue;
      for (const pattern of patterns) {
        if (pattern.test(fullText)) scores[type] += 1;
      }
    }

    const [bestType, bestScore] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const totalSignals = Object.values(scores).reduce((a, b) => a + b, 0) || 1;

    if (bestScore === 0) {
      return { type: 'unknown', confidence: 0 };
    }
    return { type: bestType as SourceDocumentType, confidence: Math.min(0.95, bestScore / totalSignals + 0.2) };
  }
}
