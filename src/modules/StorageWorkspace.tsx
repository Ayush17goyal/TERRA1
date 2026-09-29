import React, { useState } from 'react'
import {
  HardDrive,
  Upload,
  Search,
  FileText,
  FolderOpen,
  Trash2,
  Sparkles,
  BrainCircuit,
  CheckCircle2,
  AlertCircle,
  Database,
  ExternalLink,
  Layers,
  FileCode,
  ShieldCheck
} from 'lucide-react'

// Define the interface to match App.tsx LexDocument
interface LexDocument {
  id: string
  name: string
  type: string
  size: string
  uploadedAt: string
  status: string
  previewContent: string
  wordCount: number
  tags: string[]
  clausesCount: number
}

interface StorageWorkspaceProps {
  lexDocs: LexDocument[]
  selectedLexDocId: string | null
  setSelectedLexDocId: (id: string | null) => void
  setActiveTab: (tab: string) => void
  deleteLexDoc: (id: string, e: React.MouseEvent) => void
  handleDocumentIngestion: (file: File, documentType?: string) => void
  lexUploadingName: string | null
  lexUploadProgress: number | null
}

export default function StorageWorkspace({
  lexDocs,
  selectedLexDocId,
  setSelectedLexDocId,
  setActiveTab,
  deleteLexDoc,
  handleDocumentIngestion,
  lexUploadingName,
  lexUploadProgress
}: StorageWorkspaceProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [selectedUploadType, setSelectedUploadType] = useState<string>('Legal Document')

  // Parse file size strings (e.g. "2.4 MB", "420 KB", "45 KB") to MB
  const parseSizeToMB = (sizeStr: string): number => {
    try {
      const num = parseFloat(sizeStr)
      if (isNaN(num)) return 0
      if (sizeStr.toUpperCase().includes('KB')) {
        return num / 1024
      }
      if (sizeStr.toUpperCase().includes('GB')) {
        return num * 1024
      }
      return num // Default to MB
    } catch {
      return 0
    }
  }

  // Calculate storage usage details
  const totalUsedMB = lexDocs.reduce((acc, doc) => acc + parseSizeToMB(doc.size), 0)
  const storageLimitMB = 100 // Mock 100 MB limit for sandbox / free tier
  const usagePercentage = Math.min(100, Math.round((totalUsedMB / storageLimitMB) * 100))

  // Count file types
  const pdfCount = lexDocs.filter(d => d.type === 'pdf').length
  const docxCount = lexDocs.filter(d => d.type === 'docx').length
  const txtCount = lexDocs.filter(d => d.type === 'txt').length

  // Filter documents based on search query
  const filteredDocs = lexDocs.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleDocumentIngestion(e.dataTransfer.files[0], 'Legal Document')
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, customType?: string) => {
    if (e.target.files && e.target.files[0]) {
      handleDocumentIngestion(e.target.files[0], customType || selectedUploadType)
    }
  }

  // Get matching icon for file types
  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return <FileText size={20} style={{ color: '#ff7070' }} />
      case 'docx':
        return <FolderOpen size={20} style={{ color: '#5ca2ff' }} />
      case 'txt':
        return <FileCode size={20} style={{ color: 'var(--text-soft)' }} />
      default:
        return <Database size={20} style={{ color: 'var(--gold)' }} />
    }
  }

  // Central launcher to set active doc and navigate
  const launchDocument = (docId: string, tabName: string) => {
    setSelectedLexDocId(docId)
    setActiveTab(tabName)
  }

  return (
    <div className="reveal-up" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* HEADER SECTION */}
      <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HardDrive size={20} style={{ color: 'var(--gold)' }} />
            Study Library
          </h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)' }}>
            Persistent study library. Catalog, upload, and dispatch legal files into specific AI deconstruction pipelines.
          </p>
        </div>
        <span style={{ fontSize: '0.76rem', background: 'rgba(245, 193, 79, 0.08)', color: 'var(--gold)', border: '1px solid var(--line)', borderRadius: '6px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '700' }}>
          <ShieldCheck size={13} />
          AES-256 Encrypted
        </span>
      </div>

      {/* METERS & STATUS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px' }}>
        
        {/* Storage Meter Card */}
        <div style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '16px', background: 'var(--panel)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Database size={15} /> Storage Capacity
          </h4>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4px' }}>
            <div>
              <span style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text)' }}>
                {totalUsedMB.toFixed(2)} MB
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-soft)', marginLeft: '6px' }}>
                / {storageLimitMB} MB Used
              </span>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: usagePercentage > 85 ? '#ff7070' : 'var(--gold)' }}>
              {usagePercentage}%
            </span>
          </div>

          {/* Glowing Progress bar */}
          <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
            <div style={{
              width: `${usagePercentage}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #8f6412 0%, var(--gold) 100%)',
              borderRadius: '10px',
              boxShadow: '0 0 10px rgba(245, 193, 79, 0.5)',
              transition: 'width 0.4s ease'
            }} />
          </div>

          {/* Quick Stats Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)', display: 'block' }}>PDFs</span>
              <strong style={{ fontSize: '0.95rem', color: '#ff7070' }}>{pdfCount}</strong>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)', display: 'block' }}>Word Docs</span>
              <strong style={{ fontSize: '0.95rem', color: '#5ca2ff' }}>{docxCount}</strong>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)', display: 'block' }}>Text Files</span>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-soft)' }}>{txtCount}</strong>
            </div>
          </div>
        </div>

        {/* Study Library Upload Console */}
        <div style={{ border: '1px solid var(--line)', borderRadius: '12px', padding: '16px', background: 'var(--panel)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={15} /> Upload to Study Library
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '12px', height: '100%', minHeight: '180px' }}>
            
            {/* Direct Upload Buttons Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {[
                { label: 'Upload Judgment', type: 'Judgment', icon: '⚖️', desc: 'Court judgments & orders' },
                { label: 'Upload Bare Act', type: 'Bare Act', icon: '📖', desc: 'Statutes & legislations' },
                { label: 'Upload Research Paper', type: 'Research Paper', icon: '📚', desc: 'Legal research & thesis' },
                { label: 'Upload Memorial', type: 'Memorial', icon: 'Memorial', desc: 'Moot court memorials' },
                { label: 'Upload Notes', type: 'Notes', icon: '📓', desc: 'Lecture notes & study kits' },
                { label: 'Upload Legal Document', type: 'Legal Document', icon: '💼', desc: 'Contracts, briefs, etc.' },
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => {
                    setSelectedUploadType(item.type);
                    setTimeout(() => {
                      const input = document.getElementById('storage-file-input-custom') as HTMLInputElement | null;
                      if (input) {
                        input.value = '';
                        input.click();
                      }
                    }, 50);
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    padding: '8px 10px',
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid var(--line)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 180ms ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(245, 193, 79, 0.05)';
                    e.currentTarget.style.borderColor = 'var(--gold)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)';
                    e.currentTarget.style.borderColor = 'var(--line)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '1rem' }}>{item.icon === 'Memorial' ? '📝' : item.icon}</span>
                    <strong style={{ fontSize: '0.74rem', color: '#fff' }}>{item.label}</strong>
                  </div>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-soft)' }}>{item.desc}</span>
                </button>
              ))}
            </div>

            {/* General Drag & Drop zone */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => {
                setSelectedUploadType('Legal Document');
                setTimeout(() => {
                  const input = document.getElementById('storage-file-input-custom') as HTMLInputElement | null;
                  if (input) {
                    input.value = '';
                    input.click();
                  }
                }, 50);
              }}
              style={{
                border: `1px ${dragActive ? 'solid' : 'dashed'} var(--gold)`,
                borderRadius: '8px',
                padding: '12px',
                background: dragActive ? 'rgba(245, 193, 79, 0.04)' : 'rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <input 
                type="file" 
                id="storage-file-input-custom"
                onChange={(e) => handleFileInput(e)}
                style={{ display: 'none' }}
                accept=".pdf,.docx,.txt,.ppt,.pptx,.md"
              />
              <Upload size={18} style={{ color: 'var(--gold)', marginBottom: '6px' }} />
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text)', display: 'block' }}>
                Drag & Drop
              </span>
              <span style={{ fontSize: '0.64rem', color: 'var(--text-soft)' }}>
                PDF, DOCX, PPT, PPTX, TXT, MD
              </span>

              {/* Ingestion Visual Progress overlay */}
              {lexUploadingName && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: 'var(--panel-strong)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '10px',
                  zIndex: 5
                }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--gold)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px', textAlign: 'center' }}>
                    <Sparkles size={12} className="pulse" />
                    Ingesting {lexUploadingName.length > 20 ? `${lexUploadingName.substring(0, 17)}...` : lexUploadingName}
                  </span>
                  <div style={{ width: '90%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', marginBottom: '6px' }}>
                    <div style={{
                      width: `${lexUploadProgress !== null ? lexUploadProgress : 50}%`,
                      height: '100%',
                      background: 'var(--gold)',
                      transition: 'width 0.1s linear'
                    }} />
                  </div>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-soft)', textAlign: 'center' }}>
                    {lexUploadProgress !== null ? `Uploading: ${lexUploadProgress}%` : 'Vectorizing...'}
                  </span>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* SEARCH BAR & FILE CABINET */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--line)', borderRadius: '12px', padding: '16px', background: 'var(--panel)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={15} style={{ color: 'var(--gold)' }} />
            Active Document Cabinet
          </h4>
          
          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--line)', borderRadius: '8px', padding: '5px 10px', width: '250px' }}>
            <Search size={14} style={{ color: 'var(--text-soft)' }} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cabinet..." 
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text)',
                fontSize: '0.8rem',
                outline: 'none',
                width: '100%'
              }}
            />
          </div>
        </div>

        {/* CABINET LIST TABLE */}
        <div style={{ overflowX: 'auto', marginTop: '4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)' }}>
                <th style={{ padding: '8px 10px', fontSize: '0.76rem', color: 'var(--text-soft)', fontWeight: '700', textTransform: 'uppercase' }}>File Name</th>
                <th style={{ padding: '8px 10px', fontSize: '0.76rem', color: 'var(--text-soft)', fontWeight: '700', textTransform: 'uppercase' }}>Size</th>
                <th style={{ padding: '8px 10px', fontSize: '0.76rem', color: 'var(--text-soft)', fontWeight: '700', textTransform: 'uppercase' }}>Ingestion Date</th>
                <th style={{ padding: '8px 10px', fontSize: '0.76rem', color: 'var(--text-soft)', fontWeight: '700', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '8px 10px', fontSize: '0.76rem', color: 'var(--text-soft)', fontWeight: '700', textTransform: 'uppercase', textAlign: 'right' }}>AI Dispatch Pipelines</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => {
                const isSelected = selectedLexDocId === doc.id
                return (
                  <tr 
                    key={doc.id} 
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                      background: isSelected ? 'rgba(245, 193, 79, 0.04)' : 'transparent',
                      transition: 'background 0.2s'
                    }}
                  >
                    {/* Filename & Type */}
                    <td style={{ padding: '12px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {getFileIcon(doc.type)}
                      <div>
                        <span style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text)', display: 'block', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.name}
                        </span>
                        <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                          {doc.tags.slice(0, 2).map((tag, idx) => (
                            <span key={idx} style={{ fontSize: '0.66rem', color: 'var(--text-soft)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: '4px' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>

                    {/* Size */}
                    <td style={{ padding: '12px 10px', fontSize: '0.82rem', color: 'var(--text-soft)' }}>
                      {doc.size}
                    </td>

                    {/* Ingestion Date */}
                    <td style={{ padding: '12px 10px', fontSize: '0.82rem', color: 'var(--text-soft)' }}>
                      {doc.uploadedAt.split(' ')[0]}
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        border: '1px solid transparent',
                        background: doc.status === 'Ready' ? 'rgba(15, 138, 87, 0.12)' : 'rgba(245, 193, 79, 0.12)',
                        borderColor: doc.status === 'Ready' ? 'rgba(15, 138, 87, 0.25)' : 'rgba(245, 193, 79, 0.25)',
                        color: doc.status === 'Ready' ? 'var(--ok)' : 'var(--gold)'
                      }}>
                        {doc.status === 'Ready' ? (
                          <>
                            <CheckCircle2 size={11} /> Ready
                          </>
                        ) : (
                          <>
                            <AlertCircle size={11} className="spin" /> Ingesting
                          </>
                        )}
                      </span>
                    </td>

                    {/* Actions dispatcher */}
                    <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        
                        <button
                          type="button"
                          onClick={() => launchDocument(doc.id, 'Judgment Mastery Engine')}
                          title="Deconstruct Case facts & judicial holdings in Judgment Mastery Engine"
                          style={{
                            padding: '5px 8px',
                            background: 'rgba(92, 162, 255, 0.08)',
                            border: '1px solid rgba(92, 162, 255, 0.2)',
                            borderRadius: '6px',
                            color: '#5ca2ff',
                            fontSize: '0.76rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: '180ms ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(92, 162, 255, 0.2)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(92, 162, 255, 0.08)' }}
                        >
                          <ExternalLink size={11} /> Case Facts
                        </button>

                        <button
                          type="button"
                          onClick={() => launchDocument(doc.id, 'Smart Study Forge')}
                          title="Generate study flashcards, MCQs & revision sheets"
                          style={{
                            padding: '5px 8px',
                            background: 'rgba(245, 193, 79, 0.08)',
                            border: '1px solid var(--line)',
                            borderRadius: '6px',
                            color: 'var(--gold)',
                            fontSize: '0.76rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: '180ms ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245, 193, 79, 0.2)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(245, 193, 79, 0.08)' }}
                        >
                          <BrainCircuit size={11} /> Study Forge
                        </button>

                        <button
                          type="button"
                          onClick={() => launchDocument(doc.id, 'LexNotebook AI')}
                          title="Open Grounded AI Workspace Chat"
                          style={{
                            padding: '5px 8px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '6px',
                            color: 'var(--text)',
                            fontSize: '0.76rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: '180ms ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)' }}
                        >
                          Chat
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => deleteLexDoc(doc.id, e)}
                          title="Permanently remove document from cabinet"
                          style={{
                            padding: '5px',
                            background: 'rgba(255, 112, 112, 0.08)',
                            border: '1px solid rgba(255, 112, 112, 0.2)',
                            borderRadius: '6px',
                            color: '#ff7070',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            transition: '180ms ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 112, 112, 0.2)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 112, 112, 0.08)' }}
                        >
                          <Trash2 size={12} />
                        </button>
                        
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-soft)', fontSize: '0.88rem' }}>
                    <AlertCircle size={24} style={{ color: 'var(--gold)', marginBottom: '8px' }} />
                    <p>No matching documents found in the secure cabinet.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
