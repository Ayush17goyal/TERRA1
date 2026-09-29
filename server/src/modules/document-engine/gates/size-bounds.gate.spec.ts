import { SizeBoundsGate } from './size-bounds.gate';
import { MIN_EXTRACTABLE_CHARACTERS } from '../document-engine.constants';
import { NormalizedDocument } from '../types/document-graph.types';

function docWithChars(count: number): NormalizedDocument {
  return { sourceFormat: 'text', blocks: [{ index: 0, text: 'x'.repeat(count), styleHints: {}, needsOCR: false }] };
}

describe('SizeBoundsGate', () => {
  const gate = new SizeBoundsGate();

  it('fails just below the minimum extractable character threshold', () => {
    const result = gate.checkMinimumContent(docWithChars(MIN_EXTRACTABLE_CHARACTERS - 1));
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('insufficient_extractable_content');
  });

  it('passes just above the minimum extractable character threshold', () => {
    const result = gate.checkMinimumContent(docWithChars(MIN_EXTRACTABLE_CHARACTERS + 1));
    expect(result.passed).toBe(true);
  });
});
