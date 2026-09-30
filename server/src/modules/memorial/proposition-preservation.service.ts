import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { CaseDossier, DossierParagraphCategory, DossierPage, DocumentSectionType } from './memorial.types';

interface ExtractedDocument {
  rawText: string;
  pages: string[];
}

@Injectable()
export class PropositionPreservationService {
  async extractDocument(file?: any, fallbackText?: string): Promise<ExtractedDocument> {
    if (fallbackText?.trim()) {
      const normalized = this.normalize(fallbackText);
      return { rawText: normalized, pages: this.splitFallbackPages(normalized) };
    }
    if (!file?.buffer) return { rawText: '', pages: [] };

    const name = file.originalname || 'proposition.txt';
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return this.extractPdf(file.buffer);
    if (ext === 'docx') return this.extractDocx(file.buffer);

    const text = this.normalize(file.buffer.toString('utf-8'));
    return { rawText: text, pages: this.splitFallbackPages(text) };
  }

  async extractText(file?: any, fallbackText?: string) {
    return (await this.extractDocument(file, fallbackText)).rawText;
  }

  buildDossier(documentOrText: ExtractedDocument | string, sourceName = 'uploaded proposition'): CaseDossier {
    const document = typeof documentOrText === 'string'
      ? { rawText: this.normalize(documentOrText), pages: this.splitFallbackPages(this.normalize(documentOrText)) }
      : documentOrText;
    const rawText = this.normalize(document.rawText);
    const id = crypto.createHash('sha1').update(sourceName + rawText.slice(0, 2000)).digest('hex').slice(0, 12);
    const pages = document.pages.length ? document.pages : this.splitFallbackPages(rawText);
    const dossierPages: DossierPage[] = pages.map((page, index) => {
      const text = this.normalize(page);
      const classification = this.classifyPage(text);
      return {
        pageNo: index + 1,
        text,
        headings: this.extractHeadings(text),
        tables: this.extractTables(text),
        footnotes: this.extractFootnotes(text),
        sectionType: classification.type,
        sectionConfidence: classification.confidence,
      };
    });

    const paragraphs = dossierPages.flatMap((page) => this.toParagraphs(page.text, page.pageNo, page.sectionType));
    return {
      id,
      sourceName,
      rawText,
      pages: dossierPages,
      paragraphs,
      timeline: this.extractTimeline(paragraphs),
      parties: this.extractParties(rawText, paragraphs),
      legalTriggers: this.extractLegalTriggers(paragraphs),
      propositionRules: this.extractRules(paragraphs),
      unresolvedQuestions: this.extractUnresolvedQuestions(paragraphs),
    };
  }

  private async extractPdf(buffer: Buffer): Promise<ExtractedDocument> {
    const pdfParse = require('pdf-parse');
    const pageTexts: string[] = [];
    const options = {
      pagerender: async (pageData: any) => {
        const content = await pageData.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
        const items = Array.isArray(content?.items) ? content.items : [];
        let lastY: number | undefined;
        const lines: string[] = [];
        let line = '';
        for (const item of items) {
          const value = String(item?.str || '').trim();
          if (!value) continue;
          const y = Array.isArray(item?.transform) ? Number(item.transform[5]) : undefined;
          if (lastY !== undefined && y !== undefined && Math.abs(y - lastY) > 2.5 && line.trim()) {
            lines.push(line.trim());
            line = value;
          } else {
            line = line ? `${line} ${value}` : value;
          }
          if (y !== undefined) lastY = y;
        }
        if (line.trim()) lines.push(line.trim());
        const text = this.normalize(lines.join('\n'));
        pageTexts.push(text);
        return text;
      },
    };
    const parsed = await pdfParse(buffer, options);
    const raw = this.normalize(parsed?.text || pageTexts.join('\n\n'));
    return { rawText: raw, pages: pageTexts.filter(Boolean).length ? pageTexts.filter(Boolean) : this.splitFallbackPages(raw) };
  }

  private extractDocx(buffer: Buffer): ExtractedDocument {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(buffer);
    const xml = zip.readAsText('word/document.xml');
    const withBreaks = xml
      .replace(/<w:br[^>]*w:type="page"[^>]*\/>/g, '\f')
      .replace(/<w:tab[^>]*\/>/g, '\t')
      .replace(/<\/w:p>/g, '\n');
    const matches = withBreaks.match(/<w:t[^>]*>.*?<\/w:t>|\f|\n/g) || [];
    const text = matches
      .map((m: string) => m === '\f' || m === '\n' ? m : m.replace(/<[^>]+>/g, ''))
      .join('');
    const normalized = this.normalize(text);
    return { rawText: normalized, pages: text.split('\f').map((p: string) => this.normalize(p)).filter(Boolean) };
  }

  private normalize(text: string) {
    return String(text || '')
      .replace(/\r/g, '')
      .replace(/[\u00a0\u2007\u202f]/g, ' ')
      .replace(/([a-z0-9])\.([A-Z])/g, '$1. $2')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private splitFallbackPages(text: string) {
    const explicit = text.split(/\f|(?:\n\s*Page\s+\d+\s*\n)/gi).map((x) => x.trim()).filter(Boolean);
    if (explicit.length > 1) return explicit;
    const pages: string[] = [];
    const paras = text.split(/\n\s*\n/);
    let current = '';
    for (const para of paras) {
      if (current && (current.length + para.length) > 4500) {
        pages.push(current.trim());
        current = para;
      } else {
        current = current ? `${current}\n\n${para}` : para;
      }
    }
    if (current.trim()) pages.push(current.trim());
    return pages;
  }

  private classifyPage(text: string): { type: DocumentSectionType; confidence: number } {
    const l = text.toLowerCase();
    const score = {
      rules: this.count(l, [/team shall|each team|memorial|page limit|font|footnote|submission|cover|speaker|researcher|preliminary round|award|registration|eligibility/g]),
      organiser: this.count(l, [/organising committee|organizing committee|patron|convener|lawctopus|resolvify|media partner|academy|phone|email|address|naac|collaborator/g]),
      concept: this.count(l, [/concept note|participants are invited|aims to foster|proposition is situated|explores issues|digitising society|critical thinking|advocacy skills/g]),
      facts: this.count(l, [/accused|complainant|victim|lodged|arrested|search|seizure|warrant|forensic|trial court|high court|convicted|appeal|alleged|discovered|received|created|circulated|registered|investigation revealed|between\s+[a-z]+\s+and|aged\s+\d+/g]),
      issues: this.count(l, [/issues raised|whether the|questions presented|issues for consideration/g]),
      clarifications: this.count(l, [/clarification|correction|addendum|errata/g]),
    };
    if (score.issues >= 2) return { type: 'issues', confidence: 94 };
    if (score.facts >= 3 && score.facts > score.rules + score.organiser + score.concept) return { type: 'moot_proposition', confidence: Math.min(98, 72 + score.facts * 4) };
    if (score.rules >= 3 && score.rules >= score.facts) return { type: 'competition_rules', confidence: Math.min(98, 72 + score.rules * 3) };
    if (score.organiser >= 3 && score.organiser >= score.facts) return { type: 'organiser_material', confidence: Math.min(98, 70 + score.organiser * 3) };
    if (score.concept >= 2 && score.concept >= score.facts) return { type: 'concept_note', confidence: Math.min(96, 72 + score.concept * 4) };
    if (score.clarifications) return { type: 'clarifications', confidence: 90 };
    if (/annexure|appendix|schedule/i.test(text)) return { type: 'annexure', confidence: 82 };
    if (/trial court|high court|supreme court|appeal|conviction|sentence/i.test(text) && score.facts) return { type: 'procedural_history', confidence: 82 };
    if (/moot court competition|brochure|academy|institution/i.test(text) && !score.facts) return { type: 'cover_or_brochure', confidence: 72 };
    return { type: 'unknown', confidence: 45 };
  }

  private toParagraphs(text: string, pageNo: number, sectionType?: DocumentSectionType) {
    const paragraphs = text
      .split(/\n\s*\n|(?<=\.)\s+(?=(?:\d+\.|[A-Z][a-z]{2,}\s))/g)
      .flatMap((p) => this.splitLongParagraph(p.trim()))
      .filter((p) => p.length > 20);
    return paragraphs.map((text, index) => ({
      id: `P${pageNo}-${String(index + 1).padStart(3, '0')}`,
      pageNo,
      text,
      category: this.classifyParagraph(text, sectionType),
      sectionType,
    }));
  }

  private splitLongParagraph(text: string) {
    if (text.length < 1300) return [text];
    return text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/g).map((x) => x.trim()).filter((x) => x.length > 20);
  }

  private classifyParagraph(text: string, pageType?: DocumentSectionType): DossierParagraphCategory {
    const l = text.toLowerCase();
    if (pageType === 'organiser_material' || this.isOrganiser(text)) return 'organiser_material';
    if (pageType === 'concept_note' || this.isConcept(text)) return 'concept_note';
    if (pageType === 'competition_rules' || this.isCompetitionRule(text)) return 'instruction';
    if (/prayer|relief sought|therefore.*pray/i.test(text)) return 'relief';
    if (/^\s*(issues raised|whether)\b|question(?:s)? (?:presented|for consideration)/i.test(text)) return 'issue';
    if (/trial court|high court|supreme court|appeal|convicted|conviction|sentence|impugned judgment|procedural history/i.test(text)) return 'procedure';
    if (/article\s+\d+|section\s+\d+|constitution|act,?\s+\d{4}|sakshya|nyaya sanhita|information technology act/i.test(text)) return 'law';
    if (/annexure|appendix|schedule/i.test(text)) return 'annexure';
    if (this.caseFactScore(l) >= 2) return 'fact';
    return 'ambiguous';
  }

  private isCompetitionRule(text: string) {
    return /team shall|each team|memorial|page limit|word limit|font|footnote|cover|blue|red|speaker|researcher|submission|preliminary round|semi.?final|quarter.?final|registration|eligibility|award|disqualification/i.test(text);
  }

  private isOrganiser(text: string) {
    return /organising committee|organizing committee|patron|co-patron|convener|lawctopus|resolvify|media partner|academy|phone no|mobile no|info@|address|naac accredited|collaborator|our esteemed/i.test(text);
  }

  private isConcept(text: string) {
    return /concept note|participants are invited|aims to foster|proposition is situated|explores issues relating|critical thinking|advocacy skills|rapidly digitising society|digital economy/i.test(text);
  }

  private caseFactScore(l: string) {
    return this.count(l, [/accused|complainant|victim|petitioner|respondent|lodged|warrant|forensic|seized|search|trial court|high court|convicted|appeal|alleged|discovered|received|created|circulated|registered|investigation|morphed|fake account|threat|harassment|server|device|laptop|mobile|certificate/g]);
  }

  private count(text: string, regexes: RegExp[]) {
    return regexes.reduce((sum, regex) => sum + (text.match(regex) || []).length, 0);
  }

  private extractHeadings(text: string) {
    return text.split('\n').map((x) => x.trim()).filter((x) => x.length > 4 && x.length < 180 && (x === x.toUpperCase() || /^(facts|issues|rules|proposition|clarifications|annexure)/i.test(x))).slice(0, 30);
  }

  private extractTables(text: string) {
    return text.split('\n').filter((line) => /\s{3,}|\|/.test(line)).slice(0, 40);
  }

  private extractFootnotes(text: string) {
    return text.split('\n').filter((line) => /^\s*\d+[.)]?\s+[A-Z].{10,}/.test(line)).slice(0, 80);
  }

  private extractTimeline(paragraphs: any[]) {
    const dateRegex = /\b(?:\d{1,2}\s+[A-Z][a-z]+\s+\d{4}|[A-Z][a-z]+\s+\d{4}|\d{4})\b/g;
    return paragraphs
      .filter((p) => p.category === 'fact' || p.category === 'procedure')
      .flatMap((p) => (p.text.match(dateRegex) || []).map((date: string) => ({ date, event: p.text.slice(0, 400), sourceParagraphId: p.id })));
  }

  private extractParties(text: string, paragraphs: any[]) {
    const candidates = [
      ...(text.match(/\b(?:Mr\.|Ms\.|Dr\.)\s+[A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){1,2}/g) || []),
      ...(text.match(/\b(?:Republic|State|Union) of [A-Z][A-Za-z]+\b/g) || []),
      ...(text.match(/\b(?:Cyber Crime Cell|Prosecution|Respondent State|The Accused|The Complainant)\b/g) || []),
    ];
    return Array.from(new Set(candidates.map((x) => x.trim()))).slice(0, 12).map((name) => ({
      name,
      role: /state|union|republic|prosecution|cyber crime/i.test(name) ? 'respondent' : /complainant|victim/i.test(name) ? 'complainant' : 'petitioner',
      claims: [],
      actions: paragraphs.filter((p) => p.text.includes(name.replace(/^(Mr\.|Ms\.|Dr\.)\s+/, ''))).slice(0, 5).map((p) => p.text.slice(0, 300)),
    }));
  }

  private extractLegalTriggers(paragraphs: any[]) {
    return paragraphs
      .filter((p) => ['law', 'issue', 'procedure', 'fact'].includes(p.category) && /right|violate|valid|admissible|jurisdiction|conviction|sentence|privacy|evidence|search|seizure|proportionate/i.test(p.text))
      .slice(0, 120)
      .map((p) => ({ text: p.text.slice(0, 850), possibleLawArea: this.detectLawArea(p.text), sourceParagraphId: p.id }));
  }

  private detectLawArea(text: string) {
    if (/evidence|admissible|sakshya|certificate|forensic/i.test(text)) return 'Evidence Law';
    if (/jurisdiction|foreign|server|intermediary|section 75|extraterritorial/i.test(text)) return 'Cyber Jurisdiction';
    if (/privacy|data|digital|search|seizure|device|article 21/i.test(text)) return 'Privacy and Criminal Procedure';
    if (/conviction|sentence|proportionate|punishment|article 14|article 19/i.test(text)) return 'Criminal Appeal and Constitutional Proportionality';
    return 'General Legal Trigger';
  }

  private extractRules(paragraphs: any[]) {
    const instructions = paragraphs.filter((p) => p.category === 'instruction').map((p) => p.text);
    return {
      memorialRules: instructions.filter((x) => /memorial|team code|submission|cover/i.test(x)),
      pageLimits: instructions.filter((x) => /page|word|limit/i.test(x)),
      citationRules: instructions.filter((x) => /citation|footnote|bluebook|oscola|ili|scc/i.test(x)),
      formattingRules: instructions.filter((x) => /font|margin|spacing|format|pdf|docx|blue cover|red cover/i.test(x)),
    };
  }

  private extractUnresolvedQuestions(paragraphs: any[]) {
    return paragraphs.filter((p) => p.category === 'issue' || /^whether/i.test(p.text)).slice(0, 15).map((p) => p.text.slice(0, 500));
  }
}
