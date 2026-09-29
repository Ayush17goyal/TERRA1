import { Injectable, Logger } from '@nestjs/common';
import * as AdmZip from 'adm-zip';
import { NormalizedBlock, NormalizedDocument } from '../types/document-graph.types';

// architecture.md §3 Stage 0 (Format Normalization):
// "Collapse PDF/DOCX/PPT/scanned-image inputs into one internal representation before anything
// downstream needs to know the source format ... DOCX/PPT already carry semantic markup which
// should be preserved as hints, not discarded; scanned PDF/image PDF is flagged and routed to OCR."
@Injectable()
export class FormatNormalizerStage {
  private readonly logger = new Logger(FormatNormalizerStage.name);

  async normalize(buffer: Buffer, mimeType: string, filename: string): Promise<NormalizedDocument> {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    if (ext === 'pdf' || mimeType === 'application/pdf') {
      return this.normalizePdf(buffer);
    }
    if (ext === 'docx' || mimeType.includes('wordprocessingml')) {
      return this.normalizeDocx(buffer);
    }
    if (ext === 'pptx' || ext === 'ppt' || mimeType.includes('presentationml')) {
      return this.normalizePptx(buffer);
    }
    if (['png', 'jpg', 'jpeg', 'tiff'].includes(ext) || mimeType.startsWith('image/')) {
      return this.normalizeImage();
    }
    // txt / md / plain text fallback
    return this.normalizeText(buffer);
  }

  private async normalizePdf(buffer: Buffer): Promise<NormalizedDocument> {
    let text = '';
    let numPages = 1;
    try {
      // Dynamic require mirrors modules/ingestion/ingestion.service.ts's existing pdf-parse usage.
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      text = data.text || '';
      numPages = data.numpages || 1;
    } catch (error: any) {
      this.logger.error(`PDF parsing failed: ${error.message}`);
      throw new Error(`Unable to parse PDF: ${error.message}`);
    }

    const charsPerPage = text.length / Math.max(numPages, 1);
    // A scanned/image-only PDF yields little to no extractable text per page relative to a
    // native PDF — used as the Stage 0 signal to flag pages for OCR (Stage 1).
    const likelyScanned = charsPerPage < 40;

    const rawParagraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const blocks: NormalizedBlock[] = rawParagraphs.map((paragraph, index) => ({
      index,
      text: paragraph,
      page: undefined,
      styleHints: {},
      needsOCR: likelyScanned,
    }));

    if (blocks.length === 0) {
      // No extractable text at all — the whole document needs OCR.
      blocks.push({ index: 0, text: '', styleHints: {}, needsOCR: true });
    }

    return { blocks, sourceFormat: 'pdf' };
  }

  private normalizeDocx(buffer: Buffer): NormalizedDocument {
    // No dedicated DOCX parser is installed server-side; DOCX is a zip of XML parts, so the
    // document body (word/document.xml) is unzipped and its text runs extracted directly.
    // Paragraph boundaries (<w:p>) are preserved as block boundaries, and the paragraph's
    // style reference (<w:pStyle w:val="HeadingN"/>) is preserved as a native heading hint.
    const zip = new AdmZip(buffer);
    const entry = zip.getEntry('word/document.xml');
    if (!entry) throw new Error('Invalid DOCX: word/document.xml not found');
    const xml = entry.getData().toString('utf8');

    const paragraphXmls = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
    const blocks: NormalizedBlock[] = [];
    paragraphXmls.forEach((paragraphXml, index) => {
      const runs = paragraphXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
      const text = runs
        .map((r) => r.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, ''))
        .join('')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .trim();
      if (!text) return;

      const headingMatch = paragraphXml.match(/w:pStyle w:val="Heading(\d)"/);
      const isBold = /<w:b\/>|<w:b w:val="(1|true)"\/>/.test(paragraphXml);

      blocks.push({
        index,
        text,
        styleHints: {
          bold: isBold,
          nativeHeadingLevel: headingMatch ? Number(headingMatch[1]) : undefined,
          isListItem: /<w:numPr>/.test(paragraphXml),
        },
        needsOCR: false,
      });
    });

    return { blocks, sourceFormat: 'docx' };
  }

  private normalizePptx(buffer: Buffer): NormalizedDocument {
    // Same zip-of-XML approach as DOCX: each ppt/slides/slideN.xml contributes one block per
    // text run, with the slide's title placeholder preserved as a native heading hint.
    const zip = new AdmZip(buffer);
    const slideEntries = zip
      .getEntries()
      .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
      .sort((a, b) => {
        const na = Number(a.entryName.match(/slide(\d+)\.xml/)?.[1] || 0);
        const nb = Number(b.entryName.match(/slide(\d+)\.xml/)?.[1] || 0);
        return na - nb;
      });

    const blocks: NormalizedBlock[] = [];
    let index = 0;
    slideEntries.forEach((entry, slideIdx) => {
      const xml = entry.getData().toString('utf8');
      const isTitleShape = (shapeXml: string) => /<p:ph[^>]*type="(title|ctrTitle)"/.test(shapeXml);
      const shapes = xml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) || [];

      shapes.forEach((shapeXml) => {
        const runs = shapeXml.match(/<a:t>([\s\S]*?)<\/a:t>/g) || [];
        const text = runs
          .map((r) => r.replace(/<a:t>/, '').replace(/<\/a:t>/, ''))
          .join(' ')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .trim();
        if (!text) return;
        blocks.push({
          index: index++,
          text,
          slide: slideIdx + 1,
          styleHints: { nativeHeadingLevel: isTitleShape(shapeXml) ? 1 : undefined },
          needsOCR: false,
        });
      });
    });

    return { blocks, sourceFormat: 'pptx' };
  }

  private normalizeImage(): NormalizedDocument {
    // Image uploads (scanned single-page notices etc.) always route through OCR (Stage 1).
    return { blocks: [{ index: 0, text: '', styleHints: {}, needsOCR: true }], sourceFormat: 'image' };
  }

  private normalizeText(buffer: Buffer): NormalizedDocument {
    const text = buffer.toString('utf8');
    const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const blocks: NormalizedBlock[] = paragraphs.map((paragraph, index) => ({
      index,
      text: paragraph,
      styleHints: { nativeHeadingLevel: /^#{1,6}\s/.test(paragraph) ? paragraph.match(/^#+/)![0].length : undefined },
      needsOCR: false,
    }));
    return { blocks, sourceFormat: 'text' };
  }
}
