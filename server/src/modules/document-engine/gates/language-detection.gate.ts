import { Injectable } from '@nestjs/common';
import { GateResult, NormalizedDocument } from '../types/document-graph.types';

// architecture.md §3.3: "Language detection: non-English/mixed-language content ... is detected
// at Stage 0/2; routed through language-appropriate OCR/extraction rather than silently
// mis-processed as English. Documents with unsupported languages are flagged needsReview, not
// silently degraded."
//
// Implemented as lightweight Unicode-script-range detection rather than a heavy NLP language-ID
// library, consistent with keeping this module's dependency footprint minimal. Detects the
// presence of non-Latin legal scripts common in Indian legal source material; does not attempt
// full language identification for every world language.
const SCRIPT_RANGES: Array<{ language: string; regex: RegExp }> = [
  { language: 'hi', regex: /[ऀ-ॿ]/ }, // Devanagari (Hindi, Marathi, Sanskrit)
  { language: 'bn', regex: /[ঀ-৿]/ }, // Bengali
  { language: 'ta', regex: /[஀-௿]/ }, // Tamil
  { language: 'te', regex: /[ఀ-౿]/ }, // Telugu
  { language: 'gu', regex: /[઀-૿]/ }, // Gujarati
  { language: 'ur', regex: /[؀-ۿ]/ }, // Arabic script (Urdu)
];

const SUPPORTED_LANGUAGES = new Set(['en']);

@Injectable()
export class LanguageDetectionGate {
  detect(doc: NormalizedDocument): { language: string; mixed: boolean } {
    const sample = doc.blocks.map((b) => b.text).join(' ').slice(0, 20_000);
    const totalChars = sample.replace(/\s/g, '').length || 1;

    let dominantNonLatin: { language: string; count: number } | null = null;
    for (const { language, regex } of SCRIPT_RANGES) {
      const matches = sample.match(new RegExp(regex, 'g'));
      const count = matches ? matches.length : 0;
      if (count > 0 && (!dominantNonLatin || count > dominantNonLatin.count)) {
        dominantNonLatin = { language, count };
      }
    }

    if (!dominantNonLatin) {
      return { language: 'en', mixed: false };
    }

    const nonLatinRatio = dominantNonLatin.count / totalChars;
    if (nonLatinRatio < 0.05) {
      // A few stray non-Latin characters (e.g. a quoted vernacular term) — treat as English
      // with mixed content, not a language switch.
      return { language: 'en', mixed: true };
    }
    return { language: dominantNonLatin.language, mixed: true };
  }

  check(doc: NormalizedDocument): GateResult & { language: string } {
    const { language, mixed } = this.detect(doc);
    if (!SUPPORTED_LANGUAGES.has(language)) {
      return {
        passed: true, // does not halt the pipeline — flags for review per §3.3
        reason: 'unsupported_language',
        metadata: { language, mixed },
        language,
      };
    }
    if (mixed) {
      return { passed: true, reason: 'mixed_language_content', metadata: { language, mixed }, language };
    }
    return { passed: true, language };
  }
}
