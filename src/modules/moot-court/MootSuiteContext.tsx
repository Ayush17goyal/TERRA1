import React, { createContext, useContext, useState } from 'react'

export interface MootSession {
  id: string
  caseName: string
  domain: string
  date: string
  advocacyScore: number
  reasoningScore: number
  researchScore: number
  mannerScore: number
  transcript: { role: 'user' | 'judge'; text: string }[]
}

export interface PrecedentCitation {
  id: string
  caseName: string
  citation: string
  similarityScore: number
  relevance: string
}

export interface CaseMemory {
  activeCaseName: string
  jurisdiction: string
  party: 'Petitioner' | 'Respondent'
  domain: string
  compromis: string
  coreArguments: { id: string; title: string; citation: string }[]
}

interface MootSuiteContextType {
  userMemory: CaseMemory
  updateCaseMemory: (memory: Partial<CaseMemory>) => void
  mootHistory: MootSession[]
  addMootSession: (session: MootSession) => void
  researchHistory: PrecedentCitation[]
  addResearchCitation: (citation: PrecedentCitation) => void
  activeSubTab: string
  setActiveSubTab: (tab: string) => void
  selectedSimilarityQuery: string
  setSelectedSimilarityQuery: (q: string) => void
}

const MootSuiteContext = createContext<MootSuiteContextType | undefined>(undefined)

export function MootSuiteProvider({ children }: { children: React.ReactNode }) {
  const [activeSubTab, setActiveSubTab] = useState('BenchSimulator')
  const [selectedSimilarityQuery, setSelectedSimilarityQuery] = useState('')

  const [userMemory, setUserMemory] = useState<CaseMemory>({
    activeCaseName: 'Anay Sharma & Ors. v. Union of India',
    jurisdiction: 'Supreme Court of India (Article 136 Special Leave Appeal)',
    party: 'Petitioner',
    domain: 'Constitutional Law',
    compromis: 'Anay Sharma challenges state-level administrative guidelines that block judicial review accessibility under Article 226, arguing they violate the basic structure doctrine under Article 368. The state argues alternative remedies exist and the guidelines are procedural.',
    coreArguments: [
      { id: 'arg-1', title: 'Maintainability under alternate remedies', citation: 'Article 136' },
      { id: 'arg-2', title: 'Basic Structure violation of judicial review', citation: 'Article 368' }
    ]
  })

  const [mootHistory, setMootHistory] = useState<MootSession[]>([
    {
      id: 'sess-1',
      caseName: 'Anay Sharma v. Union of India',
      domain: 'Constitutional Law',
      date: '2026-06-05',
      advocacyScore: 84,
      reasoningScore: 78,
      researchScore: 88,
      mannerScore: 80,
      transcript: [
        { role: 'judge', text: 'Counsel, you may begin your pleadings. We are listening.' },
        { role: 'user', text: 'My Lords, we submit that the state regulations directly impede access to judicial review, which violates the basic structure.' },
        { role: 'judge', text: 'But Counsel, are there not alternative statutory remedies available to your clients? Why should we entertain this SLP?' }
      ]
    }
  ])

  const [researchHistory, setResearchHistory] = useState<PrecedentCitation[]>([
    {
      id: 'cit-1',
      caseName: 'Kesavananda Bharati v. State of Kerala (1973)',
      citation: '1973 4 SCC 225',
      similarityScore: 94,
      relevance: 'Establishes the Basic Structure Doctrine. Essential grounding for any argument concerning the restriction of judicial review.'
    },
    {
      id: 'cit-2',
      caseName: 'Minerva Mills v. Union of India (1980)',
      citation: '1980 3 SCC 625',
      similarityScore: 91,
      relevance: 'Confirms that judicial review is an essential feature of the Basic Structure.'
    }
  ])

  const updateCaseMemory = (updates: Partial<CaseMemory>) => {
    setUserMemory((prev) => ({ ...prev, ...updates }))
  }

  const addMootSession = (newSession: MootSession) => {
    setMootHistory((prev) => [newSession, ...prev])
  }

  const addResearchCitation = (newCitation: PrecedentCitation) => {
    setResearchHistory((prev) => [newCitation, ...prev])
  }

  return (
    <MootSuiteContext.Provider
      value={{
        userMemory,
        updateCaseMemory,
        mootHistory,
        addMootSession,
        researchHistory,
        addResearchCitation,
        activeSubTab,
        setActiveSubTab,
        selectedSimilarityQuery,
        setSelectedSimilarityQuery
      }}
    >
      {children}
    </MootSuiteContext.Provider>
  )
}

export function useMootSuite() {
  const context = useContext(MootSuiteContext)
  if (!context) {
    throw new Error('useMootSuite must be used within a MootSuiteProvider')
  }
  return context
}
