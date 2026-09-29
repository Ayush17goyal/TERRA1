import { useEffect, useRef, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { API_BASE_URL } from '../lib/api'
import LearnDraftingRoot from './learn-drafting/LearnDraftingRoot'
import DraftAnalyzer from './draft-analyzer/DraftAnalyzer'
import './learn-drafting/learn-drafting.css'
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  Gavel,
  GraduationCap,
  Info,
  Lock,
  MessageCircle,
  Play,
  Scale,
  Sparkles,
  Upload,
} from 'lucide-react'
import './DraftingAcademy.css'

import VerificationCard from '../components/VerificationCard'

type Props = { apiToken: string }

const categories = [
  'Contract Drafting',
  'Legal Notices',
  'Affidavits',
  'Plaints',
  'Written Statements',
  'Petitions',
  'Bail Applications',
  'Consumer Complaints',
  'Corporate Drafting',
  'Memorial Drafting',
]

// Detailed Mock Masterclass Data to seed or fall back to
const defaultCoursesSeed = [
  {
    id: 'course-1',
    title: 'Masterclass: Contract Drafting',
    category: 'Contract Drafting',
    description: 'Learn the architectural principles of commercial contracts. Master recitals, definitions blocks, operative provisions, and default boilerplates under Indian Law.',
    difficulty: 'Intermediate' as const,
    duration: '2.5 Hours',
    lessons: [
      { id: 'l-1', title: 'Constitutive Parts of a Contract', duration: '22 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' },
      { id: 'l-2', title: 'Drafting Parties block & Corporate Capacities', duration: '18 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' },
      { id: 'l-3', title: 'Operative Clauses, Covenants & Conditions', duration: '28 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' },
      { id: 'l-4', title: 'Boilerplates: Severability, Force Majeure & Notices', duration: '32 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' },
      { id: 'l-5', title: 'Signatures, Attestations, and Schedule Annexures', duration: '20 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' },
    ],
    takeaways: [
      'Draft in active voice ("Buyer shall pay" instead of "Payment shall be made").',
      'Incorporate clear definitions for terms capitalized throughout.',
      'Check stamp duty acts specific to the place of execution.',
    ],
    templates: [
      { name: 'Standard Commercial Service Agreement Template.docx', url: '#' },
      { name: 'Mutual Non-Disclosure Agreement Checklist.pdf', url: '#' },
    ],
    assignment: 'Draft a mutual Non-Disclosure Agreement (NDA) between a software consultancy and an agency client, ensuring all intellectual property disclosures are protected.',
  },
  {
    id: 'course-2',
    title: 'Masterclass: Legal Notices',
    category: 'Legal Notices',
    description: 'Master the art of pre-litigation notices. Learn notices under Section 138 of NI Act, Section 80 of CPC, and Consumer Protection regulations.',
    difficulty: 'Beginner' as const,
    duration: '1.8 Hours',
    lessons: [
      { id: 'l-6', title: 'Notice Framework & Legal Intent', duration: '15 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' },
      { id: 'l-7', title: 'Section 138 Cheque Bounce notices', duration: '25 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' },
      { id: 'l-8', title: 'Civil Notices under Section 80 CPC', duration: '30 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' },
      { id: 'l-9', title: 'Drafting demand for Specific Performance', duration: '20 min', videoUrl: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4' },
    ],
    takeaways: [
      'Strictly state the cause of action and date of occurrence.',
      'Clearly specify the relief demanded and the time limit for compliance (e.g. 15 days).',
      'Ensure proof of service is preserved (Speed Post AD / Email delivery logs).',
    ],
    templates: [
      { name: 'Cheque Bounce Notice Section 138 Draft.docx', url: '#' },
      { name: 'General Civil Demand Notice Format.pdf', url: '#' },
    ],
    assignment: 'Draft a legal notice demanding payment for outstanding invoices totaling INR 5,00,000, providing a strict 15-day compliance window before filing suit.',
  },
  {
    id: 'course-3',
    title: 'Masterclass: Plaints & Written Statements',
    category: 'Plaints',
    description: 'Learn pleading architecture. Master CPC Order VI rules, cause of action framing, valuation, court fees, and jurisdiction details.',
    difficulty: 'Advanced' as const,
    duration: '3.2 Hours',
    lessons: [
      { id: 'l-10', title: 'Rules of Pleading (Order VI CPC)', duration: '35 min', videoUrl: '' },
      { id: 'l-11', title: 'Structure of a Plaint (Order VII CPC)', duration: '40 min', videoUrl: '' },
      { id: 'l-12', title: 'Framing Causes of Action and Jurisdiction', duration: '30 min', videoUrl: '' },
      { id: 'l-13', title: 'Drafting Written Statements & Set-off claims', duration: '45 min', videoUrl: '' },
      { id: 'l-14', title: 'Verifications, Affidavits & Annexures', duration: '20 min', videoUrl: '' },
    ],
    takeaways: [
      'Plead facts, not laws (state material facts concisely).',
      'Specifically deny every allegation in the plaint; general denials count as admissions.',
      'Ensure verification is signed on oath before an oath commissioner.',
    ],
    templates: [
      { name: 'Model Plaint for Recovery of Money.docx', url: '#' },
      { name: 'Model Written Statement (Defense).docx', url: '#' },
    ],
    assignment: 'Draft a plaint for the recovery of money against a default buyer, including statements on jurisdiction and cause of action.',
  },
]

const WHATSAPP_LINK = 'https://whatsapp.com/channel/0029Vb8RU1pInlqP1O6tvx3Y'

export default function DraftingAcademy({ apiToken }: Props) {
  const { user: clerkUser } = useUser()
  const [tab, setTab] = useState<'learn' | 'analyzer'>('learn')
  const [courses, setCourses] = useState<any[]>([])
  const [liveSessions, setLiveSessions] = useState<any[]>([])

  // Live Sessions (student: join only)
  const livePoller = useRef<ReturnType<typeof setInterval> | null>(null)

  // Draft Analyzer States
  const [draftText, setDraftText] = useState('')
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [analyzerTab, setAnalyzerTab] = useState<'summary' | 'sections' | 'clauses' | 'language' | 'risks' | 'citations' | 'rewrite'>('summary')
  const [openSectionIndex, setOpenSectionIndex] = useState<number | null>(0)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState('')

  const fetchLiveSessions = () => {
    if (!apiToken) return
    fetch(`${API_BASE_URL}/live-sessions`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setLiveSessions(data)
      })
      .catch(() => {})
  }

  // Fetch Courses on load
  useEffect(() => {
    fetchCourses()
    fetchLiveSessions()
    livePoller.current = setInterval(fetchLiveSessions, 30000)
    return () => {
      if (livePoller.current) clearInterval(livePoller.current)
    }
  }, [apiToken])

  const fetchCourses = () => {
    fetch(`${API_BASE_URL}/legal-intelligence/drafting/courses`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          // Map backend entities to our format
          const formatted = data.map((item: any) => ({
            id: item.id,
            title: item.title,
            category: item.category,
            description: item.description,
            difficulty: item.metadata?.difficulty || 'Intermediate',
            duration: item.metadata?.duration || '2 Hours',
            lessons: item.metadata?.lessons || [],
            takeaways: item.metadata?.takeaways || [],
            templates: item.metadata?.templates || [],
            assignment: item.metadata?.assignment || '',
          }))
          setCourses(formatted)
        } else {
          setCourses(defaultCoursesSeed)
        }
      })
      .catch(() => {
        setCourses(defaultCoursesSeed)
      })
  }

  // File upload reader
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      setDraftText(event.target?.result as string)
    }
    reader.readAsText(file)
  }

  // Trigger AI Draft Check
  const checkDraft = async () => {
    if (!draftText.trim()) return
    setLoading(true)
    setResult(null)
    setFeedbackMsg('')
    try {
      const response = await fetch(`${API_BASE_URL}/legal-intelligence/drafting/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiToken}` },
        body: JSON.stringify({ text: draftText, fileName, inputType: fileName ? 'File Upload' : 'Pasted Text' }),
      })
      if (!response.ok) throw new Error(await response.text())
      const data = await response.json()
      setResult(data)
      setAnalyzerTab('summary')
    } catch (err: any) {
      setFeedbackMsg(err.message || 'Draft check failed.')
    } finally {
      setLoading(false)
    }
  }

  // Clipboard copies
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  // Export Audit Report PDF Helper
  const exportReportToPDF = async () => {
    if (!result) return
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      
      // Page styling parameters
      const margin = 50
      const pageWidth = 595
      const contentWidth = pageWidth - (margin * 2) // 495
      let yPosition = 60

      // Title Section
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(20)
      doc.setTextColor(20, 30, 60)
      doc.text('LEGATRIXON AI Legal Drafting Audit', margin, yPosition)
      
      yPosition += 20
      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text(`Generated: ${new Date().toLocaleDateString()} | Analyst: Senior Advocate AI Review Engine`, margin, yPosition)
      
      yPosition += 15
      doc.setLineWidth(1.5)
      doc.setDrawColor(245, 193, 79) // Gold accent
      doc.line(margin, yPosition, pageWidth - margin, yPosition)
      
      // Scores
      yPosition += 30
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(20, 30, 60)
      doc.text('I. EXECUTIVE PLEADING SCORECARD', margin, yPosition)
      
      yPosition += 20
      doc.setFontSize(10)
      doc.setTextColor(60, 60, 60)
      doc.text(`Overall Score: ${result.scores?.overall || 0}/100`, margin + 10, yPosition)
      doc.text(`Legal Accuracy: ${result.scores?.legalAccuracy || 0}%`, margin + 10, yPosition + 15)
      doc.text(`Professional Readiness: ${result.scores?.professionalReadiness || 0}%`, margin + 10, yPosition + 30)
      doc.text(`Formatting and Citations: ${result.scores?.formatting || 0}%`, margin + 10, yPosition + 45)
      
      doc.text(`Clause Completeness: ${result.scores?.clauseCompleteness || 0}%`, margin + 250, yPosition)
      doc.text(`Logical Pleading Flow: ${result.scores?.logicalFlow || 0}%`, margin + 250, yPosition + 15)
      doc.text(`Structure Integrity: ${result.scores?.structure || 0}%`, margin + 250, yPosition + 30)
      doc.text(`Compliance / Mitigation: ${result.scores?.compliance || 0}%`, margin + 250, yPosition + 45)

      // Summary
      yPosition += 75
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(20, 30, 60)
      doc.text('II. EXECUTIVE SUMMARY', margin, yPosition)
      
      yPosition += 15
      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(80, 80, 80)
      const summaryText = result.finalSummary?.executiveSummary || 'Audit analysis summaries ready.'
      const summaryLines = doc.splitTextToSize(summaryText, contentWidth)
      doc.text(summaryLines, margin, yPosition)
      
      yPosition += (summaryLines.length * 12) + 20
      
      // Key Fixes
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(180, 50, 50)
      doc.text('CRITICAL AMENDMENT RECOMMENDATIONS:', margin, yPosition)
      
      yPosition += 15
      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      const priorityFixes = result.finalSummary?.priorityFixes || []
      priorityFixes.forEach((fix: string) => {
        doc.text(`• ${fix}`, margin + 10, yPosition)
        yPosition += 15
      })

      // Section Review
      yPosition += 15
      if (yPosition > 700) {
        doc.addPage()
        yPosition = 50
      }
      
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(20, 30, 60)
      doc.text('III. DETAILED CLAUSE AND RISK AUDIT', margin, yPosition)

      yPosition += 20
      doc.setFontSize(10)
      doc.text('Missing Pleading Elements & Disclaimers:', margin, yPosition)
      
      yPosition += 15
      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.setTextColor(80, 80, 80)
      const missing = result.riskAnalysis?.missingMandatoryElements || []
      doc.text(missing.join(', ') || 'No critical boilerplate gaps found.', margin + 10, yPosition)

      yPosition += 25
      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(20, 30, 60)
      doc.text('Identified Litigation Risks:', margin, yPosition)

      yPosition += 15
      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      const risks = result.riskAnalysis?.litigationRisks || []
      risks.forEach((risk: string) => {
        if (yPosition > 760) {
          doc.addPage()
          yPosition = 50
        }
        const rLines = doc.splitTextToSize(`• ${risk}`, contentWidth)
        doc.text(rLines, margin, yPosition)
        yPosition += (rLines.length * 11)
      })

      // Pagination
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(160, 160, 160)
        doc.text(`Page ${i} of ${pageCount} | Automated Legal Audit from LEGATRIXON`, margin, 815)
      }

      doc.save(`Legatrixon_Drafting_Audit_${Date.now()}.pdf`)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="academy-container reveal-up">
      {/* Top Banner and Navigation */}
      <header className="academy-header-panel">
        <nav className="academy-nav">
          <button
            type="button"
            className={`academy-tab-btn ${tab === 'learn' ? 'active' : ''}`}
            onClick={() => setTab('learn')}
          >
            <BookOpen size={16} /> Learn Drafting
          </button>
          <button
            type="button"
            className={`academy-tab-btn ${tab === 'analyzer' ? 'active' : ''}`}
            onClick={() => setTab('analyzer')}
          >
            <Sparkles size={16} /> AI Draft Analyzer
          </button>
        </nav>
      </header>

      {/* FEATURE 1: LEARN DRAFTING — powered by LearnDraftingRoot */}
      {tab === 'learn' && (
        <LearnDraftingRoot apiToken={apiToken} />
      )}


      {/* FEATURE 2: AI DRAFT ANALYZER */}
      {tab === 'analyzer' && (
        <section className="analyzer-dashboard" style={{ padding: '0' }}>
          <DraftAnalyzer />
        </section>
      )}

    </div>
  )
}
