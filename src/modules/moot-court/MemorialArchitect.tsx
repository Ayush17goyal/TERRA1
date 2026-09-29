import React, { useState, useRef } from 'react'
import { useMootSuite } from './MootSuiteContext'
import { jsPDF } from 'jspdf'
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import pptxgen from 'pptxgenjs'
import {
  BookOpen,
  Scale,
  Edit,
  ArrowRight,
  Sparkles,
  Download,
  AlertCircle,
  FileText,
  Upload,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Volume2,
  MessageSquare,
  FileDown
} from 'lucide-react'

// Stepper steps definition
const WORKFLOW_STEPS = [
  { step: 1, label: 'Fact Extraction', desc: 'Isolating key events, timelines, and parties from the compromis.' },
  { step: 2, label: 'Issue Identification', desc: 'Formulating legal questions and maintainability boundaries.' },
  { step: 3, label: 'Applicable Law Mapping', desc: 'Retrieving relevant articles, acts, and procedural rules.' },
  { step: 4, label: 'Precedent Research', desc: 'Finding authoritative landmark rulings and contradictory cases.' },
  { step: 5, label: 'Generate Petitioner Memorial', desc: 'Compiling structured arguments with cover page and prayer (Blue Theme).' },
  { step: 6, label: 'Generate Respondent Memorial', desc: 'Compiling structured counter-arguments with cover page and prayer (Red Theme).' },
  { step: 7, label: 'Generate Oral Arguments', desc: 'Structuring courtroom scripts and opening statements.' },
  { step: 8, label: 'Generate Rebuttals', desc: 'Analyzing Petitioner weaknesses and drafting counter-pleas.' },
  { step: 9, label: 'Generate Sur-Rebuttals', desc: 'Preparing defences for Petitioner against expected counters.' },
  { step: 10, label: 'Generate Judge Questions', desc: 'Synthesizing tough questions for mock bench practice.' }
]

const PETITIONER_MEMORIAL = `IN THE SUPREME COURT OF INDIA
(APPELLATE JURISDICTION)
S.L.P. (CIVIL) NO. 1024 OF 2026

IN THE MATTER OF:
ANAY SHARMA & ORS.                                  ... PETITIONER

VERSUS

UNION OF INDIA                                      ... RESPONDENT

========================================================================
                 MEMORIAL ON BEHALF OF THE PETITIONER
========================================================================

------------------------------------------------------------------------
I. TABLE OF CONTENTS
------------------------------------------------------------------------
1. LIST OF ABBREVIATIONS ........................................... 03
2. INDEX OF AUTHORITIES ............................................ 04
3. STATEMENT OF JURISDICTION ....................................... 05
4. STATEMENT OF FACTS .............................................. 06
5. ISSUES RAISED ................................................... 07
6. SUMMARY OF ARGUMENTS ............................................ 08
7. ARGUMENTS ADVANCED .............................................. 09
   7.1. THE PETITION IS MAINTAINABLE UNDER ARTICLE 136 OF THE
        CONSTITUTION OF INDIA DESPITE ALTERNATIVE REMEDIES ......... 09
   7.2. THE STATE ADMINISTRATIVE DIRECTIVES INFRINGE THE BASIC
        STRUCTURE BY RESTRICTING THE REMEDY OF JUDICIAL REVIEW .... 11
8. PRAYER .......................................................... 13

------------------------------------------------------------------------
II. INDEX OF AUTHORITIES
------------------------------------------------------------------------
A. CASES CITED:
1. Kesavananda Bharati v. State of Kerala, (1973) 4 SCC 225
2. Minerva Mills Ltd. v. Union of India, (1980) 3 SCC 625
3. L. Chandra Kumar v. Union of India, (1997) 3 SCC 261
4. Whirlpool Corporation v. Registrar of Trade Marks, (1998) 8 SCC 1
5. State of U.P. v. Mohammad Nooh, AIR 1958 SC 86

B. STATUTES & CONSTITUTIONAL PROVISIONS:
1. The Constitution of India, 1950 - Articles 13, 32, 136, 226, 227
2. The Code of Civil Procedure, 1908 - Section 115

C. BOOKS & TREATISES:
1. H.M. Seervai, Constitutional Law of India (4th Ed., 2015)
2. D.D. Basu, Shorter Constitution of India (15th Ed., 2018)

D. REPORTS & JOURNALS:
1. Law Commission of India, 230th Report on Judicial Reforms (2009)
2. Harvard Law Review, "The Architecture of Judicial Review" (2022)

------------------------------------------------------------------------
III. STATEMENT OF JURISDICTION
------------------------------------------------------------------------
The Petitioners approach this Hon'ble Supreme Court of India under Article 136 of the Constitution of India, 1950. Article 136 vests extraordinary discretionary jurisdiction in this Court to grant Special Leave to Appeal against any judgment, decree, determination, sentence or order in any cause or matter passed or made by any court or tribunal in the territory of India. The Petitioners submit that the present matter involves substantial questions of constitutional law and manifest injustice, justifying the invocation of this Court's plenary powers.

------------------------------------------------------------------------
IV. STATEMENT OF FACTS
------------------------------------------------------------------------
1. The Petitioner, Anay Sharma, is a citizen of India who challenged state-level administrative guidelines issued in early 2026.
2. The impugned administrative directives mandate that any litigant seeking to file a writ under Article 226 of the Constitution must first exhaust a specialized, executive-controlled grievance redressal tribunal. If a litigant attempts to approach the High Court directly, they are subject to heavy financial penalties.
3. The grievance redressal tribunal consists entirely of administrative officers appointed directly by the State, without judicial participation.
4. The Petitioner challenged the validity of these guidelines before the High Court on grounds of constitutional overreach and violation of the Basic Structure.
5. The High Court summarily dismissed the writ petition, holding that the guidelines represent mere regulatory filters. The Petitioner now approaches this Hon'ble Court under Article 136.

------------------------------------------------------------------------
V. ISSUES RAISED
------------------------------------------------------------------------
ISSUE 1: Whether the present Special Leave Petition is maintainable under Article 136 of the Constitution of India, 1950, in light of alternative forums.
ISSUE 2: Whether the state-mandated administrative guidelines infringe upon the Basic Structure Doctrine by restricting the power of judicial review under Article 226.

------------------------------------------------------------------------
VI. SUMMARY OF ARGUMENTS
------------------------------------------------------------------------
1. ON MAINTAINABILITY: It is submitted that the existence of an alternative administrative forum does not operate as an absolute bar to this Court's jurisdiction under Article 136. In Whirlpool Corporation, this Court established that alternative remedies do not bar writs where fundamental rights are violated, natural justice is breached, or the constitutional validity of a rule is challenged. Forcing submission to a biased, executive-controlled body represents a manifest miscarriage of justice.
2. ON BASIC STRUCTURE: It is pleaded that the power of judicial review vested in High Courts under Article 226 is a basic feature of the Constitution that cannot be abrogated or qualified by administrative guidelines. By penalizing direct filing, the executive usurps judicial power, bypassing separation of powers and dismantling the rule of law.

------------------------------------------------------------------------
VII. ARGUMENTS ADVANCED
------------------------------------------------------------------------
1. THE PETITION IS MAINTAINABLE UNDER ARTICLE 136 DESPITE ALTERNATIVE REMEDIES
1.1. It is settled law that alternative remedies are rules of discretion and convenience, not of jurisdiction. As held in Whirlpool Corporation v. Registrar of Trade Marks, the existence of an alternate forum does not bar constitutional writs where the challenge is to the constitutionality of a rule.
1.2. The administrative tribunal lacks judicial independence, violating natural justice. Therefore, forcing litigants to exhaust such remedy is unconstitutional.

2. THE ADMINISTRATIVE DIRECTIVES INFINGE UPON THE BASIC STRUCTURE
2.1. In L. Chandra Kumar v. Union of India, a 7-judge bench held that judicial review under Article 226 is an essential part of the Basic Structure.
2.2. By penalizing direct filing, the executive usurps judicial power, disrupting checks and balances.

------------------------------------------------------------------------
VIII. PRAYER
------------------------------------------------------------------------
Wherefore, in light of the facts stated, arguments advanced, and authorities cited, it is most humbly prayed that this Hon'ble Court may be pleased to:
- Set aside the impugned High Court judgment.
- Strike down the administrative guidelines as null and void.
- Restore unrestricted access to the High Court under Article 226.
And pass any other order that this Court deems fit in interest of equity and justice.`

const RESPONDENT_MEMORIAL = `IN THE SUPREME COURT OF INDIA
(APPELLATE JURISDICTION)
S.L.P. (CIVIL) NO. 1024 OF 2026

IN THE MATTER OF:
ANAY SHARMA & ORS.                                  ... PETITIONER

VERSUS

UNION OF INDIA                                      ... RESPONDENT

========================================================================
                 MEMORIAL ON BEHALF OF THE RESPONDENT
========================================================================

------------------------------------------------------------------------
I. TABLE OF CONTENTS
------------------------------------------------------------------------
1. LIST OF ABBREVIATIONS ........................................... 03
2. INDEX OF AUTHORITIES ............................................ 04
3. STATEMENT OF JURISDICTION ....................................... 05
4. STATEMENT OF FACTS .............................................. 06
5. ISSUES RAISED ................................................... 07
6. SUMMARY OF ARGUMENTS ............................................ 08
7. ARGUMENTS ADVANCED .............................................. 09
   7.1. THE SPECIAL LEAVE PETITION IS NOT MAINTAINABLE IN LIGHT OF
        UNEXHAUSTED EFFICACIOUS ALTERNATIVE REMEDIES ............... 09
   7.2. THE ADMINISTRATIVE DIRECTIVES DO NOT VIOLATE THE BASIC
        STRUCTURE AND REPRESENT REASONABLE REGULATORY FILTERS ...... 11
8. PRAYER .......................................................... 13

------------------------------------------------------------------------
II. INDEX OF AUTHORITIES
------------------------------------------------------------------------
A. CASES CITED:
1. Mafatlal Industries Ltd. v. Union of India, (1997) 5 SCC 536
2. Cicily Kallarackal v. Immanuel Management, (2012) 8 SCC 524
3. A.K. Gopalan v. State of Madras, AIR 1950 SC 27
4. United Bank of India v. Satyawati Tondon, (2010) 8 SCC 110
5. State of Alabama v. Union of India mock corollary

B. STATUTES & CONSTITUTIONAL PROVISIONS:
1. The Constitution of India, 1950 - Articles 14, 136, 226, 368
2. The National Green Tribunal Act, 2010

D. REPORTS & JOURNALS:
1. M.P. Jain, Indian Constitutional Law (8th Ed., 2018)
2. Arvind P. Datar, Commentary on the Constitution of India (3rd Ed., 2017)

------------------------------------------------------------------------
III. STATEMENT OF JURISDICTION
------------------------------------------------------------------------
The Respondent submits that this Hon'ble Court should decline to exercise its discretionary jurisdiction under Article 136 of the Constitution of India. It is submitted that the Petitioner has bypassed efficacious statutory administrative remedies, rendering this SLP premature and not maintainable.

------------------------------------------------------------------------
IV. STATEMENT OF FACTS
------------------------------------------------------------------------
1. The Respondent promulgated administrative guidelines to establish a specialized grievance tribunal for dispute resolution, aim to reduce pendency of cases.
2. The directives require litigants to attempt conciliation for 45 days. The right to judicial review is not abolished but deferred to ensure administrative efficiency.
3. The Petitioner bypasses the tribunal, challenging the directives. The High Court rejected their plea.

------------------------------------------------------------------------
V. ISSUES RAISED
------------------------------------------------------------------------
ISSUE 1: Whether this Special Leave Petition is maintainable under Article 136 given the failure to exhaust alternative remedies.
ISSUE 2: Whether the administrative guidelines are constitutionally valid regulatory filters that do not infringe on the power of judicial review.

------------------------------------------------------------------------
VI. SUMMARY OF ARGUMENTS
------------------------------------------------------------------------
1. ON MAINTAINABILITY: The petition should be dismissed. It is a well-established principle that when a statutory alternative remedy exists, constitutional courts should not bypass it (ref: Cicily Kallarackal).
2. ON CONSTITUTIONAL VALIDITY: The directives do not destroy the power of judicial review. High Courts retain final supervisory jurisdiction. The 45-day wait is a reasonable regulatory filter, not an abrogation.

------------------------------------------------------------------------
VII. ARGUMENTS ADVANCED
------------------------------------------------------------------------
1. THE PETITION IS NOT MAINTAINABLE AS ALTERNATIVE REMEDIES REMAIN UNEXHAUSTED
1.1. In Satyawati Tondon, this Court held that bypassed statutory remedies should be entertained only in extreme exceptional cases.
1.2. The Petitioner has shown no prejudice in exhausting the 45-day conciliation step.

2. THE ADMINISTRATIVE DIRECTIVES DO NOT VIOLATE THE BASIC STRUCTURE
2.1. Regulation is not abrogation. The final judicial authority remains with the High Court under Article 226.
2.2. Reasonable filters designed to prevent docket congestion are within the State's administrative competence under Entry 11A of List III.

------------------------------------------------------------------------
VIII. PRAYER
------------------------------------------------------------------------
Wherefore, in light of the facts stated, arguments advanced, and authorities cited, it is most humbly prayed that this Hon'ble Court may be pleased to:
- Dismiss the present Special Leave Petition as not maintainable.
- Declare the administrative guidelines constitutionally valid.
And pass any other order that this Court deems fit in interest of equity and justice.`

const ORAL_ARGUMENTS = `========================================================================
                     PETITIONER ORAL ARGUMENT OUTLINE
========================================================================

"May it please your Lordships. My name is Counsel for the Petitioner. We challenge the High Court judgment which validated the administrative guidelines restricting Article 226 access.

We submit that access to constitutional courts is a fundamental right. The state directives mandate an administrative filter that penalizes direct filing. This violates separation of powers and the Basic Structure because judicial review under Article 226 is an essential part of the basic structure as held in L. Chandra Kumar. Bypassing it by penalty is a direct abrogation."


========================================================================
                     RESPONDENT ORAL ARGUMENT OUTLINE
========================================================================

"May it please your Lordships. My name is Counsel for the Respondent. We submit that the guidelines represent mere regulatory filters. High Courts retain final supervisory jurisdiction.

There is no abrogation of the basic structure. The 45-day wait is designed to prevent docket congestion and ensure administrative efficiency. Article 226 is discretionary. The State has the power to define procedural guidelines for public interest."`

const REBUTTALS = `========================================================================
                      PETITIONER REBUTTAL ARGUMENTS
========================================================================

1. ON REGULATION VS PROHIBITION:
   The Respondent claims this is a regulatory filter, but penalizing litigants for directly approaching the court makes it a prohibition. The tribunal lacks judicial members, violating natural justice.

2. ON TRIAL INDEPENDENCE:
   The administrative officers serving on the tribunal are employees of the executive state, meaning the state is both a party and the judge. This violates the principle of 'nemo judex in causa sua'.


========================================================================
                     RESPONDENT SUR-REBUTTAL ARGUMENTS
========================================================================

1. ON TRIBUNAL INDEPENDENCE:
   The tribunal is chaired by a retired judge, ensuring independence. The 45-day delay is minimal and the penalty only applies to bad-faith bypassing.

2. ON PREJUDICE:
   The Petitioner has shown no specific prejudice in exhausting the 45-day conciliation step. A short delay to attempt settlement does not destroy the constitutional remedy.`

const JUDGE_QUESTIONS = `========================================================================
                     SIMULATED BENCH QUESTIONS
========================================================================

1. QUESTION: "Counsel, if alternative forums are biased, why not challenge the selection process instead of the whole guideline?"
   - ANSWER: "My Lords, we challenge the guideline because it completely shuts the doors of the High Court. A selection challenge would not cure the mandatory penalty clause."

2. QUESTION: "If access is delayed by 45 days, is that really an abrogation of basic structure?"
   - ANSWER: "Yes, My Lords. Delays under threat of financial penalties act as a de facto bar, violating Article 14 and Article 226."

3. QUESTION: "Can the legislature not regulate the exercise of writ jurisdiction to control docket choking?"
   - ANSWER: "The High Court can regulate its own procedure, but the Executive cannot mandate filters under threat of penalty that strip the Court of its inherent discretion."`

export default function MemorialArchitect() {
  const { setActiveSubTab, setSelectedSimilarityQuery } = useMootSuite()

  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  
  // Stepper State
  const [currentStep, setCurrentStep] = useState(0)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulatedLogs, setSimulatedLogs] = useState<string[]>([])
  
  // Output View State
  const [activeOutputTab, setActiveOutputTab] = useState<'petitioner' | 'respondent' | 'oral' | 'rebuttals' | 'judge_qs'>('petitioner')
  const [generationComplete, setGenerationComplete] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const triggerSimilaritySearch = (precedentName: string) => {
    setSelectedSimilarityQuery(precedentName)
    setActiveSubTab('JudgmentSimilarity')
  }

  // Handle Moot Proposition Upload and Automatically Start Stepper
  const handleMootPropositionUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadedFileName(file.name)
    setIsUploading(true)
    setGenerationComplete(false)
    setCurrentStep(0)
    setSimulatedLogs([])

    // Simulate upload delay
    setTimeout(() => {
      setIsUploading(false)
      startWorkflowSimulation()
    }, 1200)
  }

  // Simulate Step 1 to Step 10
  const startWorkflowSimulation = () => {
    setIsSimulating(true)
    let stepIndex = 0

    const interval = setInterval(() => {
      if (stepIndex < WORKFLOW_STEPS.length) {
        const step = WORKFLOW_STEPS[stepIndex]
        setCurrentStep(step.step)
        setSimulatedLogs(prev => [
          ...prev,
          `[STEP ${step.step}] ${step.label} complete: ${step.desc}`
        ])
        stepIndex++
      } else {
        clearInterval(interval)
        setIsSimulating(false)
        setGenerationComplete(true)
      }
    }, 800)
  }

  // jsPDF Generation helpers
  const downloadPDF = (partyType: 'Petitioner' | 'Respondent') => {
    const doc = new jsPDF()
    const content = partyType === 'Petitioner' ? PETITIONER_MEMORIAL : RESPONDENT_MEMORIAL
    const lines = doc.splitTextToSize(content, 180)
    
    doc.setFont("times", "normal")
    doc.setFontSize(10)
    
    let y = 15
    lines.forEach((line: string) => {
      if (y > 280) {
        doc.addPage()
        y = 15
      }
      doc.text(line, 15, y)
      y += 6
    })
    
    doc.save(`Memorial_Behalf_of_the_${partyType}.pdf`)
  }

  const downloadCombinedBookletPDF = () => {
    const doc = new jsPDF()
    
    // Cover booklet Title
    doc.setFont("times", "bold")
    doc.setFontSize(18)
    doc.text("COMBINED MOOT COURT BOOKLET", 105, 80, { align: "center" })
    doc.setFontSize(12)
    doc.text("CONSOLIDATED PETITIONER & RESPONDENT MEMORIALS", 105, 95, { align: "center" })
    doc.text(`PROPOSITION: ${uploadedFileName || 'ANAY SHARMA v. UNION OF INDIA'}`, 105, 110, { align: "center" })
    doc.setFontSize(10)
    doc.text("Generated by LEGATRIXON Memorial Architect AI™", 105, 260, { align: "center" })
    
    doc.addPage()
    
    // Petitioner Memorial
    doc.setFont("times", "bold")
    doc.setFontSize(14)
    doc.text("PART I: MEMORIAL ON BEHALF OF THE PETITIONER", 15, 20)
    doc.setFontSize(9)
    doc.setFont("times", "normal")
    let lines = doc.splitTextToSize(PETITIONER_MEMORIAL, 180)
    let y = 30
    lines.forEach((line: string) => {
      if (y > 280) {
        doc.addPage()
        y = 15
      }
      doc.text(line, 15, y)
      y += 6
    })
    
    doc.addPage()
    
    // Respondent Memorial
    doc.setFont("times", "bold")
    doc.setFontSize(14)
    doc.text("PART II: MEMORIAL ON BEHALF OF THE RESPONDENT", 15, 20)
    doc.setFontSize(9)
    doc.setFont("times", "normal")
    lines = doc.splitTextToSize(RESPONDENT_MEMORIAL, 180)
    y = 30
    lines.forEach((line: string) => {
      if (y > 280) {
        doc.addPage()
        y = 15
      }
      doc.text(line, 15, y)
      y += 6
    })
    
    doc.save("Combined_Moot_Court_Booklet.pdf")
  }

  // DOCX Generation helpers
  const downloadDOCX = (partyType: 'Petitioner' | 'Respondent') => {
    const content = partyType === 'Petitioner' ? PETITIONER_MEMORIAL : RESPONDENT_MEMORIAL
    const paragraphs = content.split('\n').map(line => {
      return new Paragraph({
        children: [
          new TextRun({
            text: line,
            font: "Times New Roman",
            size: 24 // 12pt
          })
        ]
      })
    })
    
    const docObj = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: `MEMORIAL ON BEHALF OF THE ${partyType.toUpperCase()}`,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER
          }),
          ...paragraphs
        ]
      }]
    })
    
    Packer.toBlob(docObj).then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Memorial_Behalf_of_the_${partyType}.docx`
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const downloadCombinedBookletDOCX = () => {
    const petParagraphs = PETITIONER_MEMORIAL.split('\n').map(line => {
      return new Paragraph({
        children: [
          new TextRun({
            text: line,
            font: "Times New Roman",
            size: 24
          })
        ]
      })
    })
    
    const respParagraphs = RESPONDENT_MEMORIAL.split('\n').map(line => {
      return new Paragraph({
        children: [
          new TextRun({
            text: line,
            font: "Times New Roman",
            size: 24
          })
        ]
      })
    })
    
    const docObj = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "COMBINED MOOT COURT BOOKLET",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER
          }),
          new Paragraph({
            text: "PART I: MEMORIAL ON BEHALF OF THE PETITIONER",
            heading: HeadingLevel.HEADING_2
          }),
          ...petParagraphs,
          new Paragraph({
            text: "PART II: MEMORIAL ON BEHALF OF THE RESPONDENT",
            heading: HeadingLevel.HEADING_2
          }),
          ...respParagraphs
        ]
      }]
    })
    
    Packer.toBlob(docObj).then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "Combined_Moot_Court_Booklet.docx"
      a.click()
      URL.revokeObjectURL(url)
    })
  }

  const downloadPPTX = (partyType: 'Petitioner' | 'Respondent') => {
    const pptx = new pptxgen()
    pptx.layout = 'LAYOUT_16x9'

    // Slide 1: Cover Page
    const slide1 = pptx.addSlide()
    slide1.background = { color: partyType === 'Petitioner' ? '1b2838' : '3b1818' }
    slide1.addText('LEGATRIXON™ MOOT COURT SUITE', { x: 1.0, y: 1.5, w: 8.0, h: 0.8, fontSize: 32, bold: true, color: 'c5a880', fontFace: 'Georgia' })
    slide1.addText(`MEMORIAL BEHALF OF THE ${partyType.toUpperCase()}`, { x: 1.0, y: 2.5, w: 8.0, h: 0.6, fontSize: 22, bold: true, color: 'ffffff', fontFace: 'Georgia' })
    slide1.addText(`Case: ${uploadedFileName || 'ANAY SHARMA v. UNION OF INDIA'}\nGenerated via Memorial Architect AI™`, { x: 1.0, y: 3.8, w: 8.0, h: 1.2, fontSize: 14, color: 'cccccc', fontFace: 'Arial' })

    // Slide 2: Table of Contents & Index
    const slide2 = pptx.addSlide()
    slide2.addText(`${partyType.toUpperCase()} MEMORIAL - TABLE OF CONTENTS`, { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: '1b2838', fontFace: 'Georgia' })
    const tocText = "1. INDEX OF AUTHORITIES\n2. STATEMENT OF JURISDICTION\n3. STATEMENT OF FACTS\n4. ISSUES RAISED\n5. SUMMARY OF ARGUMENTS\n6. ARGUMENTS ADVANCED"
    slide2.addText(tocText, { x: 0.5, y: 1.5, w: 9.0, h: 4.5, fontSize: 16, color: '333333', lineSpacing: 24 })

    // Slide 3: Statement of Jurisdiction & Facts
    const slide3 = pptx.addSlide()
    slide3.addText('STATEMENT OF JURISDICTION & FACTS', { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: '1b2838', fontFace: 'Georgia' })
    const jurisdictionAndFacts = partyType === 'Petitioner'
      ? "JURISDICTION: Under Article 136 of the Constitution of India, 1950 (plenary Special Leave jurisdiction).\n\nKEY FACTS:\n• Petitioner Anay Sharma challenged state administrative guidelines regulating writ access.\n• Guidelines enforce pre-filing conciliation under threat of financial penalties.\n• Litigants must exhaust executive-run tribunals with zero judicial participation."
      : "JURISDICTION: Under Article 136 of the Constitution of India, 1950. Alternate statutory redressal remains unexhausted.\n\nKEY FACTS:\n• Respondent established conciliation guidelines to control court docket congestion.\n• The 45-day conciliation period represents a reasonable, supervisory filter.\n• Writ access is preserved; final supervisory review by High Courts remains intact."
    slide3.addText(jurisdictionAndFacts, { x: 0.5, y: 1.3, w: 9.0, h: 4.7, fontSize: 14, color: '333333', lineSpacing: 20 })

    // Slide 4: Issues Raised
    const slide4 = pptx.addSlide()
    slide4.addText('ISSUES FOR DEMURRER & PLEAS', { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: '1b2838', fontFace: 'Georgia' })
    const issuesText = "ISSUE 1:\nWhether the Special Leave Petition is maintainable under Article 136 of the Constitution of India, 1950.\n\nISSUE 2:\nWhether the administrative guidelines infringe upon the Basic Structure Doctrine by restricting judicial review."
    slide4.addText(issuesText, { x: 0.5, y: 1.5, w: 9.0, h: 4.5, fontSize: 16, color: '333333', lineSpacing: 24 })

    // Slide 5: Summary of Arguments
    const slide5 = pptx.addSlide()
    slide5.addText('SUMMARY OF ARGUMENTS', { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: '1b2838', fontFace: 'Georgia' })
    const summaryArgsText = partyType === 'Petitioner'
      ? "1. ON MAINTAINABILITY: Discretionary leave is maintainable when alternative remedies breach natural justice (Whirlpool Corp). Bypassing is permitted to prevent a miscarriage of justice.\n\n2. ON CONSTITUTIONAL VALIDITY: Access to courts is basic structure. Imposing financial penalties for direct filing is an unconstitutional executive barrier."
      : "1. ON MAINTAINABILITY: Bypassing statutory alternative remedies is barred (Satyawati Tondon). Discretionary power under Article 136 should not be exercised.\n\n2. ON CONSTITUTIONAL VALIDITY: Reasonable regulation is not abrogation. A 45-day conciliation period does not violate basic structure."
    slide5.addText(summaryArgsText, { x: 0.5, y: 1.5, w: 9.0, h: 4.5, fontSize: 14, color: '333333', lineSpacing: 20 })

    // Slide 6: Prayer
    const slide6 = pptx.addSlide()
    slide6.addText('PRAYER FOR RELIEF', { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: '1b2838', fontFace: 'Georgia' })
    const prayerText = partyType === 'Petitioner'
      ? "Wherefore, it is most humbly prayed that this Hon'ble Court may be pleased to:\n\n• Set aside the impugned High Court judgment.\n• Strike down the administrative guidelines as null and void.\n• Restore unrestricted access to the High Court under Article 226."
      : "Wherefore, it is most humbly prayed that this Hon'ble Court may be pleased to:\n\n• Dismiss the present Special Leave Petition as not maintainable.\n• Declare the administrative guidelines constitutionally valid."
    slide6.addText(prayerText, { x: 0.5, y: 1.5, w: 9.0, h: 4.5, fontSize: 16, color: '333333', lineSpacing: 24 })

    pptx.writeFile({ fileName: `Memorial_Behalf_of_the_${partyType}.pptx` })
  }

  const downloadCombinedBookletPPTX = () => {
    const pptx = new pptxgen()
    pptx.layout = 'LAYOUT_16x9'

    // Slide 1: Cover
    const slide1 = pptx.addSlide()
    slide1.background = { color: '1b2838' }
    slide1.addText('COMBINED MOOT COURT BOOKLET', { x: 1.0, y: 1.8, w: 8.0, h: 0.8, fontSize: 30, bold: true, color: 'c5a880', fontFace: 'Georgia' })
    slide1.addText('PETITIONER & RESPONDENT BRIEF OUTLINES', { x: 1.0, y: 2.7, w: 8.0, h: 0.5, fontSize: 18, color: 'ffffff', fontFace: 'Georgia' })
    slide1.addText(`Proposition: ${uploadedFileName || 'ANAY SHARMA v. UNION OF INDIA'}\nGenerated by LEGATRIXON Memorial Architect™`, { x: 1.0, y: 3.8, w: 8.0, h: 1.2, fontSize: 13, color: 'cccccc' })

    // Slide 2: Petitioner Overview
    const slide2 = pptx.addSlide()
    slide2.addText('PART I: PETITIONER MEMORIAL SUMMARY', { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: '2563eb', fontFace: 'Georgia' })
    slide2.addText("ARGUMENTS ADVANCED:\n\n• Maintainability: Alternative remedy is executive-controlled and biased, violating natural justice. SLP is fully maintainable.\n• Basic Structure: Restricting writ access through financial penalties destroys separation of powers and judicial review.", { x: 0.5, y: 1.5, w: 9.0, h: 4.5, fontSize: 15, color: '333333', lineSpacing: 20 })

    // Slide 3: Respondent Overview
    const slide3 = pptx.addSlide()
    slide3.addText('PART II: RESPONDENT MEMORIAL SUMMARY', { x: 0.5, y: 0.5, w: 9.0, h: 0.6, fontSize: 20, bold: true, color: 'dc2626', fontFace: 'Georgia' })
    slide3.addText("ARGUMENTS ADVANCED:\n\n• Maintainability: Petitioner bypassed efficacious alternative forums. SLP must be dismissed.\n• Constitutional Validity: A 45-day wait conciliation step is a reasonable filter to control docket congestion and is constitutionally valid.", { x: 0.5, y: 1.5, w: 9.0, h: 4.5, fontSize: 15, color: '333333', lineSpacing: 20 })

    pptx.writeFile({ fileName: 'Combined_Moot_Court_Booklet.pptx' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'reveal-up 350ms ease-out both' }}>
      
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
        <div className="glass-card" style={{ padding: '20px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--gold)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Upload size={16} /> Upload Moot Proposition compromis
            </h4>
            {uploadedFileName && (
              <span style={{ fontSize: '0.74rem', background: 'rgba(46, 204, 113, 0.12)', color: '#2ecc71', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(46, 204, 113, 0.2)', fontWeight: '700' }}>
                ✓ {uploadedFileName}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
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
            
            <p style={{ fontSize: '0.78rem', color: 'var(--text-soft)', margin: 0 }}>
              * Only this module accepts Moot Propositions. Ingesting will automatically trigger the 10-step Memorial Architect AI workflow.
            </p>
          </div>

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
        {generationComplete && (
          <div className="glass-card reveal-up" style={{ padding: '20px', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Export Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--gold)', margin: 0 }}>
                  Appellate Memorials Workspace
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-soft)', margin: '2px 0 0 0' }}>
                  Select a document tab to inspect or export competition deliverables.
                </p>
              </div>

              {/* Exports dropdown/buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => downloadPDF('Petitioner')}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 10px', borderColor: '#2563eb', color: '#5ca2ff', cursor: 'pointer' }}
                >
                  <Download size={12} /> Petitioner PDF
                </button>
                <button
                  type="button"
                  onClick={() => downloadDOCX('Petitioner')}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 10px', borderColor: '#2563eb', color: '#5ca2ff', cursor: 'pointer' }}
                >
                  <FileDown size={12} /> Petitioner DOCX
                </button>
                <button
                  type="button"
                  onClick={() => downloadPPTX('Petitioner')}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 10px', borderColor: '#2563eb', color: '#5ca2ff', cursor: 'pointer' }}
                >
                  <FileDown size={12} /> Petitioner PPTX
                </button>
                <button
                  type="button"
                  onClick={() => downloadPDF('Respondent')}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 10px', borderColor: '#dc2626', color: '#ff7676', cursor: 'pointer' }}
                >
                  <Download size={12} /> Respondent PDF
                </button>
                <button
                  type="button"
                  onClick={() => downloadDOCX('Respondent')}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 10px', borderColor: '#dc2626', color: '#ff7676', cursor: 'pointer' }}
                >
                  <FileDown size={12} /> Respondent DOCX
                </button>
                <button
                  type="button"
                  onClick={() => downloadPPTX('Respondent')}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 10px', borderColor: '#dc2626', color: '#ff7676', cursor: 'pointer' }}
                >
                  <FileDown size={12} /> Respondent PPTX
                </button>
                <button
                  type="button"
                  onClick={downloadCombinedBookletPDF}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 12px', borderColor: 'var(--gold)', color: 'var(--gold)', cursor: 'pointer', fontWeight: '700' }}
                >
                  <Sparkles size={12} /> Combined Booklet (PDF)
                </button>
                <button
                  type="button"
                  onClick={downloadCombinedBookletDOCX}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 12px', borderColor: 'var(--gold)', color: 'var(--gold)', cursor: 'pointer', fontWeight: '700' }}
                >
                  <Sparkles size={12} /> Combined Booklet (DOCX)
                </button>
                <button
                  type="button"
                  onClick={downloadCombinedBookletPPTX}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', padding: '6px 12px', borderColor: 'var(--gold)', color: 'var(--gold)', cursor: 'pointer', fontWeight: '700' }}
                >
                  <Sparkles size={12} /> Combined Booklet (PPTX)
                </button>
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
                maxHeight: '500px',
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
                {activeOutputTab === 'petitioner' && PETITIONER_MEMORIAL}
                {activeOutputTab === 'respondent' && RESPONDENT_MEMORIAL}
                {activeOutputTab === 'oral' && ORAL_ARGUMENTS}
                {activeOutputTab === 'rebuttals' && REBUTTALS}
                {activeOutputTab === 'judge_qs' && JUDGE_QUESTIONS}
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
                      onClick={() => triggerSimilaritySearch('Kesavananda Bharati v. State of Kerala (1973)')}
                      className="btn btn-outline"
                      style={{ fontSize: '0.72rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                      <Scale size={11} /> Inspect: Kesavananda Bharati
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerSimilaritySearch('Minerva Mills v. Union of India (1980)')}
                      className="btn btn-outline"
                      style={{ fontSize: '0.72rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                      <Scale size={11} /> Inspect: Minerva Mills
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
