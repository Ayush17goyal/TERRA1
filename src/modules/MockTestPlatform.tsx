import React from 'react'
import KnowledgeVaultEngine from './KnowledgeVaultEngine'

interface Props {
  apiToken: string
}

export default function MockTestPlatform({ apiToken }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <KnowledgeVaultEngine apiToken={apiToken} />
    </div>
  )
}
