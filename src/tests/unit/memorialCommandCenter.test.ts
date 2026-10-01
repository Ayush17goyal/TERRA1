import { describe, expect, it } from 'vitest'
import {
  memorialCitationCsv,
  requestedMemorialSide,
  selectMemorialDocuments,
} from '../../modules/moot-court/memorialCommandCenter'
import type { MemorialExportData } from '../../modules/moot-court/memorialExport'

const memorial = (side: 'petitioner' | 'respondent', citation: string): MemorialExportData => ({
  model: {
    metadata: {
      competitionName: 'Competition', court: 'Court', jurisdictionLine: 'Jurisdiction', caseNumber: '1',
      petitionerName: 'A', respondentName: 'B', petitionerLabel: 'Petitioner', respondentLabel: 'Respondent',
      teamCode: '03', side, coverColor: side === 'petitioner' ? 'blue' : 'red',
    },
    abbreviations: [],
    authorityGroups: [{ title: 'Cases', entries: [{ citation }] }],
    jurisdictionParagraphs: [], factParagraphs: [], issues: [], summaries: [], arguments: [],
    authorities: [], prayerParagraphs: [],
  },
  sections: {
    cover: '', tableOfContents: '', abbreviations: '', indexOfAuthorities: '', jurisdiction: '',
    statementOfFacts: '', issuesRaised: '', summaryOfArguments: '', argumentsAdvanced: '', prayer: '',
  },
})

describe('Memorial Command Center selection', () => {
  const petitionerDocument = memorial('petitioner', 'Petitioner Authority')
  const respondentDocument = memorial('respondent', 'Respondent Authority')
  const workspace = { petitionerDocument, respondentDocument }

  it('maps generation actions to the correct backend side', () => {
    expect(requestedMemorialSide('generate_petitioner')).toBe('petitioner')
    expect(requestedMemorialSide('generate_respondent')).toBe('respondent')
    expect(requestedMemorialSide('generate_both')).toBe('both')
    expect(requestedMemorialSide('issues_matrix')).toBeNull()
  })

  it('exports only the currently selected party and both documents in comparison', () => {
    expect(selectMemorialDocuments('petitioner', workspace)).toEqual([{ side: 'Petitioner', data: petitionerDocument }])
    expect(selectMemorialDocuments('respondent', workspace)).toEqual([{ side: 'Respondent', data: respondentDocument }])
    expect(selectMemorialDocuments('comparison', workspace)).toHaveLength(2)
    expect(selectMemorialDocuments('analysis', workspace)).toEqual([])
  })

  it('builds the citation sheet from the same selected memorial data', () => {
    const csv = memorialCitationCsv(selectMemorialDocuments('respondent', workspace))
    expect(csv).toContain('Respondent Authority')
    expect(csv).not.toContain('Petitioner Authority')
  })
})
