export type LegalNodeType =
  | 'act'
  | 'part'
  | 'title'
  | 'chapter'
  | 'article'
  | 'section'
  | 'subsection'
  | 'clause'
  | 'subclause'
  | 'proviso'
  | 'explanation'
  | 'illustration'
  | 'exception'
  | 'schedule'
  | 'footnote'
  | 'amendment_note'
  | 'definition'
  | 'table'
  | 'body';

export interface LegalNode {
  type: LegalNodeType;
  number?: string;
  title?: string;
  content?: string;
  children?: LegalNode[];
}

export interface ProvisionMetadata {
  part?: string;
  titleLevel?: string;
  chapter?: string;
  article?: string;
  section?: string;
  subsection?: string;
  clause?: string;
  provisionType?: 'article' | 'section';
  title?: string;
  content: string;
}

export interface ParserValidationResult {
  totalParts: number;
  totalTitles: number;
  totalChapters: number;
  totalArticles: number;
  totalSections: number;
  totalSchedules: number;
  totalExplanations: number;
  totalIllustrations: number;
  /** Sections/articles found inside schedule nodes (not counted in totalSections/totalArticles). */
  totalScheduleItems: number;
  duplicateProvisions: string[];
  orphanClauses: number;
  orphanExplanations: number;
  brokenHierarchy: string[];
}

export interface LegalDocumentMeta {
  actName: string;
  category: string;
  year?: number;
  officialName?: string;
  totalParts: number;
  totalTitles: number;
  totalChapters: number;
  totalArticles: number;
  totalSections: number;
  totalSchedules: number;
  totalExplanations: number;
  totalIllustrations: number;
  duplicates: number;
  orphanClauses: number;
  orphanExplanations: number;
  brokenHierarchy: number;
}

export interface LegalDocumentResult {
  meta: LegalDocumentMeta;
  structure: LegalNode[];
  validation: ParserValidationResult;
}

interface ParserState {
  root: LegalNode[];
  currentPart: LegalNode | null;
  currentTitle: LegalNode | null;
  currentChapter: LegalNode | null;
  currentProvision: LegalNode | null;
  currentSubsection: LegalNode | null;
  currentClause: LegalNode | null;
  currentSubclause: LegalNode | null;
  currentAttachment: LegalNode | null;
  currentSchedule: LegalNode | null;
  provisionIndex: Map<string, LegalNode>;
  inActualAct: boolean;
  /** Running count of consecutive TOC-looking lines; used to skip TOC blocks mid-document. */
  tocRunCount: number;
}

const DASH = String.raw`(?:-|--|—|–)`;
const ROMAN_OR_NUM = String.raw`[IVXLCDM]+|\d+[A-Z]?`;

function emptyState(): ParserState {
  return {
    root: [],
    currentPart: null,
    currentTitle: null,
    currentChapter: null,
    currentProvision: null,
    currentSubsection: null,
    currentClause: null,
    currentSubclause: null,
    currentAttachment: null,
    currentSchedule: null,
    provisionIndex: new Map<string, LegalNode>(),
    inActualAct: false,
    tocRunCount: 0,
  };
}

function normalizeLine(line: string): string {
  return line
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

function ensureChildren(node: LegalNode): LegalNode[] {
  if (!node.children) node.children = [];
  return node.children;
}

function appendContent(node: LegalNode, line: string): void {
  node.content = node.content ? `${node.content}\n${line}` : line;
}

function pushToCurrentContainer(state: ParserState, node: LegalNode): void {
  const parent = state.currentSchedule || state.currentChapter || state.currentTitle || state.currentPart;
  if (parent) ensureChildren(parent).push(node);
  else state.root.push(node);
}

function resetBelowPart(state: ParserState): void {
  state.currentTitle = null;
  state.currentChapter = null;
  resetBelowChapter(state);
}

function resetBelowTitle(state: ParserState): void {
  state.currentChapter = null;
  resetBelowChapter(state);
}

function resetBelowChapter(state: ParserState): void {
  state.currentProvision = null;
  state.currentSubsection = null;
  state.currentClause = null;
  state.currentSubclause = null;
  state.currentAttachment = null;
}

function resetProvisionChildren(state: ParserState): void {
  state.currentSubsection = null;
  state.currentClause = null;
  state.currentSubclause = null;
  state.currentAttachment = null;
}

/**
 * Returns true for obvious table-of-contents header lines that appear before the act body.
 */
function isLikelyTocLine(line: string): boolean {
  return /^(?:ARRANGEMENT OF|CONTENTS|SECTIONS?|ARTICLES?)$/i.test(line) ||
    /^Last Updated\s*:/i.test(line) ||
    /^={3,}$/.test(line) ||
    /^_{3,}$/.test(line) ||
    /^-{3,}$/.test(line);
}

/**
 * Returns true for lines that are clearly TOC entries — section/article title followed
 * immediately by a trailing page number with no legal content markers.
 * Only applied AFTER we enter the act body (inActualAct == true) as a secondary guard
 * for PDFs whose TOC appears after the enacting formula.
 */
function isLikelyTocEntry(line: string): boolean {
  // Must NOT contain any actual legal content markers
  if (/[—–]/.test(line)) return false;
  if (/\bProvided\b|\bExplanation\b|\bIllustration\b/i.test(line)) return false;
  // Pattern: "N. Title text   <page-number>" or "N Title text   <page-number>"
  const m = line.match(/^(\d{1,4}[A-Z]?(?:-[A-Z])?)\.\s+(.{4,90})\s{2,}(\d{1,4})$/);
  if (!m) return false;
  const rest = m[2].trim();
  // Should not look like a section body (no parentheses opening content, no period-space-capital)
  if (/^\(/.test(rest)) return false;
  if (/\.\s+[A-Z]/.test(rest) && rest.length > 40) return false;
  return true;
}

/**
 * Returns true if a matched section number + rest looks like an [Omitted] or [Repealed]
 * provision — still a valid structural node but empty content.
 */
function isOmittedProvision(rest: string): boolean {
  return /^\[(?:Omitted|Repealed|Rep\.|Deleted)\b/i.test(rest.trim());
}

function isContinuationOfPreviousProvision(current: RegExpMatchArray, previous: LegalNode | null): boolean {
  if (!previous?.number) return false;
  const currentNumber = current[1];
  const currentRest = current[2] || '';
  if (currentNumber !== previous.number) return false;
  return currentRest.length < 80 && !new RegExp(DASH).test(currentRest);
}

function splitHeadingAndContent(rest: string): { title: string; content: string } {
  const clean = normalizeLine(rest);
  if (!clean) return { title: '', content: '' };

  // Dash separators: em-dash, en-dash, double-hyphen used in Indian statutes
  const dashMatch = clean.match(new RegExp(`^(.*?)\\s*${DASH}\\s*(.*)$`));
  if (dashMatch) {
    return { title: dashMatch[1].trim(), content: dashMatch[2].trim() };
  }

  // Period-then-space-then-capital (e.g. "Short title. This Act...")
  const dotIdx = clean.indexOf('.');
  if (dotIdx > 0 && dotIdx < 140) {
    return {
      title: clean.substring(0, dotIdx).trim(),
      content: clean.substring(dotIdx + 1).trim(),
    };
  }

  return { title: '', content: clean };
}

function nearestProvisionParent(state: ParserState): LegalNode | null {
  return state.currentSubclause ||
    state.currentClause ||
    state.currentSubsection ||
    state.currentProvision;
}

function lineStartsNewContainer(line: string): boolean {
  return new RegExp(`^(?:PART|TITLE|CHAPTER)\\s+(${ROMAN_OR_NUM})\\b`, 'i').test(line) ||
    /^(?:THE\s+)?(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|\d+|[IVXLCDM]+)?\s*SCHEDULE\b/i.test(line);
}

// ─── Section number guard ─────────────────────────────────────────────────────
// Words that, when a "section" number starts a line, indicate it's NOT a section
// (e.g. footnote reference, regulatory note, editorial marker).
const SECTION_NUM_EXCLUSIONS = /^(?:No|Act|Reg|Pt|Rule|Order|Form|App|Annex)\b/i;
const SECTION_REST_EXCLUSIONS = /^(?:Subs\.|Ins\.|Omitted|Rep\.|The words|For the|See|Vide)\b/i;

export function parseLegalStructure(lines: string[]): LegalNode[] {
  const state = emptyState();
  const partRegex = new RegExp(`^PART\\s+(${ROMAN_OR_NUM})(?:\\s*${DASH}\\s*(.*))?$`, 'i');
  const titleRegex = new RegExp(`^TITLE\\s+(${ROMAN_OR_NUM})(?:\\s*${DASH}\\s*(.*))?$`, 'i');
  const chapterRegex = new RegExp(`^CHAPTER\\s+(${ROMAN_OR_NUM})(?:\\s*${DASH}\\s*(.*))?$`, 'i');
  const articleRegex = new RegExp(`^(?:Article|Art\\.)\\s+(\\d+[A-Z]?)\\.?\\s*(.*)$`, 'i');
  const sectionRegex = /^(\d+[A-Z]?(?:-[A-Z])?)\.?\s+(.*)$/;
  const subsectionRegex = /^\((\d+[A-Z]?)\)\s*(.*)$/;
  const clauseRegex = /^\(([a-z]{1,3})\)\s*(.*)$/;
  const subclauseRegex = /^\(([ivxlcdm]+)\)\s*(.*)$/i;
  const provisoRegex = /^(Provided(?:\s+(?:further|also))?\s+that\b.*)$/i;
  const explanationRegex = /^(Explanation(?:\s+\d+| [IVXLCDM]+)?\.?)\s*(?:-|--|—|–|\.|:)?\s*(.*)$/i;
  const illustrationRegex = /^(Illustrations?|Illustration\s+[A-Z]?)\.?\s*(?:-|--|—|–|:)?\s*(.*)$/i;
  const exceptionRegex = /^(Exception(?:\s+\d+)?)\.?\s*(?:-|--|—|–|:)?\s*(.*)$/i;
  const footnoteRegex = /^(\d+)\.\s+((?:Subs\.|Ins\.|Omitted|Rep\.|The words|For the|See|Vide)\b.*)$/i;
  const amendmentRegex = /^(\[(?:Subs\.|Ins\.|Omitted|Rep\.|Repealed|Amendment|Deleted).*?\].*)$/i;
  const definitionLeadRegex = /^In this (?:Act|Code|Part|Chapter|section), unless the context otherwise requires/i;
  const tableLeadRegex = /^(?:Table|THE TABLE)\b/i;
  const scheduleRegex = /^(?:(THE)\s+)?(?:(FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|\d+|[IVXLCDM]+)\s+)?SCHEDULE(?:\s*[-—–]\s*(.*))?$/i;

  const enactingRegex = /be it enacted|enacted by parliament|enacted as follows|it is enacted|hereby enacted|it is hereby enacted/i;
  const constitutionStartRegex = /WE,?\s+THE\s+PEOPLE|IN OUR CONSTITUENT ASSEMBLY|solemnly\s+resolved\s+to\s+constitute/i;
  const isConstitutionText = lines.slice(0, 120).some((line) => /CONSTITUTION OF INDIA/i.test(line));

  for (let i = 0; i < lines.length; i++) {
    const line = normalizeLine(lines[i]);
    if (!line || isLikelyTocLine(line)) continue;

    // ── Pre-body: skip until we find the operative start ────────────────────
    if (!state.inActualAct) {
      const operativeShortTitle = /^1\.\s*\(?1\)?\s+This Act may be called/i.test(line);
      const startsBody =
        enactingRegex.test(line) ||
        (isConstitutionText && constitutionStartRegex.test(line)) ||
        operativeShortTitle;
      if (!startsBody) continue;
      state.inActualAct = true;
      state.root = [];
      if (!operativeShortTitle) {
        state.root.push({ type: 'body', content: line });
        continue;
      }
    }

    // ── Secondary TOC guard: skip stray TOC entries inside the body ─────────
    if (isLikelyTocEntry(line)) {
      state.tocRunCount++;
      continue;
    }
    state.tocRunCount = 0;

    // ── Structural containers ────────────────────────────────────────────────

    let match = line.match(partRegex);
    if (match) {
      const node: LegalNode = { type: 'part', number: match[1], title: match[2] || '', children: [] };
      if (!node.title && i + 1 < lines.length && !lineStartsNewContainer(normalizeLine(lines[i + 1]))) {
        node.title = normalizeLine(lines[++i]);
      }
      state.root.push(node);
      state.currentPart = node;
      state.currentSchedule = null;
      resetBelowPart(state);
      continue;
    }

    match = line.match(titleRegex);
    if (match) {
      const node: LegalNode = { type: 'title', number: match[1], title: match[2] || '', children: [] };
      if (!node.title && i + 1 < lines.length && !lineStartsNewContainer(normalizeLine(lines[i + 1]))) {
        node.title = normalizeLine(lines[++i]);
      }
      (state.currentPart ? ensureChildren(state.currentPart) : state.root).push(node);
      state.currentTitle = node;
      state.currentSchedule = null;
      resetBelowTitle(state);
      continue;
    }

    match = line.match(chapterRegex);
    if (match) {
      const node: LegalNode = { type: 'chapter', number: match[1], title: match[2] || '', children: [] };
      if (!node.title && i + 1 < lines.length && !lineStartsNewContainer(normalizeLine(lines[i + 1]))) {
        node.title = normalizeLine(lines[++i]);
      }
      const parent = state.currentTitle || state.currentPart;
      (parent ? ensureChildren(parent) : state.root).push(node);
      state.currentChapter = node;
      state.currentSchedule = null;
      resetBelowChapter(state);
      continue;
    }

    match = line.match(scheduleRegex);
    if (match) {
      const node: LegalNode = { type: 'schedule', number: match[2] || '', title: match[3] || '', children: [] };
      // Peek next line for schedule title if missing
      if (!node.title && i + 1 < lines.length) {
        const peek = normalizeLine(lines[i + 1]);
        if (peek && !lineStartsNewContainer(peek) && !/^\d/.test(peek)) {
          node.title = peek;
          i++;
        }
      }
      state.root.push(node);
      state.currentSchedule = node;
      state.currentPart = null;
      resetBelowPart(state);
      continue;
    }

    // ── Article (explicit keyword form) ─────────────────────────────────────
    match = line.match(articleRegex);
    if (match) {
      if (isContinuationOfPreviousProvision(match, state.currentProvision)) {
        appendContent(state.currentProvision!, line);
        continue;
      }
      const split = splitHeadingAndContent(match[2] || '');
      const node: LegalNode = {
        type: 'article',
        number: match[1],
        title: split.title,
        content: split.content,
        children: [],
      };
      const key = `article:${node.number}`;
      const existing = state.provisionIndex.get(key);
      if (existing) {
        appendContent(existing, line);
        state.currentProvision = existing;
        resetProvisionChildren(state);
        continue;
      }
      state.provisionIndex.set(key, node);
      pushToCurrentContainer(state, node);
      state.currentProvision = node;
      resetProvisionChildren(state);
      continue;
    }

    // ── Section / Article (numeric form) ────────────────────────────────────
    match = line.match(sectionRegex);
    if (
      match &&
      !SECTION_NUM_EXCLUSIONS.test(match[1]) &&
      !SECTION_REST_EXCLUSIONS.test(match[2] || '')
    ) {
      const omitted = isOmittedProvision(match[2] || '');

      if (!omitted && isContinuationOfPreviousProvision(match, state.currentProvision)) {
        appendContent(state.currentProvision!, line);
        continue;
      }

      const split = splitHeadingAndContent(match[2] || '');
      const provType = isConstitutionText ? 'article' : 'section';
      const node: LegalNode = {
        type: provType,
        number: match[1],
        title: split.title,
        content: omitted ? (match[2] || '').trim() : split.content,
        children: [],
      };
      const key = `${provType}:${node.number}`;

      // Only deduplicate against the provision index when we are NOT inside a schedule.
      // Schedule-internal rules often share numbers with main-body sections (e.g. Rule 1, Rule 2).
      const inSchedule = state.currentSchedule !== null;
      const existing = inSchedule ? null : state.provisionIndex.get(key);
      if (existing) {
        if (!omitted) appendContent(existing, line);
        state.currentProvision = existing;
        resetProvisionChildren(state);
        continue;
      }
      if (!inSchedule) state.provisionIndex.set(key, node);
      pushToCurrentContainer(state, node);
      state.currentProvision = node;
      resetProvisionChildren(state);
      continue;
    }

    // ── Subsection ───────────────────────────────────────────────────────────
    match = line.match(subsectionRegex);
    if (match && state.currentProvision) {
      const node: LegalNode = { type: 'subsection', number: match[1], content: match[2] || '', children: [] };
      ensureChildren(state.currentProvision).push(node);
      state.currentSubsection = node;
      state.currentClause = null;
      state.currentSubclause = null;
      state.currentAttachment = null;
      continue;
    }

    // ── Clause (lowercase letter) ────────────────────────────────────────────
    match = line.match(clauseRegex);
    if (match && state.currentProvision) {
      const parent = state.currentSubsection || state.currentProvision;
      const node: LegalNode = { type: 'clause', number: match[1], content: match[2] || '', children: [] };
      ensureChildren(parent).push(node);
      state.currentClause = node;
      state.currentSubclause = null;
      state.currentAttachment = null;
      continue;
    }

    // ── Sub-clause (roman numeral in parens) — only when inside a clause ────
    match = line.match(subclauseRegex);
    if (match && state.currentProvision && state.currentClause) {
      const node: LegalNode = { type: 'subclause', number: match[1], content: match[2] || '', children: [] };
      ensureChildren(state.currentClause).push(node);
      state.currentSubclause = node;
      state.currentAttachment = null;
      continue;
    }

    // ── Proviso ──────────────────────────────────────────────────────────────
    match = line.match(provisoRegex);
    if (match && state.currentProvision) {
      const node: LegalNode = { type: 'proviso', content: match[1], children: [] };
      ensureChildren(nearestProvisionParent(state)!).push(node);
      state.currentAttachment = node;
      continue;
    }

    // ── Explanation ──────────────────────────────────────────────────────────
    match = line.match(explanationRegex);
    if (match && state.currentProvision) {
      const node: LegalNode = { type: 'explanation', number: match[1], content: match[2] || '', children: [] };
      ensureChildren(state.currentProvision).push(node);
      state.currentAttachment = node;
      state.currentSubsection = null;
      state.currentClause = null;
      state.currentSubclause = null;
      continue;
    }

    // ── Illustration ─────────────────────────────────────────────────────────
    match = line.match(illustrationRegex);
    if (match && state.currentProvision) {
      const node: LegalNode = { type: 'illustration', number: match[1], content: match[2] || '', children: [] };
      ensureChildren(state.currentProvision).push(node);
      state.currentAttachment = node;
      continue;
    }

    // ── Exception ────────────────────────────────────────────────────────────
    match = line.match(exceptionRegex);
    if (match && state.currentProvision) {
      const node: LegalNode = { type: 'exception', number: match[1], content: match[2] || '', children: [] };
      ensureChildren(state.currentProvision).push(node);
      state.currentAttachment = node;
      continue;
    }

    // ── Footnote ─────────────────────────────────────────────────────────────
    match = line.match(footnoteRegex);
    if (match && state.currentProvision) {
      const node: LegalNode = { type: 'footnote', number: match[1], content: match[2] };
      ensureChildren(state.currentProvision).push(node);
      state.currentAttachment = node;
      continue;
    }

    // ── Amendment note ───────────────────────────────────────────────────────
    match = line.match(amendmentRegex);
    if (match && state.currentProvision) {
      const node: LegalNode = { type: 'amendment_note', content: match[1] };
      ensureChildren(state.currentProvision).push(node);
      state.currentAttachment = node;
      continue;
    }

    // ── Definition block ─────────────────────────────────────────────────────
    if (definitionLeadRegex.test(line) && state.currentProvision) {
      const node: LegalNode = { type: 'definition', content: line, children: [] };
      ensureChildren(state.currentProvision).push(node);
      state.currentAttachment = node;
      continue;
    }

    // ── Table ────────────────────────────────────────────────────────────────
    if (tableLeadRegex.test(line) && state.currentProvision) {
      const node: LegalNode = { type: 'table', content: line, children: [] };
      ensureChildren(state.currentProvision).push(node);
      state.currentAttachment = node;
      continue;
    }

    // ── Continuation / free text ─────────────────────────────────────────────
    const target =
      state.currentAttachment ||
      state.currentSubclause ||
      state.currentClause ||
      state.currentSubsection ||
      state.currentProvision ||
      state.currentSchedule ||
      state.currentChapter ||
      state.currentTitle ||
      state.currentPart;
    if (target) appendContent(target, line);
    else state.root.push({ type: 'body', content: line });
  }

  return state.root;
}

// ─── Renderer ────────────────────────────────────────────────────────────────

function renderNode(node: LegalNode, depth = 0): string {
  const label =
    node.type === 'section' ? `Section ${node.number}` :
    node.type === 'article' ? `Article ${node.number}` :
    node.type === 'subsection' ? `(${node.number})` :
    node.type === 'clause' ? `(${node.number})` :
    node.type === 'subclause' ? `(${node.number})` :
    node.type === 'explanation' ? node.number || 'Explanation' :
    node.type === 'illustration' ? node.number || 'Illustration' :
    node.type === 'proviso' ? 'Proviso' :
    node.type === 'exception' ? node.number || 'Exception' :
    node.type === 'footnote' ? `Footnote ${node.number || ''}`.trim() :
    node.type === 'amendment_note' ? 'Amendment Note' :
    node.type === 'definition' ? 'Definition' :
    node.type === 'table' ? 'Table' :
    '';
  const heading = [label, node.title].filter(Boolean).join(' - ');
  const own = [heading, node.content].filter(Boolean).join('\n').trim();
  const childText = (node.children || []).map((child) => renderNode(child, depth + 1)).filter(Boolean).join('\n');
  return [own, childText].filter(Boolean).join('\n').trim();
}

// ─── Provision flattener ──────────────────────────────────────────────────────

export function flattenProvisions(nodes: LegalNode[], context: ProvisionMetadata = { content: '' }): ProvisionMetadata[] {
  const provisions: ProvisionMetadata[] = [];
  for (const node of nodes) {
    if (node.type === 'part') {
      provisions.push(...flattenProvisions(node.children || [], { ...context, part: node.number }));
      continue;
    }
    if (node.type === 'title') {
      provisions.push(...flattenProvisions(node.children || [], { ...context, titleLevel: node.number }));
      continue;
    }
    if (node.type === 'chapter') {
      provisions.push(...flattenProvisions(node.children || [], { ...context, chapter: node.number }));
      continue;
    }
    if (node.type === 'schedule') {
      provisions.push({
        ...context,
        part: context.part || `SCHEDULE ${node.number || ''}`.trim(),
        title: node.title || `Schedule ${node.number || ''}`.trim(),
        content: renderNode(node),
      });
      continue;
    }
    if (node.type === 'section' || node.type === 'article') {
      const key = node.type === 'article'
        ? { article: node.number, provisionType: 'article' as const }
        : { section: node.number, provisionType: 'section' as const };
      provisions.push({
        ...context,
        ...key,
        title: node.title || '',
        content: renderNode(node),
      });
    }
  }
  return provisions.filter((p) => p.content.trim().length > 0);
}

// ─── Structural validator ────────────────────────────────────────────────────

export function validateLegalStructure(nodes: LegalNode[]): ParserValidationResult {
  const result: ParserValidationResult = {
    totalParts: 0,
    totalTitles: 0,
    totalChapters: 0,
    totalArticles: 0,
    totalSections: 0,
    totalSchedules: 0,
    totalExplanations: 0,
    totalIllustrations: 0,
    totalScheduleItems: 0,
    duplicateProvisions: [],
    orphanClauses: 0,
    orphanExplanations: 0,
    brokenHierarchy: [],
  };
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  function walk(list: LegalNode[], ancestors: LegalNode[]): void {
    const inSchedule = ancestors.some((a) => a.type === 'schedule');

    for (const node of list) {
      if (node.type === 'part') result.totalParts++;
      if (node.type === 'title') result.totalTitles++;
      if (node.type === 'chapter') result.totalChapters++;
      if (node.type === 'schedule') result.totalSchedules++;
      if (node.type === 'explanation') result.totalExplanations++;
      if (node.type === 'illustration') result.totalIllustrations++;

      if (node.type === 'article') {
        if (inSchedule) result.totalScheduleItems++;
        else result.totalArticles++;
      }
      if (node.type === 'section') {
        if (inSchedule) result.totalScheduleItems++;
        else result.totalSections++;
      }

      if ((node.type === 'section' || node.type === 'article') && !inSchedule) {
        const key = `${node.type}:${node.number}`;
        if (seen.has(key)) duplicates.add(key);
        seen.add(key);
      }

      const hasProvisionAncestor = ancestors.some((a) => a.type === 'section' || a.type === 'article');
      if ((node.type === 'clause' || node.type === 'subclause') && !hasProvisionAncestor) {
        result.orphanClauses++;
      }
      if (node.type === 'explanation' && !hasProvisionAncestor) {
        result.orphanExplanations++;
      }
      if ((node.type === 'subsection' || node.type === 'clause' || node.type === 'subclause') && !hasProvisionAncestor) {
        result.brokenHierarchy.push(`${node.type}:${node.number || ''}`);
      }

      walk(node.children || [], [...ancestors, node]);
    }
  }

  walk(nodes, []);
  result.duplicateProvisions = [...duplicates].sort();
  return result;
}

// ─── High-level document parser ──────────────────────────────────────────────

/**
 * Parse a full legal document and return the tree, validation summary, and
 * per-document metadata in one call. Prefer this over calling parseLegalStructure
 * directly when you also need the counts (e.g. for writing parsed-sections.json).
 */
export function parseLegalDocument(
  lines: string[],
  actName: string,
  category: string,
  officialName?: string,
): LegalDocumentResult {
  const structure = parseLegalStructure(lines);
  const validation = validateLegalStructure(structure);
  const yearMatch = actName.match(/\b(18|19|20)\d{2}\b/) ||
    (officialName || '').match(/\b(18|19|20)\d{2}\b/);
  const meta: LegalDocumentMeta = {
    actName,
    category,
    year: yearMatch ? parseInt(yearMatch[0], 10) : undefined,
    officialName,
    totalParts: validation.totalParts,
    totalTitles: validation.totalTitles,
    totalChapters: validation.totalChapters,
    totalArticles: validation.totalArticles,
    totalSections: validation.totalSections,
    totalSchedules: validation.totalSchedules,
    totalExplanations: validation.totalExplanations,
    totalIllustrations: validation.totalIllustrations,
    duplicates: validation.duplicateProvisions.length,
    orphanClauses: validation.orphanClauses,
    orphanExplanations: validation.orphanExplanations,
    brokenHierarchy: validation.brokenHierarchy.length,
  };
  return { meta, structure, validation };
}
