import { TextCleaningStage } from './text-cleaning.stage';
import { NormalizedDocument } from '../types/document-graph.types';

function makeDoc(texts: string[]): NormalizedDocument {
  return { sourceFormat: 'text', blocks: texts.map((text, index) => ({ index, text, styleHints: {}, needsOCR: false })) };
}

describe('TextCleaningStage', () => {
  const stage = new TextCleaningStage();

  it('strips a running header/footer repeated across most blocks', () => {
    const doc = makeDoc([
      'LEGATRIXON STUDY MATERIAL',
      'Article 19 protects freedom of speech.',
      'LEGATRIXON STUDY MATERIAL',
      'Article 21 protects the right to life.',
      'LEGATRIXON STUDY MATERIAL',
    ]);
    const result = stage.clean(doc);
    expect(result.blocks.some((b) => b.text === 'LEGATRIXON STUDY MATERIAL')).toBe(false);
    expect(result.blocks.some((b) => b.text.includes('Article 19'))).toBe(true);
  });

  it('strips bare page-number footers', () => {
    const doc = makeDoc(['Page 4', '4', 'Real content about contract law.']);
    const result = stage.clean(doc);
    expect(result.blocks.map((b) => b.text)).toEqual(['Real content about contract law.']);
  });

  it('rejoins hyphenated words split across a line break', () => {
    const doc = makeDoc(['This is a matter of juris-\nprudence under the Act.']);
    const result = stage.clean(doc);
    expect(result.blocks[0].text).toContain('jurisprudence');
    expect(result.blocks[0].text).not.toContain('juris-');
  });

  it('preserves section markers and numbering', () => {
    const doc = makeDoc(['Section 12 of the Indian Contract Act, 1872 defines consideration.']);
    const result = stage.clean(doc);
    expect(result.blocks[0].text).toContain('Section 12');
  });
});
