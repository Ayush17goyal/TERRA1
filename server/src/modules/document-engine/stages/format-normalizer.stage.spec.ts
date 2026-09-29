import { FormatNormalizerStage } from './format-normalizer.stage';
import { buildDocxBuffer, buildPptxBuffer } from '../__fixtures__/sample-inputs';

jest.mock('pdf-parse', () => jest.fn(), { virtual: true });

describe('FormatNormalizerStage', () => {
  const stage = new FormatNormalizerStage();

  it('normalizes a native-text PDF into paragraph blocks, not flagged for OCR', async () => {
    const pdfParse = require('pdf-parse');
    pdfParse.mockResolvedValue({ text: 'First paragraph of real legal text.\n\nSecond paragraph here.', numpages: 1 });

    const result = await stage.normalize(Buffer.from('irrelevant'), 'application/pdf', 'act.pdf');
    expect(result.sourceFormat).toBe('pdf');
    expect(result.blocks.length).toBe(2);
    expect(result.blocks.every((b) => !b.needsOCR)).toBe(true);
  });

  it('flags a scanned/low-text PDF for OCR', async () => {
    const pdfParse = require('pdf-parse');
    // 10 pages, almost no extractable text => low chars-per-page => scanned.
    pdfParse.mockResolvedValue({ text: 'x', numpages: 10 });

    const result = await stage.normalize(Buffer.from('irrelevant'), 'application/pdf', 'scanned.pdf');
    expect(result.blocks.some((b) => b.needsOCR)).toBe(true);
  });

  it('extracts DOCX paragraphs and preserves native heading level as a style hint', async () => {
    const buffer = buildDocxBuffer([
      { text: 'Chapter 1', headingLevel: 1 },
      { text: 'Body paragraph text.' },
    ]);
    const result = (await stage.normalize(buffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'notes.docx')) as any;
    expect(result.sourceFormat).toBe('docx');
    expect(result.blocks[0].text).toBe('Chapter 1');
    expect(result.blocks[0].styleHints.nativeHeadingLevel).toBe(1);
    expect(result.blocks[1].styleHints.nativeHeadingLevel).toBeUndefined();
  });

  it('extracts PPTX slide text and marks title placeholders as heading level 1', async () => {
    const buffer = buildPptxBuffer([{ title: 'Unit 3', body: 'Consideration in contract law.' }]);
    const result = (await stage.normalize(buffer, 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'slides.pptx')) as any;
    expect(result.sourceFormat).toBe('pptx');
    expect(result.blocks.some((b: any) => b.text === 'Unit 3' && b.styleHints.nativeHeadingLevel === 1)).toBe(true);
    expect(result.blocks.some((b: any) => b.text === 'Consideration in contract law.')).toBe(true);
  });

  it('flags an image upload for OCR', async () => {
    const result = (await stage.normalize(Buffer.from('fake image bytes'), 'image/png', 'note.png')) as any;
    expect(result.sourceFormat).toBe('image');
    expect(result.blocks[0].needsOCR).toBe(true);
  });

  it('splits plain text into paragraph blocks', async () => {
    const result = (await stage.normalize(Buffer.from('Para one.\n\nPara two.'), 'text/plain', 'notes.txt')) as any;
    expect(result.sourceFormat).toBe('text');
    expect(result.blocks.length).toBe(2);
  });
});
