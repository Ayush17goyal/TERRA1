import React, { useState } from 'react'
import {
  Volume2,
  Mic,
  Activity,
  Award,
  AlertCircle,
  Play,
  StopCircle,
  HelpCircle
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts'

export default function OralArgumentCoach() {
  const [isRecording, setIsRecording] = useState(false)
  const [speechText, setSpeechText] = useState('')
  const [showAnalysis, setShowAnalysis] = useState(false)

  // Simulated metrics
  const [pacingData, setPacingData] = useState<any[]>([])
  const [fillerCounts, setFillerCounts] = useState({ um: 0, like: 0, actually: 0 })
  const [overallScore, setOverallScore] = useState(0)

  const handleStartSimulate = () => {
    setIsRecording(true)
    setShowAnalysis(false)
    
    // Simulate speaking transcript gathering over a few seconds
    setTimeout(() => {
      setSpeechText(
        "My Lords, we submit that... um... the state administrative rules directly block judicial review access. This, we argue, is... like... a violation of Article 14. Actually, alternate remedies exist but they are completely ineffective in this scenario."
      )
    }, 1000)
  }

  const handleStopSimulate = () => {
    setIsRecording(false)
    setShowAnalysis(true)

    // Synthesize mock telemetry metrics for charts
    setPacingData([
      { sec: '0s', wpm: 120 },
      { sec: '5s', wpm: 145 },
      { sec: '10s', wpm: 160 },
      { sec: '15s', wpm: 135 },
      { sec: '20s', wpm: 140 },
      { sec: '25s', wpm: 152 },
      { sec: '30s', wpm: 142 }
    ])

    setFillerCounts({
      um: 2,
      like: 1,
      actually: 1
    })

    setOverallScore(84)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'reveal-up 350ms ease-out both' }}>
      
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Volume2 style={{ color: 'var(--gold)' }} size={22} /> Oral Argument Coach™
        </h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)' }}>
          Audit vocal pacing metrics, filter filler words, and review confidence charts.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '16px' }}>
        
        {/* Left Column: Voice Simulator Terminal */}
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--gold)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Mic size={16} /> Audio Speech Audit
          </h4>
          
          <div style={{ border: '1px solid var(--line)', borderRadius: '8px', padding: '16px', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', height: '160px', position: 'relative' }}>
            {isRecording ? (
              <>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(231,76,60,0.15)', border: '2px solid #e74c3c', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.2s infinite' }}>
                  <StopCircle size={24} style={{ color: '#e74c3c' }} />
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text)', fontWeight: '700' }}>Recording Simulated Speech Log...</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', fontStyle: 'italic' }}>Speaking constitutional arguments...</span>
              </>
            ) : (
              <>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(245,193,79,0.08)', border: '1px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mic size={22} style={{ color: 'var(--gold)' }} />
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>Click button below to initiate simulated voice audit</span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {!isRecording ? (
              <button
                type="button"
                onClick={handleStartSimulate}
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px', fontSize: '0.86rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <Play size={14} /> Start Voice Simulation
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStopSimulate}
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px', fontSize: '0.86rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#e74c3c', borderColor: '#e74c3c', color: '#fff', cursor: 'pointer' }}
              >
                <StopCircle size={14} /> Stop &amp; Compile Metrics
              </button>
            )}
          </div>

          {speechText && (
            <div style={{ border: '1px solid var(--line)', background: 'rgba(0,0,0,0.1)', padding: '10px', borderRadius: '6px', fontSize: '0.78rem', lineHeight: '1.4', maxHeight: '100px', overflowY: 'auto' }}>
              <strong>Transcribed Speech Summary:</strong> "{speechText}"
            </div>
          )}
        </div>

        {/* Right Column: Audio Analysis Results */}
        <div className="glass-card" style={{ padding: '16px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--gold)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={16} /> Diagnostic Speech Audit Output
          </h4>

          {showAnalysis ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Telemetry charts using Recharts */}
              <div style={{ border: '1px solid var(--line)', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px' }}>
                <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-soft)', marginBottom: '8px', fontWeight: '700' }}>
                  PACING VECTOR GRAPH (WORDS PER MINUTE)
                </span>
                <div style={{ width: '100%', height: '140px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pacingData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPacing" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--gold)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--gold)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="sec" stroke="var(--text-soft)" fontSize={9} />
                      <YAxis stroke="var(--text-soft)" fontSize={9} domain={[100, 180]} />
                      <Tooltip contentStyle={{ background: 'var(--panel)', borderColor: 'var(--line)', fontSize: '10px' }} />
                      <Area type="monotone" dataKey="wpm" stroke="var(--gold)" strokeWidth={1.5} fillOpacity={1} fill="url(#colorPacing)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Speech KPI Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ border: '1px solid var(--line)', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Filler Words Flagged</span>
                  <strong style={{ display: 'block', fontSize: '0.94rem', color: '#e74c3c', marginTop: '3px' }}>
                    {fillerCounts.um + fillerCounts.like + fillerCounts.actually} total
                  </strong>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-soft)', display: 'block', marginTop: '2px' }}>
                    um: {fillerCounts.um} | like: {fillerCounts.like} | actually: {fillerCounts.actually}
                  </span>
                </div>
                
                <div style={{ border: '1px solid var(--line)', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Overall Delivery Index</span>
                  <strong style={{ display: 'block', fontSize: '0.94rem', color: 'var(--gold)', marginTop: '3px' }}>
                    {overallScore}% Optimal
                  </strong>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-soft)', display: 'block', marginTop: '2px' }}>
                    Pacing: 142 WPM (Excellent)
                  </span>
                </div>
              </div>

              {/* Tips banner */}
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(245,193,79,0.03)', border: '1px dashed var(--line)', padding: '10px', borderRadius: '8px', fontSize: '0.76rem', color: 'var(--text-soft)', lineHeight: '1.4' }}>
                <Award size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                <div>
                  <strong>Speech Coach Tips:</strong> You speak with a highly professional pacing profile. Attempt to pause deliberately instead of using filler terms like "um" or "like" under intense questioning.
                </div>
              </div>

            </div>
          ) : (
            <div style={{ height: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--text-soft)', border: '1px dashed var(--line)', borderRadius: '10px', textAlign: 'center', padding: '20px' }}>
              <Activity size={24} style={{ opacity: 0.5 }} />
              <span>Initiate the speech simulation on the left panel to compile audio statistics.</span>
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
