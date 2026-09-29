import { LanguageDetectionGate } from './language-detection.gate';
import { NormalizedDocument } from '../types/document-graph.types';
import { BARE_ACT_TEXT, HINDI_TEXT } from '../__fixtures__/sample-inputs';

function docWithText(text: string): NormalizedDocument {
  return { sourceFormat: 'text', blocks: [{ index: 0, text, styleHints: {}, needsOCR: false }] };
}

describe('LanguageDetectionGate', () => {
  const gate = new LanguageDetectionGate();

  it('passes pure English content with no flag', () => {
    const result = gate.check(docWithText(BARE_ACT_TEXT));
    expect(result.language).toBe('en');
    expect(result.reason).toBeUndefined();
  });

  it('flags a Devanagari-dominant document as unsupported_language', () => {
    const result = gate.check(docWithText(HINDI_TEXT));
    expect(result.language).toBe('hi');
    expect(result.reason).toBe('unsupported_language');
  });

  it('flags mixed content (English with a stray non-Latin quoted term) without changing the language', () => {
    const mixed = `${BARE_ACT_TEXT}\n"धारा" is the Hindi word for section.`;
    const result = gate.check(docWithText(mixed));
    expect(result.language).toBe('en');
    expect(result.reason).toBe('mixed_language_content');
  });
});
