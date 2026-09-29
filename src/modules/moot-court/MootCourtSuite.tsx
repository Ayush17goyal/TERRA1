import React from 'react'
import { MootSuiteProvider, useMootSuite } from './MootSuiteContext'
import BenchSimulator from './BenchSimulator'
import MemorialArchitect from './MemorialArchitect'
import ArgumentBuilder from './ArgumentBuilder'
import OralArgumentCoach from './OralArgumentCoach'
import LegalResearchTrainer from './LegalResearchTrainer'
import JudgmentSimilarity from './JudgmentSimilarity'
import MootAnalytics from './MootAnalytics'
import BenchIntelligence from './BenchIntelligence'
import {
  LayoutDashboard,
  Gavel,
  BookOpen,
  GitBranch,
  Volume2,
  Search,
  Fingerprint,
  BarChart3,
  BrainCircuit,
  ArrowLeft
} from 'lucide-react'

const subTabs = [
  { id: 'BenchSimulator', label: 'Bench Simulator', icon: <Gavel size={14} /> },
  { id: 'MemorialArchitect', label: 'Memorial Architect', icon: <BookOpen size={14} /> },
  { id: 'ArgumentBuilder', label: 'Argument Builder', icon: <GitBranch size={14} /> },
  { id: 'OralArgumentCoach', label: 'Oral Coach', icon: <Volume2 size={14} /> },
  { id: 'LegalResearchTrainer', label: 'Research Trainer', icon: <Search size={14} /> },
  { id: 'JudgmentSimilarity', label: 'Similarity Engine', icon: <Fingerprint size={14} /> },
  { id: 'MootAnalytics', label: 'Analytics', icon: <BarChart3 size={14} /> },
  { id: 'BenchIntelligence', label: 'Bench Intelligence', icon: <BrainCircuit size={14} /> }
]

function MootCourtSuiteInner() {
  const { activeSubTab, setActiveSubTab } = useMootSuite()

  const renderActiveView = () => {
    switch (activeSubTab) {
      case 'BenchSimulator':
        return <BenchSimulator />
      case 'MemorialArchitect':
        return <MemorialArchitect />
      case 'ArgumentBuilder':
        return <ArgumentBuilder />
      case 'OralArgumentCoach':
        return <OralArgumentCoach />
      case 'LegalResearchTrainer':
        return <LegalResearchTrainer />
      case 'JudgmentSimilarity':
        return <JudgmentSimilarity />
      case 'MootAnalytics':
        return <MootAnalytics />
      case 'BenchIntelligence':
        return <BenchIntelligence />
      default:
        return <BenchSimulator />
    }
  }

  return (
    <div style={{ display: 'flex', gap: '14px', height: '100%', minHeight: '600px' }}>
      {/* Internal Sidebar Navigation */}
      <nav
        style={{
          width: '190px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          padding: '10px 6px',
          borderRight: '1px solid var(--line)',
          overflowY: 'auto'
        }}
      >
        {/* Suite Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', marginBottom: '8px' }}>
          <Gavel size={16} style={{ color: 'var(--gold)' }} />
          <span style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--gold)', letterSpacing: '0.02em' }}>
            MOOT COURT SUITE
          </span>
        </div>

        {subTabs.map(tab => {
          const isActive = activeSubTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveSubTab(tab.id)
                const mapping: Record<string, string> = {
                  BenchSimulator: 'Moot Court Suite',
                  MemorialArchitect: 'Memorial Architect AI',
                  ArgumentBuilder: 'Moot Court Suite',
                  OralArgumentCoach: 'Moot Court Suite',
                  LegalResearchTrainer: 'Legal Research Command Center',
                  JudgmentSimilarity: 'Judgment Mastery Engine',
                  MootAnalytics: 'Moot Court Suite',
                  BenchIntelligence: 'Moot Court Suite',
                };
                const dbModule = mapping[tab.id] || 'Moot Court Suite';
                (window as any).logUserActivity?.(dbModule, `Accessed Sub-Tab: ${tab.label}`);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '8px',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: '600',
                color: isActive ? 'var(--text)' : 'var(--text-soft)',
                background: isActive ? 'rgba(245, 193, 79, 0.14)' : 'transparent',
                transition: 'all 150ms ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(245, 193, 79, 0.06)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              <span style={{ color: isActive ? 'var(--gold)' : 'inherit', display: 'inline-flex' }}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          )
        })}
      </nav>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 2px 6px 0' }}>
        {renderActiveView()}
      </div>
    </div>
  )
}

export default function MootCourtSuite() {
  return (
    <MootSuiteProvider>
      <MootCourtSuiteInner />
    </MootSuiteProvider>
  )
}
