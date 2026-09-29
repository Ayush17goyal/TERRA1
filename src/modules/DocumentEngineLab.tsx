import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL } from '../lib/api'
import {
  Upload,
  FileText,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  GitBranch,
} from 'lucide-react'

interface Props {
  apiToken: string
}

interface StageProgress {
  [stage: string]: 'pending' | 'in_progress' | 'completed' | 'failed'
}

interface IngestedDocument {
  id: string
  originalFilename: string
  status: string
  documentType: string
  confidenceScore: number
  needsReview: boolean
  reviewReasons: string[] | null
  stageProgress: StageProgress
  createdAt: string
}

interface PersonalExamLibrary {
  status: string
  currentStage: string | null
  topicsCount: number
  subtopicsCount: number
  definitionsCount: number
  casesCount: number
  illustrationsCount: number
  coverageScore: number
  confidenceScore: number
}

interface TopicKnowledgeUnit {
  id: string
  topic: string
  subtopic: string
  summary: string
  definitions: any[]
  legalProvisions: any[]
  landmarkCases: any[]
  referencedCases: any[]
  illustrations: any[]
  examples: any[]
  coverageScore: number
  confidenceScore: number
  version: number
  lastUpdated: string
}

const INGESTION_STAGES = [
  'format_normalization',
  'ocr_recovery',
  'text_cleaning',
  'structural_skeleton',
  'section_extraction',
  'topic_subtopic_detection',
  'entity_extraction',
  'cross_linking',
  'metadata_assembly',
]

const KNOWLEDGE_STAGES = [
  { key: 'extracting_topics', label: 'Extracting Topics' },
  { key: 'building_topic_graph', label: 'Building Topic Graph' },
  { key: 'calculating_coverage', label: 'Calculating Coverage' },
  { key: 'knowledge_library_ready', label: 'Knowledge Library Ready' },
]

const TERMINAL_STATUSES = ['knowledge_ready', 'needs_review', 'rejected', 'failed']

function statusLabel(status: string) {
  if (status === 'building_knowledge') return 'Building Knowledge Library'
  if (status === 'knowledge_ready') return 'Knowledge Library Ready'
  if (status === 'understanding') return 'Extracting Topics'
  if (status === 'completed') return 'Building Knowledge Library'
  return status.replace(/_/g, ' ')
}

export default function DocumentEngineLab({ apiToken }: Props) {
  const [documents, setDocuments] = useState<IngestedDocument[]>([])
  const [library, setLibrary] = useState<PersonalExamLibrary | null>(null)
  const [topics, setTopics] = useState<TopicKnowledgeUnit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null)
  const [recordPreview, setRecordPreview] = useState<Record<string, any>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const authHeaders = { Authorization: `Bearer ${apiToken}` }

  const fetchLibrary = async () => {
    const [libraryRes, topicsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/document-engine/library`, { headers: authHeaders }),
      fetch(`${API_BASE_URL}/document-engine/library/topics`, { headers: authHeaders }),
    ])
    if (libraryRes.ok) setLibrary(await libraryRes.json())
    if (topicsRes.ok) setTopics(await topicsRes.json())
  }

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/document-engine/documents`, { headers: authHeaders })
      if (res.ok) setDocuments(await res.json())
      await fetchLibrary().catch(() => undefined)
    } catch (err) {
      console.error('Failed to load document-engine documents', err)
    }
  }

  useEffect(() => {
    if (!apiToken) return
    fetchDocuments()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [apiToken])

  useEffect(() => {
    const hasPending = documents.some((d) => !TERMINAL_STATUSES.includes(d.status))
    if (!hasPending) {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
      return
    }
    if (pollRef.current) return
    pollRef.current = setInterval(fetchDocuments, 2500)
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [documents])

  const handleUpload = async (file: File) => {
    setUploadError(null)
    setIsLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_BASE_URL}/document-engine/upload`, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || `Upload failed (${res.status})`)
      }
      await fetchDocuments()
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed.')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleExpand = async (doc: IngestedDocument) => {
    if (expandedId === doc.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(doc.id)
    if (!recordPreview[doc.id] && ['building_knowledge', 'knowledge_ready', 'completed', 'needs_review'].includes(doc.status)) {
      try {
        const res = await fetch(`${API_BASE_URL}/document-engine/documents/${doc.id}`, { headers: authHeaders })
        if (res.ok) {
          const record = await res.json()
          setRecordPreview((prev) => ({ ...prev, [doc.id]: record }))
        }
      } catch (err) {
        console.error('Failed to load knowledge record', err)
      }
    }
  }

  const completedIngestion = (stageProgress: StageProgress) =>
    INGESTION_STAGES.filter((stage) => stageProgress?.[stage] === 'completed').length

  const renderKnowledgeProgress = (doc: IngestedDocument) => {
    const isBuilding = doc.status === 'building_knowledge'
    const isReady = doc.status === 'knowledge_ready'
    if (!isBuilding && !isReady) return null

    return (
      <div style={{ marginTop: '10px', display: 'grid', gap: '6px' }}>
        <div style={{ color: isReady ? '#42c98f' : 'var(--gold)', fontWeight: 800 }}>
          {isReady ? 'Knowledge Library Ready' : 'Building Knowledge Library'}
        </div>
        {KNOWLEDGE_STAGES.map((stage) => {
          const state = doc.stageProgress?.[stage.key]
          const done = state === 'completed' || isReady
          const active = state === 'in_progress'
          return (
            <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem' }}>
              {done ? <CheckCircle2 size={12} style={{ color: '#42c98f' }} /> : <RefreshCw size={12} className={active ? 'animate-spin' : ''} style={{ color: active ? 'var(--gold)' : 'var(--text-soft)' }} />}
              <span style={{ color: done ? '#42c98f' : active ? 'var(--gold)' : 'var(--text-soft)' }}>{stage.label}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>Library</h2>
        <p style={{ margin: '4px 0 0 0', color: 'var(--text-soft)', fontSize: '0.85rem' }}>
          Upload study material, track processing, and build your personal exam knowledge library.
        </p>
      </div>

      <div style={{ border: '1px dashed var(--line)', borderRadius: '12px', padding: '24px', background: 'var(--bg-elev)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <Upload size={36} style={{ color: 'var(--gold)' }} />
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-soft)' }}>Supports PDF, DOCX, PPT/PPTX, TXT, MD, PNG, JPG, TIFF</p>
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file); e.target.value = '' }} />
        <button type="button" className="btn btn-primary" disabled={isLoading} onClick={() => fileInputRef.current?.click()} style={{ background: 'var(--gold)', color: '#000', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 600, cursor: 'pointer' }}>
          {isLoading ? 'Uploading...' : 'Upload Document'}
        </button>
        {uploadError && <div style={{ color: '#e85d5d', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={13} /> {uploadError}</div>}
      </div>

      <div style={{ border: '1px solid var(--line)', background: 'var(--bg-elev)', borderRadius: '12px', padding: '18px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
          <BookOpen size={16} style={{ color: 'var(--gold)' }} /> Personal Exam Library
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
          {[
            ['Topics', library?.topicsCount || 0],
            ['Subtopics', library?.subtopicsCount || 0],
            ['Definitions', library?.definitionsCount || 0],
            ['Cases', library?.casesCount || 0],
            ['Illustrations', library?.illustrationsCount || 0],
            ['Coverage', `${Math.round((library?.coverageScore || 0) * 100)}%`],
          ].map(([label, value]) => (
            <div key={label} style={{ border: '1px solid var(--line)', borderRadius: '8px', padding: '10px', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-soft)', textTransform: 'uppercase', fontWeight: 800 }}>{label}</div>
              <strong style={{ color: 'var(--text)', fontSize: '1rem' }}>{value}</strong>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
          {topics.length === 0 ? (
            <div style={{ color: 'var(--text-soft)', fontSize: '0.78rem' }}>No topic knowledge units persisted yet.</div>
          ) : topics.map((topic) => {
            const open = expandedTopicId === topic.id
            const casesCount = (topic.landmarkCases?.length || 0) + (topic.referencedCases?.length || 0)
            const examplesCount = (topic.illustrations?.length || 0) + (topic.examples?.length || 0)
            return (
              <div key={topic.id} style={{ border: '1px solid var(--line)', borderRadius: '8px', background: 'var(--bg)' }}>
                <button type="button" onClick={() => setExpandedTopicId(open ? null : topic.id)} style={{ width: '100%', border: 0, background: 'transparent', color: 'var(--text)', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}><GitBranch size={14} style={{ color: 'var(--gold)' }} /><strong>{topic.topic}</strong><span style={{ color: 'var(--text-soft)' }}>{topic.subtopic}</span></span>
                  <span style={{ display: 'flex', gap: '10px', color: 'var(--text-soft)', fontSize: '0.72rem' }}>
                    <span>Coverage {Math.round(topic.coverageScore * 100)}%</span>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>
                {open && (
                  <div style={{ borderTop: '1px solid var(--line)', padding: '10px 12px', color: 'var(--text-soft)', fontSize: '0.76rem', display: 'grid', gap: '8px' }}>
                    <div>{topic.summary}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <span>Definitions: {topic.definitions?.length || 0}</span>
                      <span>Cases: {casesCount}</span>
                      <span>Illustrations: {examplesCount}</span>
                      <span>Confidence: {Math.round(topic.confidenceScore * 100)}%</span>
                      <span>Version: {topic.version}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ border: '1px solid var(--line)', background: 'var(--bg-elev)', borderRadius: '12px', padding: '18px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
          <FileText size={16} style={{ color: 'var(--gold)' }} /> Documents ({documents.length})
        </h4>

        {documents.length === 0 ? <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-soft)', fontSize: '0.8rem' }}>No documents uploaded yet.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {documents.map((doc) => {
              const completed = completedIngestion(doc.stageProgress)
              const isTerminal = TERMINAL_STATUSES.includes(doc.status)
              return (
                <div key={doc.id} style={{ border: '1px solid var(--line)', borderRadius: '8px', background: 'var(--bg)' }}>
                  <div onClick={() => toggleExpand(doc)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <FileText size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.originalFilename}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      {!isTerminal && doc.status !== 'building_knowledge' && <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', display: 'flex', alignItems: 'center', gap: '4px' }}><RefreshCw size={11} className="animate-spin" /> {completed}/{INGESTION_STAGES.length} stages</span>}
                      <span style={{ fontSize: '0.72rem', color: doc.status === 'knowledge_ready' ? '#42c98f' : 'var(--gold)' }}>{statusLabel(doc.status)}</span>
                      {expandedId === doc.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </div>

                  {expandedId === doc.id && (
                    <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', fontSize: '0.78rem', color: 'var(--text-soft)' }}>
                      <div>Status: {statusLabel(doc.status)}</div>
                      <div>Document type: {doc.documentType}</div>
                      <div>Confidence: {(doc.confidenceScore * 100).toFixed(0)}%</div>
                      {doc.needsReview && doc.reviewReasons && doc.reviewReasons.length > 0 && <div style={{ marginTop: '4px', color: '#e8a94f' }}>Review reasons: {doc.reviewReasons.join(', ')}</div>}
                      {renderKnowledgeProgress(doc)}
                      {!isTerminal && doc.status !== 'building_knowledge' && <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{INGESTION_STAGES.map((stage) => <span key={stage} style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '999px', background: doc.stageProgress?.[stage] === 'completed' ? 'rgba(66, 201, 143, 0.15)' : 'rgba(255,255,255,0.05)', color: doc.stageProgress?.[stage] === 'completed' ? '#42c98f' : 'var(--text-soft)' }}>{stage.replace(/_/g, ' ')}</span>)}</div>}
                      {recordPreview[doc.id] && <div style={{ marginTop: '8px' }}><div>Sections: {recordPreview[doc.id].graph?.sections?.length ?? 0}</div><div>Definitions: {recordPreview[doc.id].graph?.definitions?.length ?? 0}</div><div>Cases: {recordPreview[doc.id].graph?.cases?.length ?? 0}</div></div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}



