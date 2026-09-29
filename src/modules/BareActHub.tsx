import { useState, useRef, useCallback, useEffect } from 'react'
import { BookOpen, FileText, FolderOpen, PenLine, Paperclip, ArrowUp, Copy, Check, Sparkles, RefreshCw, Plus, Search, Trash2, Edit3, MoreVertical, X, ChevronLeft, ChevronRight, Menu } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@clerk/clerk-react'
import { supabase } from '../lib/supabase-client'
import { API_BASE_URL } from '../lib/api'
import './BareActHub.css'
import LearningPlatformPage from '../features/learning/pages/LearningPlatformPage'

/* Section */
interface AiBarResponse {
  markdown: string
  act: string
  source: 'corpus' | 'knowledge' | 'hybrid' | 'none'
  lowConfidence: boolean
}

interface HowToWriteStep {
  stepNumber: number
  title: string
  instruction: string
  tip: string
  example: string
}

interface HowToWriteResult {
  topic?: string
  draftingIntent?: string
  draftingIntentLabel?: string
  existingLaw?: string
  shouldCreateNewAct?: boolean
  learningObjective?: string
  overview: string
  steps: HowToWriteStep[]
  draftingPlan?: string[]
  arrangementOfSections?: string[]
  draftingPrinciples: string[]
  commonMistakes: string[]
  finalTemplate?: string
  practiceTask?: string
  sampleStyleNote?: string
  provider?: string
}

interface ChatMsg {
  id: string
  role: 'user' | 'ai'
  content: string
}

const LEGATRIXON_LOGO_SRC = '/Legatrixon%20logo.jpg'

function LegatrixonLogo({ className }: { className: string }) {
  return <img src={LEGATRIXON_LOGO_SRC} alt="" className={className} draggable={false} />
}

function cleanString(str: string | undefined | null): string {
  if (!str) return '';
  return str
    // Common Mojibake replacements
    .replace(/\u00e2\u20ac\u2022/g, '•')   // Bullet
    .replace(/\u00e2\u20ac\u0153/g, '“')   // Left double quote
    .replace(/\u00e2\u20ac/g, '”')   // Right double quote (Windows-1252)
    .replace(/\u00e2\u20ac\u009d/g, '”') // Right double quote (raw control character)
    .replace(/\u00e2\u20ac/g, '”')    // Bare pair fallback -> right double quote
    .replace(/\u00e2\u20ac\u2014/g, '—')   // Em dash
    .replace(/\u00e2\u20ac\u2013/g, '–')   // En dash
    .replace(/\u00e2\u20ac\u0094/g, '—')
    .replace(/\u00e2\u20ac\u0093/g, '–')
    .replace(/\u00e2\u20ac\u2122/g, '’')   // Right single quote (apostrophe)
    .replace(/\u00e2\u20ac\u2018/g, '‘')   // Left single quote
    .replace(/\u00e2\u20ac\u2026/g, '…')   // Ellipsis
    .replace(/\u00e2\u20ac\u00a2/g, '•')
    // Fallbacks using regex for sequences starting with \u00e2\u20ac
    .replace(/\u00e2\u0080\u0094/g, '—')
    .replace(/\u00e2\u0080\u0093/g, '–')
    .replace(/\u00e2\u0080\u0099/g, '’')
    .replace(/\u00e2\u0080\u009c/g, '“')
    .replace(/\u00e2\u0080\u009d/g, '”')
    .replace(/\u00e2\u0080\u00a2/g, '•')
    .replace(/\u00e2\u0080\u00a6/g, '…')
    .replace(/\u00e2\u20ac\u201d/g, '—')
    .replace(/\u00e2\u20ac\u201c/g, '–')
    .replace(/\u00e2\u20ac\u2122/g, '’')
    .replace(/\u00e2\u20ac\u0153/g, '“')
    .replace(/\u00e2\u20ac\u009d/g, '”')
    .replace(/\u00e2\u20ac\u00a2/g, '•')
    .replace(/\u00e2\u20ac\u00a6/g, '…')
    .replace(/\u00e2\u20ac\u02dc/g, '‘')
    .replace(/\u00e2\u0094\u0080/g, '—')
    .replace(/\u00e2\u201d\u20ac/g, '—')
    .replace(/[\u0080-\u009f]/g, '');
}

function cleanListItem(str: string | undefined | null): string {
  if (!str) return '';
  const temp = cleanString(str);
  // Strip leading list-bullet/dash artifacts.
  return temp.replace(/^[\s\-\u2014\u2013\u2022*•]+/, '').trim();
}



const ACT_LABELS: Record<string, string> = {
  bns: 'Bharatiya Nyaya Sanhita, 2023',
  bnss: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
  bsa: 'Bharatiya Sakshya Adhiniyam, 2023',
  ipc: 'Indian Penal Code, 1860',
  crpc: 'Code of Criminal Procedure, 1973',
  constitution: 'Constitution of India',
  contract: 'Indian Contract Act, 1872',
}

function stripConversationalOpening(markdown: string): string {
  return cleanString(markdown)
    .replace(/^\s*(?:certainly|sure|absolutely|let'?s\s+(?:dive|delve|look|explore)\s+(?:in|into)?|of course)[!,.\s:-]*/i, '')
    .trim()
}

function getRequestedSection(query: string): string | null {
  const match = cleanString(query).match(/\b(?:section|sec\.?|s\.?|article|art\.?)\s*(\d+[A-Za-z-]*)\b/i)
  if (!match) return null
  const label = /\barticle\b|\bart\.?\b/i.test(match[0]) ? 'Article' : 'Section'
  return `${label} ${match[1]}`
}

function getActName(query: string, responseAct?: string): string {
  const text = `${query} ${responseAct || ''}`.toLowerCase()
  const key = Object.keys(ACT_LABELS).find((item) => text.includes(item))
  if (key) return ACT_LABELS[key]
  return responseAct && !/^unknown$/i.test(responseAct) ? responseAct : ''
}

function splitMarkdownByHeading(markdown: string): Map<string, string> {
  const sections = new Map<string, string>()
  let active = 'body'
  let buffer: string[] = []

  const commit = () => {
    const value = buffer.join('\n').trim()
    if (value) sections.set(active, value)
    buffer = []
  }

  markdown.split('\n').forEach((line) => {
    const heading = line.match(/^#{1,4}\s+(.+?)\s*$/)
    if (heading) {
      commit()
      active = heading[1].toLowerCase().replace(/[*_`]/g, '').trim()
      return
    }
    buffer.push(line)
  })
  commit()
  return sections
}

function pickSection(sections: Map<string, string>, terms: string[]): string {
  for (const [heading, value] of sections.entries()) {
    if (terms.some((term) => heading.includes(term))) return value
  }
  return ''
}

function compactLegalBody(text: string): string {
  return cleanString(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

function hasFailureLanguage(text: string): boolean {
  return /\b(?:could not locate|could not reliably retrieve|not found|no data found|unknown|not identified|not specified|retrieved response|unable to generate explanation|no verified statutory text)\b/i.test(text)
}

function removeMarkdownMarks(text: string): string {
  return text.replace(/^>\s?/gm, '').replace(/```[a-z]*\n?|```/gi, '').replace(/\*\*/g, '').trim()
}

function extractOfficialTitleFromProvision(provision: string, requestedSection: string): string {
  const number = requestedSection.replace(/^(Section|Article)\s+/i, '')
  const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = provision.match(new RegExp(`(?:Section|Article)?\\s*${escaped}\\s*[.:—-]\\s*([^\\n.]{3,140})`, 'i'))
  return match?.[1]?.trim() || ''
}

function isLikelyOfficialProvision(text: string, requestedSection: string): boolean {
  const cleaned = removeMarkdownMarks(text)
  if (hasFailureLanguage(cleaned)) return false
  const number = requestedSection.replace(/^(Section|Article)\s+/i, '')
  const hasSection = new RegExp(`\\b(?:Section|Article)?\\s*${number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(cleaned)
  const hasStatutoryMarkers = /\b(?:whoever|shall|provided that|explanation|exception|illustration|punishable|means|includes|sub-section|clause)\b/i.test(cleaned)
  return hasSection && hasStatutoryMarkers && cleaned.length >= 80
}

function extractProvisionText(markdown: string, requestedSection: string): string {
  const sections = splitMarkdownByHeading(markdown)
  const headed = pickSection(sections, ['bare act provision', 'statutory text', 'official text', 'provision text', 'what the provision says'])
  if (headed && isLikelyOfficialProvision(headed, requestedSection)) return removeMarkdownMarks(headed)

  const number = requestedSection.replace(/^(Section|Article)\s+/i, '')
  const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const lines = markdown.split('\n')
  const sectionIndex = lines.findIndex((line) => new RegExp(`\\b(?:Section|Article)\\s+${escaped}\\b`, 'i').test(line))
  if (sectionIndex === -1) return ''

  const collected: string[] = []
  for (let index = sectionIndex; index < Math.min(lines.length, sectionIndex + 28); index += 1) {
    const line = lines[index].trim()
    if (index > sectionIndex && /^#{1,4}\s+/.test(line)) break
    if (/^(plain language|understanding|essential|key legal|important|examination|references?)\b/i.test(line)) break
    if (line) collected.push(line)
  }

  const candidate = removeMarkdownMarks(collected.join('\n'))
  return isLikelyOfficialProvision(candidate, requestedSection) ? candidate : ''
}

function normalizeLines(text: string): string[] {
  return removeMarkdownMarks(text)
    .split('\n')
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
}

function uniqueLines(lines: string[], used = new Set<string>()): string[] {
  const result: string[] = []
  lines.forEach((line) => {
    const key = line.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (!key || used.has(key)) return
    used.add(key)
    result.push(line)
  })
  return result
}

function bulletize(lines: string[], used?: Set<string>): string {
  return uniqueLines(lines, used).map((line) => `- ${line}`).join('\n')
}

function getClauseLines(provision: string): string[] {
  return normalizeLines(provision).filter((line) => /^(?:\(?[a-z]\)|\([ivxlcdm]+\)|\d+\.|firstly|secondly|thirdly|fourthly|fifthly|sixthly|seventhly)\b/i.test(line))
}

function buildPlainExplanation(provision: string, requestedSection: string): string {
  const title = extractOfficialTitleFromProvision(provision, requestedSection)
  const firstOperative = normalizeLines(provision).find((line) => /\b(?:whoever|shall|means|includes|punishable)\b/i.test(line))
  const parts = [`- **${requestedSection}**${title ? ` deals with **${title}**` : ''}.`]
  if (firstOperative) parts.push(`- In statutory terms, it provides: ${firstOperative}`)
  parts.push('- This explanation is limited to the official provision text displayed above.')
  return parts.join('\n')
}

function buildIngredients(provision: string): string {
  const clauses = getClauseLines(provision)
  if (clauses.length) return bulletize(clauses.slice(0, 10))
  const operative = normalizeLines(provision).filter((line) => /\b(?:whoever|shall|without|with intent|under|punishable|commits|does|causes)\b/i.test(line))
  return bulletize(operative.slice(0, 6))
}

function buildKeyElements(provision: string): string {
  const terms = Array.from(new Set((provision.match(/\b(?:consent|against her will|without her consent|misconception of fact|fear|hurt|death|intoxication|unsoundness of mind|child|woman|man|punishable|imprisonment|fine|explanation|exception)\b/gi) || []).map((term) => term.trim())))
  return bulletize(terms.slice(0, 10).map((term) => `**${term}** appears in the official provision and should be read in that statutory context.`))
}

function extractIllustrations(provision: string): string {
  const lines = normalizeLines(provision)
  const start = lines.findIndex((line) => /^illustrations?\b/i.test(line))
  if (start === -1) return ''
  const collected: string[] = []
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]
    if (index > start && /^(explanation|exception|provided that)\b/i.test(line)) break
    collected.push(line)
  }
  return bulletize(collected)
}

function extractImportantPoints(provision: string): string {
  const lines = normalizeLines(provision)
  const points = lines.filter((line) => /\b(?:provided that|explanation|exception|punishable|shall not|shall be|consent|without)\b/i.test(line))
  return bulletize(points.slice(0, 8))
}

function extractOfficialSubsection(provision: string, label: RegExp): string {
  const lines = normalizeLines(provision)
  const start = lines.findIndex((line) => label.test(line))
  if (start === -1) return ''
  const collected: string[] = []
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]
    if (index > start && /^(illustrations?|explanation|exception|provided that)\b/i.test(line) && !label.test(line)) break
    collected.push(line)
  }
  return bulletize(collected)
}

function hasMeaningfulContent(text: string): boolean {
  const cleaned = removeMarkdownMarks(text)
  return cleaned.length > 0 && !hasFailureLanguage(cleaned)
}

function appendSection(lines: string[], title: string, body: string, used?: Set<string>) {
  if (!hasMeaningfulContent(body)) return
  const normalized = title === 'Bare Act Provision' ? compactLegalBody(body) : body
  if (!hasMeaningfulContent(normalized)) return
  lines.push(`## ${title}\n${normalized}`)
  if (used && title !== 'Bare Act Provision') {
    normalizeLines(normalized).forEach((line) => used.add(line.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()))
  }
}

function formatBareActAiMarkdown(markdown: string, query: string, responseAct?: string, lowConfidence = false): string {
  return cleanString(markdown);
}

function draftToMd(r: HowToWriteResult): string {
  const s: string[] = []
  const step = r.steps?.[0]
  const topic = cleanString(r.topic || '').trim()
  const isNewAct = r.shouldCreateNewAct !== false

  s.push('## The drafting problem')
  s.push(cleanString(r.learningObjective || r.overview || 'Today you will learn one drafting skill for this Bare Act topic.'))
  s.push('')

  if (topic) {
    s.push(isNewAct ? '## Topic before the drafter' : '## Task before the drafter')
    s.push(topic)
    s.push('')
  }

  if (r.draftingIntentLabel) {
    s.push('## Counsel\'s classification')
    s.push(cleanString(r.draftingIntentLabel))
    if (r.existingLaw) s.push(`Existing legal home: ${cleanString(r.existingLaw)}`)
    s.push('')
  }

  s.push('## Counsel\'s reading')
  s.push(cleanString(r.overview))
  s.push('')

  if (r.sampleStyleNote) {
    s.push('## What the specimen Act teaches')
    s.push(cleanString(r.sampleStyleNote))
    s.push('')
  }

  if (r.draftingPlan?.length) {
    s.push(isNewAct ? '## Build the Act before drafting clauses' : '## Analyse the existing law before drafting')
    r.draftingPlan.slice(0, 6).forEach((item, index) => s.push(`${index + 1}. ${cleanString(item)}`))
    s.push('')
  }

  if (isNewAct && r.arrangementOfSections?.length) {
    s.push('## Arrangement of Sections, in the style of the specimen')
    s.push('This is not the Act. It is the skeleton a drafter prepares before writing sections.')
    s.push('')
    s.push('```text')
    r.arrangementOfSections.slice(0, 24).forEach(line => s.push(cleanString(line)))
    s.push('```')
    s.push('')
  }

  if (step) {
    s.push('## The one drafting move now')
    s.push(`### ${cleanString(step.title)}`)
    s.push(cleanString(step.instruction))
    s.push('')
    if (step.tip) {
      s.push('**Why a drafter does it this way:**')
      s.push(cleanString(step.tip))
      s.push('')
    }
    if (step.example) {
      s.push('**A narrow fictional demonstration:**')
      s.push(cleanString(step.example))
      s.push('')
    }
  }

  if (r.draftingPrinciples?.length) {
    s.push('## The drafting judgment')
    r.draftingPrinciples.slice(0, 2).forEach(p => s.push(`- ${cleanListItem(p)}`))
    s.push('')
  }

  if (r.commonMistakes?.length) {
    s.push('## The trap to avoid')
    r.commonMistakes.slice(0, 1).forEach(m => s.push(`- ${cleanListItem(m)}`))
    s.push('')
  }

  s.push('## Your next move')
  s.push(cleanString(r.practiceTask) || 'Write one sentence identifying the legislative purpose. Do not draft the section yet.')
  s.push('')
  s.push('Send only that attempt. I will review the drafting judgment before we move to definitions, operative clauses, offences, or penalties.')
  s.push('')
  s.push('---')
  s.push('*LEGATRIXON Legislative Drafting Mentor*')
  return s.join('\n')
}
function generateAutoTitle(question: string): string {
  const q = (question || '').trim();
  if (!q) return 'New Chat';

  // Truncate to maximum 55 characters (in the 50-60 range), cleanly at a word boundary if possible
  const maxLen = 55;
  if (q.length <= maxLen) return q;

  const cutIndex = q.lastIndexOf(' ', maxLen);
  // Only use word boundary if it doesn't truncate the string too much (e.g. at least 40 characters)
  const finalCut = cutIndex >= 40 ? cutIndex : maxLen;
  return q.substring(0, finalCut).trim() + '...';
}

function cleanPreview(text: string): string {
  if (!text) return 'No messages yet';
  let cleaned = text.trim();

  if (cleaned.startsWith('##') || cleaned.toLowerCase().includes('provision') || cleaned.toLowerCase().includes('original bare act')) {
    const lines = cleaned.split('\n');
    const filteredLines = lines.filter(line => {
      const l = line.trim();
      if (l.startsWith('##')) return false;
      if (l.startsWith('Provision:')) return false;
      if (l.toLowerCase().includes('original bare act text')) return false;
      if (l.toLowerCase().includes('bharatiya nyaya sanhita')) return false;
      if (l.toLowerCase().includes('indian penal code')) return false;
      if (l.toLowerCase().includes('constitution of india')) return false;
      return true;
    });
    cleaned = filteredLines.join(' ');
  }

  cleaned = cleaned.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();

  const maxLen = 55;
  if (cleaned.length <= maxLen) return cleaned || 'No messages yet';

  const cutIndex = cleaned.lastIndexOf(' ', maxLen);
  const finalCut = cutIndex >= 40 ? cutIndex : maxLen;
  return cleaned.substring(0, finalCut).trim() + '...';
}

function getGroupLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  if (date >= today) return 'TODAY'
  if (date >= yesterday) return 'YESTERDAY'
  if (date >= sevenDaysAgo) return 'LAST 7 DAYS'
  return 'OLDER'
}

/* Section */
function useLineStream(fullText: string | null) {
  const [lineCount, setLineCount] = useState(0)
  const [done, setDone] = useState(true)

  useEffect(() => {
    if (!fullText) { setLineCount(0); setDone(true); return }
    const lines = fullText.split('\n')
    setLineCount(0)
    setDone(false)
    let i = 0
    const id = setInterval(() => {
      i += 2
      setLineCount(i)
      if (i >= lines.length) { setLineCount(lines.length); setDone(true); clearInterval(id) }
    }, 32)
    return () => clearInterval(id)
  }, [fullText])

  const displayed = fullText
    ? fullText.split('\n').slice(0, lineCount).join('\n')
    : ''

  return { displayed, streaming: !done }
}

/* Section */
function inlineMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bah-icode">$1</code>')
    .replace(/\b((?:Section|Article)\s+\d+[A-Za-z-]*)\b/g, '<span class="bah-legal-section">$1</span>')
    .replace(/\b(consent|dishonestly|fraudulently|intention|knowledge|mens rea|actus reus|proviso|explanation|exception|punishment|ingredients?|liability|offence|cognizable|non-bailable)\b/gi, '<span class="bah-legal-term">$1</span>')
    .replace(/\b(whoever|shall|must|may|provided that|unless|without|with intent to|punishable|imprisonment|fine)\b/gi, '<span class="bah-legal-keyword">$1</span>')
}

/* Section */
function MarkdownRenderer({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const nodes: React.ReactNode[] = []
  let listItems: string[] = []
  let inCode = false
  let codeLines: string[] = []
  let lk = 0

  const flushList = () => {
    if (!listItems.length) return
    nodes.push(
      <ul key={`ul${lk++}`} className="bah-md-ul">
        {listItems.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: inlineMd(item) }} />
        ))}
      </ul>
    )
    listItems = []
  }

  const flushCode = () => {
    if (!codeLines.length) return
    nodes.push(
      <pre key={`code${nodes.length}`} className="bah-md-pre">
        <code>{codeLines.join('\n')}</code>
      </pre>
    )
    codeLines = []
    inCode = false
  }

  const cleanedText = cleanString(text)

  cleanedText.split('\n').forEach((line, i) => {
    const k = String(i)
    if (line.startsWith('```')) {
      inCode ? flushCode() : (() => { flushList(); inCode = true })()
      return
    }
    if (inCode) { codeLines.push(line); return }
    if (line.startsWith('# ')) {
      flushList(); nodes.push(<h2 key={k} className="bah-md-h1">{line.slice(2)}</h2>)
    } else if (line.startsWith('## ')) {
      flushList(); nodes.push(<h3 key={k} className="bah-md-h2">{line.slice(3)}</h3>)
    } else if (line.startsWith('### ')) {
      flushList(); nodes.push(<h4 key={k} className="bah-md-h3">{line.slice(4)}</h4>)
    } else if (line.startsWith('> ')) {
      flushList()
      nodes.push(<blockquote key={k} className="bah-md-bq" dangerouslySetInnerHTML={{ __html: inlineMd(cleanString(line.slice(2))) }} />)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(cleanListItem(line.slice(2)))
    } else if (line.startsWith('---')) {
      flushList(); nodes.push(<hr key={k} className="bah-md-hr" />)
    } else if (line.trim() === '') {
      flushList()
    } else {
      flushList()
      nodes.push(<p key={k} className="bah-md-p" dangerouslySetInnerHTML={{ __html: inlineMd(line) }} />)
    }
  })
  flushList()
  if (inCode) flushCode()

  return (
    <div className="bah-md">
      {nodes}
      {streaming && <span className="bah-cursor" aria-hidden />}
    </div>
  )
}

/* Section */
function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="bah-copy-btn"
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1600) }) }}
      title="Copy response"
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
      <span>{done ? 'Copied' : 'Copy'}</span>
    </button>
  )
}

/* Section */
function parseClauseBreakdown(text: string) {
  const lines = text.split('\n');
  const clauses: { title: string; body: string[] }[] = [];
  let currentClause: { title: string; body: string[] } | null = null;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const clauseMatch = trimmed.match(/^[-*•]?\s*\*\*([^*]+)\*\*[:\s-]*(.*)$/i) ||
      trimmed.match(/^[-*•]?\s*(Clause\s*\d+|First\s*Clause|Second\s*Clause|Third\s*Clause|Fourth\s*Clause|Fifth\s*Clause)[:\s-]*(.*)$/i);

    if (clauseMatch) {
      if (currentClause) {
        clauses.push(currentClause);
      }
      const title = clauseMatch[1].trim();
      const rest = clauseMatch[2] ? clauseMatch[2].trim() : '';
      currentClause = {
        title,
        body: rest ? [rest] : []
      };
    } else {
      if (currentClause) {
        currentClause.body.push(trimmed);
      } else {
        currentClause = { title: 'Breakdown', body: [trimmed] };
      }
    }
  });

  if (currentClause) {
    clauses.push(currentClause);
  }
  return clauses;
}

function parseLegalTerms(text: string) {
  const lines = text.split('\n');
  const terms: { term: string; definition: string }[] = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const match = trimmed.match(/^[-*•]?\s*\*\*([^*]+)\*\*[:\s-]*(.*)$/) ||
      trimmed.match(/^[-*•]?\s*([^:]+):(.*)$/);
    if (match) {
      terms.push({
        term: match[1].trim(),
        definition: match[2].trim()
      });
    } else {
      terms.push({
        term: '',
        definition: trimmed
      });
    }
  });

  return terms;
}

function deduplicateSectionLabels(text: string): string {
  if (!text) return ''
  let cleaned = text.replace(/\b(Section|Article|Sec|Art)\s+(\d+)\s+\1\s+\2\b/gi, '$1 $2')
  cleaned = cleaned.replace(/\b(Section|Article|Sec|Art)\s+(\d+),\s+\1\s+\2\b/gi, '$1 $2')
  return cleaned
}

function getSectionContent(sections: Map<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (sections.has(k)) return sections.get(k) || '';
  }
  return '';
}

function StructuredAiResponse({ sections }: { sections: Map<string, string> }) {
  const provisionText = getSectionContent(sections, ['provision', 'body']);
  const originalText = getSectionContent(sections, ['original bare act text', 'bare act provision', 'statutory text', 'official text']);
  const simpleExplanation = getSectionContent(sections, ['simple explanation', 'plain explanation', 'explanation']);
  const clauseText = getSectionContent(sections, ['clause-wise breakdown', 'clause-wise explanation']);
  const legalTermsText = getSectionContent(sections, ['important legal terms', 'key legal terms', 'legal terms']);
  const relatedText = getSectionContent(sections, ['related sections', 'references']);
  const sourceText = getSectionContent(sections, ['source', 'source information']);

  const hasRelated = relatedText.trim() &&
    !/no related sections/i.test(relatedText) &&
    !/no.*sections.*present/i.test(relatedText) &&
    !/\[.*no.*sections.*\]/i.test(relatedText);

  const renderedKeys = new Set([
    'provision', 'body',
    'original bare act text', 'bare act provision', 'statutory text', 'official text',
    'simple explanation', 'plain explanation', 'explanation',
    'clause-wise breakdown', 'clause-wise explanation',
    'important legal terms', 'key legal terms', 'legal terms',
    'related sections', 'references',
    'source', 'source information'
  ]);

  const remainingSections: [string, string][] = [];
  sections.forEach((val, key) => {
    if (!renderedKeys.has(key)) {
      remainingSections.push([key, val]);
    }
  });

  const clauses = clauseText ? parseClauseBreakdown(clauseText) : [];
  const terms = legalTermsText ? parseLegalTerms(legalTermsText) : [];

  return (
    <div className="bah-structured-response">
      {/* Title Card */}
      {provisionText && (
        <div className="bah-provision-header-card">
          <div className="bah-provision-header-content">
            <div dangerouslySetInnerHTML={{ __html: inlineMd(deduplicateSectionLabels(cleanString(provisionText))) }} />
          </div>
        </div>
      )}

      {/* Original Bare Act Text */}
      {originalText && (
        <div className="bah-section-block bah-section-block--original">
          <h4 className="bah-section-heading">Original Bare Act Text</h4>
          <div className="bah-statutory-container">
            <p className="bah-statutory-text" dangerouslySetInnerHTML={{ __html: inlineMd(cleanString(originalText)) }} />
          </div>
        </div>
      )}

      {/* Simple Explanation */}
      {simpleExplanation && (
        <div className="bah-section-block bah-section-block--explanation">
          <h4 className="bah-section-heading">Simple Explanation</h4>
          <div className="bah-explanation-content">
            {simpleExplanation.split('\n\n').map((para, pIdx) => {
              const cleanedPara = cleanString(para).trim();
              if (!cleanedPara) return null;
              return (
                <p
                  key={pIdx}
                  className="bah-explanation-para"
                  dangerouslySetInnerHTML={{ __html: inlineMd(cleanedPara) }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Clause-wise Explanation */}
      {clauses.length > 0 && (
        <div className="bah-section-block bah-section-block--clauses">
          <h4 className="bah-section-heading">Clause-wise Explanation</h4>
          <div className="bah-clauses-list">
            {clauses.map((clause, cIdx) => (
              <div key={cIdx} className="bah-clause-card">
                {clause.title && <div className="bah-clause-header">{clause.title}</div>}
                <div className="bah-clause-body">
                  {clause.body.map((bLine, bIdx) => (
                    <p key={bIdx} dangerouslySetInnerHTML={{ __html: inlineMd(cleanString(bLine)) }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Important Legal Terms */}
      {terms.length > 0 && (
        <div className="bah-section-block bah-section-block--terms">
          <h4 className="bah-section-heading">Important Legal Terms</h4>
          <div className="bah-terms-grid">
            {terms.map((t, tIdx) => {
              if (!t.term && !t.definition) return null;
              return (
                <div key={tIdx} className="bah-term-card">
                  {t.term && <div className="bah-term-name">{t.term}</div>}
                  {t.definition && <div className="bah-term-definition">{t.definition}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Related Sections */}
      {hasRelated && (
        <div className="bah-section-block bah-section-block--related">
          <h4 className="bah-section-heading">Related Sections</h4>
          <div className="bah-related-content">
            <MarkdownRenderer text={relatedText} />
          </div>
        </div>
      )}

      {/* Custom/Remaining Sections */}
      {remainingSections.map(([key, val]) => (
        <div key={key} className="bah-section-block bah-section-block--custom">
          <h4 className="bah-section-heading" style={{ textTransform: 'capitalize' }}>{key}</h4>
          <div className="bah-custom-content">
            <MarkdownRenderer text={val} />
          </div>
        </div>
      ))}

      {/* Source Subtle Footer */}
      {sourceText && (
        <div className="bah-section-block bah-section-block--source">
          <div className="bah-source-card">
            <span className="bah-source-label">Source</span>
            <div className="bah-source-details">
              {sourceText.split('\n').map((line, sIdx) => {
                const cleanedLine = cleanString(line).replace(/^[-*•]\s*/, '').trim();
                if (!cleanedLine) return null;
                return <span key={sIdx} className="bah-source-line">{cleanedLine}</span>;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Section */
function UserBubble({ content }: { content: string }) {
  return (
    <div className="bah-msg bah-msg--user">
      <div className="bah-user-bubble-container">
        <div className="bah-user-header">You</div>
        <div className="bah-user-bubble">{content}</div>
      </div>
    </div>
  )
}

/* Section */
function AiMessage({ content, streaming, showCopy, onAction }: {
  content: string
  streaming: boolean
  showCopy: boolean
  onAction?: (actionType: 'copy' | 'explain_simpler' | 'view_original' | 'summarize' | 'regenerate') => void
}) {
  const sections = splitMarkdownByHeading(content)
  const isStructured = !streaming && (
    sections.has('original bare act text') ||
    sections.has('bare act provision') ||
    sections.has('statutory text') ||
    sections.has('official text') ||
    sections.has('simple explanation') ||
    sections.has('plain explanation') ||
    sections.has('explanation') ||
    sections.has('clause-wise breakdown') ||
    sections.has('clause-wise explanation') ||
    sections.has('important legal terms') ||
    sections.has('key legal terms') ||
    sections.has('legal terms')
  )

  return (
    <div className="bah-msg bah-msg--ai">
      <div className="bah-ai-avatar" aria-hidden><LegatrixonLogo className="bah-ai-avatar-logo" /></div>
      <div className="bah-ai-content">
        {isStructured ? (
          <StructuredAiResponse sections={sections} />
        ) : (
          <MarkdownRenderer text={content} streaming={streaming} />
        )}
        {showCopy && !streaming && onAction && (
          <div className="bah-ai-actions">
            <button type="button" className="bah-action-btn" onClick={() => onAction('copy')} title="Copy response">
              <Copy size={13} />
              <span>Copy</span>
            </button>
            <button type="button" className="bah-action-btn" onClick={() => onAction('explain_simpler')} title="Explain Simpler">
              <Sparkles size={13} />
              <span>Explain Simpler</span>
            </button>
            <button type="button" className="bah-action-btn" onClick={() => onAction('view_original')} title="View Original">
              <BookOpen size={13} />
              <span>View Original</span>
            </button>
            <button type="button" className="bah-action-btn" onClick={() => onAction('summarize')} title="Summarize response">
              <FileText size={13} />
              <span>Summarize</span>
            </button>
            <button type="button" className="bah-action-btn" onClick={() => onAction('regenerate')} title="Regenerate response">
              <RefreshCw size={13} />
              <span>Regenerate</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* Section */
function ThinkingBubble({ steps, idx }: { steps: string[]; idx: number }) {
  return (
    <div className="bah-msg bah-msg--ai">
      <div className="bah-ai-avatar" aria-hidden><LegatrixonLogo className="bah-ai-avatar-logo" /></div>
      <div className="bah-thinking">
        <span className="bah-dots"><span /><span /><span /></span>
        <span className="bah-think-txt" key={idx}>{steps[idx]}</span>
      </div>
    </div>
  )
}

/* Section */
const EXPLAIN_STEPS = ['Reading statutory provision...', 'Breaking into legal clauses...', 'Identifying legislative intent...', 'Analysing key terminology...', 'Finding landmark judgments...', 'Preparing explanation...']
const DRAFT_STEPS = ['Understanding your drafting topic...', 'Checking uploaded sample structure...', 'Building Act architecture...', 'Teaching the first drafting skill...', 'Preparing your exercise...']

function ChatInput({
  value, onChange, onSubmit, onFiles, loading, variant, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onFiles: (files: File[]) => void
  loading: boolean
  variant: 'explain' | 'draft'
  placeholder: string
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [value])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!loading) onSubmit() }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const filesList = e.dataTransfer.files
    if (filesList && filesList.length > 0) {
      onFiles(Array.from(filesList))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files
    if (filesList && filesList.length > 0) {
      onFiles(Array.from(filesList))
    }
  }

  const canSend = value.trim().length > 0 && !loading

  return (
    <div className={`bah-composer bah-composer--${variant}`} onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
      <div className="bah-composer-inner">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.pdf,.docx"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <input
          ref={folderInputRef}
          type="file"
          {...{ webkitdirectory: "", directory: "" } as any}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <div className="bah-attach-wrapper" ref={menuRef}>
          <button
            type="button"
            className={`bah-attach-btn bah-attach-btn--${variant}`}
            onClick={() => setShowMenu(!showMenu)}
            disabled={loading}
            title="Upload Files / Folder"
          >
            <Paperclip size={17} />
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="bah-attach-menu"
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    fileInputRef.current?.click()
                  }}
                >
                  <FileText size={14} /> Upload Files
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    folderInputRef.current?.click()
                  }}
                >
                  <FolderOpen size={14} /> Upload Folder
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <textarea
          ref={taRef}
          className="bah-composer-ta"
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          disabled={loading}
          data-gramm="false"
          data-enable-grammarly="false"
          spellCheck="false"
        />
        <button
          type="button"
          className={`bah-send-btn bah-send-btn--${variant} ${canSend ? 'bah-send-btn--active' : ''}`}
          onClick={onSubmit}
          disabled={!canSend}
          title="Send (Enter)"
        >
          <ArrowUp size={16} />
        </button>
      </div>
      <p className="bah-composer-hint">
        {value.trim()
          ? `${value.length} chars • ${value.trim().split(/\s+/).length} words - Enter to send • Shift+Enter for new line`
          : 'Paste or type • drag and drop files/folders • Enter to send'
        }
      </p>
    </div>
  )
}

/* ============================================================================
   PAGE ROOT
   ============================================================================ */
const EXPLAIN_EXAMPLES = [
  'Article 21 Constitution',
  'Section 10 Indian Contract Act',
  'Section 3 BNS',
  'Section 34 IPC',
  'Definition Clause',
  'Illustration',
  'Proviso',
  'Explanation'
]

const DRAFT_EXAMPLES = [
  'Draft Article 21',
  'Draft Penal Provision',
  'Draft Definition Clause',
  'Draft Exception',
  'Draft Explanation',
  'Draft Proviso',
  'Draft Amendment',
  'Draft New Section'
]

export default function BareActHub({ apiToken, getToken }: { apiToken: string; getToken?: () => Promise<string | null> }) {
  const [mode, setMode] = useState<'explain' | 'draft'>('explain')

  // Auth state
  const { userId: clerkUserId } = useAuth()
  const dbUserId = clerkUserId

  const resolveToken = useCallback(async () => {
    if (getToken) {
      try {
        const fresh = await getToken()
        if (fresh) return fresh
      } catch { /* fall through */ }
    }
    return apiToken
  }, [getToken, apiToken])

  // Sidebar history state
  const [conversations, setConversations] = useState<any[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [conversationsLoading, setConversationsLoading] = useState(false)
  const [conversationsError, setConversationsError] = useState(false)
  const [savingStatus, setSavingStatus] = useState<'saving' | 'saved' | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)

  // Modal and menu state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

  // Scroll reference for container
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Sync Queue Reference
  const syncQueueRef = useRef<any[]>([])
  const syncInProgressRef = useRef(false)

  // State for Explain Mode (Bare Act AI)
  const [explainMessages, setExplainMessages] = useState<ChatMsg[]>([])
  const [explainInput, setExplainInput] = useState('')
  const [explainLoading, setExplainLoading] = useState(false)
  const [explainThinkIdx, setExplainThinkIdx] = useState(0)
  const [explainStreamText, setExplainStreamText] = useState<string | null>(null)

  // State for Draft Mode (Drafting Mentor)
  const [draftMessages, setDraftMessages] = useState<ChatMsg[]>([])
  const [draftInput, setDraftInput] = useState('')
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftThinkIdx, setDraftThinkIdx] = useState(0)
  const [draftStreamText, setDraftStreamText] = useState<string | null>(null)

  // Auto scroll references
  const bottomRef = useRef<HTMLDivElement>(null)

  // Stream state hooks
  const { displayed: explainDisplayed, streaming: explainStreaming } = useLineStream(explainStreamText)
  const { displayed: draftDisplayed, streaming: draftStreaming } = useLineStream(draftStreamText)

  // Auto-scroll logic
  const scrollToBottom = useCallback((force = false) => {
    if (!bottomRef.current || !chatContainerRef.current) return
    const container = chatContainerRef.current
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120
    if (force || isNearBottom) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [])

  // Sync queue runner
  const processSyncQueue = useCallback(async () => {
    if (syncInProgressRef.current || syncQueueRef.current.length === 0 || !dbUserId) return
    syncInProgressRef.current = true
    setSavingStatus('saving')

    const token = await resolveToken()

    while (syncQueueRef.current.length > 0) {
      const item = syncQueueRef.current[0]
      try {
        if (item.type === 'create_conv') {
          const response = await fetch(
            `${API_BASE_URL}/legal-intelligence/bare-act/conversations`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                id: item.tempId,
                title: item.title,
                mode: item.mode,
                last_message: item.last_message,
                created_at: item.created_at,
                updated_at: item.updated_at
              })
            }
          )
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          console.log('[History] Conversation created')
        } else if (item.type === 'save_msg') {
          const response = await fetch(
            `${API_BASE_URL}/legal-intelligence/bare-act/messages`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                id: item.msgId,
                conversation_id: item.convId,
                role: item.role,
                content: item.content,
                metadata: item.metadata || {},
                created_at: item.created_at
              })
            }
          )
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          if (item.role === 'user') {
            console.log('[History] User message saved')
          } else {
            console.log('[History] AI response saved')
          }
        } else if (item.type === 'update_conv') {
          const response = await fetch(
            `${API_BASE_URL}/legal-intelligence/bare-act/conversations`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                id: item.convId,
                last_message: item.last_message,
                updated_at: item.updated_at
              })
            }
          )
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          console.log('[History] Conversation updated')
        } else if (item.type === 'rename_conv') {
          const response = await fetch(
            `${API_BASE_URL}/legal-intelligence/bare-act/conversations/${item.convId}/rename`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ title: item.title })
            }
          )
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
        }
        syncQueueRef.current.shift()
      } catch (err) {
        console.error('Offline sync error, retrying later:', err)
        break
      }
    }

    if (syncQueueRef.current.length === 0) {
      setSavingStatus('saved')
      setTimeout(() => setSavingStatus(null), 2000)
    }
    syncInProgressRef.current = false
  }, [dbUserId])

  // Load conversations list
  const loadConversations = useCallback(async (pageToLoad: number, searchVal: string, append = false) => {
    console.log('[History] Loading conversations...')
    console.log('[History] Current Clerk user:', dbUserId)

    if (!dbUserId) {
      console.warn('[History] Query aborted: dbUserId is not resolved yet.')
      return
    }

    setConversationsLoading(true)
    setConversationsError(false)
    console.log('[History] Querying conversations...')

    try {
      const token = await resolveToken()
      const response = await fetch(
        `${API_BASE_URL}/legal-intelligence/bare-act/conversations?search=${encodeURIComponent(searchVal)}&page=${pageToLoad}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      )
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      const data = await response.json()

      console.log('[History] Query completed')
      console.log('[History] Conversations loaded:', data?.length || 0)

      if (data) {
        if (append) {
          setConversations(prev => {
            const existingIds = new Set(prev.map(c => c.id))
            const filteredNew = data.filter((c: any) => !existingIds.has(c.id))
            return [...prev, ...filteredNew]
          })
        } else {
          setConversations(data)
        }
        setHasMoreHistory(data.length === 20)
      }
    } catch (err: any) {
      console.error('[History] Query error:', err)
      setConversationsError(true)
    } finally {
      setConversationsLoading(false)
    }
  }, [dbUserId, resolveToken])

  useEffect(() => {
    if (dbUserId) {
      setHistoryPage(1)
      loadConversations(1, searchTerm, false)
    }
  }, [dbUserId, searchTerm, loadConversations])

  useEffect(() => {
    if (dbUserId && syncQueueRef.current.length > 0) {
      processSyncQueue()
    }
  }, [dbUserId, processSyncQueue])

  // Sync background queue periodically
  useEffect(() => {
    const timer = setInterval(() => {
      processSyncQueue()
    }, 5000)
    return () => clearInterval(timer)
  }, [processSyncQueue])

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuId(null)
    }
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  const loadMoreHistory = useCallback(() => {
    if (conversationsLoading || !hasMoreHistory) return
    const nextPage = historyPage + 1
    setHistoryPage(nextPage)
    loadConversations(nextPage, searchTerm, true)
  }, [conversationsLoading, hasMoreHistory, historyPage, searchTerm, loadConversations])

  const openConversation = useCallback(async (convId: string) => {
    if (activeConversationId === convId) return
    setActiveConversationId(convId)

    const conv = conversations.find(c => c.id === convId)
    if (conv) {
      setMode(conv.mode)
    }

    setExplainMessages([])
    setDraftMessages([])
    setExplainStreamText(null)
    setDraftStreamText(null)

    try {
      const token = await resolveToken()
      const response = await fetch(
        `${API_BASE_URL}/legal-intelligence/bare-act/conversations/${convId}/messages`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      )
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()

      if (data) {
        const mappedMsgs: ChatMsg[] = data.map((m: any) => ({
          id: m.id,
          role: m.role === 'assistant' ? 'ai' : 'user',
          content: m.content
        }))
        if (conv?.mode === 'draft') {
          setDraftMessages(mappedMsgs)
        } else {
          setExplainMessages(mappedMsgs)
        }
        setTimeout(() => scrollToBottom(true), 100)
      }
    } catch (err) {
      console.error('Error loading conversation messages:', err)
    }
  }, [activeConversationId, conversations, scrollToBottom, resolveToken])

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null)
    setExplainMessages([])
    setDraftMessages([])
    setExplainStreamText(null)
    setDraftStreamText(null)
  }, [])

  const handleRename = useCallback(async (convId: string, title: string) => {
    if (!title.trim()) return
    setSavingStatus('saving')
    try {
      const token = await resolveToken()
      const response = await fetch(
        `${API_BASE_URL}/legal-intelligence/bare-act/conversations/${convId}/rename`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title: title.trim() })
        }
      )
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: title.trim(), updated_at: new Date().toISOString() } : c))
      setSavingStatus('saved')
      setTimeout(() => setSavingStatus(null), 2000)
    } catch (err) {
      console.error('Rename conversation failed, queuing:', err)
      syncQueueRef.current.push({
        type: 'rename_conv',
        convId,
        title: title.trim()
      })
      processSyncQueue()
    }
  }, [processSyncQueue, resolveToken])

  const handleDelete = useCallback(async (convId: string) => {
    setSavingStatus('saving')
    try {
      const token = await resolveToken()
      const response = await fetch(
        `${API_BASE_URL}/legal-intelligence/bare-act/conversations/${convId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      )
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      setConversations(prev => prev.filter(c => c.id !== convId))
      if (activeConversationId === convId) {
        handleNewChat()
      }
      setSavingStatus('saved')
      setTimeout(() => setSavingStatus(null), 2000)
    } catch (err) {
      console.error('Delete conversation failed:', err)
      alert('Unable to delete conversation. Please try again.')
      setSavingStatus(null)
    }
  }, [activeConversationId, handleNewChat, resolveToken])

  const getUuid = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const prepareConversationTurn = useCallback(async (userText: string): Promise<string> => {
    let convId = activeConversationId;
    if (!convId) {
      convId = getUuid();
      const autoTitle = generateAutoTitle(userText);

      const newConvItem = {
        id: convId,
        title: autoTitle,
        mode: mode,
        last_message: userText,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setConversations(prev => [newConvItem, ...prev]);
      setActiveConversationId(convId);

      syncQueueRef.current.push({
        type: 'create_conv',
        tempId: convId,
        title: autoTitle,
        mode: mode,
        last_message: userText,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    const userMsgId = getUuid();
    syncQueueRef.current.push({
      type: 'save_msg',
      msgId: userMsgId,
      convId: convId,
      role: 'user',
      content: userText,
      created_at: new Date().toISOString()
    });

    processSyncQueue();
    return convId;
  }, [activeConversationId, mode, processSyncQueue]);

  const completeConversationTurn = useCallback(async (convId: string, aiText: string, aiMetadata: any) => {
    const aiMsgId = getUuid();
    syncQueueRef.current.push({
      type: 'save_msg',
      msgId: aiMsgId,
      convId: convId,
      role: 'assistant',
      content: aiText,
      created_at: new Date().toISOString(),
      metadata: aiMetadata || {}
    });

    syncQueueRef.current.push({
      type: 'update_conv',
      convId: convId,
      last_message: aiText,
      updated_at: new Date().toISOString()
    });

    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== convId);
      const matched = prev.find(c => c.id === convId);
      if (matched) {
        return [
          {
            ...matched,
            last_message: aiText,
            updated_at: new Date().toISOString()
          },
          ...filtered
        ];
      }
      return prev;
    });

    processSyncQueue();
  }, [processSyncQueue]);

  const formatTimeAgo = (dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hours ago`

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date >= yesterday) return 'Yesterday'

    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  const groupConversations = (items: any[]) => {
    const groups: { [key: string]: any[] } = {
      'TODAY': [],
      'YESTERDAY': [],
      'LAST 7 DAYS': [],
      'OLDER': []
    }

    items.forEach(c => {
      const label = getGroupLabel(c.updated_at || c.created_at)
      groups[label].push(c)
    })

    return groups
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    const activeMessages = mode === 'explain' ? explainMessages : draftMessages
    const isUserMsg = activeMessages.length > 0 && activeMessages[activeMessages.length - 1].role === 'user'
    scrollToBottom(isUserMsg)
  }, [explainMessages.length, explainDisplayed, draftMessages.length, draftDisplayed, mode, scrollToBottom])

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return
    const isExplain = mode === 'explain'
    const setInput = isExplain ? setExplainInput : setDraftInput
    const startLoading = isExplain ? setExplainLoading : setDraftLoading

    startLoading(true)

    try {
      let combinedText = ''
      const token = await resolveToken()

      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase()
        if (ext === 'txt') {
          const text = await file.text()
          combinedText += `\n--- File: ${file.name} ---\n${text}\n`
        } else if (ext === 'pdf' || ext === 'docx') {
          const fd = new FormData(); fd.append('file', file)
          const res = await fetch(`${API_BASE_URL}/extract-text`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd
          })
          if (res.ok) {
            const d = await res.json()
            combinedText += `\n--- File: ${file.name} ---\n${d.text || ''}\n`
          }
        }
      }

      if (combinedText.trim()) {
        setInput(prev => {
          const prefix = prev.trim() ? prev + '\n' : ''
          return prefix + combinedText.trim()
        })
      }
    } catch (err) {
      console.error('Error processing files:', err)
    } finally {
      isExplain ? setExplainLoading(false) : setDraftLoading(false)
    }
  }

  // Explain mode submission
  const handleExplainSubmit = useCallback(async (overridePrompt?: string) => {
    const t = (overridePrompt || explainInput).trim()
    if (!t || explainLoading) return

    const currentMsgs = explainMessages
    const userMsg: ChatMsg = { id: `u${Date.now()}`, role: 'user', content: t }
    setExplainMessages(prev => [...prev, userMsg])
    setExplainInput('')
    setExplainLoading(true)
    setExplainThinkIdx(0)
    setExplainStreamText(null)

    const timer = setInterval(() => setExplainThinkIdx(i => (i + 1) % EXPLAIN_STEPS.length), 900)

    const history = currentMsgs.slice(-8).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant' as 'user' | 'assistant',
      content: m.content,
    }))

    let convId: string | null = null;
    try {
      convId = await prepareConversationTurn(t);
    } catch (err) {
      console.error('Failed to prepare conversation turn:', err);
    }

    try {
      const token = await resolveToken()
      const res = await fetch(`${API_BASE_URL}/legal-intelligence/bare-act/ai-bar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provisionText: t, history }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data: AiBarResponse = await res.json()
      const md = formatBareActAiMarkdown(data.markdown || '**No response received.** Please try again.', t, data.act, data.lowConfidence)
      const aiMsg: ChatMsg = { id: `a${Date.now()}`, role: 'ai', content: md }
      setExplainMessages(prev => [...prev, aiMsg])
      setExplainStreamText(md)

      if (convId) {
        await completeConversationTurn(convId, md, {
          act: data.act,
          lowConfidence: data.lowConfidence,
          source: data.source
        });
      }
    } catch (e: any) {
      const errMsg: ChatMsg = { id: `a${Date.now()}`, role: 'ai', content: `**Error:** ${e?.message || 'Something went wrong. Please try again.'}` }
      setExplainMessages(prev => [...prev, errMsg])
      setExplainStreamText(errMsg.content)

      if (convId) {
        await completeConversationTurn(convId, errMsg.content, { error: true });
      }
    } finally {
      setExplainLoading(false)
      clearInterval(timer)
    }
  }, [explainInput, explainLoading, explainMessages, resolveToken, prepareConversationTurn, completeConversationTurn])

  // Handle assistant action button clicks
  const handleAction = useCallback(async (
    actionType: 'copy' | 'explain_simpler' | 'view_original' | 'summarize' | 'regenerate',
    messageIndex: number
  ) => {
    const targetMsg = explainMessages[messageIndex]
    if (!targetMsg) return

    if (actionType === 'copy') {
      navigator.clipboard.writeText(targetMsg.content)
      return
    }

    // Find closest preceding user query
    let originalQuery = ''
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (explainMessages[i].role === 'user') {
        originalQuery = explainMessages[i].content
        break
      }
    }

    const requestedSection = getRequestedSection(originalQuery) || ''

    let prompt = ''
    if (actionType === 'explain_simpler') {
      prompt = `Explain ${requestedSection || 'this provision'} in simpler terms.`
    } else if (actionType === 'view_original') {
      prompt = `Show the original statutory text of ${requestedSection || 'this provision'}.`
    } else if (actionType === 'summarize') {
      prompt = `Summarize ${requestedSection || 'this provision'}.`
    } else if (actionType === 'regenerate') {
      prompt = originalQuery || 'Regenerate last response'
    }

    if (!prompt) return

    if (actionType === 'regenerate') {
      setExplainMessages(prev => prev.slice(0, messageIndex))
      handleExplainSubmit(prompt)
    } else {
      handleExplainSubmit(prompt)
    }
  }, [explainMessages, handleExplainSubmit])

  // Draft mode submission
  const handleDraftSubmit = useCallback(async () => {
    const t = draftInput.trim()
    if (!t || draftLoading) return

    const userMsg: ChatMsg = { id: `u${Date.now()}`, role: 'user', content: t }
    setDraftMessages(prev => [...prev, userMsg])
    setDraftInput('')
    setDraftLoading(true)
    setDraftThinkIdx(0)
    setDraftStreamText(null)

    const timer = setInterval(() => setDraftThinkIdx(i => (i + 1) % DRAFT_STEPS.length), 900)

    let convId: string | null = null;
    try {
      convId = await prepareConversationTurn(t);
    } catch (err) {
      console.error('Failed to prepare draft conversation turn:', err);
    }

    try {
      const token = await resolveToken()
      const res = await fetch(`${API_BASE_URL}/legal-intelligence/bare-act/how-to-write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provisionText: t }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data: HowToWriteResult = await res.json()
      const md = draftToMd(data)
      const aiMsg: ChatMsg = { id: `a${Date.now()}`, role: 'ai', content: md }
      setDraftMessages(prev => [...prev, aiMsg])
      setDraftStreamText(md)

      if (convId) {
        await completeConversationTurn(convId, md, data);
      }
    } catch (e: any) {
      const errMsg: ChatMsg = { id: `a${Date.now()}`, role: 'ai', content: `**Error:** ${e?.message || 'Something went wrong. Please try again.'}` }
      setDraftMessages(prev => [...prev, errMsg])
      setDraftStreamText(errMsg.content)

      if (convId) {
        await completeConversationTurn(convId, errMsg.content, { error: true });
      }
    } finally {
      setDraftLoading(false)
      clearInterval(timer)
    }
  }, [draftInput, draftLoading, resolveToken, prepareConversationTurn, completeConversationTurn])

  // Derived state based on selected mode
  const activeInput = mode === 'explain' ? explainInput : draftInput
  const setActiveInput = mode === 'explain' ? setExplainInput : setDraftInput
  const activeLoading = mode === 'explain' ? explainLoading : draftLoading
  const activeSubmit = mode === 'explain' ? handleExplainSubmit : handleDraftSubmit
  const activeMessages = mode === 'explain' ? explainMessages : draftMessages
  const activeStreamText = mode === 'explain' ? explainStreamText : draftStreamText
  const activeDisplayed = mode === 'explain' ? explainDisplayed : draftDisplayed
  const activeStreaming = mode === 'explain' ? explainStreaming : draftStreaming
  const activeThinkIdx = mode === 'explain' ? explainThinkIdx : draftThinkIdx
  const activeSteps = mode === 'explain' ? EXPLAIN_STEPS : DRAFT_STEPS
  const activeSuggestions = mode === 'explain' ? EXPLAIN_EXAMPLES : DRAFT_EXAMPLES
  const currentMode: string = mode
  const hasActiveConversation = activeConversationId !== null

  const renderMainContent = () => {
    if (mode === 'draft' && !hasActiveConversation) {
      return (
        <div className="bah-journey-embed" style={{ width: '100%' }}>
          <LearningPlatformPage apiToken={apiToken} onOpenBareActAi={() => setMode('explain')} />
        </div>
      )
    }

    return (
      <div className={`bah-page-container ${hasActiveConversation ? 'bah-page-container--chatting' : ''}`} style={mode === 'draft' ? { paddingLeft: 0 } : undefined}>
        {/* Floating Toggle Button */}
        {mode === 'explain' && (
          <div className="bah-sidebar-toggle-container-floating">
            {!sidebarOpen && (
              <button
                type="button"
                className="bah-sidebar-toggle-btn"
                onClick={() => setSidebarOpen(true)}
                title="Open History"
              >
                <Menu size={18} />
              </button>
            )}
          </div>
        )}

        <div className="bah-page">
          {!hasActiveConversation && <>
            {/* Hero Section */}
            <motion.header
              className="bah-hero"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            >
              <h1 className="bah-hero-title">BARE ACT</h1>
              <p className="bah-hero-subtitle">India&apos;s Intelligent Bare Act Workspace</p>
              <p className="bah-hero-desc">
                Understand statutory provisions or learn how legislation is drafted using AI.
                <br />
                <span className="bah-hero-modes">One workspace. Two intelligent modes.</span>
              </p>
            </motion.header>

            {/* Premium Toggle */}
            <motion.div
              className="bah-toggle-container"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
            >
              <div className="bah-toggle-pill">
                <motion.div
                  className={`bah-toggle-slider ${currentMode === 'draft' ? 'is-draft' : 'is-explain'}`}
                  animate={{
                    x: currentMode === 'explain' ? '0%' : '100%'
                  }}
                  transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                />
                <button
                  type="button"
                  className={`bah-toggle-tab ${currentMode === 'explain' ? 'active' : ''}`}
                  onClick={() => setMode('explain')}
                >
                  <BookOpen size={16} /> Bare Act AI
                </button>
                <button
                  type="button"
                  className={`bah-toggle-tab ${currentMode === 'draft' ? 'active' : ''}`}
                  onClick={() => setMode('draft')}
                >
                  <PenLine size={16} /> Bare Act Drafting Mentor
                </button>
              </div>
            </motion.div>

            {/* Example Suggestions */}
            <div className="bah-suggestions-container">
              <AnimatePresence mode="wait">
                <motion.div
                  key={mode}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bah-suggestions"
                >
                  {activeSuggestions.map((ex) => (
                    <motion.button
                      key={ex}
                      type="button"
                      className={`bah-chip-btn ${currentMode === 'draft' ? 'bah-chip-btn--draft' : ''}`}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setActiveInput(ex)}
                    >
                      {ex}
                    </motion.button>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </>}

          {/* AI Conversation Area */}
          {hasActiveConversation && <div className="bah-conversation-container">
            <motion.div layout className="bah-chat-history" ref={chatContainerRef}>
              {activeMessages.map((msg, idx) => {
                const isLast = idx === activeMessages.length - 1
                const text = isLast && activeStreamText ? activeDisplayed : msg.content
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className={`bah-msg-wrapper ${msg.role === 'user' ? 'user' : 'ai'}`}
                  >
                    {msg.role === 'user' ? (
                      <UserBubble content={msg.content} />
                    ) : (
                      <AiMessage
                        content={text}
                        streaming={isLast ? activeStreaming : false}
                        showCopy={!activeLoading}
                        onAction={(actionType) => handleAction(actionType, idx)}
                      />
                    )}
                  </motion.div>
                )
              })}
              {activeLoading && !activeStreamText && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bah-msg-wrapper ai"
                >
                  <ThinkingBubble steps={activeSteps} idx={activeThinkIdx} />
                </motion.div>
              )}
              <div ref={bottomRef} />
            </motion.div>
          </div>}

          {/* Chat Input */}
          <div className="bah-input-container">
            <ChatInput
              value={activeInput}
              onChange={setActiveInput}
              onSubmit={activeSubmit}
              onFiles={handleFiles}
              loading={activeLoading}
              variant={mode}
              placeholder={
                mode === 'explain'
                  ? 'Ask anything about any Bare Act provision...'
                  : 'Paste a Bare Act provision to learn how Parliament drafted it...'
              }
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bah-workspace-wrapper">
      {/* Sidebar history */}
      {mode === 'explain' && (
        <aside className={`bah-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
          <div className="bah-sidebar-header">
            <div className="bah-sidebar-title-container">
              <div className="bah-sidebar-logo">
                <LegatrixonLogo className="bah-sidebar-logo-img" />
              </div>
              <span className="bah-sidebar-title">LEGATRIXON</span>
            </div>
            <div className="bah-sidebar-toggle-container-inside">
              <button
                type="button"
                className="bah-sidebar-close-btn"
                onClick={() => setSidebarOpen(false)}
                title="Close history drawer"
                style={{ display: 'none' }}
              >
                <X size={16} />
              </button>
              <button
                type="button"
                className="bah-sidebar-toggle-btn"
                onClick={() => setSidebarOpen(false)}
                title="Collapse history"
                style={{ border: 'none', background: 'transparent', boxShadow: 'none', padding: '4px', width: 'auto', height: 'auto' }}
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>

          <div className="bah-sidebar-actions">
            <button type="button" className="bah-new-chat-btn" onClick={handleNewChat}>
              <Plus size={14} />
              <span>New Chat</span>
            </button>
          </div>

          <div className="bah-sidebar-search">
            <Search size={12} className="bah-search-icon" />
            <input
              type="text"
              className="bah-search-input"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="bah-sidebar-content">
            {conversationsLoading && historyPage === 1 ? (
              <div className="bah-skeleton-group">
                <div className="bah-skeleton-title"></div>
                <div className="bah-skeleton-item"></div>
                <div className="bah-skeleton-item"></div>
              </div>
            ) : conversationsError ? (
              <div className="bah-history-error">
                <p>Unable to load conversation history.</p>
                <div className="bah-error-actions">
                  <button type="button" onClick={() => loadConversations(1, searchTerm, false)}>Retry</button>
                </div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="bah-history-empty">
                <p>No previous conversations found.</p>
              </div>
            ) : (
              Object.entries(groupConversations(conversations)).map(([groupName, groupItems]) => {
                if (groupItems.length === 0) return null
                return (
                  <div key={groupName} className="bah-group-container">
                    <h5 className="bah-group-title">{groupName}</h5>
                    {groupItems.map((c) => {
                      const isActive = activeConversationId === c.id
                      const isMenuOpen = activeMenuId === c.id
                      return (
                        <div
                          key={c.id}
                          className={`bah-history-item ${isActive ? 'active' : ''}`}
                          onClick={() => openConversation(c.id)}
                        >
                          <div className="bah-history-item-left">
                            <div className="bah-history-item-title" title={c.title || 'New Chat'}>
                              {c.title || 'New Chat'}
                            </div>
                            <div className="bah-history-item-preview">
                              {cleanPreview(c.last_message || 'No messages yet')}
                            </div>
                            <div className="bah-history-item-footer">
                              <span className={`bah-history-item-mode ${c.mode}`}>
                                {c.mode === 'draft' ? 'Drafting' : 'AI'}
                              </span>
                              <span className="bah-history-item-time">
                                {formatTimeAgo(c.updated_at || c.created_at)}
                              </span>
                            </div>
                          </div>

                          <div className="bah-history-item-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className={`bah-item-actions-trigger ${isMenuOpen ? 'menu-open' : ''}`}
                              onClick={() => setActiveMenuId(isMenuOpen ? null : c.id)}
                            >
                              <MoreVertical size={12} />
                            </button>
                            {isMenuOpen && (
                              <div className="bah-item-dropdown-menu">
                                <button
                                  type="button"
                                  className="bah-dropdown-btn"
                                  onClick={() => {
                                    setRenameId(c.id)
                                    setRenameTitle(c.title || '')
                                    setActiveMenuId(null)
                                  }}
                                >
                                  <Edit3 size={10} />
                                  <span>Rename</span>
                                </button>
                                <button
                                  type="button"
                                  className="bah-dropdown-btn delete"
                                  onClick={() => {
                                    setConfirmDeleteId(c.id)
                                    setActiveMenuId(null)
                                  }}
                                >
                                  <Trash2 size={10} />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )}

            {hasMoreHistory && conversations.length > 0 && !conversationsLoading && (
              <button type="button" className="bah-load-more-btn" onClick={loadMoreHistory}>
                Load More
              </button>
            )}
            {conversationsLoading && historyPage > 1 && (
              <div className="bah-skeleton-group">
                <div className="bah-skeleton-item" style={{ height: '30px' }}></div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Main Workspace content */}
      {renderMainContent()}

      {/* Rename Dialog Modal */}
      {renameId && (
        <div className="bah-dialog-overlay" onClick={() => setRenameId(null)}>
          <div className="bah-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="bah-dialog-title">Rename Conversation</h3>
            <input
              type="text"
              className="bah-dialog-input"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              placeholder="Enter new title..."
              maxLength={45}
              autoFocus
            />
            <div className="bah-dialog-actions">
              <button type="button" className="bah-dialog-btn cancel" onClick={() => setRenameId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="bah-dialog-btn confirm"
                onClick={() => {
                  handleRename(renameId, renameTitle)
                  setRenameId(null)
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog Modal */}
      {confirmDeleteId && (
        <div className="bah-dialog-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="bah-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="bah-dialog-title">Delete Conversation</h3>
            <p className="bah-dialog-desc">Are you sure you want to delete this conversation and all associated messages? This action cannot be undone.</p>
            <div className="bah-dialog-actions">
              <button type="button" className="bah-dialog-btn cancel" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="bah-dialog-btn delete"
                onClick={() => {
                  handleDelete(confirmDeleteId)
                  setConfirmDeleteId(null)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saving / Saved status notification */}
      {savingStatus && (
        <div className={`bah-saving-status ${savingStatus === 'saved' ? 'saved' : ''}`}>
          <span>{savingStatus === 'saving' ? 'Saving...' : 'Saved'}</span>
        </div>
      )}
    </div>
  )
}













