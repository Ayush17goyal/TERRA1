"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseLegalStructure = parseLegalStructure;
exports.flattenProvisions = flattenProvisions;
exports.validateLegalStructure = validateLegalStructure;
exports.parseLegalDocument = parseLegalDocument;
const DASH = String.raw `(?:-|--|—|–)`;
const ROMAN_OR_NUM = String.raw `[IVXLCDM]+|\d+[A-Z]?`;
function emptyState() {
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
        provisionIndex: new Map(),
        inActualAct: false,
        tocRunCount: 0,
    };
}
function normalizeLine(line) {
    return line
        .replace(/ /g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\s+([,.;:])/g, '$1')
        .trim();
}
function ensureChildren(node) {
    if (!node.children)
        node.children = [];
    return node.children;
}
function appendContent(node, line) {
    node.content = node.content ? `${node.content}\n${line}` : line;
}
function pushToCurrentContainer(state, node) {
    const parent = state.currentSchedule || state.currentChapter || state.currentTitle || state.currentPart;
    if (parent)
        ensureChildren(parent).push(node);
    else
        state.root.push(node);
}
function resetBelowPart(state) {
    state.currentTitle = null;
    state.currentChapter = null;
    resetBelowChapter(state);
}
function resetBelowTitle(state) {
    state.currentChapter = null;
    resetBelowChapter(state);
}
function resetBelowChapter(state) {
    state.currentProvision = null;
    state.currentSubsection = null;
    state.currentClause = null;
    state.currentSubclause = null;
    state.currentAttachment = null;
}
function resetProvisionChildren(state) {
    state.currentSubsection = null;
    state.currentClause = null;
    state.currentSubclause = null;
    state.currentAttachment = null;
}
function isLikelyTocLine(line) {
    return /^(?:ARRANGEMENT OF|CONTENTS|SECTIONS?|ARTICLES?)$/i.test(line) ||
        /^Last Updated\s*:/i.test(line) ||
        /^={3,}$/.test(line) ||
        /^_{3,}$/.test(line) ||
        /^-{3,}$/.test(line);
}
function isLikelyTocEntry(line) {
    if (/[—–]/.test(line))
        return false;
    if (/\bProvided\b|\bExplanation\b|\bIllustration\b/i.test(line))
        return false;
    const m = line.match(/^(\d{1,4}[A-Z]?(?:-[A-Z])?)\.\s+(.{4,90})\s{2,}(\d{1,4})$/);
    if (!m)
        return false;
    const rest = m[2].trim();
    if (/^\(/.test(rest))
        return false;
    if (/\.\s+[A-Z]/.test(rest) && rest.length > 40)
        return false;
    return true;
}
function isOmittedProvision(rest) {
    return /^\[(?:Omitted|Repealed|Rep\.|Deleted)\b/i.test(rest.trim());
}
function isContinuationOfPreviousProvision(current, previous) {
    if (!previous?.number)
        return false;
    const currentNumber = current[1];
    const currentRest = current[2] || '';
    if (currentNumber !== previous.number)
        return false;
    return currentRest.length < 80 && !new RegExp(DASH).test(currentRest);
}
function splitHeadingAndContent(rest) {
    const clean = normalizeLine(rest);
    if (!clean)
        return { title: '', content: '' };
    const dashMatch = clean.match(new RegExp(`^(.*?)\\s*${DASH}\\s*(.*)$`));
    if (dashMatch) {
        return { title: dashMatch[1].trim(), content: dashMatch[2].trim() };
    }
    const dotIdx = clean.indexOf('.');
    if (dotIdx > 0 && dotIdx < 140) {
        return {
            title: clean.substring(0, dotIdx).trim(),
            content: clean.substring(dotIdx + 1).trim(),
        };
    }
    return { title: '', content: clean };
}
function nearestProvisionParent(state) {
    return state.currentSubclause ||
        state.currentClause ||
        state.currentSubsection ||
        state.currentProvision;
}
function lineStartsNewContainer(line) {
    return new RegExp(`^(?:PART|TITLE|CHAPTER)\\s+(${ROMAN_OR_NUM})\\b`, 'i').test(line) ||
        /^(?:THE\s+)?(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|\d+|[IVXLCDM]+)?\s*SCHEDULE\b/i.test(line);
}
const SECTION_NUM_EXCLUSIONS = /^(?:No|Act|Reg|Pt|Rule|Order|Form|App|Annex)\b/i;
const SECTION_REST_EXCLUSIONS = /^(?:Subs\.|Ins\.|Omitted|Rep\.|The words|For the|See|Vide)\b/i;
function parseLegalStructure(lines) {
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
        if (!line || isLikelyTocLine(line))
            continue;
        if (!state.inActualAct) {
            const operativeShortTitle = /^1\.\s*\(?1\)?\s+This Act may be called/i.test(line);
            const startsBody = enactingRegex.test(line) ||
                (isConstitutionText && constitutionStartRegex.test(line)) ||
                operativeShortTitle;
            if (!startsBody)
                continue;
            state.inActualAct = true;
            state.root = [];
            if (!operativeShortTitle) {
                state.root.push({ type: 'body', content: line });
                continue;
            }
        }
        if (isLikelyTocEntry(line)) {
            state.tocRunCount++;
            continue;
        }
        state.tocRunCount = 0;
        let match = line.match(partRegex);
        if (match) {
            const node = { type: 'part', number: match[1], title: match[2] || '', children: [] };
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
            const node = { type: 'title', number: match[1], title: match[2] || '', children: [] };
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
            const node = { type: 'chapter', number: match[1], title: match[2] || '', children: [] };
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
            const node = { type: 'schedule', number: match[2] || '', title: match[3] || '', children: [] };
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
        match = line.match(articleRegex);
        if (match) {
            if (isContinuationOfPreviousProvision(match, state.currentProvision)) {
                appendContent(state.currentProvision, line);
                continue;
            }
            const split = splitHeadingAndContent(match[2] || '');
            const node = {
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
        match = line.match(sectionRegex);
        if (match &&
            !SECTION_NUM_EXCLUSIONS.test(match[1]) &&
            !SECTION_REST_EXCLUSIONS.test(match[2] || '')) {
            const omitted = isOmittedProvision(match[2] || '');
            if (!omitted && isContinuationOfPreviousProvision(match, state.currentProvision)) {
                appendContent(state.currentProvision, line);
                continue;
            }
            const split = splitHeadingAndContent(match[2] || '');
            const provType = isConstitutionText ? 'article' : 'section';
            const node = {
                type: provType,
                number: match[1],
                title: split.title,
                content: omitted ? (match[2] || '').trim() : split.content,
                children: [],
            };
            const key = `${provType}:${node.number}`;
            const inSchedule = state.currentSchedule !== null;
            const existing = inSchedule ? null : state.provisionIndex.get(key);
            if (existing) {
                if (!omitted)
                    appendContent(existing, line);
                state.currentProvision = existing;
                resetProvisionChildren(state);
                continue;
            }
            if (!inSchedule)
                state.provisionIndex.set(key, node);
            pushToCurrentContainer(state, node);
            state.currentProvision = node;
            resetProvisionChildren(state);
            continue;
        }
        match = line.match(subsectionRegex);
        if (match && state.currentProvision) {
            const node = { type: 'subsection', number: match[1], content: match[2] || '', children: [] };
            ensureChildren(state.currentProvision).push(node);
            state.currentSubsection = node;
            state.currentClause = null;
            state.currentSubclause = null;
            state.currentAttachment = null;
            continue;
        }
        match = line.match(clauseRegex);
        if (match && state.currentProvision) {
            const parent = state.currentSubsection || state.currentProvision;
            const node = { type: 'clause', number: match[1], content: match[2] || '', children: [] };
            ensureChildren(parent).push(node);
            state.currentClause = node;
            state.currentSubclause = null;
            state.currentAttachment = null;
            continue;
        }
        match = line.match(subclauseRegex);
        if (match && state.currentProvision && state.currentClause) {
            const node = { type: 'subclause', number: match[1], content: match[2] || '', children: [] };
            ensureChildren(state.currentClause).push(node);
            state.currentSubclause = node;
            state.currentAttachment = null;
            continue;
        }
        match = line.match(provisoRegex);
        if (match && state.currentProvision) {
            const node = { type: 'proviso', content: match[1], children: [] };
            ensureChildren(nearestProvisionParent(state)).push(node);
            state.currentAttachment = node;
            continue;
        }
        match = line.match(explanationRegex);
        if (match && state.currentProvision) {
            const node = { type: 'explanation', number: match[1], content: match[2] || '', children: [] };
            ensureChildren(state.currentProvision).push(node);
            state.currentAttachment = node;
            state.currentSubsection = null;
            state.currentClause = null;
            state.currentSubclause = null;
            continue;
        }
        match = line.match(illustrationRegex);
        if (match && state.currentProvision) {
            const node = { type: 'illustration', number: match[1], content: match[2] || '', children: [] };
            ensureChildren(state.currentProvision).push(node);
            state.currentAttachment = node;
            continue;
        }
        match = line.match(exceptionRegex);
        if (match && state.currentProvision) {
            const node = { type: 'exception', number: match[1], content: match[2] || '', children: [] };
            ensureChildren(state.currentProvision).push(node);
            state.currentAttachment = node;
            continue;
        }
        match = line.match(footnoteRegex);
        if (match && state.currentProvision) {
            const node = { type: 'footnote', number: match[1], content: match[2] };
            ensureChildren(state.currentProvision).push(node);
            state.currentAttachment = node;
            continue;
        }
        match = line.match(amendmentRegex);
        if (match && state.currentProvision) {
            const node = { type: 'amendment_note', content: match[1] };
            ensureChildren(state.currentProvision).push(node);
            state.currentAttachment = node;
            continue;
        }
        if (definitionLeadRegex.test(line) && state.currentProvision) {
            const node = { type: 'definition', content: line, children: [] };
            ensureChildren(state.currentProvision).push(node);
            state.currentAttachment = node;
            continue;
        }
        if (tableLeadRegex.test(line) && state.currentProvision) {
            const node = { type: 'table', content: line, children: [] };
            ensureChildren(state.currentProvision).push(node);
            state.currentAttachment = node;
            continue;
        }
        const target = state.currentAttachment ||
            state.currentSubclause ||
            state.currentClause ||
            state.currentSubsection ||
            state.currentProvision ||
            state.currentSchedule ||
            state.currentChapter ||
            state.currentTitle ||
            state.currentPart;
        if (target)
            appendContent(target, line);
        else
            state.root.push({ type: 'body', content: line });
    }
    return state.root;
}
function renderNode(node, depth = 0) {
    const label = node.type === 'section' ? `Section ${node.number}` :
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
function flattenProvisions(nodes, context = { content: '' }) {
    const provisions = [];
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
                ? { article: node.number, provisionType: 'article' }
                : { section: node.number, provisionType: 'section' };
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
function validateLegalStructure(nodes) {
    const result = {
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
    const seen = new Set();
    const duplicates = new Set();
    function walk(list, ancestors) {
        const inSchedule = ancestors.some((a) => a.type === 'schedule');
        for (const node of list) {
            if (node.type === 'part')
                result.totalParts++;
            if (node.type === 'title')
                result.totalTitles++;
            if (node.type === 'chapter')
                result.totalChapters++;
            if (node.type === 'schedule')
                result.totalSchedules++;
            if (node.type === 'explanation')
                result.totalExplanations++;
            if (node.type === 'illustration')
                result.totalIllustrations++;
            if (node.type === 'article') {
                if (inSchedule)
                    result.totalScheduleItems++;
                else
                    result.totalArticles++;
            }
            if (node.type === 'section') {
                if (inSchedule)
                    result.totalScheduleItems++;
                else
                    result.totalSections++;
            }
            if ((node.type === 'section' || node.type === 'article') && !inSchedule) {
                const key = `${node.type}:${node.number}`;
                if (seen.has(key))
                    duplicates.add(key);
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
function parseLegalDocument(lines, actName, category, officialName) {
    const structure = parseLegalStructure(lines);
    const validation = validateLegalStructure(structure);
    const yearMatch = actName.match(/\b(18|19|20)\d{2}\b/) ||
        (officialName || '').match(/\b(18|19|20)\d{2}\b/);
    const meta = {
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
//# sourceMappingURL=indian-legal-parser.js.map