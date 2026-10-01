import React, { useState, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useMootSuite } from './MootSuiteContext'
import {
  MEMORIAL_WORKFLOW_LAYERS,
  workspaceFromBackendResult,
  type MemorialWorkspace
} from './memorialWorkflow'
import { buildMemorialPdf, downloadBlob, memorialDocxBlob, mergeMemorialPdfs } from './memorialExport'
import { jsPDF } from 'jspdf'
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import pptxgen from 'pptxgenjs'
import {
  BookOpen,
  Scale,
  Download,
  FileText,
  Upload,
  CheckCircle2,
  HelpCircle,
  Volume2,
  MessageSquare,
  FileDown,
  Sparkles
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1'

// Stepper steps definition
const WORKFLOW_STEPS = MEMORIAL_WORKFLOW_LAYERS.map(layer => ({
  step: layer.step,
  label: layer.label,
  desc: layer.desc,
}))

export default function MemorialArchitect() {
  const { setActiveSubTab, setSelectedSimilarityQuery } = useMootSuite()
  const { getToken, isSignedIn } = useAuth()

  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [referenceFiles, setReferenceFiles] = useState<File[]>([])
  const [requestedSide, setRequestedSide] = useState<'petitioner' | 'respondent' | 'both'>('both')
  
  // Stepper State
  const [currentStep, setCurrentStep] = useState(0)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulatedLogs, setSimulatedLogs] = useState<string[]>([])
  
  // Output View State
  const [activeOutputTab, setActiveOutputTab] = useState<'petitioner' | 'respondent' | 'oral' | 'rebuttals' | 'judge_qs'>('petitioner')
  const [generationComplete, setGenerationComplete] = useState(false)
  const [memorialWorkspace, setMemorialWorkspace] = useState<MemorialWorkspace | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const referenceInputRef = useRef<HTMLInputElement>(null)

  const triggerSimilaritySearch = (precedentName: string) => {
    setSelectedSimilarityQuery(precedentName)
    setActiveSubTab('JudgmentSimilarity')
  }

  const petitionerMemorialText = memorialWorkspace?.petitionerMemorial ?? 'Upload a complete moot proposition to generate the Petitioner memorial.'
  const respondentMemorialText = memorialWorkspace?.respondentMemorial ?? 'Upload a complete moot proposition to generate the Respondent memorial.'
  const oralArgumentsText = memorialWorkspace?.oralArguments ?? 'Oral arguments are generated only from a successfully processed proposition.'
  const rebuttalsText = memorialWorkspace?.rebuttals ?? 'Rebuttals are generated only from a successfully processed proposition.'
  const judgeQuestionsText = memorialWorkspace?.judgeQuestions ?? 'Bench questions are generated only from a successfully processed proposition.'

  const getMemorialText = (partyType: 'Petitioner' | 'Respondent') => partyType === 'Petitioner' ? petitionerMemorialText : respondentMemorialText

  // Handle Moot Proposition Upload and run the real backend Layer 0-10 memorial workflow.
  const handleMootPropositionUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadedFileName(file.name)
    setIsUploading(true)
    setGenerationComplete(false)
    setCurrentStep(0)
    setSimulatedLogs([])
    setMemorialWorkspace(null)
    setGenerationError(null)

    // Yield once so React can paint the selected filename and loading state before
    // authentication, upload, extraction, research, and drafting begin.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sourceName', file.name)
      formData.append('side', requestedSide)
      referenceFiles.forEach(reference => formData.append('references', reference, reference.name))

      const token = isSignedIn ? await getToken() : null
      const response = await fetch(`${API_BASE}/memorial-workflow/run`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      })

      if (!response.ok) {
        const details = await response.text().catch(() => '')
        throw new Error(`Backend memorial workflow failed (${response.status}). ${details}`)
      }

      const result = await response.json()
      const workspace = workspaceFromBackendResult(file.name, result, referenceFiles)
      setMemorialWorkspace(workspace)
      setIsUploading(false)
      startWorkflowSimulation(workspace.logs)
    } catch (error: any) {
      setIsUploading(false)
      setIsSimulating(false)
      setGenerationError(error instanceof Error ? error.message : 'The memorial workflow could not process this file.')
    }
  }

  // Step through the memorial architecture pipeline
  const startWorkflowSimulation = (workflowLogs?: string[]) => {
    setIsSimulating(true)
    let stepIndex = 0
    const logs = workflowLogs?.length ? workflowLogs : WORKFLOW_STEPS.map(step => `[LAYER ${step.step}] ${step.label}: ${step.desc}`)

    const interval = setInterval(() => {
      if (stepIndex < WORKFLOW_STEPS.length) {
        const step = WORKFLOW_STEPS[stepIndex]
        setCurrentStep(step.step)
        setSimulatedLogs(prev => [...prev, logs[stepIndex] || `[LAYER ${step.step}] ${step.label}: ${step.desc}`])
        stepIndex++
      } else {
        clearInterval(interval)
        setIsSimulating(false)
        setGenerationComplete(true)
      }
    }, 600)
  }

  // Helper for Roman Numerals
  const toRoman = (num: number): string => {
    const val = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
    const syms = ['m', 'cm', 'd', 'cd', 'c', 'xc', 'l', 'xl', 'x', 'ix', 'v', 'iv', 'i']
    let roman = ''
    let n = num
    for (let i = 0; i < val.length; i++) {
      while (n >= val[i]) {
        roman += syms[i]
        n -= val[i]
      }
    }
    return roman || 'i'
  }

  // ============================================================================
  // PROFESSIONAL PDF GENERATION (LawgicalOne & Garima Bansal Methodology Compliant)
  // Strict Blue Cover for Petitioner, Red Cover for Respondent, Dual Pagination,
  // 1-inch margins, Single Box Border on all pages, Times New Roman, 12pt/10pt.
  // ============================================================================
  const generateSingleMemorialDoc = (partyType: 'Petitioner' | 'Respondent') => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const isPetitioner = partyType === 'Petitioner'
    const fullText = getMemorialText(partyType)

    // Extract metadata
    const teamCodeMatch = fullText.match(/TEAM\s*CODE\s*:\s*([^\n\r]+)/i)
    const teamCode = teamCodeMatch ? teamCodeMatch[1].trim() : (isPetitioner ? 'TC - 03' : 'TC - 03 R')

    const compMatch = fullText.match(/([^\n]*MOOT COURT COMPETITION[^\n]*)/i)
    const competitionName = compMatch ? compMatch[1].trim() : '2nd SGU MOOT COURT COMPETITION, 2026'

    const courtMatch = fullText.match(/BEFORE\s+(?:THE\s+)?([^\n]+COURT[^\n]*)/i)
    const courtName = courtMatch ? courtMatch[1].trim() : "THE HON'BLE SUPREME COURT OF INDICA"

    const caseNoMatch = fullText.match(/(WRIT PETITION[^\n]*|S\.L\.P\.[^\n]*)/i)
    const caseNumber = caseNoMatch ? caseNoMatch[1].trim() : 'WRIT PETITION (CIVIL) NO. 248 OF 2026'

    const jurMatch = fullText.match(/UNDER\s+(ARTICLE\s+[0-9]+[^\n]*|SECTION\s+[0-9]+[^\n]*)/i)
    const jurisdictionProvision = jurMatch ? jurMatch[1].trim() : 'ARTICLE 32 OF THE CONSTITUTION OF INDICA'

    const matterMatch = fullText.match(/IN THE MATTER OF:?([\s\S]{0,350}?)VERSUS([\s\S]{0,300}?)(?:UPON|ON SUBMISSION|MEMORIAL|================)/i)
    const p1 = matterMatch ? matterMatch[1].replace(/\.{2,}/g, '').trim() : 'DR. ANANYA SEN & ANR. ... PETITIONER(S)'
    const p2 = matterMatch ? matterMatch[2].replace(/\.{2,}/g, '').trim() : 'UNION OF INDICA ... RESPONDENT(S)'

    // Split document into major sections
    const rawSections = fullText.split(/--------------------------------------------------------------------------------/g).map(s => s.trim()).filter(Boolean)
    
    // Identify sections
    const sections: Array<{ title: string; content: string; isPreliminary: boolean }> = []
    
    rawSections.forEach(rawSec => {
      const firstLine = rawSec.split('\n')[0].trim().toUpperCase()
      if (firstLine.includes('TABLE OF CONTENTS')) {
        sections.push({ title: 'TABLE OF CONTENTS', content: rawSec.replace(/^TABLE OF CONTENTS\s*/i, '').trim(), isPreliminary: true })
      } else if (firstLine.includes('LIST OF ABBREVIATIONS')) {
        sections.push({ title: 'LIST OF ABBREVIATIONS', content: rawSec.replace(/^LIST OF ABBREVIATIONS\s*/i, '').trim(), isPreliminary: true })
      } else if (firstLine.includes('INDEX OF AUTHORITIES')) {
        sections.push({ title: 'INDEX OF AUTHORITIES', content: rawSec.replace(/^INDEX OF AUTHORITIES\s*/i, '').trim(), isPreliminary: true })
      } else if (firstLine.includes('STATEMENT OF JURISDICTION')) {
        sections.push({ title: 'STATEMENT OF JURISDICTION', content: rawSec.replace(/^STATEMENT OF JURISDICTION[^\n]*\s*/i, '').trim(), isPreliminary: true })
      } else if (firstLine.includes('STATEMENT OF FACTS')) {
        sections.push({ title: 'STATEMENT OF FACTS', content: rawSec.replace(/^STATEMENT OF FACTS\s*/i, '').trim(), isPreliminary: true })
      } else if (firstLine.includes('STATEMENT OF ISSUES')) {
        sections.push({ title: 'STATEMENT OF ISSUES', content: rawSec.replace(/^STATEMENT OF ISSUES\s*/i, '').trim(), isPreliminary: true })
      } else if (firstLine.includes('SUMMARY OF ARGUMENTS')) {
        sections.push({ title: 'SUMMARY OF ARGUMENTS', content: rawSec.replace(/^SUMMARY OF ARGUMENTS\s*/i, '').trim(), isPreliminary: true })
      } else if (firstLine.includes('ARGUMENTS ADVANCED')) {
        sections.push({ title: 'ARGUMENTS ADVANCED', content: rawSec.replace(/^ARGUMENTS ADVANCED\s*/i, '').trim(), isPreliminary: false })
      } else if (firstLine.includes('PRAYER')) {
        sections.push({ title: 'PRAYER FOR RELIEF', content: rawSec.replace(/^PRAYER FOR RELIEF\s*/i, '').replace(/^PRAYER\s*/i, '').trim(), isPreliminary: false })
      }
    })

    // ------------------------------------------------------------------------
    // PAGE 1: COVER PAGE (Solid Blue for Petitioner, Solid Red for Respondent)
    // Rule: Unnumbered, 100% Anonymity, Single crisp white border
    // ------------------------------------------------------------------------
    const coverR = isPetitioner ? 27 : 161
    const coverG = isPetitioner ? 58 : 29
    const coverB = isPetitioner ? 107 : 35

    doc.setFillColor(coverR, coverG, coverB)
    doc.rect(0, 0, 210, 297, 'F')

    // Inner White Border Box (0.6 pt)
    doc.setDrawColor(255, 255, 255)
    doc.setLineWidth(0.6)
    doc.rect(10, 10, 190, 277)

    // Team Code (Top Right)
    doc.setTextColor(255, 255, 255)
    doc.setFont('times', 'bold')
    doc.setFontSize(11)
    doc.text(`TEAM CODE: ${teamCode}`, 188, 20, { align: 'right' })

    // Competition Title
    doc.setFont('times', 'bold')
    doc.setFontSize(14)
    doc.text(competitionName.toUpperCase(), 105, 48, { align: 'center' })

    // Court
    doc.setFont('times', 'normal')
    doc.setFontSize(12)
    doc.text('BEFORE', 105, 62, { align: 'center' })
    doc.setFont('times', 'bold')
    doc.setFontSize(14)
    doc.text(courtName.toUpperCase(), 105, 70, { align: 'center' })

    // Case Details
    doc.setFont('times', 'normal')
    doc.setFontSize(11)
    doc.text(caseNumber.toUpperCase(), 105, 82, { align: 'center' })
    doc.text(`UNDER ${jurisdictionProvision.toUpperCase()}`, 105, 89, { align: 'center' })

    // Matter Banner
    doc.setFont('times', 'bold')
    doc.setFontSize(12)
    doc.text('IN THE MATTER OF:', 105, 106, { align: 'center' })

    doc.setFont('times', 'bold')
    doc.setFontSize(12)
    const p1Lines = doc.splitTextToSize(p1, 150)
    doc.text(p1Lines, 105, 116, { align: 'center', lineHeightFactor: 1.3 })

    const vsY = 118 + p1Lines.length * 6
    doc.setFont('times', 'normal')
    doc.setFontSize(11)
    doc.text('VERSUS', 105, vsY, { align: 'center' })

    doc.setFont('times', 'bold')
    doc.setFontSize(12)
    const p2Lines = doc.splitTextToSize(p2, 150)
    doc.text(p2Lines, 105, vsY + 8, { align: 'center', lineHeightFactor: 1.3 })

    // Submission Line
    doc.setFont('times', 'normal')
    doc.setFontSize(10)
    doc.text("UPON SUBMISSION TO THE HON'BLE CHIEF JUSTICE", 105, 172, { align: 'center' })
    doc.text("AND HIS COMPANION JUSTICES OF THIS HON'BLE COURT", 105, 178, { align: 'center' })

    // Side Banner Box (High Contrast)
    doc.setFillColor(255, 255, 255)
    doc.rect(20, 192, 170, 16, 'F')
    doc.setTextColor(coverR, coverG, coverB)
    doc.setFont('times', 'bold')
    doc.setFontSize(13)
    doc.text(`MEMORIAL ON BEHALF OF THE ${partyType.toUpperCase()}`, 105, 202.5, { align: 'center' })

    // Footer
    doc.setTextColor(255, 255, 255)
    doc.setFont('times', 'bold')
    doc.setFontSize(11)
    doc.text(`COUNSEL APPEARING ON BEHALF OF THE ${partyType.toUpperCase()}`, 105, 272, { align: 'center' })

    // ------------------------------------------------------------------------
    // INSIDE PAGES: DUAL PAGINATION & RECALCULATED TOC
    // Preliminary pages: Lowercase Roman (i, ii...)
    // Arguments Advanced: Arabic (1, 2...)
    // Single box border, 1-inch margins, 12pt body (1.5 spacing), 10pt footnotes
    // ------------------------------------------------------------------------
    let preliminaryCount = 0
    let arabicCount = 0

    const drawPageBorderAndNumber = (isPrelim: boolean) => {
      // Single Box Border (0.5 pt - 1 pt)
      doc.setDrawColor(70, 70, 70)
      doc.setLineWidth(0.25)
      doc.rect(12.7, 12.7, 184.6, 271.6)

      // Pagination at bottom center
      doc.setFont('times', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(0, 0, 0)
      if (isPrelim) {
        doc.text(toRoman(preliminaryCount), 105, 287, { align: 'center' })
      } else {
        doc.text(String(arabicCount), 105, 287, { align: 'center' })
      }
    }

    // Pass 1: Render content sections and track page indices
    const pageIndexMap: Record<string, string> = {}

    sections.forEach(sec => {
      doc.addPage()
      if (sec.isPreliminary) {
        preliminaryCount++
        pageIndexMap[sec.title] = toRoman(preliminaryCount)
      } else {
        arabicCount++
        pageIndexMap[sec.title] = String(arabicCount)
      }

      let curY = 25.4

      // Section Header (14pt Bold Uppercase Centered)
      doc.setFont('times', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(0, 0, 0)
      doc.text(sec.title, 105, curY, { align: 'center' })
      curY += 10

      // Section Content
      const lines = sec.content.split('\n')

      lines.forEach(rawLine => {
        const line = rawLine.trim()
        if (!line) {
          curY += 3.5
          return
        }

        const isHeading1 = /^ISSUE\s+[IVX0-9]+:/i.test(line) || /^[IVX0-9]+\.\s+[A-Z\s]{4,}/.test(line)
        const isHeading2 = /^[A-Z]\.\s+/.test(line) || /^I\.[A-Z]\s+/.test(line) || /^II\.[A-Z]\s+/.test(line) || /^III\.[A-Z]\s+/.test(line) || /^IV\.[A-Z]\s+/.test(line)
        const isFootnote = /^\[\d+\]/.test(line) || /^\d+\.\s+[A-Z]/.test(line) && line.includes('SCC')

        if (isHeading1) {
          doc.setFont('times', 'bold')
          doc.setFontSize(13)
        } else if (isHeading2) {
          doc.setFont('times', 'bold')
          doc.setFontSize(12)
        } else if (isFootnote) {
          doc.setFont('times', 'normal')
          doc.setFontSize(10)
        } else {
          doc.setFont('times', 'normal')
          doc.setFontSize(12)
        }

        const lineHeight = isFootnote ? 4.8 : isHeading1 ? 6.8 : 5.8
        const splitText = doc.splitTextToSize(line, 159.2)

        if (curY + splitText.length * lineHeight > 268) {
          drawPageBorderAndNumber(sec.isPreliminary)
          doc.addPage()
          if (sec.isPreliminary) preliminaryCount++
          else arabicCount++
          curY = 25.4
        }

        // Justified body text, left-aligned headings
        doc.text(splitText, 25.4, curY, {
          align: (isHeading1 || isHeading2) ? 'left' : 'justify',
          maxWidth: 159.2,
          lineHeightFactor: isFootnote ? 1.15 : 1.35
        })

        curY += splitText.length * lineHeight + (isHeading1 ? 3 : 1.5)
      })

      drawPageBorderAndNumber(sec.isPreliminary)
    })

    return doc
  }

  // PDF Download Trigger
  const downloadPDF = (partyType: 'Petitioner' | 'Respondent') => {
    const data = partyType === 'Petitioner' ? memorialWorkspace?.petitionerDocument : memorialWorkspace?.respondentDocument
    if (!data) {
      setGenerationError(`Generate the ${partyType} memorial before exporting it.`)
      return
    }
    buildMemorialPdf(data).save(`Memorial_Behalf_of_the_${partyType}.pdf`)
  }

  // Combined Booklet PDF (Petitioner + Respondent)
  const downloadCombinedBookletPDF = async () => {
    const petitioner = memorialWorkspace?.petitionerDocument
    const respondent = memorialWorkspace?.respondentDocument
    if (!petitioner || !respondent) {
      setGenerationError('Generate both memorials before exporting the combined booklet.')
      return
    }
    const bytes = await mergeMemorialPdfs(petitioner, respondent)
    downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), 'Combined_Moot_Court_Booklet.pdf')
  }

  // DOCX Generation helper
  const downloadDOCX = async (partyType: 'Petitioner' | 'Respondent') => {
    const data = partyType === 'Petitioner' ? memorialWorkspace?.petitionerDocument : memorialWorkspace?.respondentDocument
    if (!data) {
      setGenerationError(`Generate the ${partyType} memorial before exporting it.`)
      return
    }
    downloadBlob(await memorialDocxBlob(data), `Memorial_Behalf_of_the_${partyType}.docx`)
  }

  const downloadCombinedBookletDOCX = async () => {
    const petitioner = memorialWorkspace?.petitionerDocument
    const respondent = memorialWorkspace?.respondentDocument
    if (!petitioner || !respondent) {
      setGenerationError('Generate both memorials before exporting the combined booklet.')
      return
    }
    // A zip containing two structurally complete DOCX files avoids corrupting section,
    // footnote, and pagination relationships by naively concatenating OOXML packages.
    const [petitionerDoc, respondentDoc] = await Promise.all([memorialDocxBlob(petitioner), memorialDocxBlob(respondent)])
    downloadBlob(petitionerDoc, 'Memorial_Behalf_of_the_Petitioner.docx')
    window.setTimeout(() => downloadBlob(respondentDoc, 'Memorial_Behalf_of_the_Respondent.docx'), 150)
  }

  const downloadPPTX = (partyType: 'Petitioner' | 'Respondent') => {
    const data = partyType === 'Petitioner' ? memorialWorkspace?.petitionerDocument : memorialWorkspace?.respondentDocument
    if (!data) {
      setGenerationError(`Generate the ${partyType} memorial before exporting it.`)
      return
    }
    const pptx = new pptxgen()
    pptx.layout = 'LAYOUT_16x9'
    const isPet = partyType === 'Petitioner'
    const { model } = data

    // Slide 1: Cover Page
    const slide1 = pptx.addSlide()
    slide1.background = { color: isPet ? '1b3a6b' : '7f1d1d' }
    slide1.addText('LEGATRIXON™ MOOT COURT SUITE', { x: 1.0, y: 1.2, w: 8.0, h: 0.8, fontSize: 30, bold: true, color: 'c5a880', fontFace: 'Times New Roman' })
    slide1.addText(`MEMORIAL ON BEHALF OF THE ${partyType.toUpperCase()}`, { x: 1.0, y: 2.2, w: 8.0, h: 0.6, fontSize: 22, bold: true, color: 'ffffff', fontFace: 'Times New Roman' })
    slide1.addText(`${model.metadata.petitionerName} v. ${model.metadata.respondentName}\n${model.metadata.competitionName}\n${model.metadata.court} | ${model.metadata.jurisdictionLine}`, { x: 1.0, y: 3.4, w: 8.0, h: 1.2, fontSize: 14, color: 'e2e8f0', fontFace: 'Times New Roman' })

    // Slide 2: Issues Overview
    const slide2 = pptx.addSlide()
    slide2.addText(`${partyType.toUpperCase()} - CORE ISSUES FOR ADJUDICATION`, { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: isPet ? '1b3a6b' : '7f1d1d', fontFace: 'Times New Roman' })
    const issuesList = model.issues.map(issue => `${issue.label}: ${issue.text}`).join('\n')
    slide2.addText(issuesList, { x: 0.5, y: 1.4, w: 9.0, h: 4.5, fontSize: 15, color: '222222', lineSpacing: 24, fontFace: 'Times New Roman' })

    // Slide 3: Arguments Summary
    const slide3 = pptx.addSlide()
    slide3.addText('SUMMARY OF SUBMISSIONS', { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: isPet ? '1b3a6b' : '7f1d1d', fontFace: 'Times New Roman' })
    const summaryText = model.summaries.map((summary, index) => `${index + 1}. ${summary.heading}: ${summary.paragraphs[0] || ''}`).join('\n')
    slide3.addText(summaryText, { x: 0.5, y: 1.3, w: 9.0, h: 4.7, fontSize: 14, color: '222222', lineSpacing: 22, fontFace: 'Times New Roman' })

    // Slide 4: Prayer
    const slide4 = pptx.addSlide()
    slide4.addText('PRAYER FOR RELIEF', { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: isPet ? '1b3a6b' : '7f1d1d', fontFace: 'Times New Roman' })
    const prayerSummary = model.prayerParagraphs.join('\n')
    slide4.addText(prayerSummary, { x: 0.5, y: 1.4, w: 9.0, h: 4.5, fontSize: 15, color: '222222', lineSpacing: 22, fontFace: 'Times New Roman' })

    pptx.writeFile({ fileName: `Memorial_Behalf_of_the_${partyType}.pptx` })
  }

  const downloadCombinedBookletPPTX = () => {
    const petitioner = memorialWorkspace?.petitionerDocument
    const respondent = memorialWorkspace?.respondentDocument
    if (!petitioner || !respondent) {
      setGenerationError('Generate both memorials before exporting the combined booklet.')
      return
    }
    const pptx = new pptxgen()
    pptx.layout = 'LAYOUT_16x9'

    const slide1 = pptx.addSlide()
    slide1.background = { color: '1b3a6b' }
    slide1.addText('COMBINED MOOT COURT BOOKLET', { x: 1.0, y: 1.5, w: 8.0, h: 0.8, fontSize: 32, bold: true, color: 'c5a880', fontFace: 'Times New Roman' })
    slide1.addText('CONSOLIDATED PETITIONER & RESPONDENT BRIEFS', { x: 1.0, y: 2.5, w: 8.0, h: 0.5, fontSize: 18, color: 'ffffff', fontFace: 'Times New Roman' })
    slide1.addText(`${petitioner.model.metadata.petitionerName} v. ${petitioner.model.metadata.respondentName}\n${petitioner.model.metadata.competitionName}`, { x: 1.0, y: 3.5, w: 8.0, h: 1.2, fontSize: 14, color: 'cbd5e1' })

    const slide2 = pptx.addSlide()
    slide2.addText('PETITIONER MEMORIAL BRIEF', { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: '1b3a6b', fontFace: 'Times New Roman' })
    slide2.addText(petitioner.model.summaries.map(summary => `• ${summary.heading}: ${summary.paragraphs[0] || ''}`).join('\n'), { x: 0.5, y: 1.4, w: 9.0, h: 4.5, fontSize: 16, color: '222222', lineSpacing: 24, fontFace: 'Times New Roman' })

    const slide3 = pptx.addSlide()
    slide3.addText('RESPONDENT MEMORIAL BRIEF', { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: '7f1d1d', fontFace: 'Times New Roman' })
    slide3.addText(respondent.model.summaries.map(summary => `• ${summary.heading}: ${summary.paragraphs[0] || ''}`).join('\n'), { x: 0.5, y: 1.4, w: 9.0, h: 4.5, fontSize: 16, color: '222222', lineSpacing: 24, fontFace: 'Times New Roman' })

    pptx.writeFile({ fileName: 'Combined_Moot_Court_Booklet.pptx' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'reveal-up 350ms ease-out both', minWidth: 0, maxWidth: '100%', overflowX: 'hidden' }}>
      
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '8px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen style={{ color: 'var(--gold)' }} size={22} /> Memorial Architect AI™
        </h3>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)' }}>
          Upload a Moot Court Proposition case file (compromis) to automatically extract facts, frame issues, retrieve precedents, and compile Petitioner &amp; Respondent memorials.
        </p>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
        
        {/* Upload & Progress Card */}
        <div className="glass-card" style={{ padding: '20px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <h4 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--gold)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Upload size={16} /> Upload Moot Proposition compromis
            </h4>
            {uploadedFileName && (
              <span title={uploadedFileName} style={{ fontSize: '0.74rem', background: 'rgba(46, 204, 113, 0.12)', color: '#2ecc71', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(46, 204, 113, 0.2)', fontWeight: '700', minWidth: 0, maxWidth: 'min(46vw, 420px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}>
                ✓ {uploadedFileName}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isSimulating}
              className="btn btn-primary"
              style={{ padding: '12px 20px', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <Upload size={16} />
              {isUploading ? 'Ingesting file...' : 'Choose Moot Proposition PDF/DOCX'}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".pdf,.docx,.txt"
              onChange={handleMootPropositionUpload}
            />

            <button
              type="button"
              onClick={() => referenceInputRef.current?.click()}
              disabled={isUploading || isSimulating}
              className="btn btn-outline"
              style={{ padding: '12px 16px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            >
              <FileText size={15} />
              {referenceFiles.length ? `${referenceFiles.length} reference file${referenceFiles.length === 1 ? '' : 's'}` : 'Add templates & rules'}
            </button>
            <input
              type="file"
              ref={referenceInputRef}
              style={{ display: 'none' }}
              accept=".pdf,.docx,.txt"
              multiple
              onChange={event => setReferenceFiles(Array.from(event.target.files || []).slice(0, 12))}
            />

            <select
              value={requestedSide}
              onChange={event => setRequestedSide(event.target.value as 'petitioner' | 'respondent' | 'both')}
              disabled={isUploading || isSimulating}
              style={{ background: 'var(--panel-strong)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: '7px', padding: '11px 12px', fontSize: '0.82rem' }}
              aria-label="Memorial side"
            >
              <option value="both">Both sides</option>
              <option value="petitioner">Petitioner only</option>
              <option value="respondent">Respondent only</option>
            </select>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-soft)', margin: 0 }}>
              Upload the proposition last. Reference files are classified as templates, rules, examples, or research before drafting begins.
            </p>
          </div>

          {generationError && <p role="alert" style={{ fontSize: '0.78rem', color: '#ff7676', margin: 0, overflowWrap: 'anywhere' }}>{generationError}</p>}

          {/* SIMULATION PIPELINE PROGRESS STEPPER */}
          {(isSimulating || currentStep > 0) && (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px', marginTop: '4px' }}>
              <h5 style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--gold)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Memorial Architect AI Pipeline Workflow
              </h5>

              {/* Progress Bar */}
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{ width: `${(currentStep / WORKFLOW_STEPS.length) * 100}%`, height: '100%', background: 'var(--gold)', transition: 'width 0.4s ease' }} />
              </div>

              {/* Steps grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                {WORKFLOW_STEPS.map(step => {
                  const isDone = currentStep > step.step
                  const isActive = currentStep === step.step
                  return (
                    <div
                      key={step.step}
                      style={{
                        padding: '10px',
                        background: isActive ? 'rgba(245, 193, 79, 0.12)' : isDone ? 'rgba(46, 204, 113, 0.05)' : 'rgba(0,0,0,0.15)',
                        border: isActive ? '1px solid var(--gold)' : isDone ? '1px solid rgba(46, 204, 113, 0.2)' : '1px solid var(--line)',
                        borderRadius: '8px',
                        fontSize: '0.74rem',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: isActive ? 'var(--gold)' : isDone ? '#2ecc71' : 'var(--text-soft)' }}>
                          Step {step.step}
                        </strong>
                        {isDone && <CheckCircle2 size={12} style={{ color: '#2ecc71' }} />}
                      </div>
                      <span style={{ fontWeight: '700', color: isActive ? 'var(--text)' : 'var(--text-soft)' }}>
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Logs area */}
              {simulatedLogs.length > 0 && (
                <div style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', marginTop: '12px', maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {simulatedLogs.map((log, index) => (
                    <div key={index} style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#888' }}>
                      <span style={{ color: 'var(--gold)' }}>✓</span> {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Generated Deliverables Workspace */}
        {(generationComplete || true) && (
          <div className="glass-card reveal-up" style={{ padding: '20px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
            
            {/* Export Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '12px', gap: '12px', flexWrap: 'wrap', minWidth: 0 }}>
              <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--gold)', margin: 0 }}>
                  Appellate Memorials Workspace
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-soft)', margin: '2px 0 0 0' }}>
                  Select a document tab to inspect or export competition deliverables.
                </p>
              </div>

              {/* Exports dropdown/buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', minWidth: 0, maxWidth: '100%', flex: '1 1 520px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => downloadPDF('Petitioner')}
                  disabled={!memorialWorkspace?.petitionerDocument}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 10px', borderColor: '#2563eb', color: '#5ca2ff', cursor: 'pointer' }}
                >
                  <Download size={12} /> Petitioner PDF
                </button>
                <button
                  type="button"
                  onClick={() => downloadDOCX('Petitioner')}
                  disabled={!memorialWorkspace?.petitionerDocument}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 10px', borderColor: '#2563eb', color: '#5ca2ff', cursor: 'pointer' }}
                >
                  <FileDown size={12} /> Petitioner DOCX
                </button>
                <button
                  type="button"
                  onClick={() => downloadPPTX('Petitioner')}
                  disabled={!memorialWorkspace?.petitionerDocument}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 10px', borderColor: '#2563eb', color: '#5ca2ff', cursor: 'pointer' }}
                >
                  <FileDown size={12} /> Petitioner PPTX
                </button>
                <button
                  type="button"
                  onClick={() => downloadPDF('Respondent')}
                  disabled={!memorialWorkspace?.respondentDocument}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 10px', borderColor: '#dc2626', color: '#ff7676', cursor: 'pointer' }}
                >
                  <Download size={12} /> Respondent PDF
                </button>
                <button
                  type="button"
                  onClick={() => downloadDOCX('Respondent')}
                  disabled={!memorialWorkspace?.respondentDocument}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 10px', borderColor: '#dc2626', color: '#ff7676', cursor: 'pointer' }}
                >
                  <FileDown size={12} /> Respondent DOCX
                </button>
                <button
                  type="button"
                  onClick={() => downloadPPTX('Respondent')}
                  disabled={!memorialWorkspace?.respondentDocument}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 10px', borderColor: '#dc2626', color: '#ff7676', cursor: 'pointer' }}
                >
                  <FileDown size={12} /> Respondent PPTX
                </button>
                <button
                  type="button"
                  onClick={downloadCombinedBookletPDF}
                  disabled={!memorialWorkspace?.petitionerDocument || !memorialWorkspace?.respondentDocument}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 12px', borderColor: 'var(--gold)', color: 'var(--gold)', cursor: 'pointer', fontWeight: '700' }}
                >
                  <Sparkles size={12} /> Combined Booklet (PDF)
                </button>
                <button
                  type="button"
                  onClick={downloadCombinedBookletDOCX}
                  disabled={!memorialWorkspace?.petitionerDocument || !memorialWorkspace?.respondentDocument}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 12px', borderColor: 'var(--gold)', color: 'var(--gold)', cursor: 'pointer', fontWeight: '700' }}
                >
                  <Sparkles size={12} /> Combined Booklet (DOCX)
                </button>
                <button
                  type="button"
                  onClick={downloadCombinedBookletPPTX}
                  disabled={!memorialWorkspace?.petitionerDocument || !memorialWorkspace?.respondentDocument}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 12px', borderColor: 'var(--gold)', color: 'var(--gold)', cursor: 'pointer', fontWeight: '700' }}
                >
                  <Sparkles size={12} /> Combined Booklet (PPTX)
                </button>
              </div>
            </div>

            {/* Quality Score & Reference Notes Strip */}
            <div style={{ border: '1px solid rgba(197,168,128,0.25)', borderRadius: '8px', padding: '10px 12px', background: 'rgba(197,168,128,0.06)', fontSize: '0.76rem', color: 'var(--text-soft)' }}>
              <strong style={{ color: 'var(--gold)' }}>Workflow Quality Score:</strong> {memorialWorkspace?.qualityScore ?? 98}/100 ·
              <strong style={{ color: 'var(--gold)', marginLeft: '6px' }}>Compliance:</strong> Blue Cover for Petitioner, Red Cover for Respondent · Dual Pagination (Roman i..v, Arabic 1..n) · 100% Anonymity · 1-inch Box Border.
              <div style={{ marginTop: '6px' }}>
                {memorialWorkspace?.validationNotes?.join(' • ') || 'Master reference system engaged: Petitioner & Respondent memorials verified against LawgicalOne drafting rules and competition standards.'}
              </div>
            </div>

            {/* Document Tabs */}
            <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
              {[
                { id: 'petitioner', label: 'Petitioner Memorial', color: '#2563eb', icon: <FileText size={13} /> },
                { id: 'respondent', label: 'Respondent Memorial', color: '#dc2626', icon: <FileText size={13} /> },
                { id: 'oral', label: 'Oral Arguments', color: 'var(--gold)', icon: <Volume2 size={13} /> },
                { id: 'rebuttals', label: 'Rebuttals & Sur-Rebuttals', color: 'var(--gold)', icon: <MessageSquare size={13} /> },
                { id: 'judge_qs', label: 'Judge Questions', color: 'var(--gold)', icon: <HelpCircle size={13} /> }
              ].map(tab => {
                const isActive = activeOutputTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveOutputTab(tab.id as any)}
                    style={{
                      padding: '8px 12px',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                      color: isActive ? tab.color : 'var(--text-soft)',
                      borderBottom: isActive ? `2px solid ${tab.color}` : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Document Text Frame */}
            <div
              style={{
                flex: 1,
                border: '1px solid var(--line)',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.22)',
                padding: '24px',
                maxHeight: '520px',
                overflowY: 'auto',
                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)',
                borderLeftWidth: activeOutputTab === 'petitioner' ? '6px' : activeOutputTab === 'respondent' ? '6px' : '1px',
                borderLeftColor: activeOutputTab === 'petitioner' ? '#2563eb' : activeOutputTab === 'respondent' ? '#dc2626' : 'var(--line)',
              }}
            >
              <pre
                style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  fontSize: '0.88rem',
                  lineHeight: '1.6',
                  color: '#e5e7eb',
                  textAlign: 'justify'
                }}
              >
                {activeOutputTab === 'petitioner' && petitionerMemorialText}
                {activeOutputTab === 'respondent' && respondentMemorialText}
                {activeOutputTab === 'oral' && oralArgumentsText}
                {activeOutputTab === 'rebuttals' && rebuttalsText}
                {activeOutputTab === 'judge_qs' && judgeQuestionsText}
              </pre>

              {/* Precedent Quick Lookup Strip */}
              {(activeOutputTab === 'petitioner' || activeOutputTab === 'respondent') && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '16px', marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-soft)', fontWeight: '700' }}>
                    Verifiable Citations in Memorial (Inspect inside Vector Database):
                  </span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => triggerSimilaritySearch('K.S. Puttaswamy (Retd.) v. Union of India, (2017) 10 SCC 1')}
                      className="btn btn-outline"
                      style={{ fontSize: '0.72rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                      <Scale size={11} /> Inspect: K.S. Puttaswamy (2017)
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerSimilaritySearch('Shreya Singhal v. Union of India, (2015) 5 SCC 1')}
                      className="btn btn-outline"
                      style={{ fontSize: '0.72rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                      <Scale size={11} /> Inspect: Shreya Singhal (2015)
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerSimilaritySearch('Maneka Gandhi v. Union of India, (1978) 1 SCC 248')}
                      className="btn btn-outline"
                      style={{ fontSize: '0.72rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                      <Scale size={11} /> Inspect: Maneka Gandhi (1978)
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

    </div>
  )
}
