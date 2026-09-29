import { Logger } from '@nestjs/common';

/**
 * Legal Document Chunking Strategies
 * ====================================
 * Specialized chunkers for three legal document types:
 *   - Judgments (court decisions)
 *   - Bare Acts (statutes / legislation)
 *   - Research Papers (academic legal scholarship)
 *
 * Each chunker produces { text, metadata } tuples that preserve
 * structural context lost during raw text splitting.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentChunk {
  /** The text content of this chunk */
  text: string;
  /** Zero-based index within the parent document */
  chunkIndex: number;
  /** Total chunks produced from the parent document */
  totalChunks?: number;
  /** Structural section this chunk belongs to */
  section?: string;
  /** Extra metadata extracted from the chunk position */
  metadata: Record<string, any>;
}



export interface ChunkerOptions {
  /** Target chunk size in tokens (default: 1200) */
  chunkSize?: number;
  /** Overlap between consecutive chunks in tokens (default: 200) */
  chunkOverlap?: number;
}

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_CHUNK_OVERLAP = 150;

// ---------------------------------------------------------------------------
// Shared Utilities
// ---------------------------------------------------------------------------

const logger = new Logger('LegalChunker');

/**
 * Splits text on legal-aware sentence boundaries.
 * Avoids splitting on abbreviations common in legal writing.
 */
function splitIntoSentences(text: string): string[] {
  const sentenceBoundary =
    /(?<!\b(?:[a-zA-Z]|vs?|supp|art|secs?|nos?|vol|ltd|co|corp|inc|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.)(?<=[.?!])\s+/i;
  return text
    .split(sentenceBoundary)
    .map((s) => s.trim())
    .filter(Boolean);
}

function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words * 1.3);
}

/**
 * Generic sliding-window chunker that operates on a list of sentences (token-based).
 */
function chunkBySentences(
  sentences: string[],
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  chunkOverlap: number = DEFAULT_CHUNK_OVERLAP,
): string[] {
  if (sentences.length === 0) return [];

  const chunks: string[] = [];
  let currentSentences: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);
    
    // Handle oversized sentences
    if (sentenceTokens > chunkSize) {
      if (currentSentences.length > 0) {
        chunks.push(currentSentences.join(' '));
        currentSentences = [];
        currentTokens = 0;
      }
      
      const words = sentence.split(/\s+/);
      let wordBuf: string[] = [];
      let wordTokens = 0;
      for (const w of words) {
        const wTokens = Math.ceil(w.length / 4) || 1;
        if (wordTokens + wTokens > chunkSize && wordBuf.length > 0) {
          chunks.push(wordBuf.join(' '));
          
          // Overlap
          const overlapBuf: string[] = [];
          let oTokens = 0;
          for (let i = wordBuf.length - 1; i >= 0; i--) {
            const tok = Math.ceil(wordBuf[i].length / 4) || 1;
            if (oTokens + tok <= chunkOverlap) {
              overlapBuf.unshift(wordBuf[i]);
              oTokens += tok;
            } else break;
          }
          wordBuf = [...overlapBuf, w];
          wordTokens = oTokens + wTokens;
        } else {
          wordBuf.push(w);
          wordTokens += wTokens;
        }
      }
      if (wordBuf.length > 0) {
        currentSentences = wordBuf;
        currentTokens = wordTokens;
      }
      continue;
    }

    if (currentTokens + sentenceTokens > chunkSize) {
      chunks.push(currentSentences.join(' '));

      // Overlap
      const overlapSentences: string[] = [];
      let overlapTokens = 0;
      for (let i = currentSentences.length - 1; i >= 0; i--) {
        const s = currentSentences[i];
        const sTok = estimateTokens(s);
        if (overlapTokens + sTok <= chunkOverlap) {
          overlapSentences.unshift(s);
          overlapTokens += sTok;
        } else break;
      }

      currentSentences = [...overlapSentences, sentence];
      currentTokens = overlapTokens + sentenceTokens;
    } else {
      currentSentences.push(sentence);
      currentTokens += sentenceTokens;
    }
  }

  if (currentSentences.length > 0) {
    chunks.push(currentSentences.join(' '));
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Judgment Chunker
// ---------------------------------------------------------------------------

/** Known structural sections in Indian court judgments. */
const JUDGMENT_SECTION_PATTERNS: { key: string; patterns: RegExp[] }[] = [
  {
    key: 'facts',
    patterns: [
      /^\s*(?:FACTS|FACTUAL\s+BACKGROUND|BRIEF\s+FACTS|THE\s+FACTS)/im,
      /^\s*(?:\d+\.\s+)?(?:The\s+)?facts\s+(?:of|in)\s+(?:the|this)\s+case/im,
    ],
  },
  {
    key: 'issues',
    patterns: [
      /^\s*(?:ISSUES?\s+(?:FOR\s+)?(?:CONSIDERATION|DETERMINATION|FRAMED))/im,
      /^\s*(?:QUESTIONS?\s+(?:OF\s+LAW|FOR\s+CONSIDERATION))/im,
    ],
  },
  {
    key: 'arguments_petitioner',
    patterns: [
      /^\s*(?:ARGUMENTS?\s+(?:OF|BY|ON\s+BEHALF\s+OF)\s+(?:THE\s+)?(?:PETITIONER|APPELLANT|PLAINTIFF))/im,
      /^\s*(?:SUBMISSIONS?\s+(?:OF|BY)\s+(?:THE\s+)?(?:PETITIONER|APPELLANT))/im,
    ],
  },
  {
    key: 'arguments_respondent',
    patterns: [
      /^\s*(?:ARGUMENTS?\s+(?:OF|BY|ON\s+BEHALF\s+OF)\s+(?:THE\s+)?(?:RESPONDENT|DEFENDANT))/im,
      /^\s*(?:SUBMISSIONS?\s+(?:OF|BY)\s+(?:THE\s+)?(?:RESPONDENT|DEFENDANT))/im,
    ],
  },
  {
    key: 'analysis',
    patterns: [
      /^\s*(?:ANALYSIS|DISCUSSION|REASONING|ANALYSIS\s+AND\s+DISCUSSION)/im,
      /^\s*(?:(?:THE\s+)?COURT'?S?\s+(?:ANALYSIS|REASONING|DISCUSSION))/im,
    ],
  },
  {
    key: 'ratio_decidendi',
    patterns: [
      /^\s*(?:RATIO\s+DECIDENDI|HOLDING|DECISION|CONCLUSION|FINDINGS?)/im,
    ],
  },
  {
    key: 'order',
    patterns: [
      /^\s*(?:ORDER|DIRECTIONS?|OPERATIVE\s+(?:PART|ORDER)|RESULT|DISPOSITION)/im,
    ],
  },
];

/**
 * Attempts to detect structural sections in a judgment text
 * and returns labelled segments.
 */
function detectJudgmentSections(
  text: string,
): { section: string; content: string }[] {
  const lines = text.split('\n');
  const segments: { section: string; startLine: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { key, patterns } of JUDGMENT_SECTION_PATTERNS) {
      if (patterns.some((p) => p.test(line))) {
        segments.push({ section: key, startLine: i });
        break;
      }
    }
  }

  if (segments.length === 0) {
    // No structure detected — treat entire document as a single section
    return [{ section: 'full_text', content: text }];
  }

  const result: { section: string; content: string }[] = [];
  for (let i = 0; i < segments.length; i++) {
    const start = segments[i].startLine;
    const end = i + 1 < segments.length ? segments[i + 1].startLine : lines.length;
    result.push({
      section: segments[i].section,
      content: lines.slice(start, end).join('\n').trim(),
    });
  }

  // Include any preamble before the first detected section
  if (segments[0].startLine > 0) {
    const preamble = lines.slice(0, segments[0].startLine).join('\n').trim();
    if (preamble.length > 50) {
      result.unshift({ section: 'preamble', content: preamble });
    }
  }

  return result;
}

export function chunkJudgment(
  text: string,
  opts: ChunkerOptions = {},
): DocumentChunk[] {
  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkOverlap = opts.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;

  if (!text || text.trim() === '') return [];

  const sections = detectJudgmentSections(text);
  const allChunks: DocumentChunk[] = [];

  for (const { section, content } of sections) {
    const sentences = splitIntoSentences(content);
    const textChunks = chunkBySentences(sentences, chunkSize, chunkOverlap);

    for (const chunk of textChunks) {
      allChunks.push({
        text: chunk,
        chunkIndex: allChunks.length,
        section,
        metadata: { section, document_type: 'judgment' },
      });
    }
  }

  // Backfill totalChunks
  for (const c of allChunks) c.totalChunks = allChunks.length;

  logger.debug(`JudgmentChunker: ${allChunks.length} chunks from ${sections.length} sections`);
  return allChunks;
}

// ---------------------------------------------------------------------------
// Bare Act Chunker
// ---------------------------------------------------------------------------

/**
 * Regex patterns to detect section / article boundaries in Indian statutes.
 * Matches patterns like:
 *   "Section 302.", "SECTION 302—", "Art. 21.", "Article 14 —"
 *   "302. Punishment for murder."
 */
const SECTION_BOUNDARY =
  /^(?:(?:Section|Sec\.|SECTION)\s+(\d+[A-Za-z]?)[\.\-—:]?\s*|(?:Article|Art\.)\s+(\d+[A-Za-z]?)[\.\-—:]?\s*|(\d+[A-Za-z]?)\.\s+)/m;

function detectActSections(text: string): { sectionId: string; content: string }[] {
  const lines = text.split('\n');
  const segments: { sectionId: string; startLine: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = SECTION_BOUNDARY.exec(lines[i]);
    if (match) {
      const sectionId = match[1] || match[2] || match[3];
      segments.push({ sectionId, startLine: i });
    }
  }

  if (segments.length === 0) {
    return [{ sectionId: 'full_text', content: text }];
  }

  const result: { sectionId: string; content: string }[] = [];

  // Preamble
  if (segments[0].startLine > 0) {
    const preamble = lines.slice(0, segments[0].startLine).join('\n').trim();
    if (preamble.length > 30) {
      result.push({ sectionId: 'preamble', content: preamble });
    }
  }

  for (let i = 0; i < segments.length; i++) {
    const start = segments[i].startLine;
    const end = i + 1 < segments.length ? segments[i + 1].startLine : lines.length;
    result.push({
      sectionId: segments[i].sectionId,
      content: lines.slice(start, end).join('\n').trim(),
    });
  }

  return result;
}

export function chunkBareAct(
  text: string,
  actName?: string,
  opts: ChunkerOptions = {},
): DocumentChunk[] {
  if (!text || text.trim() === '') return [];

  const sections = detectActSections(text);
  const allChunks: DocumentChunk[] = [];

  for (const { sectionId, content } of sections) {
    const isProvision = sectionId !== 'full_text' && sectionId !== 'preamble';
    const cleanAct = actName?.trim() || 'Bare Act';
    const isConstitution = /constitution/i.test(cleanAct);
    const docType = isConstitution ? 'Constitution' : 'Bare Act';
    const provisionLabel = isConstitution ? 'Article' : 'Section';

    const normalizedContent = content.replace(/\s+/g, ' ').trim();
    const formattedText = isProvision
      ? `Act:\n${cleanAct}\n\n${provisionLabel}:\n${sectionId}\n\nText:\n${normalizedContent}`
      : normalizedContent;

    allChunks.push({
      text: formattedText,
      chunkIndex: allChunks.length,
      section: sectionId,
      metadata: {
        act_name: cleanAct,
        act_short_name: cleanAct,
        section_number: isProvision ? sectionId : '',
        title: isProvision ? `${provisionLabel} ${sectionId}` : sectionId,
        chapter: '',
        content: normalizedContent,
        document_type: docType,
        year: undefined,
        jurisdiction: 'India',
      },
    });
  }

  for (const c of allChunks) c.totalChunks = allChunks.length;

  logger.debug(`BareActChunker: ${allChunks.length} chunks from ${sections.length} sections`);
  return allChunks;
}

// ---------------------------------------------------------------------------
// Research Paper Chunker
// ---------------------------------------------------------------------------

const PAPER_SECTION_PATTERNS: { key: string; pattern: RegExp }[] = [
  { key: 'abstract', pattern: /^\s*(?:ABSTRACT|Abstract)\s*$/m },
  { key: 'introduction', pattern: /^\s*(?:\d+[\.\)]\s*)?(?:INTRODUCTION|Introduction)\s*$/m },
  { key: 'literature_review', pattern: /^\s*(?:\d+[\.\)]\s*)?(?:LITERATURE\s+REVIEW|Literature\s+Review|REVIEW\s+OF\s+LITERATURE)/im },
  { key: 'methodology', pattern: /^\s*(?:\d+[\.\)]\s*)?(?:METHODOLOGY|RESEARCH\s+METHODOLOGY|Methodology|METHODS?)/im },
  { key: 'analysis', pattern: /^\s*(?:\d+[\.\)]\s*)?(?:ANALYSIS|FINDINGS?\s+AND\s+(?:ANALYSIS|DISCUSSION)|RESULTS?\s+AND\s+DISCUSSION)/im },
  { key: 'discussion', pattern: /^\s*(?:\d+[\.\)]\s*)?(?:DISCUSSION|Discussion)\s*$/m },
  { key: 'conclusion', pattern: /^\s*(?:\d+[\.\)]\s*)?(?:CONCLUSION|CONCLUSIONS?|SUMMARY\s+AND\s+CONCLUSION)/im },
  { key: 'references', pattern: /^\s*(?:REFERENCES|BIBLIOGRAPHY|WORKS?\s+CITED)/im },
];

function detectPaperSections(text: string): { section: string; content: string }[] {
  const lines = text.split('\n');
  const segments: { section: string; startLine: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    for (const { key, pattern } of PAPER_SECTION_PATTERNS) {
      if (pattern.test(lines[i])) {
        segments.push({ section: key, startLine: i });
        break;
      }
    }
  }

  if (segments.length === 0) {
    return [{ section: 'full_text', content: text }];
  }

  const result: { section: string; content: string }[] = [];

  if (segments[0].startLine > 0) {
    const header = lines.slice(0, segments[0].startLine).join('\n').trim();
    if (header.length > 30) {
      result.push({ section: 'header', content: header });
    }
  }

  for (let i = 0; i < segments.length; i++) {
    const start = segments[i].startLine;
    const end = i + 1 < segments.length ? segments[i + 1].startLine : lines.length;
    result.push({
      section: segments[i].section,
      content: lines.slice(start, end).join('\n').trim(),
    });
  }

  return result;
}

export function chunkResearchPaper(
  text: string,
  opts: ChunkerOptions = {},
): DocumentChunk[] {
  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkOverlap = opts.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;

  if (!text || text.trim() === '') return [];

  const sections = detectPaperSections(text);
  const allChunks: DocumentChunk[] = [];

  for (const { section, content } of sections) {
    // Skip references section from embedding — it's mostly citations
    if (section === 'references') {
      allChunks.push({
        text: content.substring(0, Math.min(content.length, chunkSize)),
        chunkIndex: allChunks.length,
        section,
        metadata: { section, document_type: 'paper', is_references: true },
      });
      continue;
    }

    const sentences = splitIntoSentences(content);
    const textChunks = chunkBySentences(sentences, chunkSize, chunkOverlap);

    for (const chunk of textChunks) {
      allChunks.push({
        text: chunk,
        chunkIndex: allChunks.length,
        section,
        metadata: { section, document_type: 'paper' },
      });
    }
  }

  for (const c of allChunks) c.totalChunks = allChunks.length;

  logger.debug(`ResearchPaperChunker: ${allChunks.length} chunks from ${sections.length} sections`);
  return allChunks;
}

// ---------------------------------------------------------------------------
// Generic / fallback chunker
// ---------------------------------------------------------------------------

export function chunkGeneric(
  text: string,
  documentType: string,
  opts: ChunkerOptions = {},
): DocumentChunk[] {
  const chunkSize = opts.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkOverlap = opts.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;

  if (!text || text.trim() === '') return [];

  const sentences = splitIntoSentences(text);
  const textChunks = chunkBySentences(sentences, chunkSize, chunkOverlap);

  return textChunks.map((chunk, idx) => ({
    text: chunk,
    chunkIndex: idx,
    totalChunks: textChunks.length,
    metadata: { document_type: documentType },
  }));
}
