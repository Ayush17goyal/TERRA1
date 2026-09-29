import { Injectable } from '@nestjs/common';
import { CleanedDocument, CleaningLogEntry, NormalizedDocument, NormalizedBlock } from '../types/document-graph.types';

// architecture.md §3 Stage 2 (Text Cleaning & Noise Removal):
// "Strip artifacts without destroying legal meaning ... Explicitly preserves: numbering tokens,
// section markers, quotation marks around statutory text, italics/bold markers."
@Injectable()
export class TextCleaningStage {
  clean(doc: NormalizedDocument): CleanedDocument {
    const cleaningLog: CleaningLogEntry[] = [];

    // Header/footer repetition removal: any block whose exact text repeats identically across
    // more than a third of the document's blocks is treated as a running header/footer, not content.
    const textCounts = new Map<string, number>();
    for (const block of doc.blocks) {
      const key = block.text.trim();
      if (key.length > 0 && key.length < 120) {
        textCounts.set(key, (textCounts.get(key) || 0) + 1);
      }
    }
    const repetitionThreshold = Math.max(3, Math.floor(doc.blocks.length / 3));
    const repeatedTexts = new Set(
      [...textCounts.entries()].filter(([, count]) => count >= repetitionThreshold).map(([text]) => text),
    );

    const cleanedBlocks: NormalizedBlock[] = [];
    for (const block of doc.blocks) {
      const removed: string[] = [];
      let text = block.text;

      const trimmed = text.trim();
      if (repeatedTexts.has(trimmed)) {
        removed.push('repeated header/footer');
        cleanedBlocks.push({ ...block, text: '' });
        cleaningLog.push({ blockIndex: block.index, removed });
        continue;
      }

      // "Page X of Y" / bare page-number footers.
      if (/^(page\s+)?\d+(\s+of\s+\d+)?$/i.test(trimmed)) {
        removed.push('page-number footer');
        cleanedBlocks.push({ ...block, text: '' });
        cleaningLog.push({ blockIndex: block.index, removed });
        continue;
      }

      // Hyphenation-across-linebreak rejoining (e.g. "juris-\nprudence" -> "jurisprudence").
      const beforeHyphenFix = text;
      text = text.replace(/(\w)-\n(\w)/g, '$1$2').replace(/(\w)-\s+(\w)/g, (m, a, b) => `${a}${b}`);
      if (text !== beforeHyphenFix) removed.push('hyphenation rejoin');

      // Common OCR misreads. Deliberately conservative — only fixes patterns unambiguous enough
      // not to corrupt legitimate text (e.g. does not blanket-replace "l"/"1").
      const beforeOcrFix = text;
      text = text.replace(/\bSS\b(?=\s*\d)/g, '§§').replace(/\bS\.(\s*\d)/g, '§.$1');
      if (text !== beforeOcrFix) removed.push('OCR artifact correction');

      // Whitespace/encoding normalization — preserves single newlines/numbering, collapses runs
      // of spaces/tabs only.
      const beforeWhitespaceFix = text;
      text = text.replace(/[ \t]{2,}/g, ' ').replace(/ /g, ' ').trim();
      if (text !== beforeWhitespaceFix) removed.push('whitespace normalization');

      cleanedBlocks.push({ ...block, text });
      if (removed.length > 0) cleaningLog.push({ blockIndex: block.index, removed });
    }

    return { blocks: cleanedBlocks.filter((b) => b.text.length > 0), cleaningLog };
  }
}
