import React, { useState, useRef } from 'react'
import {
  UploadCloud,
  FileText,
  Trash2,
  Sparkles,
  Send,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  Award,
  Bookmark,
  Check,
  Loader2,
  Zap,
  Scale
} from 'lucide-react'

export interface VaultDoc {
  id: string
  name: string
  type: string
  subject: string
  size: string
  uploadDate: string
  indexedStatus: 'Indexed' | 'Processing'
}

interface Question {
  id: number
  type: string
  marks: number
  question: string
  options?: string[]
  correct?: number
  legalRef?: string
  explanation?: string
}

const INITIAL_DOCS: VaultDoc[] = [
  {
    id: '1',
    name: 'Constitution_of_India_Fundamental_Rights_Art12-35.pdf',
    type: 'Bare Act (PDF)',
    subject: 'Constitutional Law',
    size: '8.4 MB',
    uploadDate: '2026-07-20',
    indexedStatus: 'Indexed',
  },
  {
    id: '2',
    name: 'Kesavananda_Bharati_v_State_of_Kerala_Bench_Ratio.docx',
    type: 'Judgment (DOCX)',
    subject: 'Constitutional Law',
    size: '3.1 MB',
    uploadDate: '2026-07-21',
    indexedStatus: 'Indexed',
  },
  {
    id: '3',
    name: 'Bharatiya_Nyaya_Sanhita_BNS_2023_Offence_Chart.pdf',
    type: 'Bare Act (PDF)',
    subject: 'Criminal Law',
    size: '12.8 MB',
    uploadDate: '2026-07-22',
    indexedStatus: 'Indexed',
  },
  {
    id: '4',
    name: 'Judiciary_Exam_Previous_Year_Solved_Papers_2021-2025.pdf',
    type: 'PYQ (PDF)',
    subject: 'Mixed Law',
    size: '18.6 MB',
    uploadDate: '2026-07-24',
    indexedStatus: 'Indexed',
  },
]

const PROMPT_CHIPS = [
  'University Exam',
  'Judiciary Exam',
  'CLAT',
  'UPSC Law',
  'Case Based',
  'MCQ',
  'Long Answer',
  'Short Answer',
  'Mixed',
  'Easy',
  'Medium',
  'Hard',
  'Expert',
]

const GENERATED_TEST_QUESTIONS: Question[] = [
  {
    id: 1,
    type: 'MCQ',
    marks: 2,
    question: "Under Section 103 of Bharatiya Nyaya Sanhita (BNS) 2023, what is the mandatory punishment for committing murder?",
    options: [
      "A. Imprisonment for 10 years and fine",
      "B. Death or imprisonment for life, and shall also be liable to fine",
      "C. Rigorous imprisonment for 7 years only",
      "D. Fine up to Rs. 50,000 without custody"
    ],
    correct: 1,
    legalRef: "BNS 2023 • Section 103 (Erstwhile Section 302 IPC)",
    explanation: "Section 103 of BNS 2023 prescribes punishment for murder as death or imprisonment for life, along with liability to fine."
  },
  {
    id: 2,
    type: 'Short Answer',
    marks: 5,
    question: "Differentiate between 'Right of Private Defence' under Bharatiya Nyaya Sanhita (BNS) and 'Necessity' as a defense against criminal liability.",
    legalRef: "BNS Sections 38 to 44 (Private Defence) & Section 34 (Necessity)",
    explanation: "Private defence repels unlawful aggression from another person, whereas Necessity involves committing a lesser harm to avert a greater harm without criminal intent."
  },
  {
    id: 3,
    type: 'Case Based',
    marks: 10,
    question: "Scenario:\n'An industrial gas plant experiences a sudden toxic ammonia leak during routine valve servicing, injuring town residents. The plant owners claim defense of Act of God (Vis Major).'\nExamine whether the plant owners can escape liability under modern Indian tort law.",
    legalRef: "Law of Torts • M.C. Mehta Absolute Liability Doctrine",
    explanation: "Under M.C. Mehta v. Union of India (Oleum Gas Leak case), Indian courts established Absolute Liability which rejects traditional exceptions like Act of God or Vis Major for hazardous industries."
  }
]

export default function KnowledgeVaultEngine({ apiToken }: { apiToken?: string }) {
  const [documents, setDocuments] = useState<VaultDoc[]>(INITIAL_DOCS)
  const [promptText, setPromptText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [viewState, setViewState] = useState<'vault' | 'exam' | 'result'>('vault')

  // Test taking state
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string | number>>({})
  const [markedReview, setMarkedReview] = useState<Record<number, boolean>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newDocs: VaultDoc[] = Array.from(e.target.files).map((file, idx) => ({
        id: `uploaded-${Date.now()}-${idx}`,
        name: file.name,
        type: file.name.split('.').pop()?.toUpperCase() || 'DOCUMENT',
        subject: 'General Legal Studies',
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        uploadDate: new Date().toISOString().split('T')[0],
        indexedStatus: 'Indexed',
      }))
      setDocuments([...documents, ...newDocs])
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newDocs: VaultDoc[] = Array.from(e.dataTransfer.files).map((file, idx) => ({
        id: `uploaded-${Date.now()}-${idx}`,
        name: file.name,
        type: file.name.split('.').pop()?.toUpperCase() || 'DOCUMENT',
        subject: 'General Legal Studies',
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        uploadDate: new Date().toISOString().split('T')[0],
        indexedStatus: 'Indexed',
      }))
      setDocuments([...documents, ...newDocs])
    }
  }

  const deleteDocument = (id: string) => {
    setDocuments(documents.filter((d) => d.id !== id))
  }

  const addChipToPrompt = (chip: string) => {
    if (!promptText.includes(chip)) {
      setPromptText(promptText ? `${promptText}, ${chip}` : `Generate a ${chip} test`)
    }
  }

  const handleGenerateExam = () => {
    if (documents.length === 0) {
      alert('Please upload study material to your Knowledge Vault first!')
      return
    }
    setIsGenerating(true)
    setTimeout(() => {
      setIsGenerating(false)
      setViewState('exam')
      setCurrentQIndex(0)
      setAnswers({})
      setMarkedReview({})
    }, 1800)
  }

  const currentQuestion = GENERATED_TEST_QUESTIONS[currentQIndex]

  const calculateTotalScore = () => {
    let score = 0
    GENERATED_TEST_QUESTIONS.forEach((q) => {
      if (q.type === 'MCQ' && answers[q.id] === q.correct) score += q.marks
      else if (answers[q.id]) score += Math.round(q.marks * 0.85)
    })
    return score
  }

  const totalPossibleMarks = GENERATED_TEST_QUESTIONS.reduce((acc, q) => acc + q.marks, 0)

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '10px 0 60px', display: 'flex', flexDirection: 'column', gap: '48px', fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}>
      
      {viewState === 'vault' && (
        <>
          {/* SECTION 1: PERSONAL KNOWLEDGE VAULT */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, color: 'var(--text)', tracking: '-0.02em' }}>
                My Knowledge Vault
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: '0.92rem', color: 'var(--text-soft)', lineHeight: 1.6 }}>
                Upload your legal study stack. AI indexes all Bare Acts, Notes, Judgments, and PYQs into your personal legal knowledge base.
              </p>
            </div>

            {/* Large Modern Upload Area */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '44px 24px',
                borderRadius: '20px',
                border: '2px dashed rgba(245,193,79,0.4)',
                background: 'rgba(245,193,79,0.03)',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                multiple
                style={{ display: 'none' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(245,193,79,0.12)', border: '1px solid rgba(245,193,79,0.25)', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: 'var(--gold)' }}>
                  <UploadCloud size={28} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)' }}>
                    Drag & drop your study material or <span style={{ color: 'var(--gold)', textDecoration: 'underline' }}>Browse files</span>
                  </h3>
                  <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'var(--text-soft)' }}>
                    Supports Bare Acts, Notes, Class Notes, Books, Judgments, Research Papers, PYQs, PDFs, DOCX, PPT, Images, TXT & ZIP files
                  </p>
                </div>
              </div>
            </div>

            {/* Clean Uploaded Documents Table */}
            {documents.length > 0 && (
              <div style={{ border: '1px solid var(--line)', borderRadius: '16px', overflow: 'hidden', background: 'var(--bg-elev)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)', background: 'rgba(255,255,255,0.02)', color: 'var(--text-soft)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                      <th style={{ padding: '14px 18px' }}>File Name</th>
                      <th style={{ padding: '14px 12px' }}>File Type</th>
                      <th style={{ padding: '14px 12px' }}>Subject</th>
                      <th style={{ padding: '14px 12px' }}>Size</th>
                      <th style={{ padding: '14px 12px' }}>Upload Date</th>
                      <th style={{ padding: '14px 12px' }}>Status</th>
                      <th style={{ padding: '14px 18px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={16} style={{ color: 'var(--gold)', shrink: 0 }} />
                          <span style={{ wordBreak: 'break-word' }}>{doc.name}</span>
                        </td>
                        <td style={{ padding: '14px 12px', color: 'var(--text-soft)' }}>{doc.type}</td>
                        <td style={{ padding: '14px 12px', color: 'var(--text-soft)' }}>{doc.subject}</td>
                        <td style={{ padding: '14px 12px', color: 'var(--text-soft)' }}>{doc.size}</td>
                        <td style={{ padding: '14px 12px', color: 'var(--text-soft)' }}>{doc.uploadDate}</td>
                        <td style={{ padding: '14px 12px' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '12px', background: 'rgba(16,185,129,0.14)', color: '#10b981', fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} /> {doc.indexedStatus}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => deleteDocument(doc.id)}
                            style={{ padding: '6px', borderRadius: '8px', border: 0, background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                            title="Delete file"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* SECTION 2: AI MOCK TEST GENERATOR */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: 'var(--text)' }}>
                AI Mock Test Generator
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: 'var(--text-soft)' }}>
                Describe the examination you want AI to generate from your uploaded Knowledge Vault.
              </p>
            </div>

            {/* Large ChatGPT / Perplexity AI Prompt Bar */}
            <div style={{ border: '2px solid rgba(245,193,79,0.3)', borderRadius: '20px', background: 'var(--bg-elev)', padding: '8px 12px 12px 18px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}>
              <textarea
                rows={3}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="What kind of mock test would you like to generate? (e.g. Generate a 100-mark Constitutional Law university paper from my uploaded notes...)"
                style={{
                  width: '100%',
                  border: 0,
                  background: 'transparent',
                  color: 'var(--text)',
                  fontSize: '0.98rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                  resize: 'none',
                  lineHeight: 1.6,
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>
                  AI synthesizes questions strictly from your indexed materials.
                </span>

                <button
                  type="button"
                  onClick={handleGenerateExam}
                  disabled={isGenerating}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '14px',
                    background: 'var(--gold)',
                    color: '#000',
                    fontWeight: 900,
                    fontSize: '0.88rem',
                    border: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(245,193,79,0.3)',
                  }}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> AI Generating Test...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Generate Mock Test
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Clickable Prompt Enhancer Chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', tracking: '0.05em' }}>
                Prompt Presets & Format Enhancers:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {PROMPT_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => addChipToPrompt(chip)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '20px',
                      border: '1px solid var(--line)',
                      background: 'var(--bg-elev)',
                      color: 'var(--text)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* EXAMINATION TAKING INTERFACE */}
      {viewState === 'exam' && currentQuestion && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ padding: '16px 20px', borderRadius: '16px', background: 'var(--bg-elev)', border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setViewState('vault')}
              style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--line)', background: 'transparent', color: 'var(--text)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={16} /> Exit Exam
            </button>

            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--gold)' }}>
              AI Generated Examination
            </span>

            <button
              type="button"
              onClick={() => setViewState('result')}
              style={{ padding: '8px 18px', borderRadius: '10px', background: 'var(--gold)', color: '#000', fontWeight: 900, border: 0, cursor: 'pointer', fontSize: '0.82rem' }}
            >
              Submit Exam
            </button>
          </div>

          <div style={{ padding: '24px', borderRadius: '16px', background: 'var(--bg-elev)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
              <span style={{ padding: '4px 10px', borderRadius: '8px', background: 'rgba(245,193,79,0.15)', color: 'var(--gold)', fontSize: '0.78rem', fontWeight: 800 }}>
                Question {currentQIndex + 1} of {GENERATED_TEST_QUESTIONS.length} ({currentQuestion.type} • {currentQuestion.marks} Marks)
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>
                {currentQuestion.legalContext}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.6, whitespace: 'pre-line' }}>
              {currentQuestion.questionText}
            </p>

            {currentQuestion.options ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {currentQuestion.options.map((opt, oIdx) => (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => setAnswers({ ...answers, [currentQuestion.id]: oIdx })}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: answers[currentQuestion.id] === oIdx ? '1px solid var(--gold)' : '1px solid var(--line)',
                      background: answers[currentQuestion.id] === oIdx ? 'rgba(245,193,79,0.15)' : 'var(--bg)',
                      color: 'var(--text)',
                      textAlign: 'left',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                rows={5}
                placeholder="Type your legal response citing bare act provisions, statutory exceptions, and precedent ratios..."
                value={(answers[currentQuestion.id] as string) || ''}
                onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
                style={{ width: '100%', border: '1px solid var(--line)', borderRadius: '12px', padding: '12px', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
              <button
                type="button"
                disabled={currentQIndex === 0}
                onClick={() => setCurrentQIndex((prev) => prev - 1)}
                style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, opacity: currentQIndex === 0 ? 0.4 : 1 }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentQIndex === GENERATED_TEST_QUESTIONS.length - 1}
                onClick={() => setCurrentQIndex((prev) => prev + 1)}
                style={{ padding: '8px 20px', borderRadius: '10px', background: 'var(--gold)', color: '#000', fontWeight: 900, border: 0 }}
              >
                Next Question →
              </button>
            </div>

          </div>

        </div>
      )}

      {/* EXAM RESULTS SCORECARD */}
      {viewState === 'result' && (
        <div style={{ padding: '32px', borderRadius: '20px', background: 'var(--bg-elev)', border: '1px solid #10b981', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: '#10b981', margin: '0 auto' }}>
            <Award size={32} />
          </div>

          <div>
            <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: 'var(--text)' }}>
              AI Examination Scorecard
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-soft)' }}>
              Evaluation completed strictly against uploaded Knowledge Vault materials.
            </p>
          </div>

          <div style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg)', border: '1px solid var(--line)', maxWidth: '280px', margin: '0 auto' }}>
            <span style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--gold)' }}>
              {calculateTotalScore()} / {totalPossibleMarks}
            </span>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', fontWeight: 800, color: '#10b981' }}>
              High Distinction Benchmarking
            </p>
          </div>

          <button
            type="button"
            onClick={() => setViewState('vault')}
            style={{ padding: '12px 24px', borderRadius: '12px', background: 'var(--gold)', color: '#000', fontWeight: 900, border: 0, cursor: 'pointer', margin: '10px auto 0' }}
          >
            Return to My Knowledge Vault
          </button>
        </div>
      )}

    </div>
  )
}
