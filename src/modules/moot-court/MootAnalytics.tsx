import React from 'react'
import { useMootSuite } from './MootSuiteContext'
import {
  BarChart3,
  TrendingUp,
  Award,
  Target
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend
} from 'recharts'

export default function MootAnalytics() {
  const { mootHistory } = useMootSuite()

  // Build timeline data from session history
  const timelineData = mootHistory.map((s, idx) => ({
    session: `S${mootHistory.length - idx}`,
    advocacy: s.advocacyScore,
    reasoning: s.reasoningScore,
    research: s.researchScore,
    manner: s.mannerScore,
    date: s.date
  })).reverse()

  // If we have data, compute averages
  const avg = (key: 'advocacyScore' | 'reasoningScore' | 'researchScore' | 'mannerScore') =>
    mootHistory.length > 0
      ? Math.round(mootHistory.reduce((s, m) => s + m[key], 0) / mootHistory.length)
      : 0

  const kpis = [
    { label: 'Avg Advocacy', value: avg('advocacyScore'), color: 'var(--gold)' },
    { label: 'Avg Reasoning', value: avg('reasoningScore'), color: '#3498db' },
    { label: 'Avg Research', value: avg('researchScore'), color: '#2ecc71' },
    { label: 'Avg Courtroom Manner', value: avg('mannerScore'), color: '#e67e22' }
  ]

  // Distribution data for bar chart
  const distData = [
    { name: 'Advocacy', score: avg('advocacyScore') },
    { name: 'Reasoning', score: avg('reasoningScore') },
    { name: 'Research', score: avg('researchScore') },
    { name: 'Manner', score: avg('mannerScore') }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'reveal-up 350ms ease-out both' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 style={{ color: 'var(--gold)' }} size={22} /> Moot Analytics™
        </h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)' }}>
          Review performance trends across all simulated hearings. Track advocacy, reasoning, and manner trajectories.
        </p>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        {kpis.map(kpi => (
          <div
            key={kpi.label}
            className="glass-card"
            style={{
              padding: '14px 16px',
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: `${kpi.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={18} style={{ color: kpi.color }} />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-soft)' }}>{kpi.label}</span>
              <strong style={{ display: 'block', fontSize: '1.2rem', color: kpi.value > 0 ? kpi.color : 'var(--text-soft)' }}>
                {kpi.value > 0 ? `${kpi.value}%` : 'N/A'}
              </strong>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '16px' }}>
        {/* Area Chart: Session Performance Timeline */}
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <h4 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--gold)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={16} /> Performance Trend Over Sessions
          </h4>

          {timelineData.length > 0 ? (
            <div style={{ width: '100%', height: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAdv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f5c14f" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f5c14f" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3498db" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3498db" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorRsch" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2ecc71" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2ecc71" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="session" stroke="var(--text-soft)" fontSize={10} />
                  <YAxis stroke="var(--text-soft)" fontSize={10} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--panel)',
                      borderColor: 'var(--line)',
                      fontSize: '11px',
                      borderRadius: '6px'
                    }}
                  />
                  <Area type="monotone" dataKey="advocacy" stroke="#f5c14f" strokeWidth={2} fillOpacity={1} fill="url(#colorAdv)" name="Advocacy" />
                  <Area type="monotone" dataKey="reasoning" stroke="#3498db" strokeWidth={1.5} fillOpacity={1} fill="url(#colorRes)" name="Reasoning" />
                  <Area type="monotone" dataKey="research" stroke="#2ecc71" strokeWidth={1.5} fillOpacity={1} fill="url(#colorRsch)" name="Research" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--line)', borderRadius: '8px', color: 'var(--text-soft)', fontSize: '0.82rem' }}>
              Complete a hearing in the Bench Simulator to generate trend data.
            </div>
          )}
        </div>

        {/* Bar Chart: Average Score Distribution */}
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <h4 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--gold)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={16} /> Score Distribution
          </h4>

          {mootHistory.length > 0 ? (
            <div style={{ width: '100%', height: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" stroke="var(--text-soft)" fontSize={10} />
                  <YAxis stroke="var(--text-soft)" fontSize={10} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--panel)',
                      borderColor: 'var(--line)',
                      fontSize: '11px',
                      borderRadius: '6px'
                    }}
                  />
                  <Bar dataKey="score" fill="var(--gold)" radius={[4, 4, 0, 0]} name="Average Score" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--line)', borderRadius: '8px', color: 'var(--text-soft)', fontSize: '0.82rem' }}>
              No scores available yet.
            </div>
          )}
        </div>
      </div>

      {/* Session History Table */}
      <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <h4 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--gold)', margin: '0 0 12px 0' }}>
          Session History Log
        </h4>
        {mootHistory.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  {['Date', 'Case', 'Domain', 'Advocacy', 'Reasoning', 'Research', 'Manner'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 6px', color: 'var(--text-soft)', fontWeight: '700', textTransform: 'uppercase', fontSize: '0.7rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mootHistory.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '8px 6px', color: 'var(--text-soft)' }}>{s.date}</td>
                    <td style={{ padding: '8px 6px', color: 'var(--text)', fontWeight: '600', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.caseName}</td>
                    <td style={{ padding: '8px 6px', color: 'var(--text-soft)' }}>{s.domain}</td>
                    <td style={{ padding: '8px 6px', color: 'var(--gold)', fontWeight: '700' }}>{s.advocacyScore}%</td>
                    <td style={{ padding: '8px 6px', color: '#3498db', fontWeight: '700' }}>{s.reasoningScore}%</td>
                    <td style={{ padding: '8px 6px', color: '#2ecc71', fontWeight: '700' }}>{s.researchScore}%</td>
                    <td style={{ padding: '8px 6px', color: '#e67e22', fontWeight: '700' }}>{s.mannerScore}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-soft)', fontStyle: 'italic', margin: 0, textAlign: 'center', padding: '20px' }}>
            No sessions logged. Use the AI Bench Simulator to begin recording sessions.
          </p>
        )}
      </div>
    </div>
  )
}
