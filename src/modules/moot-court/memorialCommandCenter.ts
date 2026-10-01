import type { MemorialExportData } from './memorialExport'

export type MemorialWorkspaceTab = 'analysis' | 'petitioner' | 'respondent' | 'comparison'

export type MemorialDocumentSelection = {
  side: 'Petitioner' | 'Respondent'
  data: MemorialExportData
}

type MemorialDocuments = {
  petitionerDocument?: MemorialExportData
  respondentDocument?: MemorialExportData
}

export function requestedMemorialSide(actionId: string): 'petitioner' | 'respondent' | 'both' | null {
  if (actionId === 'generate_petitioner') return 'petitioner'
  if (actionId === 'generate_respondent') return 'respondent'
  if (actionId === 'generate_both') return 'both'
  return null
}

export function selectMemorialDocuments(
  activeTab: MemorialWorkspaceTab,
  workspace?: MemorialDocuments | null,
): MemorialDocumentSelection[] {
  if (!workspace || activeTab === 'analysis') return []
  if (activeTab === 'petitioner') {
    return workspace.petitionerDocument
      ? [{ side: 'Petitioner', data: workspace.petitionerDocument }]
      : []
  }
  if (activeTab === 'respondent') {
    return workspace.respondentDocument
      ? [{ side: 'Respondent', data: workspace.respondentDocument }]
      : []
  }
  return [
    ...(workspace.petitionerDocument ? [{ side: 'Petitioner' as const, data: workspace.petitionerDocument }] : []),
    ...(workspace.respondentDocument ? [{ side: 'Respondent' as const, data: workspace.respondentDocument }] : []),
  ]
}

export function memorialCitationCsv(documents: MemorialDocumentSelection[]) {
  const rows = ['Side,Category,Citation,Pinpoint']
  documents.forEach(({ side, data }) => {
    data.model.authorityGroups.forEach((group) => {
      group.entries.forEach((entry) => {
        rows.push([side, group.title, entry.citation, entry.pinpoint || '']
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(','))
      })
    })
  })
  return rows.join('\n')
}
