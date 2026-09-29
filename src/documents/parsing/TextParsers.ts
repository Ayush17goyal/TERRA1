import type { DocumentParser, ParsedDocument, SupportedFileKind, UploadedDocumentInput } from '../types';

export class PlainTextParser implements DocumentParser {
  supports(fileKind: SupportedFileKind): boolean {
    return fileKind === 'txt' || fileKind === 'markdown';
  }

  async parse(input: UploadedDocumentInput): Promise<ParsedDocument> {
    return {
      text: new TextDecoder('utf-8').decode(input.content),
      metadata: { parser: 'plain-text' },
    };
  }
}

export class PdfParser implements DocumentParser {
  supports(fileKind: SupportedFileKind): boolean {
    return fileKind === 'pdf';
  }

  async parse(input: UploadedDocumentInput): Promise<ParsedDocument> {
    const pdfParse = await import('pdf-parse').then((module) => module.default ?? module);
    const buffer = typeof Buffer !== 'undefined'
      ? Buffer.from(input.content)
      : input.content;
    const result = await (pdfParse as (data: Uint8Array) => Promise<{ text: string; numpages?: number; info?: unknown }>)(buffer);
    return {
      text: result.text,
      pageCount: result.numpages,
      metadata: { parser: 'pdf-parse', info: result.info },
    };
  }
}

export class DocxParser implements DocumentParser {
  private readonly extractor?: (content: Uint8Array) => Promise<string>;

  constructor(extractor?: (content: Uint8Array) => Promise<string>) {
    this.extractor = extractor;
  }

  supports(fileKind: SupportedFileKind): boolean {
    return fileKind === 'docx';
  }

  async parse(input: UploadedDocumentInput): Promise<ParsedDocument> {
    if (!this.extractor) {
      throw new Error('DOCX parser is not configured. Provide a mammoth-backed extractor in production.');
    }
    return {
      text: await this.extractor(input.content),
      metadata: { parser: 'docx-extractor' },
    };
  }
}


