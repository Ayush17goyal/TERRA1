import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../lib/api'
import { BarChart3, Clock, RefreshCw, Target, TrendingUp, AlertTriangle, Trophy, Activity } from 'lucide-react'

interface Props {
  apiToken: string
}

interface TopicPerformanceRow {
  topic: string
  subtopic: string
  attempts: number
  averageMarks: number
  averageMaxMarks: number
  averagePercentage: number
  bestPercentage: number
  latestPercentage: number
  trend: number
  lastAttemptAt: string | null
}

interface ImprovementPoint {
  attemptId: string
  sequence: number
  date: string
  percentage: number
  rollingAverage: number
  marksAwarded: number
  maxMarks: number
}

interface AnalyticsDashboard {
  generatedAt: string
  summary: {
    attempts: number
    averageMarks: number
    averageMaxMarks: number
    averagePercentage: number
    totalMarksAwarded: number
    totalMaxMarks: number
  }
  topicWisePerformance: TopicPerformanceRow[]
  weakTopics: TopicPerformanceRow[]
  strongTopics: TopicPerformanceRow[]
  dimensionPerformance: Array<{ dimension: string; label: string; attempts: number; averagePercentage: number; averageMarks: number; maxMarks: number }>
  timeAnalysis: {
    attemptsWithRecordedTime: number
    averageTimeSeconds: number | null
    estimatedAverageTimeSeconds: number
    averageAnswerWords: number
    averageWordsPerMinute: number | null
    practiceCadence: Array<{ date: string; attempts: number; averagePercentage: number }>
  }
  improvementGraph: ImprovementPoint[]
  progressTracking: {
    totalAttempts: number
    completedTopics: number
    currentStreakDays: number
    bestStreakDays: number
    latestAttemptAt: string | null
    improvementSinceFirstAttempt: number
    readinessScore: number
  }
}

function formatPercent(value: number) {
  return `${Math.round(value || 0)}%`
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return 'Not recorded'
  const minutes = Math.floor(seconds / 60)
  const rem = Math.round(seconds % 60)
  return minutes > 0 ? `${minutes}m ${rem}s` : `${rem}s`
}

function scoreColor(value: number) {
  if (value >= 75) return '#42c98f'
  if (value >= 60) return 'var(--gold)'
  return '#f87171'
}

export default function ExamAnalyticsDashboard({ apiToken }: Props) {
  const [dashboard, setDashboard] = useState<AnalyticsDashboard | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${apiToken}` }), [apiToken])

  const loadDashboard = async () => {
    if (!apiToken) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/exam-engine/analytics/dashboard`, { headers: authHeaders })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || `Analytics unavailable (${res.status})`)
      }
      setDashboard(await res.json())
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [apiToken])

  const graphPath = useMemo(() => {
    const points = dashboard?.improvementGraph || []
    if (points.length === 0) return ''
    const width = 560
    const height = 160
    return points
      .map((point, index) => {
        const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width
        const y = height - (Math.max(0, Math.min(100, point.rollingAverage)) / 100) * height
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join(' ')
  }, [dashboard])

  if (!dashboard && isLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '280px', color: 'var(--text-soft)' }}>
        <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--gold)' }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>Analytics</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-soft)', fontSize: '0.85rem' }}>
            Topic performance, weak spots, timing, and progress from evaluated answers.
          </p>
        </div>
        <button type="button" onClick={loadDashboard} disabled={isLoading} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div style={{ border: '1px solid rgba(248,113,113,0.45)', borderRadius: '10px', padding: '10px 12px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {!dashboard || dashboard.summary.attempts === 0 ? (
        <div style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '24px', background: 'var(--bg-elev)', color: 'var(--text-soft)', textAlign: 'center' }}>
          <BarChart3 size={34} style={{ color: 'var(--gold)', marginBottom: '8px' }} />
          <div style={{ color: 'var(--text)', fontWeight: 800 }}>No evaluated answers yet</div>
          <p style={{ margin: '6px auto 0', maxWidth: '460px', fontSize: '0.84rem' }}>Submit answers through the Answer Evaluation Engine to populate topic-wise performance, timing, and progress tracking.</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            {[
              ['Attempts', dashboard.summary.attempts, <Activity size={16} />],
              ['Average Marks', `${dashboard.summary.averageMarks}/${dashboard.summary.averageMaxMarks}`, <Target size={16} />],
              ['Average Score', formatPercent(dashboard.summary.averagePercentage), <BarChart3 size={16} />],
              ['Readiness', formatPercent(dashboard.progressTracking.readinessScore), <Trophy size={16} />],
              ['Current Streak', `${dashboard.progressTracking.currentStreakDays} days`, <TrendingUp size={16} />],
            ].map(([label, value, icon]) => (
              <div key={String(label)} style={{ border: '1px solid var(--line)', borderRadius: '10px', padding: '12px', background: 'var(--bg-elev)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-soft)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800 }}>{icon}{label}</div>
                <strong style={{ display: 'block', color: 'var(--text)', fontSize: '1.18rem', marginTop: '6px' }}>{value}</strong>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(280px, 0.65fr)', gap: '14px' }}>
            <section style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '16px', background: 'var(--bg-elev)' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={16} style={{ color: 'var(--gold)' }} /> Improvement Graph</h3>
              <svg viewBox="0 0 560 180" style={{ width: '100%', height: '190px', marginTop: '10px' }}>
                <line x1="0" y1="160" x2="560" y2="160" stroke="rgba(255,255,255,0.12)" />
                <line x1="0" y1="80" x2="560" y2="80" stroke="rgba(255,255,255,0.08)" />
                <path d={graphPath} fill="none" stroke="var(--gold)" strokeWidth="3" strokeLinecap="round" />
                {dashboard.improvementGraph.map((point, index, points) => {
                  const x = points.length === 1 ? 280 : (index / (points.length - 1)) * 560
                  const y = 160 - (Math.max(0, Math.min(100, point.rollingAverage)) / 100) * 160
                  return <circle key={point.attemptId} cx={x} cy={y} r="4" fill={scoreColor(point.rollingAverage)} />
                })}
              </svg>
            </section>

            <section style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '16px', background: 'var(--bg-elev)' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={16} style={{ color: 'var(--gold)' }} /> Time Analysis</h3>
              <div style={{ display: 'grid', gap: '10px', marginTop: '12px', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}><span style={{ color: 'var(--text-soft)' }}>Recorded average</span><strong>{formatDuration(dashboard.timeAnalysis.averageTimeSeconds)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}><span style={{ color: 'var(--text-soft)' }}>Estimated average</span><strong>{formatDuration(dashboard.timeAnalysis.estimatedAverageTimeSeconds)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}><span style={{ color: 'var(--text-soft)' }}>Answer length</span><strong>{Math.round(dashboard.timeAnalysis.averageAnswerWords)} words</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}><span style={{ color: 'var(--text-soft)' }}>Timed attempts</span><strong>{dashboard.timeAnalysis.attemptsWithRecordedTime}</strong></div>
              </div>
            </section>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
            <TopicList title="Weak Topics" rows={dashboard.weakTopics} empty="No weak topics below 60%." />
            <TopicList title="Strong Topics" rows={dashboard.strongTopics} empty="No strong topics above 75% yet." />
          </div>

          <section style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '16px', background: 'var(--bg-elev)' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text)' }}>Topic-wise Performance</h3>
            <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
              {dashboard.topicWisePerformance.map((row) => (
                <div key={`${row.topic}-${row.subtopic}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(150px, 2fr) 70px', gap: '10px', alignItems: 'center', fontSize: '0.78rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ color: 'var(--text)' }}>{row.topic}</strong>
                    <div style={{ color: 'var(--text-soft)' }}>{row.subtopic} · {row.attempts} attempts</div>
                  </div>
                  <div style={{ height: '9px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.max(4, Math.min(100, row.averagePercentage))}%`, background: scoreColor(row.averagePercentage), borderRadius: 'inherit' }} />
                  </div>
                  <strong style={{ color: scoreColor(row.averagePercentage), textAlign: 'right' }}>{formatPercent(row.averagePercentage)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '16px', background: 'var(--bg-elev)' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text)' }}>Dimension Performance</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginTop: '12px' }}>
              {dashboard.dimensionPerformance.map((row) => (
                <div key={row.dimension} style={{ border: '1px solid var(--line)', borderRadius: '8px', padding: '10px', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ color: 'var(--text-soft)', fontSize: '0.72rem', fontWeight: 800 }}>{row.label}</div>
                  <strong style={{ color: scoreColor(row.averagePercentage), fontSize: '1rem' }}>{formatPercent(row.averagePercentage)}</strong>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function TopicList({ title, rows, empty }: { title: string; rows: TopicPerformanceRow[]; empty: string }) {
  return (
    <section style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '16px', background: 'var(--bg-elev)' }}>
      <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text)' }}>{title}</h3>
      <div style={{ display: 'grid', gap: '8px', marginTop: '12px' }}>
        {rows.length === 0 ? <div style={{ color: 'var(--text-soft)', fontSize: '0.8rem' }}>{empty}</div> : rows.map((row) => (
          <div key={`${title}-${row.topic}-${row.subtopic}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
            <div style={{ minWidth: 0 }}>
              <strong style={{ color: 'var(--text)', fontSize: '0.82rem' }}>{row.topic}</strong>
              <div style={{ color: 'var(--text-soft)', fontSize: '0.74rem' }}>{row.subtopic}</div>
            </div>
            <strong style={{ color: scoreColor(row.averagePercentage), flexShrink: 0 }}>{formatPercent(row.averagePercentage)}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

