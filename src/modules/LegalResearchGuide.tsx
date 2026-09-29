import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Flame,
  Loader2,
  LockKeyhole,
  Medal,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Sparkles,
  Star,
  Target,
} from 'lucide-react'
import { useAuth } from '@clerk/clerk-react'
import { API_BASE_URL } from '../lib/api'
import './LegalResearchGuide.css'

// ─── Data ─────────────────────────────────────────────────────────────────────

const phases = [
  ['UNDERSTAND THE PROBLEM', ['Read the Topic Carefully', 'Break the Topic into Legal Questions', 'Identify Keywords']],
  ['FIND THE LEGAL FRAMEWORK', ['Identify Constitutional Provisions', 'Identify Primary Legislation', 'Read the Bare Act Completely', 'Identify Delegated Legislation']],
  ['UNDERSTAND THE LAW', ['Read Definitions First', 'Read Every Relevant Section', 'Cross-reference Sections']],
  ['JUDICIAL RESEARCH', ['Find Landmark Supreme Court Judgments', 'Find High Court Judgments', 'Arrange Judgments Chronologically', 'Extract Legal Principles', 'Check Whether Cases Are Still Good Law']],
  ['LEGISLATIVE INTENT', ['Read Statement of Objects and Reasons', 'Study Parliamentary Debates', 'Study Committee Reports', 'Study Law Commission Reports']],
  ['SECONDARY RESEARCH', ['Read Authoritative Commentaries', 'Read Research Papers', 'Read Journal Articles']],
  ['COMPARATIVE RESEARCH', ['Study Foreign Jurisdictions', 'Compare Indian Law with Foreign Law']],
  ['PRACTICAL RESEARCH', ['Read Government Material', 'Study Regulatory Bodies', 'Find Recent Amendments', 'Find Current Litigation']],
  ['CRITICAL ANALYSIS', ['Identify Legal Gaps', 'Identify Conflicting Judgments', 'Evaluate Practical Challenges', 'Identify Future Challenges']],
  ['ORGANIZE THE RESEARCH', ['Create a Research Outline', 'Prepare Case Notes', 'Prepare Statutory Notes', 'Prepare a Chronology', 'Write the Legal Analysis', 'Write the Conclusion']],
  ['FINAL VERIFICATION', ['Verify Every Citation', 'Update the Research']],
] as const

const lessons = phases.flatMap((p, pi) => p[1].map((title) => ({ phase: pi + 1, phaseName: p[0], title })))

const explanations = [
  'Read the assignment slowly before opening any database. Identify the topic, jurisdiction, time period, legal relationship and the type of answer required.',
  'Turn one broad topic into smaller questions about rights, duties, limitations, procedure, remedies and the current legal position.',
  'Prepare factual, statutory and doctrinal search terms. Add synonyms and exact phrases that may appear in legislation or judgments.',
  'Check relevant Articles, Parts, Schedules and constitutional amendments. Record why each provision may apply.',
  'Identify every parent Act that may govern the issue. Confirm territorial extent, commencement and current version.',
  'Read the official text, not a summary. Review the preamble, definitions, operative sections, exceptions, explanations, illustrations and schedules.',
  'Locate rules, regulations, notifications, orders, circulars and guidelines. Trace each instrument to its enabling section.',
  'Definitions control statutory meaning. Note inclusive, exclusive and deeming definitions before interpreting operative provisions.',
  'For every provision record its purpose, scope, ingredients, conditions, procedure, consequence and exceptions.',
  'Map every reference from one section to another, including rules and schedules. A provision rarely works alone.',
  'Find leading Supreme Court cases using the provision, exact legal phrase and fact pattern. Record citation, bench and relevant paragraphs.',
  'Compare relevant High Court approaches, especially the territorial court and recent decisions.',
  'Build a timeline showing how doctrine developed from early cases to the current position.',
  'Extract the tests, standards, burdens, exceptions and judicial guidelines—not merely quotations.',
  'Check whether every important case was followed, approved, distinguished, modified, reversed or overruled.',
  'Use Objects and Reasons to understand the problem, background and policy goal without overriding clear enacted text.',
  'Use debates to identify concerns, alternatives and reasons for legislative changes. Describe their persuasive weight accurately.',
  'Review Standing, Joint, Select and Department-related Committee reports for drafting rationale and evidence.',
  'Separate the Law Commission\'s diagnosed problem, comparative analysis, recommendation and whether Parliament adopted it.',
  'Use reputable, current commentaries to orient research and discover primary authorities. Verify those authorities yourself.',
  'Review scholarly papers for detailed analysis, policy debate, evidence and reform proposals.',
  'Use peer-reviewed journals to identify arguments, counterarguments and recent doctrinal developments.',
  'Select comparable jurisdictions for a reason and use official foreign legislation and judgments.',
  'Compare definitions, rights, institutions, procedure, remedies, enforcement and safeguards in a common table.',
  'Review official FAQs, white papers, policy documents, manuals and press releases, noting their different legal weight.',
  'Identify the regulator and review its powers, guidance, circulars, advisories and enforcement decisions.',
  'Check amendments, repeals, substitutions, commencement dates and transition provisions. State a research cut-off date.',
  'Identify pending challenges, references, PILs and important unresolved matters without treating them as decided law.',
  'State what is ambiguous, missing or internally inconsistent. Distinguish a legal gap from an enforcement gap.',
  'Map the competing proposition, court, bench, facts, reasoning and territorial relevance.',
  'Evaluate implementation, enforcement, compliance costs, administrative capacity and access-to-justice concerns.',
  'Consider technological, social, economic, constitutional and international developments that may test the law.',
  'Create issue-based headings before drafting. Link each heading to the authorities and facts it requires.',
  'Record case name, citation, court, bench, facts, issue, holding, ratio, significance and current status.',
  'Record the statute\'s purpose, provisions, definitions, powers, duties, procedure, penalties, exceptions and amendments.',
  'Combine enactments, amendments, landmark cases and policy developments into one dated timeline.',
  'Synthesize the rule, authority, factual application, counterargument and qualified conclusion for each issue.',
  'Summarize the current position, key principles, unresolved questions and possible reform without introducing new sources.',
  'Reopen every source. Confirm statutory references, case citations, pinpoints, quotations and bibliography entries.',
  'Before submission, check for new amendments, judgments, notifications and rules. Record the final verification date.',
]

const examples = [
  'Privacy Rights in India: first decide whether the issue concerns State surveillance, a private company, personal data, or all three.',
  'Privacy becomes questions about Article 21, applicable data law, consent, surveillance, restrictions, remedies and current cases.',
  'Use: right to privacy, informational privacy, Article 21, personal data, surveillance, consent and proportionality.',
  'For privacy, begin with Articles 21, 14 and 19, then verify the actor and constitutional route.',
  'For workplace biometrics, identify current data-protection, information-technology and employment-related legislation.',
  'For the Contract Act, read definitions and connected validity provisions before deciding whether an agreement is enforceable.',
  'A statutory notification may commence or operationalise a provision; an informal FAQ usually cannot.',
]

const mistakes = [
  'Searching before defining the problem.',
  'Writing a question that already assumes the conclusion.',
  'Using only everyday language instead of statutory terms.',
  'Listing Articles without explaining their connection to the facts.',
  'Starting from a textbook instead of current legislation.',
  'Reading one section without definitions, provisos or schedules.',
  'Treating every circular as binding law.',
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// ─── Storage key ──────────────────────────────────────────────────────────────

const KEY = 'legatrixon-simple-research-guide-v1'

// ─── Component ────────────────────────────────────────────────────────────────

export default function LegalResearchGuide() {
  // ── Progress state ──
  const [done, setDone] = useState(() => Number(localStorage.getItem(KEY) || 0))
  const [active, setActive] = useState(() => Math.min(Number(localStorage.getItem(KEY) || 0), 39))

  // ── Sidebar state ──
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // ── AI state ──
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // ── Auth ──
  const { getToken, isSignedIn } = useAuth()
  const [apiToken, setApiToken] = useState('')

  // ── Refs ──
  const aiInputRef = useRef<HTMLTextAreaElement>(null)
  const aiBottomRef = useRef<HTMLDivElement>(null)

  // ── Persist progress ──
  useEffect(() => {
    localStorage.setItem(KEY, String(done))
  }, [done])

  // ── Fetch token when signed in ──
  useEffect(() => {
    if (isSignedIn) {
      getToken().then((t) => setApiToken(t || ''))
    } else {
      setApiToken('')
    }
  }, [isSignedIn, getToken])

  // ── Reset AI conversation when lesson changes ──
  useEffect(() => {
    setAiMessages([])
    setAiInput('')
    setAiError(null)
  }, [active])

  // ── Scroll AI messages to bottom ──
  useEffect(() => {
    aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages, aiLoading])

  // ─── Derived values ───────────────────────────────────────────────────────

  const lesson = lessons[active]
  const pct = Math.round((done / 40) * 100)
  const example = examples[Math.min(active, 6)] || `Apply this step to Privacy Rights, Bail under BNSS, Contract Law or any other legal topic.`
  const mistake = mistakes[Math.min(active, 6)] || 'Collecting information without recording its authority, date and relevance.'

  // ─── Lesson navigation ────────────────────────────────────────────────────

  function select(i: number) {
    if (i <= done) {
      setActive(i)
    }
  }

  function complete() {
    const next = Math.max(done, active + 1)
    setDone(next)
    if (active < 39) {
      setActive(active + 1)
    }
  }

  // ─── Build lesson context for AI ─────────────────────────────────────────

  function buildLessonContext(): string {
    const lessonExample = examples[Math.min(active, 6)] || 'Apply this step to any legal research problem.'
    const lessonMistake = mistakes[Math.min(active, 6)] || 'Collecting information without recording its authority, date and relevance.'
    const lessonExplanation = explanations[active] || ''

    return `[LEXMENTOR LESSON CONTEXT]
You are LexMentor, the AI teaching assistant for the LEGATRIXON Legal Research Guide.
The student is currently studying the following lesson. Answer ONLY questions relevant to this lesson.

Module: ${lesson.phaseName}
Lesson ${active + 1} of 40: ${lesson.title}
Learning Objective: Learn how to ${lesson.title.toLowerCase()} professionally.
Explanation: ${lessonExplanation}
Real Indian Example: ${lessonExample}
Common Beginner Mistake: ${lessonMistake}
Professional Research Principle: Record the source, legal weight, date and relevance of every research finding.

IMPORTANT RULES:
1. Answer questions about the concepts in this specific lesson.
2. Use simple, clear language suitable for a law student.
3. Give concrete examples when helpful.
4. If the student asks about a topic unrelated to this lesson, respond: "That topic goes beyond this lesson. I can help you with the concepts covered in this lesson — for example, I can explain ${lesson.title.toLowerCase()}."
5. Do not make up law. Stay grounded in the lesson content above.
[END CONTEXT]

Student question: `
  }

  // ─── Send AI query ────────────────────────────────────────────────────────

  async function handleAskLexMentor() {
    const text = aiInput.trim()
    if (!text || aiLoading) return

    setAiInput('')
    setAiError(null)

    if (aiInputRef.current) {
      aiInputRef.current.style.height = 'auto'
    }

    const userMsg: AiMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    }
    setAiMessages((prev) => [...prev, userMsg])
    setAiLoading(true)

    // If not signed in, show a helpful message
    if (!isSignedIn) {
      setTimeout(() => {
        setAiMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: 'Please log in to use the Ask LexMentor feature. Once signed in, I can answer your questions about this lesson.',
          },
        ])
        setAiLoading(false)
      }, 500)
      return
    }

    // Build a lesson-scoped session ID so conversations are isolated per lesson
    const sessionId = `lrg_lesson_${active}_${Date.now().toString(36)}`
    const contextualMessage = buildLessonContext() + text

    try {
      const res = await fetch(`${API_BASE_URL}/chat/guidebot/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          sessionId,
          message: contextualMessage,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      const content: string = data.content || data.message || data.reply || ''

      if (!content) throw new Error('Empty response from AI')

      // Word-by-word streaming effect
      const assistantMsgId = `a-${Date.now()}`
      setAiMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: 'assistant', content: '' },
      ])
      setAiLoading(false)

      const words = content.split(' ')
      let currentIndex = 0
      let streamed = ''

      const interval = setInterval(() => {
        if (currentIndex < words.length) {
          streamed += (currentIndex === 0 ? '' : ' ') + words[currentIndex]
          setAiMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: streamed } : m))
          )
          currentIndex++
        } else {
          clearInterval(interval)
        }
      }, 35)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[LexMentor AI] Request failed:', err)
      }
      setAiLoading(false)
      setAiError('LexMentor couldn\'t answer right now. Please try again.')
    }
  }

  function handleAiKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAskLexMentor()
    }
  }

  function autoResizeInput() {
    if (aiInputRef.current) {
      aiInputRef.current.style.height = 'auto'
      aiInputRef.current.style.height = `${Math.min(aiInputRef.current.scrollHeight, 120)}px`
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={`srg${sidebarOpen ? '' : ' srg--collapsed'}`}>

      {/* ── SIDEBAR ── */}
      <aside className={`srg-aside${sidebarOpen ? '' : ' srg-aside--hidden'}`}>

        {/* Brand */}
        <div className="srg-brand">
          <span
            className="legatrixon-logo-circle"
            style={{ width: '38px', height: '38px', flexShrink: 0 }}
          />
          <span>
            <b>LexMentor</b>
            <small>Research Academy</small>
          </span>
        </div>

        {/* Journey header + collapse toggle */}
        <div className="srg-journey">
          <span>
            <b>YOUR JOURNEY</b>
            <span className="srg-journey-count">{done} of 40 lessons</span>
          </span>
          <button
            className="srg-sidebar-toggle"
            onClick={() => setSidebarOpen(false)}
            title="Collapse sidebar"
            type="button"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        <button className="srg-notebook">
          <NotebookPen />
          Research Notebook
          <b>{done}</b>
        </button>

        <nav>
          {phases.map((phase, pi) => {
            const start = phases.slice(0, pi).reduce((n, p) => n + p[1].length, 0)
            return (
              <section key={phase[0]}>
                <h3>{phase[0]}</h3>
                {phase[1].map((name, li) => {
                  const i = start + li
                  const locked = i > done
                  const current = i === active
                  return (
                    <button
                      key={i}
                      className={current ? 'current' : i < done ? 'complete' : 'locked'}
                      disabled={locked}
                      onClick={() => select(i)}
                      type="button"
                    >
                      {i < done ? <CheckCircle2 /> : locked ? <LockKeyhole /> : <BookOpen />}
                      <span>
                        <small>Lesson {i + 1}</small>
                        <b>{name}</b>
                      </span>
                    </button>
                  )
                })}
              </section>
            )
          })}
        </nav>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="srg-main">

        {/* Sticky header */}
        <header className="srg-header">
          {/* Expand button (only visible when sidebar is collapsed) */}
          {!sidebarOpen && (
            <button
              className="srg-expand-btn"
              onClick={() => setSidebarOpen(true)}
              title="Expand sidebar"
              type="button"
            >
              <PanelLeftOpen size={16} />
            </button>
          )}

          <div className="srg-header-progress">
            <b>{pct}% complete</b>
            <span>{40 - done} lessons remaining · about {(40 - done) * 4} min</span>
            <i><em style={{ width: pct + '%' }} /></i>
          </div>

          <section className="srg-header-stats">
            <span>
              <Flame />
              <b>7</b>
              <small>day streak</small>
            </span>
            <span>
              <Star />
              <b>{done * 50}</b>
              <small>total XP</small>
            </span>
            <span>
              <Target />
              <b>{pct}</b>
              <small>research score</small>
            </span>
          </section>
        </header>

        {/* Lesson article */}
        <article className="srg-lesson">
          <div className="srg-meta">
            <b>PHASE {lesson.phase} · LESSON {active + 1} OF 40</b>
            <span><Clock3 />3–5 min</span>
            <span><Medal />+50 XP</span>
          </div>

          <div className="srg-title">
            <i><BookOpen /></i>
            <span>
              <small>{lesson.phaseName}</small>
              <h1>{lesson.title}</h1>
            </span>
          </div>

          <div className="srg-grid">
            {/* Left column: lesson content */}
            <section className="srg-content">
              <label>1 · LEARNING OBJECTIVE</label>
              <h2>Learn how to {lesson.title.toLowerCase()} professionally.</h2>

              <label>2 · SIMPLE EXPLANATION</label>
              <p>{explanations[active]}</p>

              <div className="srg-principle">
                <Target />
                <span>
                  <b>Professional research principle</b>
                  <p>Record the source, legal weight, date and relevance of every research finding.</p>
                </span>
              </div>

              {/* ── ASK LEXMENTOR ── */}
              <div className="srg-ask">
                <div className="srg-ask-header">
                  <Sparkles size={15} />
                  <span>Ask LexMentor about this lesson</span>
                </div>

                {/* Conversation messages */}
                {aiMessages.length > 0 && (
                  <div className="srg-ai-conversation">
                    {aiMessages.map((msg) => (
                      <div key={msg.id} className={`srg-ai-msg srg-ai-msg--${msg.role}`}>
                        {msg.role === 'assistant' ? (
                          <div className="srg-ai-card">
                            <div className="srg-ai-card-header">
                              <Sparkles size={13} />
                              <span>LEXMENTOR AI</span>
                            </div>
                            <p>{msg.content}</p>
                          </div>
                        ) : (
                          <div className="srg-ai-user-bubble">
                            <p>{msg.content}</p>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Loading state */}
                    {aiLoading && (
                      <div className="srg-ai-card srg-ai-card--loading">
                        <div className="srg-ai-card-header">
                          <Sparkles size={13} />
                          <span>LEXMENTOR AI</span>
                        </div>
                        <div className="srg-ai-thinking">
                          <Loader2 size={14} className="srg-ai-spinner" />
                          <span>Thinking about this lesson...</span>
                        </div>
                      </div>
                    )}

                    {/* Error state */}
                    {aiError && !aiLoading && (
                      <div className="srg-ai-card srg-ai-card--error">
                        <p>{aiError}</p>
                        <button
                          type="button"
                          className="srg-ai-retry"
                          onClick={() => {
                            setAiError(null)
                            handleAskLexMentor()
                          }}
                        >
                          Try Again
                        </button>
                      </div>
                    )}

                    <div ref={aiBottomRef} />
                  </div>
                )}

                {/* Loading when no messages yet */}
                {aiLoading && aiMessages.filter(m => m.role === 'assistant').length === 0 && (
                  <div className="srg-ai-card srg-ai-card--loading" style={{ marginBottom: '12px' }}>
                    <div className="srg-ai-card-header">
                      <Sparkles size={13} />
                      <span>LEXMENTOR AI</span>
                    </div>
                    <div className="srg-ai-thinking">
                      <Loader2 size={14} className="srg-ai-spinner" />
                      <span>Thinking about this lesson...</span>
                    </div>
                  </div>
                )}

                {/* Input area */}
                <div className="srg-ask-input-wrap">
                  <textarea
                    ref={aiInputRef}
                    className="srg-ask-input"
                    placeholder="Ask anything about this lesson..."
                    value={aiInput}
                    onChange={(e) => {
                      setAiInput(e.target.value)
                      autoResizeInput()
                    }}
                    onKeyDown={handleAiKeyDown}
                    rows={1}
                    disabled={aiLoading}
                  />
                  <button
                    type="button"
                    className="srg-ask-send"
                    onClick={handleAskLexMentor}
                    disabled={!aiInput.trim() || aiLoading}
                    title="Send"
                  >
                    <Send size={15} />
                  </button>
                </div>

                <p className="srg-ask-hint">
                  Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line
                </p>
              </div>

              {/* Complete button */}
              <button className="srg-complete" onClick={complete} type="button">
                {active < 39 ? 'Complete & continue' : 'Complete course'}
                <ArrowRight />
              </button>
            </section>

            {/* Right column: example + tip */}
            <aside className="srg-example">
              <label>3 · REAL INDIAN EXAMPLE</label>
              <h2>{active < 10 ? 'Privacy Rights in India' : 'Bail under BNSS'}</h2>
              <p>{example}</p>
              <hr />
              <label>5 · COMMON BEGINNER MISTAKE</label>
              <p>• {mistake}</p>
              <div>
                <Sparkles />
                <span>
                  <b>LexMentor tip</b>
                  <p>Do not rush to case law. Complete the current research step and preserve what you verified.</p>
                </span>
              </div>
            </aside>
          </div>
        </article>
      </main>
    </div>
  )
}
