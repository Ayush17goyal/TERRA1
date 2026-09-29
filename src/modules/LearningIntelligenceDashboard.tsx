import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { API_BASE_URL } from '../lib/api'
import { AlertTriangle, BookOpen, Brain, CalendarDays, FileText, RefreshCw, Target, Trophy } from 'lucide-react'

interface Props {
  apiToken: string
}

interface LearningIntelligenceReport {
  predictedScore: { percentage: number; band: string; confidence: number; rationale: string }
  topicsToRevise: Array<{ topic: string; subtopic: string; priority: string; reason: string; currentScore: number; targetScore: number; suggestedMinutes: number }>
  questionsToPractice: Array<{ questionId: string; question: string; topic: string; subtopic: string; markValue: number; questionType: string; priority: string; reason: string }>
  newMockTests: Array<{ mode: string; prompt: string; targetTopics: string[]; totalMarks: number; priority: string; reason: string }>
  revisionPlan: Array<{ day: number; focus: string; topics: string[]; practiceQuestionIds: string[]; estimatedMinutes: number; tasks: string[] }>
  personalizedRecommendations: Array<{ title: string; category: string; priority: string; rationale: string; action: string }>
}

function scoreColor(value: number) {
  if (value >= 75) return '#42c98f'
  if (value >= 60) return 'var(--gold)'
  return '#f87171'
}

function priorityColor(priority: string) {
  if (priority === 'high') return '#f87171'
  if (priority === 'medium') return 'var(--gold)'
  return '#42c98f'
}

export default function LearningIntelligenceDashboard({ apiToken }: Props) {
  const [report, setReport] = useState<LearningIntelligenceReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const headers = useMemo(() => ({ Authorization: `Bearer ${apiToken}` }), [apiToken])

  const loadReport = async () => {
    if (!apiToken) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/exam-engine/learning-intelligence/recommendations`, { headers })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || `Learning Intelligence unavailable (${res.status})`)
      }
      setReport(await res.json())
    } catch (err: any) {
      setError(err.message || 'Failed to load learning recommendations.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
  }, [apiToken])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>Learning Intelligence</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-soft)', fontSize: '0.85rem' }}>
            Personalized revision, practice questions, mock tests, predicted score, and study plan.
          </p>
        </div>
        <button type="button" onClick={loadReport} disabled={isLoading} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div style={{ border: '1px solid rgba(248,113,113,0.45)', borderRadius: '10px', padding: '10px 12px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {!report && isLoading ? (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '280px', color: 'var(--text-soft)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--gold)' }} />
        </div>
      ) : !report || report.personalizedRecommendations.length === 0 ? (
        <section style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '24px', background: 'var(--bg-elev)', textAlign: 'center' }}>
          <Brain size={36} style={{ color: 'var(--gold)', marginBottom: '8px' }} />
          <h3 style={{ margin: 0, color: 'var(--text)' }}>No learning pattern yet</h3>
          <p style={{ margin: '6px auto 0', color: 'var(--text-soft)', fontSize: '0.84rem', maxWidth: '500px' }}>
            Evaluate a few answers first. The engine will then recommend weak topics, practice questions, mock tests, and a revision plan.
          </p>
        </section>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.65fr) minmax(0, 1.35fr)', gap: '14px' }}>
            <section style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '16px', background: 'var(--bg-elev)' }}>
              <div style={{ color: 'var(--text-soft)', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800 }}>Predicted Score</div>
              <strong style={{ display: 'block', marginTop: '8px', fontSize: '2.2rem', color: scoreColor(report.predictedScore.percentage) }}>{Math.round(report.predictedScore.percentage)}%</strong>
              <div style={{ color: 'var(--text-soft)', fontSize: '0.78rem', marginTop: '6px' }}>{report.predictedScore.rationale}</div>
            </section>
            <section style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '16px', background: 'var(--bg-elev)' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}><Trophy size={16} style={{ color: 'var(--gold)' }} /> Personalized Study Recommendations</h3>
              <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
                {report.personalizedRecommendations.map((item) => (
                  <div key={`${item.category}-${item.title}`} style={{ border: '1px solid var(--line)', borderRadius: '10px', padding: '10px', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                      <strong style={{ color: 'var(--text)', fontSize: '0.84rem' }}>{item.title}</strong>
                      <span style={{ color: priorityColor(item.priority), fontSize: '0.68rem', fontWeight: 900, textTransform: 'uppercase' }}>{item.priority}</span>
                    </div>
                    <div style={{ color: 'var(--text-soft)', fontSize: '0.76rem', marginTop: '4px' }}>{item.action}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
            <Panel title="Topics To Revise" icon={<BookOpen size={16} style={{ color: 'var(--gold)' }} />}>
              {report.topicsToRevise.slice(0, 6).map((topic) => (
                <Row key={`${topic.topic}-${topic.subtopic}`} title={topic.topic} meta={`${topic.subtopic} · ${topic.suggestedMinutes} min · target ${Math.round(topic.targetScore)}%`} value={`${Math.round(topic.currentScore)}%`} color={priorityColor(topic.priority)} />
              ))}
            </Panel>
            <Panel title="Questions To Practice" icon={<FileText size={16} style={{ color: 'var(--gold)' }} />}>
              {report.questionsToPractice.slice(0, 5).map((question) => (
                <div key={question.questionId} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
                  <strong style={{ color: 'var(--text)', fontSize: '0.8rem' }}>{question.markValue} marks · {question.questionType.replace(/_/g, ' ')}</strong>
                  <div style={{ color: 'var(--text-soft)', fontSize: '0.74rem', marginTop: '3px' }}>{question.question}</div>
                </div>
              ))}
            </Panel>
            <Panel title="New Mock Tests" icon={<Target size={16} style={{ color: 'var(--gold)' }} />}>
              {report.newMockTests.map((test) => (
                <div key={`${test.mode}-${test.totalMarks}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
                  <strong style={{ color: 'var(--text)', fontSize: '0.8rem', textTransform: 'capitalize' }}>{test.mode} · {test.totalMarks} marks</strong>
                  <div style={{ color: 'var(--text-soft)', fontSize: '0.74rem', marginTop: '3px' }}>{test.prompt}</div>
                </div>
              ))}
            </Panel>
          </div>

          <section style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '16px', background: 'var(--bg-elev)' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}><CalendarDays size={16} style={{ color: 'var(--gold)' }} /> Revision Plan</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', marginTop: '12px' }}>
              {report.revisionPlan.slice(0, 10).map((day) => (
                <div key={day.day} style={{ border: '1px solid var(--line)', borderRadius: '10px', padding: '10px', background: 'rgba(255,255,255,0.02)' }}>
                  <strong style={{ color: 'var(--text)', fontSize: '0.82rem' }}>Day {day.day}: {day.focus}</strong>
                  <div style={{ color: 'var(--text-soft)', fontSize: '0.74rem', marginTop: '5px' }}>{day.estimatedMinutes} minutes · {day.practiceQuestionIds.length} practice questions</div>
                  <ul style={{ margin: '8px 0 0', paddingLeft: '16px', color: 'var(--text-soft)', fontSize: '0.74rem' }}>
                    {day.tasks.slice(0, 2).map((task) => <li key={task}>{task}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '16px', background: 'var(--bg-elev)' }}>
      <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>{icon}{title}</h3>
      <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>{children}</div>
    </section>
  )
}

function Row({ title, meta, value, color }: { title: string; meta: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
      <div>
        <strong style={{ color: 'var(--text)', fontSize: '0.82rem' }}>{title}</strong>
        <div style={{ color: 'var(--text-soft)', fontSize: '0.74rem' }}>{meta}</div>
      </div>
      <strong style={{ color, flexShrink: 0 }}>{value}</strong>
    </div>
  )
}


