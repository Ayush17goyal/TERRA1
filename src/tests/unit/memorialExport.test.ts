// @vitest-environment node
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import AdmZip from 'adm-zip'
import { Packer } from 'docx'
import { describe, expect, it } from 'vitest'
import { buildMemorialDocx, buildMemorialPdf, type MemorialExportData } from '../../modules/moot-court/memorialExport'

const fixture: MemorialExportData = {
  model: {
    metadata: {
      competitionName: 'National Moot Court Competition 2026',
      court: "THE HON'BLE SUPREME COURT OF INDIA",
      jurisdictionLine: 'UNDER ARTICLE 32 OF THE CONSTITUTION OF INDIA',
      caseNumber: 'WRIT PETITION (CIVIL) NO. 101 OF 2026',
      petitionerName: 'A. CITIZEN',
      respondentName: 'UNION OF INDIA',
      petitionerLabel: 'PETITIONER',
      respondentLabel: 'RESPONDENT',
      teamCode: 'TC-18',
      side: 'petitioner',
      coverColor: 'blue',
    },
    abbreviations: [{ abbreviation: 'SCC', fullForm: 'Supreme Court Cases' }],
    authorityGroups: [{ title: 'I. CASES', entries: [{ citation: 'Illustrative Verified Authority v. Union of India, (2020) 1 SCC 1' }] }],
    jurisdictionParagraphs: ['The Petitioner respectfully invokes the jurisdiction of this Honorable Court under Article 32.'],
    factParagraphs: ['The proposition records a challenge to a final administrative order.'],
    issues: [{ id: 'issue-1', label: 'ISSUE I', text: 'Whether the impugned order violates the Constitution?', subIssues: ['Whether due process was observed?'] }],
    summaries: [{ issueId: 'issue-1', heading: 'ISSUE I', paragraphs: ['The impugned order is unconstitutional for the reasons set out below.'] }],
    arguments: [{
      issueId: 'issue-1',
      heading: 'I. THE IMPUGNED ORDER IS UNCONSTITUTIONAL',
      thesis: 'The order violates the governing constitutional guarantee.',
      roadmap: 'The Petitioner establishes the rule, applies it to the proposition, and answers the Respondent.',
      subArguments: [{
        label: 'I.A',
        heading: 'THE GOVERNING RULE REQUIRES FAIR PROCEDURE',
        paragraphs: ['A binding authority requires a fair hearing before adverse State action.'],
        authorityIds: ['auth-1'],
      }],
      concludingParagraphs: ['The first issue should therefore be answered for the Petitioner.'],
    }],
    authorities: [{ id: 'auth-1', citation: 'Illustrative Verified Authority v. Union of India, (2020) 1 SCC 1' }],
    prayerParagraphs: ['WHEREFORE, the Petitioner respectfully prays that this Honorable Court may allow the petition.'],
  },
  sections: {
    cover: '', tableOfContents: '', abbreviations: '', indexOfAuthorities: '', jurisdiction: '', statementOfFacts: '', issuesRaised: '', summaryOfArguments: '', argumentsAdvanced: '', prayer: '',
  },
}

describe('memorial exports', () => {
  it('creates a non-empty, paginated A4 PDF with substantive memorial content', () => {
    const pdf = buildMemorialPdf(fixture)
    const bytes = new Uint8Array(pdf.output('arraybuffer'))
    expect(new TextDecoder('latin1').decode(bytes.slice(0, 8))).toContain('%PDF-')
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(10)
    expect(bytes.byteLength).toBeGreaterThan(8_000)
    mkdirSync(resolve('tmp/pdfs'), { recursive: true })
    writeFileSync(resolve('tmp/pdfs/memorial-export-validation.pdf'), bytes)
  })

  it('creates a valid DOCX package with page numbering, borders, TOC, and footnotes', async () => {
    const bytes = await Packer.toBuffer(buildMemorialDocx(fixture))
    const zip = new AdmZip(bytes)
    const documentXml = zip.readAsText('word/document.xml')
    const footnotesXml = zip.readAsText('word/footnotes.xml')
    expect(documentXml).toContain('MEMORIAL ON BEHALF OF THE PETITIONER')
    expect(documentXml).toContain('w:pgBorders')
    expect(documentXml).toContain('TOC')
    expect(documentXml).toContain('lowerRoman')
    expect(footnotesXml).toContain('Illustrative Verified Authority')
    expect(bytes.byteLength).toBeGreaterThan(8_000)
    mkdirSync(resolve('tmp/pdfs'), { recursive: true })
    writeFileSync(resolve('tmp/pdfs/memorial-export-validation.docx'), bytes)
  })
})
