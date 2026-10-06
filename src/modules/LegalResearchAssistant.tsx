import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DemoUsageBadge } from '../components/DemoUsageBadge'
import {
  AlertCircle,
  BarChart2,
  BookMarked,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Download,
  FileDown,
  FileText,
  Folder,
  Gavel,
  GitMerge,
  Globe2,
  Hash,
  History,
  Landmark,
  Library,
  Loader2,
  Plus,
  Printer,
  RotateCcw,
  Scale,
  Search,
  Sparkles,
  Target,
  Upload,
  Zap,
} from 'lucide-react'
import './LegalResearchAssistant.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1'
const FETCH_TIMEOUT_MS = 600_000
const MIN_STAGE_COUNT = 10
const MIN_TOTAL_WORDS_FOR_ACCEPTANCE = 2500

// ─── Types ────────────────────────────────────────────────────────────────────

interface SourceRecord {
  id?: number | string
  title: string
  type?: string
  citation?: string
  url?: string
}

interface StageRecord {
  stageNumber: number
  title: string
  status?: string
  timeSpentMinutes?: number
  readingTimeMinutes?: number
  sourcesFound?: number
  confidenceScore?: number
  summary?: string
  researchNotes?: string
  content?: string
  authoritiesAnalysed?: unknown[]
  caseAnalyses?: unknown[]
  statutoryFindings?: unknown[]
  keyObservations?: string[]
  professionalInsights?: string[]
  nextStep?: string
  keyFindings?: string[]
  sources?: SourceRecord[]
  [key: string]: unknown
}

interface FinalMemorandum {
  title?: string
  researchQuestion?: string
  executiveSummary?: string
  issues?: string
  legalIssues?: string
  applicableLaw?: string
  statutoryAnalysis?: string
  bareActAnalysis?: string
  caseLawAnalysis?: string
  caseAnalysis?: string
  academicAnalysis?: string
  academicOpinion?: string
  comparativeAnalysis?: string
  arguments?: string
  counterArguments?: string
  criticalEvaluation?: string
  criticalAnalysis?: string
  conclusion?: string
  futureDevelopments?: string
  footnotes?: string[]
  bibliography?: Record<string, unknown>
  [key: string]: unknown
}

interface ResearchData {
  sessionId?: string
  question: string
  areaOfLaw?: string
  jurisdiction?: string
  stages: StageRecord[]
  researchLog: string[]
  finalMemorandum?: FinalMemorandum
  provider?: string
  model?: string
}

type Phase = 'ready' | 'running' | 'complete' | 'audit'
type StageStatus = 'pending' | 'active' | 'done'

interface AuditStageRecord {
  stageNumber: number
  stageName: string
  status: 'WAITING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
  durationMs: number | null
  provider: string | null
  model: string | null
  promptTokens: number
  completionTokens: number
  totalTokens: number
  retryCount: number
  fallbackUsed: boolean
  error: string | null
}

interface ExecutionAudit {
  executionId: string
  correlationId: string
  overallStatus: 'SUCCESS' | 'FAILED' | 'PARTIAL'
  progress: number
  executionTimeMs: number
  failureBatch?: string
  failureStage?: string
  failureStageIndex?: number
  failureCategory?: string
  rootCause?: string
  errorMessage?: string
  retryAttempts?: number
  fallbackAttempted?: boolean
  recoverySucceeded?: boolean
  recommendation?: string
  nextAction?: string
  stages: AuditStageRecord[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const stageBlueprint = [
  { title: 'Understand the Question', icon: Target, detail: 'Parsing research context and assumptions', minimum: '800 words', next: 'Design Research Strategy' },
  { title: 'Design Research Strategy', icon: Search, detail: 'Designing search strategy and keywords', minimum: '1000 words', next: 'Statutory Research' },
  { title: 'Statutory Research', icon: Landmark, detail: 'Identifying applicable statutes', minimum: '1500 words', next: 'Bare Act Reading' },
  { title: 'Bare Act Reading', icon: BookOpen, detail: 'Reading provisions section by section', minimum: '2000 words', next: 'Case Law Research' },
  { title: 'Case Law Research', icon: Gavel, detail: 'Analysing binding and persuasive precedents', minimum: '3000 words', next: 'Academic Research' },
  { title: 'Academic Research', icon: Library, detail: 'Reviewing scholarship and reports', minimum: '2000 words', next: 'Conflict Analysis' },
  { title: 'Conflict Analysis', icon: GitMerge, detail: 'Mapping conflicts and grey areas', minimum: '1500 words', next: 'Comparative Law' },
  { title: 'Comparative Law', icon: Globe2, detail: 'Comparing foreign jurisdictions', minimum: '2000 words', next: 'Legal Reasoning' },
  { title: 'Professional Legal Reasoning', icon: Brain, detail: 'Preparing senior-advocate analysis', minimum: '2000 words', next: 'Research Memorandum' },
  { title: 'Professional Research Memorandum', icon: FileText, detail: 'Drafting and finalising the memorandum', minimum: '5000 words', next: 'Ready for export' },
]

const liveTimeline = [
  'Understanding question and assumptions',
  'Designing search strategy',
  'Identifying statutes and delegated law',
  'Reading provisions section by section',
  'Analysing cases and treatment history',
  'Reviewing scholarship and reports',
  'Mapping conflicts and grey areas',
  'Comparing foreign jurisdictions',
  'Preparing senior-advocate reasoning',
  'Drafting final memorandum',
]

const sampleQuestions = [
  'Analyse the doctrine of proportionality under Article 14 with reference to Supreme Court jurisprudence.',
  'Whether anticipatory bail can be granted under BNSS? Discuss with relevant case law.',
  'How do Indian courts test manifest arbitrariness under Article 14? Trace the evolution.',
  'What are the rights of an arrested person under Indian criminal law post-BNSS?',
  'Examine the right to privacy as a fundamental right after K.S. Puttaswamy.',
  'Critically analyse the basic structure doctrine with reference to Kesavananda Bharati.',
]


const LEGAL_FOLDERS = [
  { id: 'constitutional', label: 'Constitutional Law' },
  { id: 'criminal', label: 'Criminal Law' },
  { id: 'civil', label: 'Civil Law' },
  { id: 'corporate', label: 'Corporate Law' },
  { id: 'ipr', label: 'IPR' },
  { id: 'taxation', label: 'Taxation' },
  { id: 'international', label: 'International Law' },
]

// ─── Utility Functions ────────────────────────────────────────────────────────

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : []
}

function normalizeSources(value: unknown): SourceRecord[] {
  if (!Array.isArray(value)) return []
  return value.map((item, index) => {
    if (typeof item === 'string') return { id: index + 1, title: item, citation: item, type: 'source' }
    const record = item as Record<string, unknown>
    return {
      id: (record.id as string | number | undefined) ?? index + 1,
      title: String(record.title ?? record.name ?? record.citation ?? `Source ${index + 1}`),
      type: String(record.type ?? record.kind ?? 'source'),
      citation: String(record.citation ?? record.reference ?? ''),
      url: record.url ? String(record.url) : undefined,
    }
  }).filter((s) => s.title.trim())
}

function stringifyValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (typeof item === 'object' && item !== null) {
        return Object.entries(item as Record<string, unknown>)
          .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1')}: ${stringifyValue(v)}`)
          .join('\n')
      }
      return `${index + 1}. ${stringifyValue(item)}`
    }).filter(Boolean).join('\n\n')
  }
  return Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1')}: ${stringifyValue(v)}`)
    .join('\n')
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70) || 'legal-research'
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function normalizeStage(raw: Record<string, unknown>, index: number): StageRecord {
  const blueprint = stageBlueprint[index] ?? stageBlueprint[stageBlueprint.length - 1]
  const researchNotes = String(raw.researchNotes ?? raw.content ?? '')
  const keyObservations = asStringArray(raw.keyObservations ?? raw.keyFindings)
  const sources = normalizeSources(raw.sources)
  return {
    ...raw,
    stageNumber: Number(raw.stageNumber ?? index + 1),
    title: String(raw.title || blueprint.title),
    status: String(raw.status ?? 'Completed'),
    timeSpentMinutes: Number(raw.timeSpentMinutes ?? raw.readingTimeMinutes ?? Math.max(8, index * 3 + 7)),
    sourcesFound: Number(raw.sourcesFound ?? sources.length),
    summary: raw.summary ? String(raw.summary) : undefined,
    researchNotes,
    content: researchNotes,
    keyObservations,
    professionalInsights: asStringArray(raw.professionalInsights),
    nextStep: String(raw.nextStep ?? blueprint.next),
    keyFindings: keyObservations,
    sources,
  }
}

function buildValidationReport(raw: any, data: ResearchData): string | null {
  const fields: Array<{ key: string; ok: boolean; detail: string }> = []

  const check = (label: string, value: unknown, detail: string) => {
    const ok = value !== null && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)
    fields.push({ key: label, ok, detail: ok ? detail : `❌ ${detail}` })
    return ok
  }

  check('question', data.question, `"${String(data.question ?? '').slice(0, 60)}"`)
  check('areaOfLaw', data.areaOfLaw, String(data.areaOfLaw ?? 'missing'))
  check('jurisdiction', data.jurisdiction, String(data.jurisdiction ?? 'missing'))
  check('stages (array)', raw?.stages, `type=${typeof raw?.stages}`)
  check(`stages.length ≥ ${MIN_STAGE_COUNT}`, (raw?.stages?.length ?? 0) >= MIN_STAGE_COUNT, `received ${raw?.stages?.length ?? 0}`)
  check('finalMemorandum', data.finalMemorandum, typeof data.finalMemorandum === 'object' ? 'present' : `type=${typeof data.finalMemorandum}`)
  check('finalMemorandum.executiveSummary', data.finalMemorandum?.executiveSummary, String(data.finalMemorandum?.executiveSummary ?? 'missing').slice(0, 40))
  check('finalMemorandum.conclusion', data.finalMemorandum?.conclusion, String(data.finalMemorandum?.conclusion ?? 'missing').slice(0, 40))

  const stagesOk = Array.isArray(raw?.stages) && raw.stages.length >= MIN_STAGE_COUNT
  if (stagesOk) {
    for (let i = 0; i < MIN_STAGE_COUNT; i++) {
      const s = raw.stages[i]
      check(`stages[${i}].researchNotes`, s?.researchNotes, `${wordCount(String(s?.researchNotes ?? ''))} words`)
    }
  }

  const totalWords = data.stages.reduce((sum, s) => sum + wordCount(`${s.researchNotes ?? ''} ${s.summary ?? ''}`), 0)
  check(`totalWords ≥ ${MIN_TOTAL_WORDS_FOR_ACCEPTANCE}`, totalWords >= MIN_TOTAL_WORDS_FOR_ACCEPTANCE, `${totalWords} words`)

  const failed = fields.filter(f => !f.ok)
  if (failed.length === 0) return null

  const lines = [
    `Research File Validation — ${failed.length} field(s) failed`,
    '',
    ...fields.map(f => `${f.ok ? '✓' : '❌'} ${f.key}: ${f.detail}`),
    '',
    'Raw response keys: ' + (raw && typeof raw === 'object' ? Object.keys(raw).join(', ') : String(raw)),
    'stages received: ' + (raw?.stages?.length ?? 0),
    'executionStatus: ' + (raw?.executionStatus ?? 'not set'),
  ]
  return lines.join('\n')
}

function validateResearchData(raw: any, data: ResearchData) {
  const report = buildValidationReport(raw, data)
  if (report) throw new Error(report)
}

function normalizeResearchData(raw: any, fallbackQuestion: string): ResearchData {
  const rawStages = Array.isArray(raw?.stages) ? raw.stages : []
  const data: ResearchData = {
    sessionId: raw?.sessionId,
    question: String(raw?.question || fallbackQuestion),
    areaOfLaw: raw?.areaOfLaw ? String(raw.areaOfLaw) : undefined,
    jurisdiction: raw?.jurisdiction ? String(raw.jurisdiction) : undefined,
    stages: rawStages.map((stage: Record<string, unknown>, index: number) => normalizeStage(stage, index)),
    researchLog: Array.isArray(raw?.researchLog) ? raw.researchLog.map(String) : liveTimeline,
    finalMemorandum: raw?.finalMemorandum ?? raw?.finalMemo,
    provider: raw?.provider,
    model: raw?.model,
  }
  validateResearchData(raw, data)
  return data
}

function buildMarkdown(data: ResearchData, mode: 'full' | 'memo' | 'citations' = 'full') {
  const lines: string[] = []
  const memo = data.finalMemorandum
  if (mode !== 'citations') {
    lines.push(`# ${memo?.title || 'Professional Legal Research Memorandum'}`, '')
    lines.push(`Research Question: ${data.question}`)
    if (data.areaOfLaw) lines.push(`Area of Law: ${data.areaOfLaw}`)
    if (data.jurisdiction) lines.push(`Jurisdiction: ${data.jurisdiction}`)
    lines.push('')
  }
  if (mode === 'full') {
    data.stages.forEach((stage) => {
      lines.push(`## Stage ${stage.stageNumber}: ${stage.title}`, '')
      if (stage.summary) lines.push(`Summary: ${stage.summary}`)
      if (stage.researchNotes) lines.push(stage.researchNotes)
      const obs = stage.keyObservations ?? []
      if (obs.length) { lines.push('Key Observations:'); obs.forEach((o) => lines.push(`- ${o}`)) }
      if (stage.professionalInsights?.length) { lines.push('Professional Insights:'); stage.professionalInsights.forEach((i) => lines.push(`- ${i}`)) }
      if (stage.sources?.length) { lines.push('Sources:'); stage.sources.forEach((s) => lines.push(`- ${s.title}${s.citation ? `, ${s.citation}` : ''}`)) }
      lines.push('')
    })
  }
  if (memo && mode !== 'citations') {
    const sections: [string, unknown][] = [
      ['Executive Summary', memo.executiveSummary], ['Research Question', memo.researchQuestion],
      ['Issues', memo.issues ?? memo.legalIssues], ['Applicable Law', memo.applicableLaw],
      ['Statutory Analysis', memo.statutoryAnalysis ?? memo.bareActAnalysis],
      ['Case Law Analysis', memo.caseLawAnalysis ?? memo.caseAnalysis],
      ['Academic Analysis', memo.academicAnalysis ?? memo.academicOpinion],
      ['Comparative Analysis', memo.comparativeAnalysis], ['Arguments', memo.arguments],
      ['Counter Arguments', memo.counterArguments],
      ['Critical Evaluation', memo.criticalEvaluation ?? memo.criticalAnalysis],
      ['Conclusion', memo.conclusion], ['Future Developments', memo.futureDevelopments],
    ]
    lines.push('## Professional Research Memorandum')
    sections.forEach(([label, value]) => {
      const text = stringifyValue(value)
      if (text.trim()) lines.push('', `### ${label}`, text)
    })
  }
  const allSources = data.stages.flatMap((s) => s.sources ?? [])
  if (mode === 'citations') lines.push(`# Citation List: ${data.question}`, '')
  if (memo?.footnotes?.length) { lines.push('', '## OSCOLA Footnotes'); memo.footnotes.forEach((n) => lines.push(String(n))) }
  if (memo?.bibliography) lines.push('', '## Bibliography', stringifyValue(memo.bibliography))
  if (allSources.length) { lines.push('', '## Sources Consulted'); allSources.forEach((s) => lines.push(`- ${s.title}${s.citation ? `, ${s.citation}` : ''}`)) }
  return lines.join('\n')
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Prose({ text }: { text?: string }) {
  if (!text?.trim()) return null
  return (
    <div className="lra-prose">
      {text.split('\n').filter((l) => l.trim()).map((line, i) => {
        const t = line.trim()
        if (/^#{1,4}\s/.test(t)) return <h4 key={i}>{t.replace(/^#{1,4}\s*/, '')}</h4>
        if (/^[-*]\s/.test(t)) return <p key={i} className="lra-bullet">{t.replace(/^[-*]\s*/, '')}</p>
        return <p key={i}>{t}</p>
      })}
    </div>
  )
}

function ObjectNotebookSection({ title, value }: { title: string; value: unknown }) {
  const text = stringifyValue(value)
  if (!text.trim()) return null
  return (
    <section className="lra-nb-sub">
      <h4>{title}</h4>
      <Prose text={text} />
    </section>
  )
}

function StageNotebookEntry({ stage }: { stage: StageRecord }) {
  const bp = stageBlueprint[stage.stageNumber - 1] ?? stageBlueprint[0]
  const Icon = bp.icon
  const noteWords = wordCount(`${stage.researchNotes ?? ''} ${stringifyValue(stage.authoritiesAnalysed)} ${stringifyValue(stage.caseAnalyses)}`)
  const structured: [string, unknown][] = [
    ['Authorities Analysed', stage.authoritiesAnalysed],
    ['Case Notes', stage.caseAnalyses],
    ['Statutory Findings', stage.statutoryFindings],
    ['Conflicts Mapped', (stage as any).conflicts],
    ['Comparative Notes', (stage as any).comparisons],
    ['Search Queries', (stage as any).booleanQueries ?? (stage as any).booleanStrings],
  ]
  return (
    <article className="lra-stage-entry" id={`lra-stage-${stage.stageNumber}`}>
      <div className="lra-stage-rail">
        <div className="lra-stage-num">{stage.stageNumber}</div>
        <div className="lra-stage-line" />
      </div>
      <div className="lra-stage-card">
        <header className="lra-stage-header">
          <div className="lra-stage-title-row">
            <span className="lra-stage-icon"><Icon size={16} /></span>
            <div>
              <p className="lra-stage-label">Stage {stage.stageNumber}</p>
              <h2 className="lra-stage-name">{stage.title}</h2>
            </div>
            <div className="lra-stage-badge lra-badge-done">
              <CheckCircle2 size={12} /> Completed
            </div>
          </div>
          <div className="lra-stage-metrics">
            <span><Clock size={11} /> {stage.timeSpentMinutes ?? '--'} min</span>
            <span><BookMarked size={11} /> {stage.sourcesFound ?? stage.sources?.length ?? 0} sources</span>
            <span><Hash size={11} /> {noteWords} words</span>
          </div>
        </header>
        {stage.summary && (
          <section className="lra-stage-section lra-stage-summary">
            <h3>Research Position</h3>
            <p>{stage.summary}</p>
          </section>
        )}
        <section className="lra-stage-section">
          <h3>Research Notes</h3>
          <Prose text={stage.researchNotes} />
        </section>
        {structured.map(([title, value]) => (
          <ObjectNotebookSection key={title} title={title} value={value} />
        ))}
        {stage.keyObservations?.length ? (
          <section className="lra-stage-section lra-observations">
            <h3>Key Observations</h3>
            <ul>{stage.keyObservations.map((item, i) => <li key={i}>{item}</li>)}</ul>
          </section>
        ) : null}
        {stage.professionalInsights?.length ? (
          <section className="lra-stage-section lra-insights">
            <h3>Professional Insights</h3>
            <ul>{stage.professionalInsights.map((item, i) => <li key={i}>{item}</li>)}</ul>
          </section>
        ) : null}
        {stage.sources?.length ? (
          <section className="lra-stage-section">
            <h3>Sources Consulted</h3>
            <div className="lra-source-grid">
              {stage.sources.map((s, i) => (
                <div className="lra-source-tile" key={i}>
                  <span className="lra-source-type">{s.type || 'source'}</span>
                  <strong>{s.title}</strong>
                  {s.citation && <small>{s.citation}</small>}
                </div>
              ))}
            </div>
          </section>
        ) : null}
        <footer className="lra-stage-next">
          <span>Next Step</span>
          <strong>{stage.nextStep || bp.next}</strong>
        </footer>
      </div>
    </article>
  )
}

function MemoView({ memo }: { memo?: FinalMemorandum }) {
  if (!memo) return null
  const sections: [string, unknown][] = [
    ['Executive Summary', memo.executiveSummary],
    ['Research Question', memo.researchQuestion],
    ['Issues', memo.issues ?? memo.legalIssues],
    ['Applicable Law', memo.applicableLaw],
    ['Statutory Analysis', memo.statutoryAnalysis ?? memo.bareActAnalysis],
    ['Case Law Analysis', memo.caseLawAnalysis ?? memo.caseAnalysis],
    ['Academic Analysis', memo.academicAnalysis ?? memo.academicOpinion],
    ['Comparative Analysis', memo.comparativeAnalysis],
    ['Arguments', memo.arguments],
    ['Counter Arguments', memo.counterArguments],
    ['Critical Evaluation', memo.criticalEvaluation ?? memo.criticalAnalysis],
    ['Conclusion', memo.conclusion],
    ['Future Developments', memo.futureDevelopments],
  ]
  return (
    <article className="lra-memo" id="lra-memo">
      <div className="lra-memo-header">
        <div className="lra-memo-badge"><FileText size={13} /> Final Memorandum</div>
        <h2>{memo.title || 'Professional Research Memorandum'}</h2>
      </div>
      {sections.map(([title, value]) => {
        const text = stringifyValue(value)
        if (!text.trim()) return null
        return (
          <section className="lra-memo-section" key={title as string}>
            <h3>{title as string}</h3>
            <Prose text={text} />
          </section>
        )
      })}
      {memo.footnotes?.length ? (
        <section className="lra-memo-section">
          <h3>OSCOLA Footnotes</h3>
          <ol className="lra-footnotes">{memo.footnotes.map((n, i) => <li key={i}>{n}</li>)}</ol>
        </section>
      ) : null}
      {memo.bibliography ? (
        <section className="lra-memo-section">
          <h3>Bibliography</h3>
          <Prose text={stringifyValue(memo.bibliography)} />
        </section>
      ) : null}
    </article>
  )
}

// ─── Left Sidebar (complete phase only) ──────────────────────────────────────

function LeftSidebar({
  recentResearch,
  currentQuestion,
  onNewResearch,
  onSelectQuestion,
}: {
  recentResearch: string[]
  currentQuestion: string
  onNewResearch: () => void
  onSelectQuestion: (q: string) => void
}) {
  return (
    <aside className="lra-sidebar">
      <div className="lra-sidebar-top">
        <button className="lra-new-btn" onClick={onNewResearch}>
          <Plus size={14} /> New Research
        </button>
      </div>

      <nav className="lra-sidebar-nav">
        {recentResearch.length > 0 && (
          <div className="lra-nav-group">
            <p className="lra-nav-label">History</p>
            {recentResearch.map((q, i) => (
              <button
                key={i}
                className={`lra-nav-item ${q === currentQuestion ? 'lra-nav-item--active' : ''}`}
                onClick={() => onSelectQuestion(q)}
                title={q}
              >
                <FileText size={13} />
                <span>{q.length > 38 ? q.slice(0, 38) + '…' : q}</span>
              </button>
            ))}
          </div>
        )}

        <div className="lra-nav-group">
          <p className="lra-nav-label">Folders</p>
          {LEGAL_FOLDERS.map((f) => (
            <button key={f.id} className="lra-nav-item">
              <Folder size={13} />
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </aside>
  )
}

// ─── Right Sidebar — Agent Monitor (running/complete only) ────────────────────

function AgentMonitor({
  phase,
  activeStep,
  elapsedSeconds,
  authorityCount,
  findings,
  data,
  onExportDocx,
  onExportMarkdown,
}: {
  phase: Phase
  activeStep: number
  elapsedSeconds: number
  authorityCount: number
  findings: string[]
  data: ResearchData | null
  onExportDocx: () => void
  onExportMarkdown: (mode: 'full' | 'memo' | 'citations') => void
}) {
  const totalSources = useMemo(() => data?.stages.reduce((sum, s) => sum + (s.sources?.length ?? 0), 0) ?? 0, [data])
  const totalWords = useMemo(() => data?.stages.reduce((sum, s) => sum + wordCount(s.researchNotes ?? ''), 0) ?? 0, [data])
  const progress = phase === 'complete' ? 100 : Math.round((activeStep / stageBlueprint.length) * 100)
  const confidence = phase === 'complete' ? 94 : Math.min(45 + authorityCount * 3, 89)

  return (
    <aside className="lra-agent">
      <div className="lra-agent-header">
        <div className="lra-agent-title">
          <Zap size={14} className={phase === 'running' ? 'lra-pulse-icon' : ''} />
          <span>AI Research Agent</span>
        </div>
        {phase === 'running' && (
          <span className="lra-agent-status lra-status-running">
            <span className="lra-status-dot" /> Active
          </span>
        )}
        {phase === 'complete' && (
          <span className="lra-agent-status lra-status-done">
            <CheckCircle2 size={11} /> Done
          </span>
        )}
      </div>

      <div className="lra-agent-body">
        <div className="lra-agent-progress-wrap">
          <div className="lra-agent-progress-bar">
            <div className="lra-agent-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="lra-agent-progress-label">{progress}%</span>
        </div>

        <div className="lra-agent-stats">
          <div className="lra-agent-stat">
            <Clock size={13} />
            <div>
              <p className="lra-stat-label">Elapsed</p>
              <p className="lra-stat-val">{formatTime(elapsedSeconds)}</p>
            </div>
          </div>
          <div className="lra-agent-stat">
            <BookMarked size={13} />
            <div>
              <p className="lra-stat-label">Authorities</p>
              <p className="lra-stat-val">{phase === 'complete' ? totalSources : authorityCount}</p>
            </div>
          </div>
          <div className="lra-agent-stat">
            <BarChart2 size={13} />
            <div>
              <p className="lra-stat-label">Confidence</p>
              <p className="lra-stat-val">{confidence}%</p>
            </div>
          </div>
          <div className="lra-agent-stat">
            <Hash size={13} />
            <div>
              <p className="lra-stat-label">Words</p>
              <p className="lra-stat-val">{phase === 'complete' ? totalWords.toLocaleString() : '—'}</p>
            </div>
          </div>
        </div>

        {phase === 'running' && (
          <div className="lra-agent-current">
            <p className="lra-agent-section-label">Current Stage</p>
            <div className="lra-current-stage">
              <Loader2 size={13} className="lra-spin" />
              <span>{stageBlueprint[Math.min(activeStep, 9)]?.title}</span>
            </div>
            <div className="lra-current-detail">
              {stageBlueprint[Math.min(activeStep, 9)]?.detail}
            </div>
          </div>
        )}

        <div className="lra-agent-findings">
          <p className="lra-agent-section-label">
            {phase === 'complete' ? 'Authorities Found' : 'Recent Findings'}
          </p>
          <div className="lra-findings-list">
            {(phase === 'complete'
              ? (data?.stages ?? []).flatMap((s) => s.sources ?? []).slice(0, 10).map((s) => s.title)
              : findings
            ).map((item, i) => (
              <div key={i} className="lra-finding-item">
                <CheckCircle2 size={11} className="lra-finding-check" />
                <span>{item}</span>
              </div>
            ))}
            {(phase === 'running' && findings.length === 0) && (
              <div className="lra-findings-empty">Scanning sources…</div>
            )}
          </div>
        </div>

        {phase === 'complete' && (
          <div className="lra-agent-exports">
            <p className="lra-agent-section-label">Export</p>
            <button className="lra-export-btn" onClick={() => window.print()}>
              <Printer size={13} /> Print PDF
            </button>
            <button className="lra-export-btn" onClick={onExportDocx}>
              <FileDown size={13} /> Download DOCX
            </button>
            <button className="lra-export-btn" onClick={() => onExportMarkdown('full')}>
              <Download size={13} /> Full Markdown
            </button>
            <button className="lra-export-btn" onClick={() => onExportMarkdown('memo')}>
              <FileText size={13} /> Memorandum
            </button>
            <button className="lra-export-btn" onClick={() => onExportMarkdown('citations')}>
              <BookMarked size={13} /> Citations
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

// ─── Minimal Intake (Ready Phase) ─────────────────────────────────────────────

function IntakeScreen({
  question,
  setQuestion,
  error,
  onSubmit,
}: {
  question: string
  setQuestion: (v: string) => void
  error: string
  onSubmit: (q?: string) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="lra-intake-screen">
      <div className="lra-intake-content">
        <div className="lra-intake-brand">
          <Scale size={20} className="lra-brand-scale" />
          <span>AI Legal Research Agent</span>
        </div>

        <h1 className="lra-intake-heading">
          What legal topic would you like to research today?
        </h1>

        <form
          className="lra-intake-form"
          onSubmit={(e) => { e.preventDefault(); onSubmit() }}
        >
          <div className="lra-textarea-wrap">
            <textarea
              ref={textareaRef}
              className="lra-question-area"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your legal research problem…"
              rows={4}
              autoFocus
            />
            <div className="lra-textarea-actions">
              <button type="button" className="lra-upload-btn" title="Upload document">
                <Upload size={15} />
              </button>
              <button
                type="submit"
                className="lra-start-btn"
                disabled={!question.trim()}
              >
                Start Research
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {error && (
            <div className="lra-error">
              <AlertCircle size={14} />
              <span>{error}</span>
              {/upgrade|limit|trial/i.test(error) && <a href="/pricing">View Plans</a>}
            </div>
          )}
        </form>

        <div className="lra-suggestions">
          {sampleQuestions.map((q) => (
            <button
              key={q}
              className="lra-suggestion-chip"
              onClick={() => onSubmit(q)}
              type="button"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Research Progress (Running Phase) ────────────────────────────────────────

function ResearchProgress({
  question,
  activeStep,
  onCancel,
}: {
  question: string
  activeStep: number
  onCancel: () => void
}) {
  return (
    <div className="lra-progress-screen">
      <div className="lra-progress-content">
        <div className="lra-progress-status">
          <Loader2 size={16} className="lra-spin lra-progress-spin" />
          <span>Researching</span>
        </div>

        <h1 className="lra-progress-question">{question}</h1>

        <div className="lra-progress-bar-wrap">
          <div className="lra-progress-track">
            <div
              className="lra-progress-fill"
              style={{ width: `${Math.round((activeStep / stageBlueprint.length) * 100)}%` }}
            />
          </div>
          <span className="lra-progress-pct">
            {Math.round((activeStep / stageBlueprint.length) * 100)}%
          </span>
        </div>

        <div className="lra-stages-list">
          {stageBlueprint.map((stage, i) => {
            const Icon = stage.icon
            const status: StageStatus = i < activeStep ? 'done' : i === activeStep ? 'active' : 'pending'
            return (
              <div key={i} className={`lra-tl-stage lra-tl-stage--${status}`}>
                <div className="lra-tl-icon-wrap">
                  {status === 'done' && <CheckCircle2 size={15} className="lra-tl-check" />}
                  {status === 'active' && <Loader2 size={15} className="lra-spin lra-tl-active-icon" />}
                  {status === 'pending' && <Circle size={15} className="lra-tl-pending-icon" />}
                  {i < stageBlueprint.length - 1 && <div className="lra-tl-connector" />}
                </div>
                <div className="lra-tl-content">
                  <div className="lra-tl-title-row">
                    <Icon size={12} />
                    <strong className="lra-tl-name">{stage.title}</strong>
                    {status === 'active' && <span className="lra-tl-tag lra-tl-tag--active">Running…</span>}
                    {status === 'done' && <span className="lra-tl-tag lra-tl-tag--done">Done</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <button className="lra-cancel-link" onClick={onCancel}>
          Cancel research
        </button>
      </div>
    </div>
  )
}

// ─── Complete Panel ───────────────────────────────────────────────────────────

function CompletePanel({
  data,
  onNewResearch,
}: {
  data: ResearchData
  onNewResearch: () => void
}) {
  return (
    <div className="lra-complete">
      <div className="lra-complete-header no-print">
        <div className="lra-complete-meta">
          <div className="lra-complete-badge">
            <CheckCircle2 size={13} /> Research Complete
          </div>
          <h1 className="lra-complete-question">{data.question}</h1>
          <p className="lra-complete-sub">
            {data.areaOfLaw || 'Indian Legal Research'}
            {data.jurisdiction ? ` · ${data.jurisdiction}` : ''}
            {data.provider ? ` · ${data.provider}` : ''}
          </p>
        </div>
        <button className="lra-new-research-btn" onClick={onNewResearch}>
          <RotateCcw size={14} /> New Research
        </button>
      </div>

      <div className="lra-research-doc">
        {data.stages.map((stage) => (
          <StageNotebookEntry key={stage.stageNumber} stage={stage} />
        ))}
        <MemoView memo={data.finalMemorandum} />
      </div>
    </div>
  )
}

// ─── Audit Panel ─────────────────────────────────────────────────────────────

function AuditPanel({
  audit,
  question,
  onRetry,
  onReset,
}: {
  audit: ExecutionAudit
  question: string
  onRetry: () => void
  onReset: () => void
}) {
  const durationSec = (audit.executionTimeMs / 1000).toFixed(1)

  const stageIcon = (status: AuditStageRecord['status']) => {
    if (status === 'COMPLETED') return <CheckCircle2 size={14} className="ea-stage-icon ea-stage-icon--ok" />
    if (status === 'FAILED') return <AlertCircle size={14} className="ea-stage-icon ea-stage-icon--fail" />
    if (status === 'RUNNING') return <Loader2 size={14} className="ea-stage-icon ea-stage-icon--run" />
    return <Circle size={14} className="ea-stage-icon ea-stage-icon--wait" />
  }

  function downloadAuditJson() {
    const blob = new Blob([JSON.stringify({ question, executionAudit: audit }, null, 2)], { type: 'application/json' })
    downloadBlob(`ExecutionAuditReport-${audit.executionId}.json`, blob)
  }

  const completedCount = audit.stages.filter(s => s.status === 'COMPLETED').length
  const totalStages = audit.stages.length

  return (
    <div className="ea-panel">
      {/* Header */}
      <div className="ea-header">
        <div className="ea-header-left">
          <div className="ea-status-badge ea-status-badge--failed">
            <AlertCircle size={13} /> Execution Failed
          </div>
          <h2 className="ea-question">{question}</h2>
          <div className="ea-meta-row">
            <span className="ea-meta-chip"><Hash size={10} /> {audit.executionId}</span>
            <span className="ea-meta-chip"><Zap size={10} /> {durationSec}s</span>
            <span className="ea-meta-chip"><BarChart2 size={10} /> {audit.progress}% complete</span>
            <span className="ea-meta-chip"><CheckCircle2 size={10} /> {completedCount}/{totalStages} stages</span>
          </div>
        </div>
        <button className="ea-new-btn" onClick={onReset}>
          <RotateCcw size={13} /> New Research
        </button>
      </div>

      <div className="ea-body">
        {/* Pipeline Timeline */}
        <section className="ea-section">
          <h3 className="ea-section-title"><Target size={13} /> Pipeline Execution Timeline</h3>
          <div className="ea-timeline">
            {audit.stages.map((s) => (
              <div key={s.stageNumber} className={`ea-tl-row ea-tl-row--${s.status.toLowerCase()}`}>
                <div className="ea-tl-icon">{stageIcon(s.status)}</div>
                <div className="ea-tl-body">
                  <div className="ea-tl-name">
                    <span>{s.stageName}</span>
                    <span className={`ea-tl-badge ea-tl-badge--${s.status.toLowerCase()}`}>{s.status}</span>
                  </div>
                  {s.durationMs != null && (
                    <div className="ea-tl-detail"><Clock size={10} /> {(s.durationMs / 1000).toFixed(1)}s{s.provider ? ` · ${s.provider}` : ''}</div>
                  )}
                  {s.error && <div className="ea-tl-error"><AlertCircle size={10} /> {s.error.slice(0, 120)}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Failure Details */}
        {audit.failureStage && (
          <section className="ea-section">
            <h3 className="ea-section-title"><AlertCircle size={13} /> Failure Diagnostics</h3>
            <div className="ea-detail-grid">
              <div className="ea-detail-row"><span className="ea-detail-label">Failed At</span><span className="ea-detail-value">{audit.failureStage}</span></div>
              <div className="ea-detail-row"><span className="ea-detail-label">Batch</span><span className="ea-detail-value">{audit.failureBatch}</span></div>
              <div className="ea-detail-row"><span className="ea-detail-label">Root Cause</span><span className="ea-detail-value ea-detail-value--cause">{audit.rootCause?.replace(/_/g, ' ')}</span></div>
              <div className="ea-detail-row"><span className="ea-detail-label">Category</span><span className="ea-detail-value">{audit.failureCategory}</span></div>
              <div className="ea-detail-row"><span className="ea-detail-label">Retry Attempts</span><span className="ea-detail-value">{audit.retryAttempts ?? 0}</span></div>
              <div className="ea-detail-row"><span className="ea-detail-label">Fallback Tried</span><span className="ea-detail-value">{audit.fallbackAttempted ? 'Yes' : 'No'}</span></div>
              <div className="ea-detail-row"><span className="ea-detail-label">Recovery</span><span className="ea-detail-value ea-detail-value--fail">{audit.recoverySucceeded ? 'Succeeded' : 'Failed'}</span></div>
              {audit.errorMessage && (
                <div className="ea-detail-row ea-detail-row--full">
                  <span className="ea-detail-label">Error Message</span>
                  <span className="ea-detail-value ea-error-msg">{audit.errorMessage.slice(0, 300)}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Recommendation */}
        {audit.recommendation && (
          <section className="ea-section ea-section--rec">
            <h3 className="ea-section-title"><Sparkles size={13} /> Recommended Fix</h3>
            <p className="ea-rec-text">{audit.recommendation}</p>
            {audit.nextAction && (
              <div className="ea-next-action">
                <strong>Next Action:</strong> {audit.nextAction}
              </div>
            )}
          </section>
        )}

        {/* Correlation IDs */}
        <section className="ea-section ea-section--ids">
          <h3 className="ea-section-title"><Hash size={13} /> Execution Identifiers</h3>
          <div className="ea-detail-grid">
            <div className="ea-detail-row"><span className="ea-detail-label">Execution ID</span><code className="ea-code">{audit.executionId}</code></div>
            <div className="ea-detail-row"><span className="ea-detail-label">Correlation ID</span><code className="ea-code">{audit.correlationId}</code></div>
            <div className="ea-detail-row"><span className="ea-detail-label">Execution Time</span><span className="ea-detail-value">{durationSec}s</span></div>
            <div className="ea-detail-row"><span className="ea-detail-label">Progress</span><span className="ea-detail-value">{audit.progress}%</span></div>
          </div>
        </section>

        {/* Actions */}
        <div className="ea-actions">
          <button className="ea-btn ea-btn--primary" onClick={onRetry}>
            <RotateCcw size={14} /> Retry Research
          </button>
          <button className="ea-btn ea-btn--secondary" onClick={downloadAuditJson}>
            <Download size={14} /> Download Audit JSON
          </button>
          <button className="ea-btn ea-btn--ghost" onClick={onReset}>
            New Research
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LegalResearchAssistant({ apiToken }: { apiToken: string }) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [question, setQuestion] = useState('')
  const [activeStep, setActiveStep] = useState(0)
  const [data, setData] = useState<ResearchData | null>(null)
  const [auditData, setAuditData] = useState<ExecutionAudit | null>(null)
  const [error, setError] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [authorityCount, setAuthorityCount] = useState(0)
  const [findings, setFindings] = useState<string[]>([])
  const [recentResearch, setRecentResearch] = useState<string[]>([])

  const abortRef = useRef<AbortController | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      clearInterval(intervalRef.current!)
      clearInterval(timerRef.current!)
    }
  }, [])

  const startLiveEffects = useCallback(() => {
    setElapsedSeconds(0)
    setAuthorityCount(0)
    setFindings([])

    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1)
    }, 1000)
  }, [])

  const stopLiveEffects = useCallback(() => {
    clearInterval(timerRef.current!)
  }, [])

  async function runResearch(nextQuestion = question) {
    const cleanQ = nextQuestion.trim()
    if (!cleanQ) return

    setQuestion(cleanQ)
    setError('')
    setData(null)
    setPhase('running')
    setActiveStep(0)
    startLiveEffects()

    clearInterval(intervalRef.current!)
    intervalRef.current = setInterval(
      () => setActiveStep((s) => Math.min(s + 1, stageBlueprint.length - 1)),
      6500,
    )

    abortRef.current = new AbortController()
    const timer = setTimeout(() => abortRef.current?.abort(), FETCH_TIMEOUT_MS)

    try {
      const body: Record<string, string> = { question: cleanQ }
      const response = await fetch(`${API_BASE_URL}/legal-intelligence/research-assistant/conduct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      })
      clearTimeout(timer)
      const rawText = await response.text()
      let json: any = null
      try { json = rawText ? JSON.parse(rawText) : null } catch { json = null }

      clearInterval(intervalRef.current!)
      stopLiveEffects()

      if (!response.ok) {
        const msg = Array.isArray(json?.message) ? json.message.join(' ') : json?.message || json?.error || ''
        throw new Error(msg || `Research failed with status ${response.status}.`)
      }

      if (json?.executionStatus === 'FAILED') {
        setAuditData(json.executionAudit ?? null)
        setPhase('audit')
        return
      }

      setActiveStep(stageBlueprint.length)
      try {
        const normalized = normalizeResearchData(json, cleanQ)
        setData(normalized)

        // Populate findings from the actual AI-returned sources — no hardcoding
        const realAuthorities = normalized.stages
          .flatMap((s: any) => s.sources ?? [])
          .map((src: any) => src.title ?? src.citation ?? '')
          .filter(Boolean)
        const unique = [...new Set<string>(realAuthorities)]
        setFindings(unique)
        setAuthorityCount(unique.length)

        setPhase('complete')
        setRecentResearch((prev) => [cleanQ, ...prev.filter((q) => q !== cleanQ)].slice(0, 8))
      } catch (validationErr: any) {
        // Backend claimed SUCCESS but returned invalid/incomplete data — treat as AI failure
        const syntheticAudit: ExecutionAudit = json?.executionAudit ?? {
          executionId: `exec_frontend_${Date.now()}`,
          correlationId: `corr_frontend_${Math.random().toString(36).slice(2, 10)}`,
          overallStatus: 'FAILED' as const,
          progress: 0,
          executionTimeMs: 0,
          failureBatch: 'Response Schema Validation',
          failureStage: 'Schema Validation',
          failureCategory: 'SCHEMA VALIDATION FAILURE',
          rootCause: 'SCHEMA_VALIDATION_FAILURE',
          errorMessage: validationErr?.message || 'Unknown validation error',
          retryAttempts: 0,
          fallbackAttempted: false,
          recoverySucceeded: false,
          recommendation: 'The AI returned data but it failed schema validation. Retry the research with the same or a narrower question.',
          nextAction: 'Click Retry Research',
          stages: [],
        }
        setAuditData(syntheticAudit)
        setPhase('audit')
      }
    } catch (err: any) {
      clearTimeout(timer)
      clearInterval(intervalRef.current!)
      stopLiveEffects()

      const isTimeout = err?.name === 'AbortError'
      const isNetworkError = err?.name === 'TypeError' || err?.message === 'Failed to fetch'

      if (isTimeout || isNetworkError) {
        // Show the audit panel with a clear diagnosis instead of silently resetting to home
        const networkAudit: ExecutionAudit = {
          executionId: `exec_network_${Date.now()}`,
          correlationId: `corr_${Math.random().toString(36).slice(2, 10)}`,
          overallStatus: 'FAILED',
          progress: 0,
          executionTimeMs: FETCH_TIMEOUT_MS,
          failureBatch: 'Network / Transport',
          failureStage: isTimeout ? 'Request Timeout' : 'Network Connection',
          failureStageIndex: 0,
          failureCategory: isTimeout ? 'PROVIDER_TIMEOUT' : 'NETWORK_ERROR',
          rootCause: isTimeout ? 'PROVIDER_TIMEOUT' : 'NETWORK_ERROR',
          errorMessage: isTimeout
            ? 'The research pipeline exceeded the 10-minute timeout. The AI providers took too long to respond.'
            : `Network connection to the research server failed: ${err?.message || 'Failed to fetch'}. Ensure the NestJS server is running on port 4001.`,
          retryAttempts: 0,
          fallbackAttempted: false,
          recoverySucceeded: false,
          recommendation: isTimeout
            ? 'Retry with a more specific/shorter legal question, or wait a moment for provider load to decrease'
            : 'Check that the NestJS server is running (cd server && npm run start:dev) then retry',
          nextAction: 'Click Retry Research',
          stages: [],
        }
        setAuditData(networkAudit)
        setPhase('audit')
      } else {
        setPhase('ready')
        setError(err?.message || 'The research run failed.')
      }
    }
  }

  function resetWorkspace() {
    abortRef.current?.abort()
    clearInterval(intervalRef.current!)
    stopLiveEffects()
    setPhase('ready')
    setData(null)
    setAuditData(null)
    setActiveStep(0)
    setError('')
    setFindings([])
    setAuthorityCount(0)
    setElapsedSeconds(0)
  }

  async function exportDocx() {
    if (!data) return
    const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import('docx')
    const children = buildMarkdown(data).split('\n').map((line) => {
      if (line.startsWith('# ')) return new Paragraph({ text: line.slice(2), heading: HeadingLevel.TITLE })
      if (line.startsWith('## ')) return new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_1 })
      if (line.startsWith('### ')) return new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_2 })
      if (line.startsWith('- ')) return new Paragraph({ children: [new TextRun(line.slice(2))], bullet: { level: 0 } })
      return new Paragraph({ text: line || ' ' })
    })
    const doc = new Document({ sections: [{ properties: {}, children }] })
    const blob = await Packer.toBlob(doc)
    downloadBlob(`${safeFileName(data.question)}.docx`, blob)
  }

  function exportMarkdown(mode: 'full' | 'memo' | 'citations') {
    if (!data) return
    const suffix = mode === 'full' ? 'research-notebook' : mode === 'memo' ? 'memorandum' : 'citation-list'
    downloadBlob(
      `${safeFileName(data.question)}-${suffix}.md`,
      new Blob([buildMarkdown(data, mode)], { type: 'text/markdown;charset=utf-8' }),
    )
  }

  const showSidebars = phase === 'complete'
  const showAgentPanel = phase === 'running' || phase === 'complete'

  return (
    <div className={`lra-workspace lra-workspace--${phase}`}>
      <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 40 }}><DemoUsageBadge feature="legal_research" /></div>
      {showSidebars && (
        <LeftSidebar
          recentResearch={recentResearch}
          currentQuestion={question}
          onNewResearch={resetWorkspace}
          onSelectQuestion={(q) => { setQuestion(q); setPhase('ready') }}
        />
      )}

      <div className="lra-center">
        {phase === 'ready' && (
          <IntakeScreen
            question={question}
            setQuestion={setQuestion}
            error={error}
            onSubmit={runResearch}
          />
        )}
        {phase === 'running' && (
          <ResearchProgress
            question={question}
            activeStep={activeStep}
            onCancel={resetWorkspace}
          />
        )}
        {phase === 'audit' && auditData && (
          <AuditPanel
            audit={auditData}
            question={question}
            onRetry={() => { setAuditData(null); runResearch(question) }}
            onReset={resetWorkspace}
          />
        )}
        {phase === 'complete' && data && (
          <CompletePanel
            data={data}
            onNewResearch={resetWorkspace}
          />
        )}
      </div>

      {showAgentPanel && (
        <AgentMonitor
          phase={phase}
          activeStep={activeStep}
          elapsedSeconds={elapsedSeconds}
          authorityCount={authorityCount}
          findings={findings}
          data={data}
          onExportDocx={exportDocx}
          onExportMarkdown={exportMarkdown}
        />
      )}
    </div>
  )
}
