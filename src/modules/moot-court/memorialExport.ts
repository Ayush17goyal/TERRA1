import { jsPDF } from 'jspdf'
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  FootnoteReferenceRun,
  HeadingLevel,
  NumberFormat,
  PageBreak,
  PageNumber,
  PageOrientation,
  Paragraph,
  Packer,
  SectionType,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { PDFDocument } from 'pdf-lib'

export interface MemorialRenderModel {
  metadata: {
    competitionName: string
    court: string
    jurisdictionLine: string
    caseNumber: string
    petitionerName: string
    respondentName: string
    petitionerLabel: string
    respondentLabel: string
    teamCode: string
    side: 'petitioner' | 'respondent'
    coverColor: string
  }
  abbreviations: Array<{ abbreviation: string; fullForm: string }>
  authorityGroups: Array<{ title: string; entries: Array<{ citation: string; pinpoint?: string }> }>
  jurisdictionParagraphs: string[]
  factParagraphs: string[]
  issues: Array<{ id: string; label: string; text: string; subIssues: string[] }>
  summaries: Array<{ issueId: string; heading: string; paragraphs: string[] }>
  arguments: Array<{
    issueId: string
    heading: string
    thesis: string
    roadmap: string
    subArguments: Array<{ label: string; heading: string; paragraphs: string[]; authorityIds: string[] }>
    concludingParagraphs: string[]
  }>
  authorities: Array<{ id: string; citation: string; pinpoint?: string }>
  prayerParagraphs: string[]
}

export interface MemorialSectionSet {
  cover: string
  tableOfContents: string
  abbreviations: string
  indexOfAuthorities: string
  jurisdiction: string
  statementOfFacts: string
  issuesRaised: string
  summaryOfArguments: string
  argumentsAdvanced: string
  prayer: string
}

export interface MemorialExportData {
  model: MemorialRenderModel
  sections: MemorialSectionSet
}

const A4 = { width: 11906, height: 16838 }
const PAGE_MARGIN = 1440 // 1 inch in twips
const BODY_SIZE = 24 // 12 pt in half-points
const FOOTNOTE_SIZE = 20 // 10 pt

const clean = (value?: string) => String(value || '').replace(/\s+/g, ' ').trim()

const roman = (value: number) => {
  const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
  const symbols = ['m', 'cm', 'd', 'cd', 'c', 'xc', 'l', 'xl', 'x', 'ix', 'v', 'iv', 'i']
  let output = ''
  let number = value
  values.forEach((candidate, index) => {
    while (number >= candidate) {
      output += symbols[index]
      number -= candidate
    }
  })
  return output || 'i'
}

const isArbitration = (model: MemorialRenderModel) => /arbitrat|ICSID|claimant|investment/i.test(
  `${model.metadata.court} ${model.metadata.jurisdictionLine} ${model.metadata.petitionerLabel}`,
)

const activeSideLabel = (model: MemorialRenderModel) => clean(
  model.metadata.side === 'petitioner'
    ? model.metadata.petitionerLabel || 'PETITIONER'
    : model.metadata.respondentLabel || 'RESPONDENT',
).toUpperCase()

const submissionTitle = (model: MemorialRenderModel) => {
  const label = activeSideLabel(model)
  if (isArbitration(model) && model.metadata.side === 'respondent') return `COUNTER-MEMORIAL ON BEHALF OF THE ${label}`
  return `MEMORIAL ON BEHALF OF THE ${label}`
}

const pageBorder = (color = '444444') => ({
  pageBorderTop: { style: BorderStyle.SINGLE, size: 6, color },
  pageBorderRight: { style: BorderStyle.SINGLE, size: 6, color },
  pageBorderBottom: { style: BorderStyle.SINGLE, size: 6, color },
  pageBorderLeft: { style: BorderStyle.SINGLE, size: 6, color },
})

const docxPage = (formatType?: (typeof NumberFormat)[keyof typeof NumberFormat], start?: number, color = '444444') => ({
  size: { width: A4.width, height: A4.height, orientation: PageOrientation.PORTRAIT },
  margin: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, footer: 720 },
  pageNumbers: formatType ? { formatType, start } : undefined,
  borders: pageBorder(color),
})

const bodyParagraph = (
  text: string,
  options: { bold?: boolean; italic?: boolean; centered?: boolean; size?: number; footnotes?: number[]; color?: string } = {},
) => new Paragraph({
  children: [
    new TextRun({
      text: clean(text),
      font: 'Times New Roman',
      size: options.size || BODY_SIZE,
      bold: options.bold,
      italics: options.italic,
      color: options.color,
    }),
    ...(options.footnotes || []).map((id) => new FootnoteReferenceRun(id)),
  ],
  alignment: options.centered ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
  spacing: { line: options.size === FOOTNOTE_SIZE ? 240 : 360, after: options.bold ? 160 : 100 },
})

const heading = (text: string, level = HeadingLevel.HEADING_1) => new Paragraph({
  text: clean(text).toUpperCase(),
  heading: level,
  alignment: AlignmentType.CENTER,
  spacing: { before: 120, after: 240 },
})

const pageBreak = () => new Paragraph({ children: [new PageBreak()] })

const numberedFooter = () => new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], font: 'Times New Roman', size: 20 })],
  })],
})

/**
 * Build a genuine OOXML .docx document.
 * Cover page is unnumbered; preliminary pages use lower Roman numerals;
 * Arguments Advanced onward starts again at Arabic 1.
 */
export function buildMemorialDocx(data: MemorialExportData): Document {
  const { model } = data
  const sideColor = model.metadata.side === 'petitioner' ? '1B3A6B' : 'A11D23'
  const label = activeSideLabel(model)
  const title = submissionTitle(model)
  const authorities = new Map(model.authorities.map((authority) => [authority.id, authority]))
  const footnotes: Record<string, { children: Paragraph[] }> = {}
  let footnoteId = 1

  const coverChildren = [
    bodyParagraph(`TEAM CODE: ${model.metadata.teamCode || '______'}`, { bold: true }),
    bodyParagraph(model.metadata.competitionName || 'MOOT COURT COMPETITION', { bold: true, centered: true, size: 28 }),
    bodyParagraph('BEFORE', { centered: true }),
    bodyParagraph(model.metadata.court, { bold: true, centered: true, size: 28 }),
    ...(model.metadata.caseNumber ? [bodyParagraph(model.metadata.caseNumber, { centered: true })] : []),
    bodyParagraph(model.metadata.jurisdictionLine, { bold: true, centered: true }),
    bodyParagraph('IN THE MATTER OF:', { bold: true, centered: true }),
    bodyParagraph(`${model.metadata.petitionerName} ... ${model.metadata.petitionerLabel}`, { bold: true, centered: true }),
    bodyParagraph('VERSUS', { bold: true, centered: true }),
    bodyParagraph(`${model.metadata.respondentName} ... ${model.metadata.respondentLabel}`, { bold: true, centered: true }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        children: [new TableCell({
          shading: { type: ShadingType.CLEAR, fill: sideColor, color: 'auto' },
          children: [bodyParagraph(title, { bold: true, centered: true, size: 28, color: 'FFFFFF' })],
        })],
      })],
    }),
    bodyParagraph(`COUNSEL APPEARING ON BEHALF OF THE ${label}`, { centered: true }),
  ]

  const preliminary: Array<Paragraph | TableOfContents | Table> = [
    bodyParagraph('TABLE OF CONTENTS', { bold: true, centered: true, size: 28 }),
    // Word/LibreOffice updates this field from the final headings/pages.
    new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-3' }),
    pageBreak(),
    heading('LIST OF ABBREVIATIONS'),
    ...model.abbreviations.map((row) => bodyParagraph(`${row.abbreviation}\t${row.fullForm}`)),
    pageBreak(),
    heading('INDEX OF AUTHORITIES'),
    ...model.authorityGroups.flatMap((group) => [
      heading(group.title, HeadingLevel.HEADING_2),
      ...group.entries.map((entry) => bodyParagraph(`${entry.citation}${entry.pinpoint ? `, ${entry.pinpoint}` : ''}`)),
    ]),
    pageBreak(),
    heading('STATEMENT OF JURISDICTION'),
    ...model.jurisdictionParagraphs.map((text) => bodyParagraph(text)),
    pageBreak(),
    heading('STATEMENT OF FACTS'),
    ...model.factParagraphs.map((text, index) => bodyParagraph(`${index + 1}. ${text}`)),
    pageBreak(),
    heading('ISSUES FOR CONSIDERATION'),
    ...model.issues.map((issue) => bodyParagraph(`${issue.label}: ${issue.text}`, { bold: true })),
    pageBreak(),
    heading('SUMMARY OF ARGUMENTS'),
    ...model.summaries.flatMap((summary) => [
      bodyParagraph(summary.heading, { bold: true }),
      ...summary.paragraphs.map((text) => bodyParagraph(text)),
    ]),
  ]

  const argumentsChildren: Paragraph[] = [heading('ARGUMENTS ADVANCED')]
  model.arguments.forEach((argument) => {
    argumentsChildren.push(
      bodyParagraph(argument.heading, { bold: true }),
      bodyParagraph(argument.thesis),
      bodyParagraph(argument.roadmap),
    )

    argument.subArguments.forEach((subArgument) => {
      const ids = subArgument.authorityIds
        .map((authorityId) => authorities.get(authorityId))
        .filter(Boolean)
        .map((authority) => {
          const id = footnoteId++
          footnotes[String(id)] = {
            children: [bodyParagraph(
              `${authority!.citation}${authority!.pinpoint ? `, ${authority!.pinpoint}` : ''}`,
              { size: FOOTNOTE_SIZE },
            )],
          }
          return id
        })

      argumentsChildren.push(bodyParagraph(`${subArgument.label} ${subArgument.heading}`, { bold: true }))
      subArgument.paragraphs.forEach((text, index) => {
        argumentsChildren.push(bodyParagraph(text, { footnotes: index === 0 ? ids : [] }))
      })
    })

    argument.concludingParagraphs.forEach((text) => argumentsChildren.push(bodyParagraph(text)))
  })

  argumentsChildren.push(
    pageBreak(),
    heading('PRAYER FOR RELIEF'),
    ...model.prayerParagraphs.map((text) => bodyParagraph(text)),
  )

  return new Document({
    title,
    creator: 'LEGATRIXON Memorial Architect',
    features: { updateFields: true },
    footnotes,
    styles: {
      default: {
        document: {
          run: { font: 'Times New Roman', size: BODY_SIZE },
          paragraph: { spacing: { line: 360 } },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: 'Times New Roman', size: 28, bold: true },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 240 } },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: 'Times New Roman', size: 24, bold: true },
          paragraph: { spacing: { before: 120, after: 120 } },
        },
      ],
    },
    sections: [
      { properties: { page: docxPage(undefined, undefined, sideColor) }, children: coverChildren },
      {
        properties: { type: SectionType.NEXT_PAGE, page: docxPage(NumberFormat.LOWER_ROMAN, 1) },
        footers: { default: numberedFooter() },
        children: preliminary,
      },
      {
        properties: { type: SectionType.NEXT_PAGE, page: docxPage(NumberFormat.DECIMAL, 1) },
        footers: { default: numberedFooter() },
        children: argumentsChildren,
      },
    ],
  })
}

export async function memorialDocxBlob(data: MemorialExportData): Promise<Blob> {
  return Packer.toBlob(buildMemorialDocx(data))
}

type PdfMode = 'preliminary' | 'substantive'

/**
 * Build a real A4 PDF using the same render model as DOCX.
 * The table of contents is filled only after all section page starts are known.
 */
export function buildMemorialPdf(data: MemorialExportData): jsPDF {
  const { model } = data
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const blue = [27, 58, 107] as const
  const red = [161, 29, 35] as const
  const sideColor = model.metadata.side === 'petitioner' ? blue : red
  const label = activeSideLabel(model)
  const title = submissionTitle(model)
  const authorityMap = new Map(model.authorities.map((authority) => [authority.id, authority]))

  // Cover: no visible page number.
  doc.setFillColor(...sideColor)
  doc.rect(0, 0, 210, 297, 'F')
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.6)
  doc.rect(10, 10, 190, 277)
  doc.setTextColor(255, 255, 255)
  doc.setFont('times', 'bold')
  doc.setFontSize(11)
  doc.text(`TEAM CODE: ${model.metadata.teamCode || '______'}`, 188, 20, { align: 'right' })

  const center = (text: string, yPos: number, size = 12, bold = false, width = 165) => {
    if (!clean(text)) return
    doc.setFont('times', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.text(doc.splitTextToSize(clean(text), width), 105, yPos, { align: 'center', lineHeightFactor: 1.25 })
  }

  center(model.metadata.competitionName || 'MOOT COURT COMPETITION', 45, 14, true)
  center('BEFORE', 61, 11)
  center(model.metadata.court, 70, 14, true)
  if (model.metadata.caseNumber) center(model.metadata.caseNumber, 83, 11)
  center(model.metadata.jurisdictionLine, 92, 11, true)
  center('IN THE MATTER OF:', 108, 12, true)
  center(`${model.metadata.petitionerName} ... ${model.metadata.petitionerLabel}`, 121, 12, true)
  center('VERSUS', 139, 11)
  center(`${model.metadata.respondentName} ... ${model.metadata.respondentLabel}`, 151, 12, true)

  doc.setFillColor(255, 255, 255)
  doc.rect(20, 194, 170, 18, 'F')
  doc.setTextColor(...sideColor)
  center(title, 205, 12.5, true)
  doc.setTextColor(255, 255, 255)
  center(`COUNSEL APPEARING ON BEHALF OF THE ${label}`, 272, 10, true)

  let preliminaryPage = 0
  let substantivePage = 0
  let mode: PdfMode = 'preliminary'
  let y = 25.4
  const pageLabels = new Map<number, string>()
  const starts = new Map<string, string>()
  const tocEntriesCount = 8 + model.arguments.reduce((sum, argument) => sum + 1 + argument.subArguments.length, 0)
  const tocPageCount = Math.max(1, Math.ceil(tocEntriesCount / 23))
  const tocPages: number[] = []

  const shell = (page: number, pageLabel: string) => {
    doc.setPage(page)
    doc.setDrawColor(70, 70, 70)
    doc.setLineWidth(0.25)
    doc.rect(12.7, 12.7, 184.6, 271.6)
    doc.setFont('times', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    doc.text(pageLabel, 105, 278, { align: 'center' })
    pageLabels.set(page, pageLabel)
  }

  const newPage = (nextMode: PdfMode = mode) => {
    mode = nextMode
    doc.addPage()
    const pageLabel = mode === 'preliminary' ? roman(++preliminaryPage) : String(++substantivePage)
    const page = doc.getNumberOfPages()
    shell(page, pageLabel)
    y = 25.4
    return { page, label: pageLabel }
  }

  const ensureSpace = (height: number) => {
    if (y + height > 264) newPage(mode)
  }

  const writeHeading = (text: string, size = 14, centered = true) => {
    const lines = doc.splitTextToSize(clean(text).toUpperCase(), 159.2)
    ensureSpace(lines.length * 7 + 6)
    doc.setFont('times', 'bold')
    doc.setFontSize(size)
    doc.setTextColor(0, 0, 0)
    doc.text(lines, centered ? 105 : 25.4, y, {
      align: centered ? 'center' : 'left',
      lineHeightFactor: 1.25,
    })
    y += lines.length * 6.5 + 5
  }

  const writeParagraph = (
    text: string,
    options: { bold?: boolean; size?: number; indent?: number; prefix?: string } = {},
  ) => {
    const value = `${options.prefix || ''}${clean(text)}`
    if (!value) return
    const size = options.size || 12
    const lineHeight = size <= 10 ? 4.6 : 6.1
    const x = 25.4 + (options.indent || 0)
    const width = 159.2 - (options.indent || 0)
    const lines = doc.splitTextToSize(value, width)
    let offset = 0

    while (offset < lines.length) {
      if (y > 260) newPage(mode)
      const availableLines = Math.max(1, Math.floor((264 - y) / lineHeight))
      const chunk = lines.slice(offset, offset + availableLines)
      doc.setFont('times', options.bold ? 'bold' : 'normal')
      doc.setFontSize(size)
      doc.setTextColor(0, 0, 0)
      doc.text(chunk, x, y, {
        align: options.bold ? 'left' : 'justify',
        maxWidth: width,
        lineHeightFactor: size <= 10 ? 1.05 : 1.35,
      })
      y += chunk.length * lineHeight
      offset += chunk.length
      if (offset < lines.length) newPage(mode)
    }
    y += options.bold ? 3 : 2
  }

  // Reserve TOC pages first. They are populated only after the whole document is laid out.
  for (let index = 0; index < tocPageCount; index += 1) tocPages.push(newPage('preliminary').page)

  const beginSection = (key: string, sectionTitle: string, nextMode: PdfMode = 'preliminary') => {
    const page = newPage(nextMode)
    starts.set(key, page.label)
    writeHeading(sectionTitle)
  }

  beginSection('abbreviations', 'LIST OF ABBREVIATIONS')
  model.abbreviations.forEach((row) => writeParagraph(`${row.abbreviation}    ${row.fullForm}`))

  beginSection('authorities', 'INDEX OF AUTHORITIES')
  model.authorityGroups.forEach((group) => {
    writeHeading(group.title, 12, false)
    group.entries.forEach((entry, index) => writeParagraph(`${index + 1}. ${entry.citation}${entry.pinpoint ? `, ${entry.pinpoint}` : ''}`))
  })

  beginSection('jurisdiction', 'STATEMENT OF JURISDICTION')
  model.jurisdictionParagraphs.forEach((text) => writeParagraph(text))

  beginSection('facts', 'STATEMENT OF FACTS')
  model.factParagraphs.forEach((text, index) => writeParagraph(`${index + 1}. ${text}`))

  beginSection('issues', 'ISSUES FOR CONSIDERATION')
  model.issues.forEach((issue) => writeParagraph(`${issue.label}: ${issue.text}`, { bold: true }))

  beginSection('summary', 'SUMMARY OF ARGUMENTS')
  model.summaries.forEach((summary) => {
    writeParagraph(summary.heading, { bold: true })
    summary.paragraphs.forEach((text) => writeParagraph(text))
  })

  beginSection('arguments', 'ARGUMENTS ADVANCED', 'substantive')
  let pdfFootnoteNumber = 1
  model.arguments.forEach((argument) => {
    starts.set(`issue:${argument.issueId}`, pageLabels.get(doc.getNumberOfPages()) || String(substantivePage))
    writeParagraph(argument.heading, { bold: true })
    writeParagraph(argument.thesis)
    writeParagraph(argument.roadmap)

    argument.subArguments.forEach((subArgument) => {
      starts.set(`sub:${subArgument.label}`, pageLabels.get(doc.getNumberOfPages()) || String(substantivePage))
      writeParagraph(`${subArgument.label} ${subArgument.heading}`, { bold: true })
      subArgument.paragraphs.forEach((text) => writeParagraph(text))

      // PDF citations are rendered as compact, numbered footnote-style notes directly
      // after the proposition they support so they are never dropped during export.
      subArgument.authorityIds
        .map((id) => authorityMap.get(id))
        .filter(Boolean)
        .forEach((authority) => {
          writeParagraph(
            `${pdfFootnoteNumber++}. ${authority!.citation}${authority!.pinpoint ? `, ${authority!.pinpoint}` : ''}`,
            { size: 10, indent: 5 },
          )
        })
    })

    argument.concludingParagraphs.forEach((text) => writeParagraph(text))
  })

  beginSection('prayer', 'PRAYER FOR RELIEF', 'substantive')
  model.prayerParagraphs.forEach((text) => writeParagraph(text))

  const tocEntries = [
    ['LIST OF ABBREVIATIONS', starts.get('abbreviations')],
    ['INDEX OF AUTHORITIES', starts.get('authorities')],
    ['STATEMENT OF JURISDICTION', starts.get('jurisdiction')],
    ['STATEMENT OF FACTS', starts.get('facts')],
    ['ISSUES FOR CONSIDERATION', starts.get('issues')],
    ['SUMMARY OF ARGUMENTS', starts.get('summary')],
    ['ARGUMENTS ADVANCED', starts.get('arguments')],
    ...model.arguments.flatMap((argument) => [
      [argument.heading, starts.get(`issue:${argument.issueId}`)],
      ...argument.subArguments.map((subArgument) => [
        `${subArgument.label} ${subArgument.heading}`,
        starts.get(`sub:${subArgument.label}`),
      ]),
    ]),
    ['PRAYER FOR RELIEF', starts.get('prayer')],
  ] as Array<[string, string | undefined]>

  tocPages.forEach((page, tocIndex) => {
    doc.setPage(page)
    y = 25.4
    writeHeading(tocIndex === 0 ? 'TABLE OF CONTENTS' : 'TABLE OF CONTENTS (CONTINUED)')
    tocEntries.slice(tocIndex * 23, (tocIndex + 1) * 23).forEach(([entryTitle, pageLabel]) => {
      const abbreviated = clean(entryTitle).slice(0, 88)
      writeParagraph(`${abbreviated} ${'.'.repeat(Math.max(3, 92 - abbreviated.length))} ${pageLabel || ''}`, { size: 10 })
    })
  })

  doc.setPage(doc.getNumberOfPages())
  return doc
}

export async function mergeMemorialPdfs(
  petitioner: MemorialExportData,
  respondent: MemorialExportData,
): Promise<Uint8Array> {
  const output = await PDFDocument.create()
  for (const data of [petitioner, respondent]) {
    const source = await PDFDocument.load(buildMemorialPdf(data).output('arraybuffer'))
    const pages = await output.copyPages(source, source.getPageIndices())
    pages.forEach((page) => output.addPage(page))
  }
  return output.save()
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
