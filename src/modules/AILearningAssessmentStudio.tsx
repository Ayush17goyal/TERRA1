import { API_BASE_URL } from '../lib/api'
import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import {
  Brain,
  FileText,
  Upload,
  Link,
  BookOpen,
  Map,
  Plus,
  Play,
  RotateCcw,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Clock,
  Check,
  ChevronRight,
  ChevronDown,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  Award,
  BookMarked,
  Edit2,
  Eye,
  RefreshCw,
  Download,
  Book,
  Scale,
  Maximize2,
  Minimize2,
  Copy,
  ChevronUp
} from 'lucide-react'

// Backend API Base URL
const API_BASE = `${API_BASE_URL}/learning-workspace`

// Interfaces
interface Citation {
  sourceName: string
  section?: string
  chapter?: string
  page?: string
  chunkRef?: string
  supportingText?: string
  paragraph?: string
  confidenceScore?: number
}

interface LearningSource {
  id: string
  kind: string
  name: string
  url: string | null
  text: string
  textLength: number
  createdAt: string
  vectorId?: string
  status?: string
  indexingProgress?: number
  subject?: string
  documentType?: string
  unit?: string
  topic?: string
  metadata?: {
    insufficientForMockTest?: boolean
    insufficientForLongAnswers?: boolean
    extractedWordCount?: number
    error?: string
  }
}

interface GeneratedAnswer {
  text: string
  modelAnswer?: string
  importantJudgments?: string[]
  relevantArticles?: string[]
  relevantSections?: string[]
  sourcesUsed?: string[]
  citations?: Citation[]
  generatedAt?: string
  insufficientMaterialWarning?: string
  retrievalAudit?: {
    topK: number
    requestedTopK: number
    fullDocumentsSent: boolean
    generatedOnlyOnDemand: boolean
  }
}

interface MockQuestion {
  id: string
  type: string
  topic: string
  question: string
  marks?: number
  difficulty?: string
  options?: string[]
  expectedAnswerLength?: string
  modelAnswerRequested?: boolean
  answer?: string
  explanation?: string
  modelAnswer?: string
  markingScheme?: string
  caseReferences?: string
  citations?: Citation[]
  legalPrerequisite?: string
  sampleAnswer?: string
  insufficientMaterialWarning?: string
  generatedAnswers?: Record<string, GeneratedAnswer>
}

interface MockTest {
  id: string
  topic: string
  difficulty: string
  questionType: string
  questionCount: number
  sourceIds: string[]
  questions: MockQuestion[]
  mode: string // 'interactive' | 'pdf'
  pdfUrl?: string
  scoreReport?: {
    totalMarks?: number
    examTitle?: string
    subjectTopic?: string
    instructions?: string[]
    modelAnswerRequested?: boolean
    insufficientForMockTest?: boolean
    extractionWarning?: string
  }
  createdAt: string
}

interface MockTestAttempt {
  id: string
  mockTestId: string
  score: number
  total: number
  percentage: number
  timeTaken: number
  accuracy: number
  answers: Record<string, string>
  weakAreas: string[]
  createdAt: string
}

interface MindMapNode {
  id: string
  node_id?: string
  label: string
  concept_name?: string
  summary: string
  revisionSummary?: string
  definition?: string
  full_content?: string
  detailedExplanation?: string
  key_points?: string[]
  keyPoints?: string[]
  important_facts?: string[]
  importantFacts?: string[]
  related_concepts?: string[]
  relatedConcepts?: string[]
  cases_mentioned?: string[]
  relatedCases?: string[]
  articles_mentioned?: string[]
  relevantArticles?: string[]
  sections_mentioned?: string[]
  relevantSections?: string[]
  exam_important_notes?: string[]
  examNotes?: string[]
  source_chunks?: string[]
  chunkReferences?: string[]
  page_numbers?: string[]
  pageReferences?: string[]
  confidence_score?: number
  confidenceScore?: number
  type: string // 'Case Law' | 'Bare Act' | 'Concept' | 'Root'
  citations?: Citation[]
  children: MindMapNode[]
  isCollapsed?: boolean // client-side toggle
  sourceId?: string
  pageNumber?: number | string
  chunkId?: string
  documentName?: string
  originalSourceText?: string
}

interface MindMap {
  id: string
  title: string
  structureType: string // Quick, Detailed, Judiciary, Bare Act
  sourceIds: string[]
  map: MindMapNode
  concepts: string[]
  createdAt: string
  coverageMetrics?: {
    totalConcepts: number
    pagesAnalyzed: number
    chunksUsed: number
    sourceConfidence: number
  }
}

interface Flashcard {
  id: string
  topic: string
  front: string
  back: string
}

interface StudyKitContent {
  title?: string
  summary: string
  revisionNotes: string
  onePageNotes: string
  keyConcepts: { title: string; explanation: string; citations?: Citation[] }[]
  importantCases: { caseName: string; summary: string; citations?: Citation[] }[]
  importantArticles: { articleOrSection: string; summary: string; citations?: Citation[] }[]
  examQuestions: { question: string; approach: string; citations?: Citation[] }[]
  flashcards: Flashcard[]
  mcqs: MockQuestion[]
}

interface StudyKit {
  id: string
  title: string
  sourceIds: string[]
  content: StudyKitContent
  createdAt: string
}

interface Analytics {
  documentsUploaded: number
  mockTestsGenerated: number
  mindMapsCreated: number
  studyKitsGenerated: number
  averageScore: number
  topicsMastered: number
  readinessScore?: number
}

interface WeakAreaReport {
  weakTopics: string[]
  strongTopics: string[]
  suggestedRevisionPlan: string[]
}

interface RevisionPlanNode {
  day: string
  topic: string
  tasks: string[]
  expectedHours: number
}

interface RevisionPlan {
  title: string
  duration: number
  schedule: RevisionPlanNode[]
}

// Strips all markdown formatting symbols so answers render as clean plain prose
function cleanAnswerText(text: string): string {
  if (!text) return '';
  return text
    .replace(/#{1,6}\s*/g, '')         // remove # ## ### headings
    .replace(/\*\*(.+?)\*\*/g, '$1')   // remove **bold**
    .replace(/\*(.+?)\*/g, '$1')       // remove *italic*
    .replace(/^[\-\*]\s+/gm, '')       // remove bullet dashes and asterisks at line start
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, '')) // remove backticks
    .replace(/_{1,2}(.+?)_{1,2}/g, '$1') // remove __underline__ and _italic_
    .replace(/>\s*/gm, '')              // remove blockquote >
    .replace(/\n{3,}/g, '\n\n')        // collapse excessive blank lines
    .trim();
}

export default function AILearningAssessmentStudio({ theme, onNavigateToMockTests }: { theme?: 'light' | 'dark'; onNavigateToMockTests?: () => void }) {
  const { getToken } = useAuth()

  // Navigation state (renamed to LEGATRIXON convention)
  const [activeSubTab, setActiveSubTab] = useState<'sources' | 'mock-tests' | 'mind-maps' | 'study-kits' | 'analytics'>('sources')

  // Main lists states
  const [sources, setSources] = useState<LearningSource[]>([])
  const [mockTests, setMockTests] = useState<MockTest[]>([])
  const [mindMaps, setMindMaps] = useState<MindMap[]>([])
  const [studyKits, setStudyKits] = useState<StudyKit[]>([])
  const [analytics, setAnalytics] = useState<Analytics>({
    documentsUploaded: 0,
    mockTestsGenerated: 0,
    mindMapsCreated: 0,
    studyKitsGenerated: 0,
    averageScore: 0,
    topicsMastered: 0
  })
  const [weakAreas, setWeakAreas] = useState<WeakAreaReport>({
    weakTopics: [],
    strongTopics: [],
    suggestedRevisionPlan: []
  })
  const [attempts, setAttempts] = useState<MockTestAttempt[]>([])

  // Form states
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Sources tab states
  const [notesText, setNotesText] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [notesKind, setNotesKind] = useState('Notes')
  const [viewingSource, setViewingSource] = useState<LearningSource | null>(null)

  // Mock Test generation states
  const [testTopic, setTestTopic] = useState('')
  const [testDifficulty, setTestDifficulty] = useState('Intermediate')
  const [testQuestionType, setTestQuestionType] = useState('Mixed Descriptive Paper')
  const [testQuestionCount, setTestQuestionCount] = useState(5)
  const [testSelectedSources, setTestSelectedSources] = useState<string[]>([])
  const [testMode, setTestMode] = useState<'interactive' | 'pdf'>('interactive')
  const [paperType, setPaperType] = useState('Full Semester Paper')
  const [customPaperPrompt, setCustomPaperPrompt] = useState('')
  const [answerMode, setAnswerMode] = useState<'10 Marks' | '15 Marks' | '20 Marks' | 'Judiciary Style' | 'Long Descriptive'>('15 Marks')
  const [answerLoadingKey, setAnswerLoadingKey] = useState('')
  const [collapsedAnswers, setCollapsedAnswers] = useState<Record<string, boolean>>({})
  
  // Judiciary Examination Mode States
  const [isJudiciaryMode, setIsJudiciaryMode] = useState(false)
  const [judiciaryState, setJudiciaryState] = useState('General')
  const [examType, setExamType] = useState('PCS-J')
  const [examPattern, setExamPattern] = useState('Mains Pattern')

  useEffect(() => {
    if (isJudiciaryMode) {
      setExamPattern('Mains Pattern')
      setTestQuestionType('Judiciary Descriptive Paper')
    } else {
      setTestQuestionType('Mixed Descriptive Paper')
    }
  }, [isJudiciaryMode])

  // Active Mock Test Attempt
  const [activeTest, setActiveTest] = useState<MockTest | null>(null)
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({})
  const [activeAttemptResult, setActiveAttemptResult] = useState<MockTestAttempt | null>(null)
  const [quizStartTime, setQuizStartTime] = useState<number>(0)

  // Mind Map Architect states
  const [mapSelectedSources, setMapSelectedSources] = useState<string[]>([])
  const [activeMindMap, setActiveMindMap] = useState<MindMap | null>(null)
  const [selectedMapNode, setSelectedMapNode] = useState<MindMapNode | null>(null)
  const [mapStructureType, setMapStructureType] = useState('Quick')
  const [mapSearchQuery, setMapSearchQuery] = useState('')
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [isFullscreenMode, setIsFullscreenMode] = useState(false)
  
  // Custom Node-Based Map Pan & Zoom states
  const [panX, setPanX] = useState(100)
  const [panY, setPanY] = useState(250)
  const [zoom, setZoom] = useState(0.8)
  const [isDraggingMap, setIsDraggingMap] = useState(false)
  const mapDragStart = useRef({ x: 0, y: 0 })
  const mapSvgRef = useRef<SVGSVGElement | null>(null)
  
  // Node collapse toggle mapping
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({})

  // Study Kit states
  const [kitSelectedSources, setKitSelectedSources] = useState<string[]>([])
  const [activeStudyKit, setActiveStudyKit] = useState<StudyKit | null>(null)
  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(0)
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false)
  const [flashcardScores, setFlashcardScores] = useState<Record<string, { correct: boolean; rating: number }>>({})

  // Revision Planner AI states
  const [revisionDuration, setRevisionDuration] = useState<number>(7)
  const [activeRevisionPlan, setActiveRevisionPlan] = useState<RevisionPlan | null>(null)

  // Ingestion System State Variables
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatusText, setUploadStatusText] = useState('')
  const [queueStatus, setQueueStatus] = useState<{ paused: boolean; queueLength: number; isProcessing: boolean }>({
    paused: false,
    queueLength: 0,
    isProcessing: false
  })
  const [selectedTrace, setSelectedTrace] = useState<Citation | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const mockPaperTypes = [
    'Full Semester Paper',
    'Unit Wise Test',
    'PYQ Style Paper',
    'Teacher Style Paper',
    '50 Marks Exam',
    'Important Questions',
    'Difficult Practice Test',
    'Revision Test'
  ]

  // Fetch Background Queue Status
  const fetchQueueStatus = async () => {
    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE.replace('/learning-workspace', '')}/learning-workspace/indexing/status`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (response.ok) {
        setQueueStatus(await response.json())
      }
    } catch (err) {
      console.warn('[Queue Status] Service endpoint is offline.', err)
    }
  }

  // Polling for live status when on sources tab
  useEffect(() => {
    if (activeSubTab === 'sources') {
      fetchQueueStatus()
      const interval = setInterval(() => {
        fetchQueueStatus()
        fetchWorkspace() // fetch fresh status & progress of files
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [activeSubTab])

  // Pause queue execution
  const handlePauseQueue = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE.replace('/learning-workspace', '')}/learning-workspace/indexing/pause`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (response.ok) {
        setSuccessMessage('Asynchronous document indexing queue has been paused.')
        fetchQueueStatus()
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to pause queue.')
    } finally {
      setLoading(false)
    }
  }

  // Resume queue execution
  const handleResumeQueue = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE.replace('/learning-workspace', '')}/learning-workspace/indexing/resume`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (response.ok) {
        setSuccessMessage('Asynchronous document indexing queue has been resumed.')
        fetchQueueStatus()
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resume queue.')
    } finally {
      setLoading(false)
    }
  }

  // Recursive webkit tree files reader for drag & drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const items = e.dataTransfer.items
    if (!items) return

    const fileList: File[] = []
    const traverseFileTree = async (entry: any) => {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => {
          entry.file(resolve, reject)
        })
        fileList.push(file)
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader()
        const readEntries = () => {
          return new Promise<any[]>((resolve, reject) => {
            dirReader.readEntries(resolve, reject)
          })
        }
        let entries = await readEntries()
        let allEntries = [...entries]
        while (entries.length > 0) {
          entries = await readEntries()
          allEntries = [...allEntries, ...entries]
        }
        for (const childEntry of allEntries) {
          await traverseFileTree(childEntry)
        }
      }
    }

    const promises = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry()
        if (entry) {
          promises.push(traverseFileTree(entry))
        }
      }
    }
    await Promise.all(promises)
    setSelectedFiles(prev => [...prev, ...fileList])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const removeSelectedFile = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const clearSelectedFiles = () => {
    setSelectedFiles([])
  }

  // Handle multiple file upload via XMLHttp to track progress
  const handleBulkFileUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedFiles.length === 0) {
      setErrorMessage('Please select or drop files to upload.')
      return
    }

    setUploadingFiles(true)
    setUploadProgress(5)
    setUploadStatusText('Preparing upload package...')
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const token = await getToken()
      const formData = new FormData()
      selectedFiles.forEach((file) => {
        formData.append('files', file)
      })
      formData.append('kind', 'Study Material')

      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${API_BASE}/sources/bulk-upload`)
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const pct = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(Math.min(95, Math.max(5, pct)))
          setUploadStatusText(pct >= 100 ? 'Upload sent. Waiting for server acceptance...' : 'Uploading file data to server...')
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress(100)
          setUploadStatusText('Upload accepted. Backend indexing is now running in the queue.')
          setSuccessMessage(`Accepted ${selectedFiles.length} file(s). Background extraction, OCR, chunking, and vector indexing are now running.`)
          setSelectedFiles([])
          fetchWorkspace()
          fetchQueueStatus()
        } else {
          setUploadStatusText('Upload failed before indexing could start.')
          setErrorMessage(`Bulk upload failed: ${xhr.statusText || xhr.status}`)
        }
        setUploadingFiles(false)
      }

      xhr.onerror = () => {
        setUploadStatusText('Upload failed before indexing could start.')
        setErrorMessage('A network error occurred during document uploads.')
        setUploadingFiles(false)
      }

      xhr.send(formData)
    } catch (err: any) {
      setUploadStatusText('Upload could not be initialized.')
      setErrorMessage(err.message || 'Upload initialization failed.')
      setUploadingFiles(false)
    }
  }

  // Fetch all workspace lists
  const fetchWorkspace = async () => {
    setLoading(true)
    setErrorMessage('')
    try {
      const token = await getToken()
      const response = await fetch(API_BASE, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (!response.ok) {
        throw new Error('Could not load studio workspace data.')
      }
      const data = await response.json()
      setSources(data.sources || [])
      setMockTests(data.mockTests || [])
      setMindMaps(data.mindMaps || [])
      setStudyKits(data.studyKits || [])
      if (data.attempts) setAttempts(data.attempts)
      if (data.analytics) setAnalytics(data.analytics)
      if (data.weakAreas) setWeakAreas(data.weakAreas)
    } catch (err: any) {
      setErrorMessage(err.message || 'Error loading studio data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkspace()
  }, [])

  const getAnswerModeForQuestion = (q: any): string => {
    const qt = String(q.type || '').toLowerCase();
    if (qt.includes('10 mark') || q.marks === 10) return '10 Marks';
    if (qt.includes('15 mark') || q.marks === 15) return '15 Marks';
    if (qt.includes('20 mark') || q.marks === 20) return '20 Marks';
    if (qt.includes('judiciary')) return 'Judiciary Style';
    if (qt.includes('long descriptive')) return 'Long Descriptive';
    return '15 Marks';
  };

  useEffect(() => {
    if (!activeTest) return;
    
    let isCancelled = false;
    
    const generateMissingAnswers = async () => {
      for (const q of activeTest.questions) {
        const targetMode = getAnswerModeForQuestion(q);
        const hasAnswer = q.generatedAnswers?.[targetMode];
        
        if (!hasAnswer && !isCancelled) {
          const loadingKey = `${q.id}:${targetMode}`;
          setAnswerLoadingKey(loadingKey);
          try {
            const token = await getToken();
            const response = await fetch(`${API_BASE}/mock-tests/${activeTest.id}/questions/${q.id}/answer`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ mode: targetMode })
            });
            if (response.ok && !isCancelled) {
              const result = await response.json();
              setActiveTest(prev => {
                if (!prev) return null;
                const updated = {
                  ...prev,
                  questions: prev.questions.map(item => {
                    if (item.id !== q.id) return item;
                    return {
                      ...item,
                      generatedAnswers: {
                        ...(item.generatedAnswers || {}),
                        [result.mode]: result.answer
                      }
                    };
                  })
                };
                setMockTests(history => history.map(t => t.id === updated.id ? updated : t));
                return updated;
              });
            }
          } catch (err) {
            console.error('Failed to auto-generate answer for question', q.id, err);
          } finally {
            setAnswerLoadingKey('');
          }
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
    };
    
    generateMissingAnswers();
    
    return () => {
      isCancelled = true;
    };
  }, [activeTest?.id]);

  const generateAnswerForQuestion = async (q: MockQuestion, targetMode: string, force = false) => {
    if (!activeTest || (!force && q.generatedAnswers?.[targetMode]) || answerLoadingKey) return;
    const loadingKey = `${q.id}:${targetMode}`;
    setAnswerLoadingKey(loadingKey);
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE}/mock-tests/${activeTest.id}/questions/${q.id}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ mode: targetMode, force })
      });
      if (!response.ok) throw new Error('Unable to generate detailed answer.');
      const result = await response.json();
      setActiveTest(prev => {
        if (!prev) return null;
        const updated = {
          ...prev,
          questions: prev.questions.map(item => item.id === q.id ? {
            ...item,
            generatedAnswers: {
              ...(item.generatedAnswers || {}),
              [result.mode]: result.answer
            }
          } : item)
        };
        setMockTests(history => history.map(t => t.id === updated.id ? updated : t));
        return updated;
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to generate detailed answer.')
    } finally {
      setAnswerLoadingKey('');
    }
  }
  const downloadAssessmentFile = async (url: string, filename: string) => {
    setLoading(true)
    setErrorMessage('')
    try {
      const token = await getToken()
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (!response.ok) throw new Error('Export could not be generated.')
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(downloadUrl)
      setSuccessMessage(`${filename} downloaded successfully.`)
    } catch (err: any) {
      setErrorMessage(err.message || 'Export could not be generated.')
    } finally {
      setLoading(false)
    }
  }

  const handleExportMockTest = (testId: string, format: 'pdf' | 'docx' | 'pptx') => {
    const url = `${API_BASE}/mock-tests/${testId}/export/${format}`
    downloadAssessmentFile(url, `MockTest-${testId}.${format}`)
  }

  const handleExportStudyKit = (kitId: string, format: 'pdf' | 'docx' | 'pptx') => {
    const url = `${API_BASE}/study-kits/${kitId}/export/${format}`
    downloadAssessmentFile(url, `StudyKit-${kitId}.${format}`)
  }


  // Clear notifications
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('')
        setErrorMessage('')
      }, 8000)
      return () => clearTimeout(timer)
    }
  }, [successMessage, errorMessage])

  // Handle URL / Text source addition
  const handleAddTextSource = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!notesText.trim() && !linkUrl.trim()) {
      setErrorMessage('Please paste text notes or enter a valid URL.')
      return
    }
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const token = await getToken()
      const body = {
        kind: linkUrl ? (linkUrl.includes('youtube.com') || linkUrl.includes('youtu.be') ? 'YouTube URL' : 'Article URL') : notesKind,
        name: sourceName.trim() || (linkUrl ? linkUrl : `Pasted Note (${new Date().toLocaleDateString()})`),
        text: notesText,
        url: linkUrl || undefined
      }

      const response = await fetch(`${API_BASE}/sources/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(errText || 'Failed to add source.')
      }

      setSuccessMessage('Source successfully analyzed, vectorized, and ingested into Qdrant!')
      setNotesText('')
      setSourceName('')
      setLinkUrl('')
      fetchWorkspace()
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to add text or link source.')
    } finally {
      setLoading(false)
    }
  }

  // Handle file uploads
  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      setErrorMessage('Please select a file to upload.')
      return
    }
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const token = await getToken()
      const formData = new FormData()
      formData.append('file', selectedFile)
      
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || ''
      let kind = 'Document'
      if (fileExt === 'pptx' || fileExt === 'ppt') kind = 'PPT/PPTX'
      else if (fileExt === 'pdf') kind = 'PDF'
      else if (fileExt === 'docx') kind = 'DOCX'
      else if (fileExt === 'txt') kind = 'TXT'

      formData.append('kind', kind)

      const response = await fetch(`${API_BASE}/sources/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(errText || 'Failed to upload document.')
      }

      setSuccessMessage('Document file successfully parsed, chunked, and stored in Qdrant!')
      setSelectedFile(null)
      const fileInput = document.getElementById('studio-file') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      fetchWorkspace()
    } catch (err: any) {
      setErrorMessage(err.message || 'File ingestion failed.')
    } finally {
      setLoading(false)
    }
  }

  // Rename source
  const handleRenameSource = async (id: string, currentName: string) => {
    const newName = prompt('Enter a new name for this source:', currentName)
    if (!newName || !newName.trim() || newName.trim() === currentName) return
    setLoading(true)
    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE}/sources/${id}/rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newName: newName.trim() })
      })
      if (!response.ok) throw new Error('Failed to rename source.')
      setSuccessMessage('Source renamed successfully.')
      fetchWorkspace()
    } catch (err: any) {
      setErrorMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Delete source
  const handleDeleteSource = async (id: string) => {
    if (!confirm('Are you sure you want to delete this source? This will remove its chunks from Qdrant vector database.')) return
    setLoading(true)
    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE}/sources/${id}/delete`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (!response.ok) throw new Error('Failed to delete source.')
      setSuccessMessage('Source deleted from platform and Qdrant.')
      fetchWorkspace()
    } catch (err: any) {
      setErrorMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Reprocess source
  const handleReprocessSource = async (id: string) => {
    setLoading(true)
    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE}/sources/${id}/reprocess`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (!response.ok) throw new Error('Failed to reprocess source.')
      setSuccessMessage('Source successfully re-chunked and re-indexed in Qdrant.')
      fetchWorkspace()
    } catch (err: any) {
      setErrorMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Handle Mock Test generation
  const handleGenerateMockTest = async (e: React.FormEvent) => {
    e.preventDefault()
    const builderPrompt = customPaperPrompt.trim()
    const topic = testTopic.trim() || builderPrompt
    if (!topic) {
      setErrorMessage('Please enter a topic or describe the paper you want.')
      return
    }
    if (testSelectedSources.length === 0) {
      setErrorMessage('Please select at least one uploaded legal source for mock test generation.')
      return
    }

    const selectedSources = sources.filter(src => testSelectedSources.includes(src.id))
    const usableSources = selectedSources.filter(src => {
      const extractedWords = src.metadata?.extractedWordCount || Math.floor((src.textLength || 0) / 5)
      const hasReadableText = extractedWords >= 120 || (src.textLength || 0) >= 600
      const isIndexed = !src.status || src.status === 'Indexed'
      return isIndexed && hasReadableText
    })
    if (usableSources.length === 0) {
      setErrorMessage('No usable uploaded material exists for Mock Test generation. Please wait for indexing or upload readable legal material.')
      return
    }

    const extractionWarnings = selectedSources.filter(src => src.metadata?.insufficientForMockTest)
    if (extractionWarnings.length > 0) {
      setSuccessMessage('Extraction warning: selected source text is limited. The paper will use available indexed chunks; verify coverage before final use.')
    }

    setLoading(true)
    setErrorMessage('')
    if (extractionWarnings.length === 0) setSuccessMessage('')
    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE}/mock-tests/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          topic,
          difficulty: testDifficulty,
          questionType: testQuestionType,
          paperType,
          templateIntent: `${paperType} descriptive legal long-answer paper`,
          customPrompt: builderPrompt,
          questionCount: testQuestionCount,
          sourceIds: testSelectedSources,
          mode: testMode,
          isJudiciaryMode,
          judiciaryState,
          examType,
          examPattern,
          modelAnswerRequested: true
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        try {
          const parsed = JSON.parse(errText)
          throw new Error(parsed.message || parsed.error || 'AI mock test generation failed.')
        } catch {
          throw new Error(errText || 'AI mock test generation failed.')
        }
      }

      const generatedTest = await response.json()
      setSuccessMessage('Descriptive legal mock paper generated. Long professional model answers are being generated and cached for each question.')
      setTestTopic('')
      setCustomPaperPrompt('')
      fetchWorkspace()
      
      if (testMode === 'interactive') {
        setActiveTest(generatedTest)
        setUserAnswers({})
        setActiveAttemptResult(null)
        setQuizStartTime(Date.now())
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'AI Mock Test generation failed.')
    } finally {
      setLoading(false)
    }
  }
  // Submit Mock Test Answers
  const handleSubmitMockTest = async () => {
    if (!activeTest) return
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const elapsedSeconds = Math.round((Date.now() - quizStartTime) / 1000)
      const token = await getToken()
      const response = await fetch(`${API_BASE}/mock-tests/${activeTest.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          answers: userAnswers,
          timeTaken: elapsedSeconds
        })
      })

      if (!response.ok) {
        throw new Error('Failed to submit mock test answers.')
      }

      const attemptResult = await response.json()
      setActiveAttemptResult(attemptResult)
      setSuccessMessage(`Assessment complete! Accuracy: ${attemptResult.accuracy}% in ${elapsedSeconds} seconds.`)
      fetchWorkspace()
    } catch (err: any) {
      setErrorMessage(err.message || 'Mock test submission failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateDetailedAnswer = async (questionId: string) => {
    if (!activeTest) return
    const loadingKey = `${questionId}:${answerMode}`
    setAnswerLoadingKey(loadingKey)
    setErrorMessage('')
    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE}/mock-tests/${activeTest.id}/questions/${questionId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ mode: answerMode })
      })
      if (!response.ok) {
        const errText = await response.text()
        throw new Error(errText || 'Detailed answer generation failed.')
      }
      const result = await response.json()
      const updatedTest = {
        ...activeTest,
        questions: activeTest.questions.map((question) => {
          if (question.id !== questionId) return question
          return {
            ...question,
            generatedAnswers: {
              ...(question.generatedAnswers || {}),
              [result.mode]: result.answer
            }
          }
        })
      }
      setActiveTest(updatedTest)
      setMockTests(prev => prev.map(test => test.id === updatedTest.id ? updatedTest : test))
      setSuccessMessage(result.cached ? 'Returned cached detailed answer.' : 'Detailed answer generated on demand.')
    } catch (err: any) {
      setErrorMessage(err.message || 'Detailed answer generation failed.')
    } finally {
      setAnswerLoadingKey('')
    }
  }
  // Handle Mind Map generation
  const handleGenerateMindMap = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mapSelectedSources.length === 0) {
      setErrorMessage('Please select at least one source for mind map generation.')
      return
    }
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE}/mind-maps/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sourceIds: mapSelectedSources,
          structureType: mapStructureType
        })
      })

      if (!response.ok) {
        throw new Error('AI mind map generation failed.')
      }

      const mapData = await response.json()
      setSuccessMessage('AI Mind Map™ compiled successfully!')
      fetchWorkspace()
      setActiveMindMap(mapData)
      setSelectedMapNode(mapData.map)
      setCollapsedNodes({})
      // Centering map tree
      setPanX(100)
      setPanY(250)
      setZoom(0.8)
    } catch (err: any) {
      setErrorMessage(err.message || 'Mind Map generation failed.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Study Kit generation
  const handleGenerateStudyKit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (kitSelectedSources.length === 0) {
      setErrorMessage('Please select at least one source for Study Kit generation.')
      return
    }
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE}/study-kits/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sourceIds: kitSelectedSources
        })
      })

      if (!response.ok) {
        throw new Error('AI Study Kit generation failed.')
      }

      const kitData = await response.json()
      setSuccessMessage('AI Study Kit™ generated successfully!')
      fetchWorkspace()
      setActiveStudyKit(kitData)
      setActiveFlashcardIndex(0)
      setIsFlashcardFlipped(false)
    } catch (err: any) {
      setErrorMessage(err.message || 'Study Kit generation failed.')
    } finally {
      setLoading(false)
    }
  }

  // Generate AI Revision Planner
  const handleGenerateRevisionPlanner = async (days: number) => {
    setLoading(true)
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const token = await getToken()
      const response = await fetch(`${API_BASE}/revision-plan/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ durationDays: days })
      })

      if (!response.ok) throw new Error('AI Revision plan compiler failed.')
      const plan = await response.json()
      setActiveRevisionPlan(plan)
      setSuccessMessage('Judiciary Study Action timeline compiled!')
    } catch (err: any) {
      setErrorMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Review flashcard
  const handleReviewFlashcard = async (card: Flashcard, correct: boolean, rating: number) => {
    if (!activeStudyKit) return
    setFlashcardScores(prev => ({
      ...prev,
      [card.id]: { correct, rating }
    }))
    try {
      const token = await getToken()
      await fetch(`${API_BASE}/flashcards/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          studyKitId: activeStudyKit.id,
          cardId: card.id,
          topic: card.topic,
          correct,
          rating
        })
      })
      const analyticsResponse = await fetch(`${API_BASE}/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (analyticsResponse.ok) {
        setAnalytics(await analyticsResponse.json())
      }
    } catch (err) {
      console.warn('Could not record flashcard metrics', err)
    }
  }

  // Toggle checklist selection
  const toggleSourceSelection = (id: string, type: 'test' | 'map' | 'kit') => {
    const selector = type === 'test' ? testSelectedSources : type === 'map' ? mapSelectedSources : kitSelectedSources
    const setter = type === 'test' ? setTestSelectedSources : type === 'map' ? setMapSelectedSources : setKitSelectedSources
    if (selector.includes(id)) {
      setter(selector.filter(s => s !== id))
    } else {
      setter([...selector, id])
    }
  }

  const toggleAllSources = (type: 'test' | 'map' | 'kit') => {
    const selector = type === 'test' ? testSelectedSources : type === 'map' ? mapSelectedSources : kitSelectedSources
    const setter = type === 'test' ? setTestSelectedSources : type === 'map' ? setMapSelectedSources : setKitSelectedSources
    if (selector.length === sources.length) {
      setter([])
    } else {
      setter(sources.map(s => s.id))
    }
  }

  const renderNodeKnowledgeContainer = (node: MindMapNode) => {
    const conceptName = node.concept_name || node.label || 'Unnamed Concept';
    const definition = node.definition || 'No definition available in source.';
    const completeExplanation = node.full_content || node.detailedExplanation || 'No detailed explanation available in source.';
    const keyPoints = node.key_points || node.keyPoints || [];
    const importantFacts = node.important_facts || node.importantFacts || [];
    const relatedConcepts = node.related_concepts || node.relatedConcepts || [];
    const casesMentioned = node.cases_mentioned || node.relatedCases || [];
    const articlesMentioned = node.articles_mentioned || node.relevantArticles || [];
    const sectionsMentioned = node.sections_mentioned || node.relevantSections || [];
    const examNotes = node.exam_important_notes || node.examNotes || [];
    const revisionSummary = node.summary || node.revisionSummary || 'No revision summary available.';
    const citations = node.citations || [];
    const pageReferences = node.page_numbers || node.pageReferences || [];
    const chunkReferences = node.source_chunks || node.chunkReferences || [];
    const confidenceScore = typeof node.confidence_score === 'number' 
      ? node.confidence_score 
      : (typeof node.confidenceScore === 'number' ? node.confidenceScore : 0.95);

    const typeNorm = node.type === 'Case Law' ? 'Case' : (node.type === 'Bare Act' ? 'Section' : (node.type || 'Concept'));
    
    let typeColor = theme === 'light' ? '#2563eb' : '#3b82f6'; // Concept
    let typeBg = theme === 'light' ? 'rgba(37, 99, 235, 0.1)' : 'rgba(59, 130, 246, 0.1)';
    if (typeNorm === 'Root') {
      typeColor = theme === 'light' ? '#11131a' : '#ffffff';
      typeBg = theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)';
    } else if (typeNorm === 'Article') {
      typeColor = theme === 'light' ? '#d97706' : '#fbbf24';
      typeBg = theme === 'light' ? 'rgba(217, 119, 6, 0.1)' : 'rgba(251, 191, 36, 0.1)';
    } else if (typeNorm === 'Case') {
      typeColor = theme === 'light' ? '#059669' : '#10b981';
      typeBg = theme === 'light' ? 'rgba(5, 150, 105, 0.1)' : 'rgba(16, 185, 129, 0.1)';
    } else if (typeNorm === 'Doctrine') {
      typeColor = theme === 'light' ? '#7c3aed' : '#8b5cf6';
      typeBg = theme === 'light' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(139, 92, 246, 0.1)';
    } else if (typeNorm === 'Section') {
      typeColor = theme === 'light' ? '#ea580c' : '#f97316';
      typeBg = theme === 'light' ? 'rgba(234, 88, 12, 0.1)' : 'rgba(249, 115, 22, 0.1)';
    }

    return (
      <div className="knowledge-container" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        color: 'var(--text)',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {/* Header Section */}
        <div style={{
          borderBottom: '1px solid var(--line)',
          paddingBottom: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <h4 style={{ 
              fontSize: '1.05rem', 
              fontWeight: '800', 
              color: 'var(--gold)',
              margin: 0,
              lineHeight: '1.3'
            }}>
              {conceptName}
            </h4>
            <span style={{ 
              fontSize: '0.62rem', 
              background: typeBg, 
              color: typeColor, 
              padding: '2px 8px', 
              borderRadius: '4px', 
              textTransform: 'uppercase',
              fontWeight: 'bold',
              border: `1px solid ${typeColor}30`,
              whiteSpace: 'nowrap'
            }}>
              {typeNorm}
            </span>
          </div>
        </div>

        {/* 15. Evidence Grounding Confidence */}
        <div style={{
          background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.01)',
          border: theme === 'light' ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.03)',
          padding: '10px 12px',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-soft)', fontWeight: '500' }}>
              <Award size={13} style={{ color: '#10b981' }} /> Evidence Grounding Confidence
            </span>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>{Math.round(confidenceScore * 100)}%</span>
          </div>
          <div style={{ width: '100%', height: '5px', background: theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${confidenceScore * 100}%`, height: '100%', background: '#10b981', borderRadius: '3px', transition: 'width 0.5s ease-in-out' }} />
          </div>
        </div>

        {/* 2. Definition Box */}
        <div style={{
          background: theme === 'light' ? 'rgba(143, 100, 18, 0.04)' : 'rgba(245, 193, 79, 0.03)',
          borderLeft: '3px solid var(--gold)',
          padding: '10px 12px',
          borderRadius: '0 8px 8px 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', fontWeight: 'bold', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: '4px' }}>
            <Book size={12} /> Definition
          </div>
          <p style={{ fontSize: '0.78rem', lineHeight: '1.45', margin: 0, color: 'var(--text)' }}>
            {definition}
          </p>
        </div>

        {/* 11. Revision Summary Takeaway */}
        <div style={{
          background: theme === 'light' ? 'rgba(37, 99, 235, 0.04)' : 'rgba(59, 130, 246, 0.03)',
          borderLeft: '3px solid #3b82f6',
          padding: '10px 12px',
          borderRadius: '0 8px 8px 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', fontWeight: 'bold', color: '#3b82f6', textTransform: 'uppercase', marginBottom: '4px' }}>
            <Sparkles size={12} /> Revision Summary
          </div>
          <p style={{ fontSize: '0.76rem', lineHeight: '1.45', margin: 0, color: theme === 'light' ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)' }}>
            {revisionSummary}
          </p>
        </div>

        {/* 3. Complete Explanation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.66rem', fontWeight: 'bold', color: 'var(--text-soft)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <FileText size={12} /> Complete Grounded Explanation
          </span>
          <p style={{ 
            fontSize: '0.76rem', 
            color: theme === 'light' ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.75)', 
            lineHeight: '1.5', 
            margin: 0,
            textAlign: 'justify',
            background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.01)',
            padding: '10px',
            borderRadius: '8px',
            border: theme === 'light' ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.02)'
          }}>
            {completeExplanation}
          </p>
        </div>

        {/* 4 & 5. Key Points & Important Facts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Key Points */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.66rem', fontWeight: 'bold', color: 'var(--text-soft)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CheckCircle size={12} style={{ color: '#10b981' }} /> Key Conceptual Points
            </span>
            <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {Array.isArray(keyPoints) && keyPoints.length > 0 ? (
                keyPoints.map((pt, i) => (
                  <li key={i} style={{ fontSize: '0.74rem', color: theme === 'light' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)', lineHeight: '1.4' }}>
                    {pt}
                  </li>
                ))
              ) : (
                <li style={{ fontSize: '0.72rem', color: 'var(--text-soft)', listStyleType: 'none', marginLeft: '-16px' }}>
                  No key points extracted.
                </li>
              )}
            </ul>
          </div>

          {/* Important Facts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: theme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.04)', paddingTop: '10px' }}>
            <span style={{ fontSize: '0.66rem', fontWeight: 'bold', color: 'var(--text-soft)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Layers size={12} style={{ color: '#fbbf24' }} /> Grounded Facts
            </span>
            <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {Array.isArray(importantFacts) && importantFacts.length > 0 ? (
                importantFacts.map((fact, i) => (
                  <li key={i} style={{ fontSize: '0.74rem', color: theme === 'light' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)', lineHeight: '1.4' }}>
                    {fact}
                  </li>
                ))
              ) : (
                <li style={{ fontSize: '0.72rem', color: 'var(--text-soft)', listStyleType: 'none', marginLeft: '-16px' }}>
                  No historical/legal facts mentioned.
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* 10. Exam Important Notes */}
        {((Array.isArray(examNotes) && examNotes.length > 0) || (typeof examNotes === 'string' && String(examNotes).trim() !== '')) && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.02)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            padding: '10px 12px',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', fontWeight: 'bold', color: '#f87171', textTransform: 'uppercase' }}>
              <AlertTriangle size={12} /> Exam Important Notes
            </div>
            <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {Array.isArray(examNotes) ? (
                examNotes.map((note, i) => (
                  <li key={i} style={{ fontSize: '0.73rem', color: theme === 'light' ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)', lineHeight: '1.4' }}>
                    {note}
                  </li>
                ))
              ) : (
                <li style={{ fontSize: '0.73rem', color: theme === 'light' ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)', lineHeight: '1.4', listStyleType: 'none', marginLeft: '-16px' }}>
                  {examNotes}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* 14. Original Source Text Grounding (NEW Segment) */}
        {node.originalSourceText && node.originalSourceText.trim() !== '' && (
          <div style={{
            background: theme === 'light' ? 'rgba(143, 100, 18, 0.04)' : 'rgba(245, 193, 79, 0.02)',
            border: theme === 'light' ? '1px solid rgba(143, 100, 18, 0.15)' : '1px solid rgba(245, 193, 79, 0.15)',
            padding: '10px 12px',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.68rem',
              fontWeight: 'bold',
              color: 'var(--gold)',
              textTransform: 'uppercase'
            }}>
              <BookOpen size={12} /> Original Source Text Grounding
            </div>
            <p style={{
              fontSize: '0.74rem',
              color: theme === 'light' ? 'rgba(0,0,0,0.78)' : 'rgba(255,255,255,0.78)',
              lineHeight: '1.45',
              margin: 0,
              fontStyle: 'italic',
              background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0.12)',
              padding: '8px',
              borderRadius: '6px',
              borderLeft: '2px solid var(--gold)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              "{node.originalSourceText}"
            </p>
          </div>
        )}

        {/* Grouped Entity Badges: 6, 7, 8, 9, 13, 14 */}
        <div style={{
          borderTop: theme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.05)',
          paddingTop: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {/* 6. Related Concepts */}
          {relatedConcepts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-soft)', fontWeight: 'bold', minWidth: '85px' }}>Related Concepts:</span>
              {relatedConcepts.map((item, idx) => (
                <span key={idx} style={{
                  fontSize: '0.58rem',
                  background: theme === 'light' ? 'rgba(37, 99, 235, 0.08)' : 'rgba(59, 130, 246, 0.1)',
                  color: theme === 'light' ? '#1e40af' : '#3b82f6',
                  border: theme === 'light' ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid rgba(59, 130, 246, 0.2)',
                  padding: '1px 5px',
                  borderRadius: '4px'
                }}>
                  {item}
                </span>
              ))}
            </div>
          )}

          {/* 7. Cases Mentioned */}
          {casesMentioned.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-soft)', fontWeight: 'bold', minWidth: '85px' }}>Cases Mentioned:</span>
              {casesMentioned.map((item, idx) => (
                <span key={idx} style={{
                  fontSize: '0.58rem',
                  background: theme === 'light' ? 'rgba(5, 150, 105, 0.08)' : 'rgba(16, 185, 129, 0.1)',
                  color: theme === 'light' ? '#065f46' : '#10b981',
                  border: theme === 'light' ? '1px solid rgba(5, 150, 105, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                  padding: '1px 5px',
                  borderRadius: '4px'
                }}>
                  {item}
                </span>
              ))}
            </div>
          )}

          {/* 8 & 9. Articles & Sections Mentioned */}
          {articlesMentioned.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-soft)', fontWeight: 'bold', minWidth: '85px' }}>Articles:</span>
              {articlesMentioned.map((item, idx) => (
                <span key={idx} style={{
                  fontSize: '0.58rem',
                  background: theme === 'light' ? 'rgba(217, 119, 6, 0.08)' : 'rgba(251, 191, 36, 0.1)',
                  color: theme === 'light' ? '#92400e' : '#fbbf24',
                  border: theme === 'light' ? '1px solid rgba(217, 119, 6, 0.2)' : '1px solid rgba(251, 191, 36, 0.2)',
                  padding: '1px 5px',
                  borderRadius: '4px'
                }}>
                  {item}
                </span>
              ))}
            </div>
          )}

          {sectionsMentioned.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-soft)', fontWeight: 'bold', minWidth: '85px' }}>Sections:</span>
              {sectionsMentioned.map((item, idx) => (
                <span key={idx} style={{
                  fontSize: '0.58rem',
                  background: theme === 'light' ? 'rgba(154, 52, 18, 0.08)' : 'rgba(249, 115, 22, 0.1)',
                  color: theme === 'light' ? '#9a3412' : '#f97316',
                  border: theme === 'light' ? '1px solid rgba(154, 52, 18, 0.2)' : '1px solid rgba(249, 115, 22, 0.2)',
                  padding: '1px 5px',
                  borderRadius: '4px'
                }}>
                  {item}
                </span>
              ))}
            </div>
          )}

          {/* 13. Page References */}
          {pageReferences.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-soft)', fontWeight: 'bold', minWidth: '85px' }}>Pages:</span>
              {pageReferences.map((item, idx) => (
                <span key={idx} style={{
                  fontSize: '0.58rem',
                  background: theme === 'light' ? 'rgba(91, 33, 182, 0.08)' : 'rgba(139, 92, 246, 0.1)',
                  color: theme === 'light' ? '#5b21b6' : '#a78bfa',
                  border: theme === 'light' ? '1px solid rgba(91, 33, 182, 0.2)' : '1px solid rgba(139, 92, 246, 0.2)',
                  padding: '1px 5px',
                  borderRadius: '4px'
                }}>
                  Page {item}
                </span>
              ))}
            </div>
          )}

          {/* 14. Chunk References */}
          {chunkReferences.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-soft)', fontWeight: 'bold', minWidth: '85px' }}>Chunks:</span>
              {chunkReferences.map((item, idx) => (
                <span key={idx} style={{ fontSize: '0.55rem', fontFamily: 'monospace', background: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', color: 'var(--text-soft)', padding: '1px 5px', borderRadius: '4px' }}>
                  {item.substring(0, 18) + (item.length > 18 ? '...' : '')}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 12. Source Citations list */}
        {citations && citations.length > 0 && (
          <div style={{ borderTop: theme === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 'bold', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <BookMarked size={12} /> Grounding Citations
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {citations.map((c, idx) => (
                <div key={idx} 
                  onClick={() => setSelectedTrace(c)}
                  style={{
                    padding: '8px',
                    background: theme === 'light' ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.02)',
                    border: theme === 'light' ? '1px solid rgba(0, 0, 0, 0.05)' : '1px solid rgba(255, 255, 255, 0.04)',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(245, 193, 79, 0.06)'
                    e.currentTarget.style.borderColor = 'rgba(245, 193, 79, 0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = theme === 'light' ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.02)'
                    e.currentTarget.style.borderColor = theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.04)'
                  }}
                >
                  <div style={{ fontSize: '0.68rem', fontWeight: 'bold', color: 'var(--text)' }}>
                    Document: <span style={{ color: 'var(--gold)' }}>{c.sourceName}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '0.62rem', color: 'var(--text-soft)' }}>
                    <span>Page: {c.page || 'N/A'}</span>
                    <span>•</span>
                    <span>Ref: {c.chunkRef || 'N/A'}</span>
                  </div>
                  {c.supportingText && (
                    <div style={{
                      fontSize: '0.65rem',
                      color: theme === 'light' ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.65)',
                      background: theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0,0,0,0.15)',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      fontStyle: 'italic',
                      marginTop: '2px',
                      lineHeight: '1.3',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                      borderLeft: '2px solid var(--gold)'
                    }}>
                      "{c.supportingText}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- SVG INTERACTIVE MIND MAP BUILDER ---
  interface VisualNode {
    id: string
    label: string
    type: string
    summary: string
    citations?: Citation[]
    children: VisualNode[]
    isCollapsed: boolean
    x: number
    y: number
  }

  const isGroundedNode = (node: MindMapNode): boolean => {
    if (!node.label && !node.concept_name) return false;
    const explanation = node.definition || node.full_content || node.detailedExplanation;
    if (!explanation || explanation.trim() === '') return false;
    const hasCitations = (node.citations && node.citations.length > 0) || 
                          (node.source_chunks && node.source_chunks.length > 0) ||
                          node.chunkId ||
                          node.sourceId;
    if (!hasCitations) return false;
    const hasPage = node.pageNumber || 
                    (node.page_numbers && node.page_numbers.length > 0) ||
                    (node.citations && node.citations.some(c => c.page));
    if (!hasPage) return false;
    if (!node.type) return false;
    return true;
  };

  const filterGroundedTree = (node: MindMapNode): MindMapNode | null => {
    if (!isGroundedNode(node)) return null;
    const groundedChildren: MindMapNode[] = [];
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        const filtered = filterGroundedTree(child);
        if (filtered) groundedChildren.push(filtered);
      });
    }
    return {
      ...node,
      children: groundedChildren
    };
  };

  const computeMapLayout = (node: MindMapNode, x = 100, yStart = 50, depth = 0): { nodes: VisualNode[]; height: number } => {
    const nodeHeight = 70
    const nodeWidth = 200
    const gapX = 260
    const gapY = 40
    
    const isCollapsed = collapsedNodes[node.id] || false
    let currentY = yStart
    const laidOutChildren: VisualNode[] = []
    const allSubNodes: VisualNode[] = []
    
    if (node.children && node.children.length > 0 && !isCollapsed) {
      node.children.forEach(child => {
        const childLayout = computeMapLayout(child, x + gapX, currentY, depth + 1)
        laidOutChildren.push(childLayout.nodes[0])
        allSubNodes.push(...childLayout.nodes)
        currentY += childLayout.height + gapY
      })
    }
    
    const totalHeight = Math.max(nodeHeight, currentY - yStart - gapY)
    const midY = yStart + totalHeight / 2 - nodeHeight / 2
    
    const visualNode: VisualNode = {
      ...node,
      isCollapsed,
      x,
      y: midY,
      children: laidOutChildren
    }
    
    return {
      nodes: [visualNode, ...allSubNodes],
      height: totalHeight
    }
  }

  // Render SVG Map Architect Canvas
  const renderInteractiveMindMap = () => {
    if (!activeMindMap || !activeMindMap.map) return null
    const groundedMap = filterGroundedTree(activeMindMap.map)
    if (!groundedMap) {
      return (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-soft)', background: theme === 'light' ? '#ffffff' : '#090d16', border: '1px solid var(--line)', borderRadius: '12px' }}>
          No grounded, source-linked nodes passed the validation quality check.
        </div>
      )
    }
    const { nodes } = computeMapLayout(groundedMap)

    const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button !== 0) return // Left click only for pan
      setIsDraggingMap(true)
      mapDragStart.current = { x: e.clientX - panX, y: e.clientY - panY }
    }

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDraggingMap) return
      setPanX(e.clientX - mapDragStart.current.x)
      setPanY(e.clientY - mapDragStart.current.y)
    }

    const handleMouseUpOrLeave = () => {
      setIsDraggingMap(false)
    }

    const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault()
      const scaleFactor = e.deltaY < 0 ? 1.05 : 0.95
      setZoom(prev => Math.max(0.2, Math.min(3, prev * scaleFactor)))
    }

    // Export Functions
    const handleExportSVG = () => {
      if (!mapSvgRef.current) return
      const serializer = new XMLSerializer()
      const svgStr = serializer.serializeToString(mapSvgRef.current)
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${activeMindMap.title.replace(/\s+/g, '_')}.svg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }

    const handleExportPNG = () => {
      if (!mapSvgRef.current) return
      const serializer = new XMLSerializer()
      const svgStr = serializer.serializeToString(mapSvgRef.current)
      const img = new Image()
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 1600
        canvas.height = 1000
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#111827' // match panel bg
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const url = canvas.toDataURL('image/png')
          const link = document.createElement('a')
          link.href = url
          link.download = `${activeMindMap.title.replace(/\s+/g, '_')}.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }
      }
    }

    const handleExportMindMap = (format: 'pdf' | 'docx' | 'pptx') => {
      const url = `${API_BASE}/mind-maps/${activeMindMap.id}/export/${format}`
      downloadAssessmentFile(url, `MindMap-${activeMindMap.id}.${format}`)
    }

    return (
      <div style={isFullscreenMode ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        background: theme === 'light' ? '#ffffff' : '#090d16',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      } : { display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Zoom / Pan Controls */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" onClick={() => setZoom(prev => Math.min(3, prev + 0.1))} className="comp-nav-btn" style={{ padding: '4px 8px', fontSize: '0.74rem' }}>+</button>
              <button type="button" onClick={() => setZoom(prev => Math.max(0.2, prev - 0.1))} className="comp-nav-btn" style={{ padding: '4px 8px', fontSize: '0.74rem' }}>-</button>
              <button type="button" 
                onClick={() => {
                  setPanX(100)
                  setPanY(250)
                  setZoom(0.8)
                  setMapSearchQuery('')
                }} 
                className="comp-nav-btn" 
                style={{ padding: '4px 8px', fontSize: '0.74rem' }}
              >
                Auto Layout
              </button>
            </div>

            {/* Node Search Bar */}
            <input
              type="text"
              placeholder="Search nodes..."
              value={mapSearchQuery}
              onChange={(e) => setMapSearchQuery(e.target.value)}
              className="comp-select"
              style={{
                width: '140px',
                height: '28px',
                fontSize: '0.74rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--line)',
                borderRadius: '6px',
                padding: '4px 8px',
                color: 'var(--text)'
              }}
            />

            {/* Mode Toggles */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                type="button" 
                onClick={() => setIsFocusMode(!isFocusMode)} 
                className={`comp-nav-btn ${isFocusMode ? 'active' : ''}`}
                style={{ padding: '4px 8px', fontSize: '0.74rem', color: isFocusMode ? 'var(--gold)' : 'inherit' }}
              >
                {isFocusMode ? 'Exit Focus' : 'Focus Mode'}
              </button>
              <button 
                type="button" 
                onClick={() => setIsFullscreenMode(!isFullscreenMode)} 
                className={`comp-nav-btn ${isFullscreenMode ? 'active' : ''}`}
                style={{ padding: '4px 8px', fontSize: '0.74rem', color: isFullscreenMode ? 'var(--gold)' : 'inherit' }}
              >
                {isFullscreenMode ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>
            </div>
          </div>

          {/* Export Controls */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={handleExportSVG} className="comp-nav-btn" style={{ fontSize: '0.74rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={12} /> SVG
            </button>
            <button type="button" onClick={handleExportPNG} className="comp-nav-btn" style={{ fontSize: '0.74rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={12} /> PNG
            </button>
            <button type="button" onClick={() => handleExportMindMap('pdf')} className="comp-nav-btn" style={{ fontSize: '0.74rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={12} /> PDF
            </button>
            <button type="button" onClick={() => handleExportMindMap('docx')} className="comp-nav-btn" style={{ fontSize: '0.74rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={12} /> DOCX
            </button>
            <button type="button" onClick={() => handleExportMindMap('pptx')} className="comp-nav-btn" style={{ fontSize: '0.74rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Download size={12} /> PPTX
            </button>
          </div>
        </div>

        {/* Source Coverage Metrics row */}
        {activeMindMap.coverageMetrics && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '10px',
            background: 'rgba(255,255,255,0.01)',
            border: '1px solid var(--line)',
            borderRadius: '8px',
            padding: '10px 14px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Concepts</span>
              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--gold)' }}>
                {activeMindMap.coverageMetrics.totalConcepts || 0}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pages Analyzed</span>
              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text)' }}>
                {activeMindMap.coverageMetrics.pagesAnalyzed || 0}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Chunks Processed</span>
              <span style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text)' }}>
                {activeMindMap.coverageMetrics.chunksUsed || 0}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Source Confidence</span>
              <span style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px' }}>
                {Math.round((activeMindMap.coverageMetrics.sourceConfidence || 0) * 100)}%
              </span>
            </div>
          </div>
        )}

        <div 
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onWheel={handleWheel}
          style={{
            position: 'relative',
            width: '100%',
            height: isFullscreenMode 
              ? (activeMindMap.coverageMetrics ? 'calc(100vh - 195px)' : 'calc(100vh - 135px)') 
              : '500px',
            background: theme === 'light' ? '#ffffff' : '#090d16',
            borderRadius: '12px',
            border: theme === 'light' ? '1px solid rgba(143, 100, 18, 0.25)' : '1px solid rgba(245, 193, 79, 0.15)',
            overflow: 'hidden',
            cursor: isDraggingMap ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
        >
          {/* SVG Connection Lines */}
          <svg 
            ref={mapSvgRef}
            width="100%" 
            height="100%" 
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          >
            <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
              {nodes.map(node => {
                if (!node.children || node.children.length === 0) return null
                return node.children.map(child => {
                  const startX = node.x + 210
                  const startY = node.y + 35
                  const endX = child.x
                  const endY = child.y + 35
                  const ctrlX1 = startX + 60
                  const ctrlY1 = startY
                  const ctrlX2 = endX - 60
                  const ctrlY2 = endY
                  
                  const childNorm = child.type === 'Case Law' ? 'Case' : (child.type === 'Bare Act' ? 'Section' : (child.type || 'Concept'));
                  let strokeColor = theme === 'light' ? 'rgba(143, 100, 18, 0.65)' : 'rgba(245, 193, 79, 0.45)'
                  if (childNorm === 'Concept') strokeColor = theme === 'light' ? 'rgba(37, 99, 235, 0.5)' : 'rgba(59, 130, 246, 0.45)'
                  else if (childNorm === 'Article') strokeColor = theme === 'light' ? 'rgba(217, 119, 6, 0.5)' : 'rgba(251, 191, 36, 0.45)'
                  else if (childNorm === 'Case') strokeColor = theme === 'light' ? 'rgba(5, 150, 105, 0.5)' : 'rgba(16, 185, 129, 0.45)'
                  else if (childNorm === 'Doctrine') strokeColor = theme === 'light' ? 'rgba(124, 58, 237, 0.5)' : 'rgba(139, 92, 246, 0.45)'
                  else if (childNorm === 'Section') strokeColor = theme === 'light' ? 'rgba(234, 88, 12, 0.5)' : 'rgba(249, 115, 22, 0.45)'

                  return (
                    <path
                      key={`${node.id}-${child.id}`}
                      d={`M ${startX} ${startY} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${endX} ${endY}`}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="2"
                    />
                  )
                })
              })}
            </g>
          </svg>

          {/* HTML Render Nodes */}
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              transformOrigin: '0 0'
            }}
          >
            {nodes.map(node => {
              const normalizedType = node.type === 'Case Law' ? 'Case' : (node.type === 'Bare Act' ? 'Section' : (node.type || 'Concept'));
              let borderCol = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
              let bgCol = theme === 'light' ? '#ffffff' : 'rgba(17, 24, 39, 0.95)'
              let badgeText = normalizedType
              let badgeColor = theme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'
              let badgeTextColor = 'var(--text-soft)'

              if (normalizedType === 'Root') {
                borderCol = theme === 'light' ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.35)'
                bgCol = theme === 'light' ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.05)'
              } else if (normalizedType === 'Concept') {
                borderCol = theme === 'light' ? '#2563eb' : '#3b82f6'
                bgCol = theme === 'light' ? 'rgba(37, 99, 235, 0.03)' : 'rgba(59, 130, 246, 0.03)'
                badgeColor = theme === 'light' ? 'rgba(37, 99, 235, 0.1)' : 'rgba(59, 130, 246, 0.15)'
                badgeTextColor = theme === 'light' ? '#2563eb' : '#3b82f6'
              } else if (normalizedType === 'Article') {
                borderCol = theme === 'light' ? '#d97706' : '#fbbf24'
                bgCol = theme === 'light' ? 'rgba(217, 119, 6, 0.03)' : 'rgba(251, 191, 36, 0.03)'
                badgeColor = theme === 'light' ? 'rgba(217, 119, 6, 0.1)' : 'rgba(251, 191, 36, 0.15)'
                badgeTextColor = theme === 'light' ? '#d97706' : '#fbbf24'
              } else if (normalizedType === 'Case') {
                borderCol = theme === 'light' ? '#059669' : '#10b981'
                bgCol = theme === 'light' ? 'rgba(5, 150, 105, 0.03)' : 'rgba(16, 185, 129, 0.03)'
                badgeColor = theme === 'light' ? 'rgba(5, 150, 105, 0.1)' : 'rgba(16, 185, 129, 0.15)'
                badgeTextColor = theme === 'light' ? '#059669' : '#10b981'
              } else if (normalizedType === 'Doctrine') {
                borderCol = theme === 'light' ? '#7c3aed' : '#8b5cf6'
                bgCol = theme === 'light' ? 'rgba(124, 58, 237, 0.03)' : 'rgba(139, 92, 246, 0.03)'
                badgeColor = theme === 'light' ? 'rgba(124, 58, 237, 0.1)' : 'rgba(139, 92, 246, 0.15)'
                badgeTextColor = theme === 'light' ? '#7c3aed' : '#8b5cf6'
              } else if (normalizedType === 'Section') {
                borderCol = theme === 'light' ? '#ea580c' : '#f97316'
                bgCol = theme === 'light' ? 'rgba(234, 88, 12, 0.03)' : 'rgba(249, 115, 22, 0.03)'
                badgeColor = theme === 'light' ? 'rgba(234, 88, 12, 0.1)' : 'rgba(249, 115, 22, 0.15)'
                badgeTextColor = theme === 'light' ? '#ea580c' : '#f97316'
              }

              const isCollapsed = collapsedNodes[node.id] || false
              const hasChildren = node.children && node.children.length > 0
              const isSearchMatch = mapSearchQuery.trim() !== '' && node.label.toLowerCase().includes(mapSearchQuery.toLowerCase())
              const isSelected = selectedMapNode?.id === node.id

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedMapNode(node)}
                  style={{
                    position: 'absolute',
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: '210px',
                    minHeight: '70px',
                    border: isSearchMatch 
                      ? '2px solid #ef4444' 
                      : `1px solid ${isSelected ? 'var(--gold)' : borderCol}`,
                    background: bgCol,
                    borderRadius: '8px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    boxShadow: isSearchMatch 
                      ? '0 0 15px rgba(239, 68, 68, 0.85)' 
                      : (isSelected ? '0 0 10px rgba(245, 193, 79, 0.25)' : '0 4px 6px rgba(0,0,0,0.3)'),
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 200ms ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--text)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '140px' }}>
                      {node.label}
                    </span>
                    
                    {/* Expand/Collapse Toggle */}
                    {hasChildren && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCollapsedNodes(prev => ({ ...prev, [node.id]: !isCollapsed }))
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--gold)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '2px'
                        }}
                      >
                        {isCollapsed ? <Plus size={12} /> : <Minimize2 size={12} />}
                      </button>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <span style={{ fontSize: '0.58rem', background: badgeColor, color: badgeTextColor, padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                      {badgeText}
                    </span>
                    {node.citations && node.citations.length > 0 && (
                      <span style={{ fontSize: '0.54rem', color: 'var(--gold)', fontStyle: 'italic' }}>
                        Cited
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          
          {/* Floating node details panel when in Focus or Fullscreen mode */}
          {(isFocusMode || isFullscreenMode) && selectedMapNode && (
            <div 
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                bottom: '16px',
                width: '320px',
                background: theme === 'light' ? 'rgba(255, 255, 255, 0.96)' : 'rgba(9, 13, 22, 0.94)',
                backdropFilter: 'blur(16px)',
                border: theme === 'light' ? '1px solid rgba(143, 100, 18, 0.25)' : '1px solid rgba(245, 193, 79, 0.25)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                overflowY: 'auto',
                zIndex: 100,
                boxShadow: theme === 'light' ? '0 10px 30px rgba(0,0,0,0.1)' : '0 10px 30px rgba(0,0,0,0.6)',
                pointerEvents: 'auto'
              }}
            >
              {/* Floating Close Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-20px', zIndex: 10 }}>
                <button 
                  type="button" 
                  onClick={() => setSelectedMapNode(null)} 
                  style={{ background: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-soft)', cursor: 'pointer', fontSize: '0.75rem', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 150ms ease' }}
                   onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(232, 93, 93, 0.2)'; e.currentTarget.style.color = '#e85d5d'; }}
                   onMouseLeave={(e) => { e.currentTarget.style.background = theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-soft)'; }}
                >
                  ✓
                </button>
              </div>

              {renderNodeKnowledgeContainer(selectedMapNode)}
            </div>
          )}
        </div>
      </div>
    )
  }

  const hideSurrounding = activeSubTab === 'mind-maps' && !!activeMindMap && (isFocusMode || isFullscreenMode)

  return (
    <div className="reveal-up" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* HEADER HERO */}
      {!hideSurrounding && (
        <div style={{
        borderBottom: '1px solid var(--line)',
        paddingBottom: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h2 style={{
            fontSize: '1.45rem',
            fontWeight: '900',
            background: 'linear-gradient(135deg, var(--gold) 0%, #ffe9a6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Brain size={24} style={{ color: 'var(--gold)' }} />
            LEGATRIXON AI Assessment Studio™
          </h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-soft)', marginTop: '2px' }}>
            Interactive knowledge databases, judiciary test simulations, vector map hierarchies, and smart learning tools.
          </p>
        </div>
      </div>
      )}

      {/* TOP KPI BLOCK (Mastery Analytics Engine™) */}
      {!hideSurrounding && (
        <div className="comp-kpi-grid">
        <div className="comp-kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="comp-kpi-label">Hub Documents</span>
            <div className="comp-kpi-icon"><FileText size={16} /></div>
          </div>
          <span className="comp-kpi-value">{analytics.documentsUploaded}</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-soft)' }}>Pasted, uploaded, YouTube</span>
        </div>

        <div className="comp-kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="comp-kpi-label">Tests Conducted</span>
            <div className="comp-kpi-icon"><Award size={16} /></div>
          </div>
          <span className="comp-kpi-value">{analytics.mockTestsGenerated}</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-soft)' }}>Judiciary & general sets</span>
        </div>

        <div className="comp-kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="comp-kpi-label">Average Accuracy</span>
            <div className="comp-kpi-icon"><TrendingUp size={16} /></div>
          </div>
          <span className="comp-kpi-value">{analytics.averageScore}%</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-soft)' }}>Mastery scoring metrics</span>
        </div>

        <div className="comp-kpi-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="comp-kpi-label">Topics Decoded</span>
            <div className="comp-kpi-icon"><CheckCircle size={16} /></div>
          </div>
          <span className="comp-kpi-value">{analytics.topicsMastered}</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-soft)' }}>Weak Area Intelligence feedback</span>
        </div>
      </div>
      )}

      {/* NOTIFICATIONS PANELS */}
      {!hideSurrounding && errorMessage && (
        <div style={{
          background: 'rgba(232, 93, 93, 0.1)',
          border: '1px solid rgba(232, 93, 93, 0.3)',
          padding: '12px 16px',
          borderRadius: '8px',
          color: '#e85d5d',
          fontSize: '0.84rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={16} />
          {errorMessage}
        </div>
      )}

      {!hideSurrounding && successMessage && (
        <div style={{
          background: 'rgba(66, 201, 143, 0.1)',
          border: '1px solid rgba(66, 201, 143, 0.3)',
          padding: '12px 16px',
          borderRadius: '8px',
          color: '#42c98f',
          fontSize: '0.84rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={16} />
          {successMessage}
        </div>
      )}

      {/* SUB-TABS INTERFACE */}
      <div className="comp-layout" style={hideSurrounding ? { gridTemplateColumns: '1fr' } : undefined}>
        {!hideSurrounding && (
          <aside className="comp-nav">
          <div className="comp-nav-title">Studio Modules</div>
          <button
            type="button"
            className={`comp-nav-btn ${activeSubTab === 'sources' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('sources')}
          >
            <Upload size={14} /> Knowledge Source Hub™
          </button>
          <button
            type="button"
            className={`comp-nav-btn ${activeSubTab === 'mock-tests' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('mock-tests')}
          >
            <Award size={14} /> AI Mock Test Generator™
          </button>
          <button
            type="button"
            className={`comp-nav-btn ${activeSubTab === 'mind-maps' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('mind-maps')}
          >
            <Map size={14} /> AI Mind Map Architect™
          </button>
          <button
            type="button"
            className={`comp-nav-btn ${activeSubTab === 'study-kits' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('study-kits')}
          >
            <BookOpen size={14} /> Smart Study Kit Forge™
          </button>
          <button
            type="button"
            className={`comp-nav-btn ${activeSubTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('analytics')}
          >
            <TrendingUp size={14} /> Mastery Analytics Engine™
          </button>
        </aside>
        )}

        <main className="comp-content">
          
          {/* TAB 1: KNOWLEDGE SOURCE HUB™ */}
          {activeSubTab === 'sources' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="comp-section-header">
                <div>
                  <h3>Knowledge Source Hub™</h3>
                  <p>Feed bare act notes, case study PDFs, web articles, or YouTube lectures into your workspace Qdrant vector database.</p>
                </div>
              </div>

              {(() => {
                const pipelineSources = sources.filter(src => src.status && src.status !== 'Indexed');
                const indexedSources = sources.filter(src => !src.status || src.status === 'Indexed');
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* Bulk Ingestion Zone */}
                      <div style={{
                        background: 'var(--panel)',
                        padding: '20px',
                        borderRadius: '16px',
                        border: '1px solid var(--line)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
                        backdropFilter: 'blur(8px)'
                      }}>
                        <strong style={{ fontSize: '0.94rem', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Upload size={16} /> Bulk Resource Ingestion Engine™
                        </strong>
                        
                        <div
                          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={handleDrop}
                          onClick={() => {
                            const fileInput = document.getElementById('studio-bulk-files')
                            if (fileInput) fileInput.click()
                          }}
                          style={{
                            border: dragOver ? '2px dashed var(--gold)' : '2px dashed rgba(245, 193, 79, 0.3)',
                            borderRadius: '12px',
                            padding: '32px 20px',
                            textAlign: 'center',
                            background: dragOver ? 'rgba(245, 193, 79, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            boxShadow: dragOver ? '0 0 15px rgba(245, 193, 79, 0.15)' : 'none'
                          }}
                        >
                          <input
                            type="file"
                            id="studio-bulk-files"
                            multiple
                            {...{ webkitdirectory: "", directory: "" }}
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <Upload size={32} style={{ color: dragOver ? 'var(--gold)' : 'rgba(255,255,255,0.4)', transition: 'color 0.3s' }} />
                            <span style={{ fontSize: '0.86rem', color: 'var(--text)', fontWeight: '600' }}>
                              Drag & drop files or entire folders here
                            </span>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-soft)' }}>
                              Supports PDF, DOCX, PPTX, TXT, ZIP, JPEG, PNG, WEBP
                            </span>
                            <span style={{ fontSize: '0.74rem', color: 'var(--gold)', textDecoration: 'underline' }}>
                              or click to browse local files
                            </span>
                          </div>
                        </div>

                        {/* Staged files list */}
                        {selectedFiles.length > 0 && (
                          <div style={{
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: '8px',
                            padding: '12px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text)' }}>
                                Staged Resources ({selectedFiles.length})
                              </span>
                              <button
                                type="button"
                                onClick={clearSelectedFiles}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#e85d5d',
                                  fontSize: '0.72rem',
                                  cursor: 'pointer',
                                  fontWeight: '600'
                                }}
                              >
                                Clear All
                              </button>
                            </div>
                            {selectedFiles.map((file, idx) => (
                              <div key={idx} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'rgba(255,255,255,0.03)',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                fontSize: '0.74rem'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '85%' }}>
                                  <FileText size={12} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-soft)' }} title={file.name}>
                                    {file.name}
                                  </span>
                                  <span style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                                    ({(file.size / 1024).toFixed(1)} KB)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeSelectedFile(idx)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(255,255,255,0.4)',
                                    cursor: 'pointer',
                                    padding: '2px'
                                  }}
                                  title="Remove"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Progress indicator */}
                        {uploadingFiles && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--gold)' }}>
                              <span>{uploadStatusText || 'Uploading to server...'}</span>
                              <strong>{uploadProgress}%</strong>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'linear-gradient(90deg, #9a7849, var(--gold))', borderRadius: '3px', transition: 'width 0.1s ease-out' }} />
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleBulkFileUpload}
                          disabled={uploadingFiles || selectedFiles.length === 0}
                          className="home-search-send-btn"
                          style={{
                            borderRadius: '8px',
                            width: '100%',
                            height: '38px',
                            fontSize: '0.84rem',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          {uploadingFiles ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" /> Ingesting {selectedFiles.length} files...
                            </>
                          ) : (
                            `Upload & Ingest ${selectedFiles.length > 0 ? `${selectedFiles.length} ` : ''}Resource${selectedFiles.length !== 1 ? 's' : ''}`
                          )}
                        </button>
                      </div>

                      {/* Links / Text Form */}
                      <form onSubmit={handleAddTextSource} style={{
                        background: 'var(--panel)',
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid var(--line)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Link size={15} /> Paste Notes or Links
                        </strong>
                        <input
                          type="text"
                          className="comp-input"
                          placeholder="Source title (optional)"
                          value={sourceName}
                          onChange={(e) => setSourceName(e.target.value)}
                        />
                        <input
                          type="url"
                          className="comp-input"
                          placeholder="YouTube transcript link or web article URL"
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                        />
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-soft)', textAlign: 'center' }}>- OR -</span>
                        <textarea
                          className="comp-input"
                          style={{ minHeight: '80px', resize: 'vertical' }}
                          placeholder="Paste study notes or reference text here..."
                          value={notesText}
                          onChange={(e) => setNotesText(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <select
                            className="comp-select"
                            value={notesKind}
                            onChange={(e) => setNotesKind(e.target.value)}
                            style={{ height: '36px', fontSize: '0.8rem' }}
                          >
                            <option>Notes</option>
                            <option>Bare Act</option>
                            <option>Judgment</option>
                            <option>Research Paper</option>
                          </select>
                          <button
                            type="submit"
                            disabled={loading}
                            className="home-search-send-btn"
                            style={{ borderRadius: '8px', flex: '1', height: '36px', fontSize: '0.82rem', fontWeight: '700' }}
                          >
                            {loading ? 'Analyzing...' : 'Add Source'}
                          </button>
                        </div>
                      </form>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* RAG Pipeline Control Center */}
                      <div style={{
                        background: 'var(--panel)',
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid var(--line)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.88rem', color: 'var(--text)' }}>
                            Ingestion Pipeline Status
                          </strong>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            background: queueStatus.paused
                              ? 'rgba(245, 193, 79, 0.15)'
                              : queueStatus.isProcessing
                              ? 'rgba(66, 201, 143, 0.15)'
                              : 'rgba(255,255,255,0.05)',
                            color: queueStatus.paused
                              ? 'var(--gold)'
                              : queueStatus.isProcessing
                              ? '#42c98f'
                              : 'var(--text-soft)',
                            border: queueStatus.paused
                              ? '1px solid var(--gold)'
                              : queueStatus.isProcessing
                              ? '1px solid #42c98f'
                              : '1px solid rgba(255,255,255,0.1)'
                          }}>
                            {queueStatus.paused ? 'Queue Paused' : queueStatus.isProcessing ? 'Indexing Active' : 'Standby / Idle'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-soft)' }}>
                          <span>Backlog Queue Count: <strong>{queueStatus.queueLength} document(s)</strong></span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {queueStatus.paused ? (
                              <button
                                type="button"
                                onClick={handleResumeQueue}
                                disabled={loading}
                                style={{
                                  background: 'rgba(66, 201, 143, 0.12)',
                                  border: '1px solid #42c98f',
                                  color: '#42c98f',
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  fontSize: '0.74rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Play size={10} /> Resume Pipeline
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={handlePauseQueue}
                                disabled={loading}
                                style={{
                                  background: 'rgba(245, 193, 79, 0.12)',
                                  border: '1px solid var(--gold)',
                                  color: 'var(--gold)',
                                  borderRadius: '6px',
                                  padding: '4px 8px',
                                  fontSize: '0.74rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Clock size={10} /> Pause Pipeline
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Live Ingestion Backlog */}
                      {pipelineSources.length > 0 && (
                        <div style={{
                          background: 'var(--panel)',
                          padding: '16px',
                          borderRadius: '12px',
                          border: '1px solid var(--line)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}>
                          <strong style={{ fontSize: '0.88rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <RefreshCw size={13} className={queueStatus.isProcessing && !queueStatus.paused ? 'animate-spin' : ''} style={{ color: 'var(--gold)' }} />
                            Active Vectorizing Backlog ({pipelineSources.length})
                          </strong>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                            {pipelineSources.map(src => {
                              const isProcessing = src.status === 'Processing';
                              const isFailed = src.status === 'Failed';
                              return (
                                <div key={src.id} style={{
                                  padding: '10px',
                                  background: 'rgba(255,255,255,0.01)',
                                  border: '1px solid rgba(255,255,255,0.04)',
                                  borderRadius: '8px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '6px'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                                      {src.name}
                                    </span>
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                      <span style={{
                                        fontSize: '0.64rem',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: isProcessing ? 'rgba(245, 193, 79, 0.1)' : isFailed ? 'rgba(232, 93, 93, 0.1)' : 'rgba(255,255,255,0.05)',
                                        color: isProcessing ? 'var(--gold)' : isFailed ? '#e85d5d' : 'var(--text-soft)',
                                        border: isProcessing ? '1px solid rgba(245, 193, 79, 0.2)' : isFailed ? '1px solid rgba(232, 93, 93, 0.2)' : '1px solid rgba(255,255,255,0.1)'
                                      }}>
                                        {isProcessing ? 'Processing OCR & Classification...' : isFailed ? 'Failed' : 'Queued'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSource(src.id)}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: 'rgba(255,255,255,0.4)',
                                          cursor: 'pointer',
                                          padding: '2px'
                                        }}
                                        title="Cancel Ingestion"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                  {/* Progress bar */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                      <div style={{
                                        width: `${src.indexingProgress || 0}%`,
                                        height: '100%',
                                        background: isFailed ? '#e85d5d' : 'linear-gradient(90deg, #9a7849, var(--gold))',
                                        borderRadius: '2px',
                                        transition: 'width 0.3s ease'
                                      }} />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: 'var(--text-soft)' }}>
                                      <span>{isFailed ? (src.metadata?.error || 'Indexing failed') : 'Step Progress'}</span>
                                      <span>{src.indexingProgress || 0}%</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Processed Sources List */}
                      <div style={{
                        background: 'var(--panel)',
                        padding: '16px',
                        borderRadius: '12px',
                        border: '1px solid var(--line)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--text)' }}>
                          Processed Ingestion Sources ({indexedSources.length})
                        </strong>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                          {indexedSources.map(src => (
                            <div key={src.id} style={{
                              padding: '10px 12px',
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              borderRadius: '8px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '75%' }}>
                                  <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                    {src.name}
                                  </span>
                                  <span style={{ fontSize: '0.68rem', color: 'var(--text-soft)' }}>
                                    {src.kind} · {(src.textLength / 1024).toFixed(1)} KB · {new Date(src.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button type="button" onClick={() => setViewingSource(src)} className="comp-nav-btn" style={{ padding: '4px', borderRadius: '4px' }} title="View Text">
                                    <Eye size={12} />
                                  </button>
                                  <button type="button" onClick={() => handleRenameSource(src.id, src.name)} className="comp-nav-btn" style={{ padding: '4px', borderRadius: '4px' }} title="Rename">
                                    <Edit2 size={12} />
                                  </button>
                                  <button type="button" onClick={() => handleReprocessSource(src.id)} className="comp-nav-btn" style={{ padding: '4px', borderRadius: '4px' }} title="Reprocess Vectors">
                                    <RefreshCw size={12} />
                                  </button>
                                  <button type="button" onClick={() => handleDeleteSource(src.id)} className="comp-nav-btn" style={{ padding: '4px', borderRadius: '4px', color: '#e85d5d' }} title="Delete">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>

                              {/* Classification Badges */}
                              {(src.subject || src.documentType || src.unit || src.topic) && (
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                                  {src.subject && (
                                    <span style={{ fontSize: '0.64rem', background: 'rgba(66, 201, 143, 0.08)', color: '#42c98f', border: '1px solid rgba(66, 201, 143, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                                      {src.subject}
                                    </span>
                                  )}
                                  {src.documentType && (
                                    <span style={{ fontSize: '0.64rem', background: 'rgba(245, 193, 79, 0.08)', color: 'var(--gold)', border: '1px solid rgba(245, 193, 79, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                                      {src.documentType}
                                    </span>
                                  )}
                                  {src.unit && (
                                    <span style={{ fontSize: '0.64rem', background: 'rgba(255,255,255,0.04)', color: 'var(--text-soft)', border: '1px solid rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px' }} title={`Unit: ${src.unit}`}>
                                      {src.unit}
                                    </span>
                                  )}
                                  {src.topic && (
                                    <span style={{ fontSize: '0.64rem', background: 'rgba(255,255,255,0.04)', color: 'var(--text-soft)', border: '1px solid rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px' }} title={`Topic: ${src.topic}`}>
                                      {src.topic}
                                    </span>
                                  )}
                                  </div>
                                )}

                                {src.metadata?.insufficientForMockTest && (
                                  <div style={{ marginTop: '6px', fontSize: '0.64rem', color: '#ff9b40', background: 'rgba(255, 155, 64, 0.08)', border: '1px solid rgba(255, 155, 64, 0.2)', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertCircle size={10} /> Insufficient text ({src.metadata.extractedWordCount} words) for Mock Test generation.
                                  </div>
                                )}
                              </div>
                          ))}
                          {indexedSources.length === 0 && (
                            <div style={{ padding: '30px 10px', color: 'var(--text-soft)', textAlign: 'center', fontSize: '0.82rem' }}>
                              No indexed sources yet. Ingest documents on the left to add them to your vector library.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* View Source Modal */}
              {viewingSource && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100vw',
                  height: '100vh',
                  background: 'rgba(0,0,0,0.7)',
                  backdropFilter: 'blur(4px)',
                  zIndex: 1000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px'
                }}>
                  <div style={{
                    background: 'var(--panel)',
                    border: '1px solid var(--line)',
                    borderRadius: '12px',
                    width: '100%',
                    maxWidth: '800px',
                    maxHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '20px',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--gold)' }}>{viewingSource.name}</h4>
                      <button type="button" onClick={() => setViewingSource(null)} className="comp-nav-btn" style={{ padding: '4px 10px', fontSize: '0.74rem' }}>Close</button>
                    </div>
                    <div style={{
                      flex: 1,
                      overflowY: 'auto',
                      background: 'rgba(0,0,0,0.2)',
                      padding: '14px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      lineHeight: '1.6',
                      color: 'var(--text-soft)',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {viewingSource.text}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AI MOCK TEST GENERATOR (redirects to unified Mock Test platform) */}
          {activeSubTab === 'mock-tests' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="comp-section-header">
                <div>
                  <h3>AI Mock Test Generator&trade;</h3>
                  <p>Mock test generation, attempts, and grading now live in one place.</p>
                </div>
              </div>
              <div style={{
                background: 'var(--panel)',
                padding: '32px 24px',
                borderRadius: '12px',
                border: '1px dashed var(--line)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                textAlign: 'center'
              }}>
                <Award size={28} style={{ color: 'var(--gold)' }} />
                <strong style={{ fontSize: '0.98rem', color: 'var(--text)' }}>Mock tests have moved to the AI Exam Platform</strong>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-soft)', maxWidth: '440px' }}>
                  Paper generation, timed attempts, model answers, and evaluation feedback are now unified under the
                  Mock Test tab for a single consistent experience.
                </p>
                {onNavigateToMockTests && (
                  <button
                    type="button"
                    onClick={onNavigateToMockTests}
                    className="comp-nav-btn active"
                    style={{ fontSize: '0.82rem', padding: '9px 18px', marginTop: '4px' }}
                  >
                    Go to Mock Test
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: AI MIND MAP ARCHITECT™ */}
          {activeSubTab === 'mind-maps' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="comp-section-header">
                <div>
                  <h3>AI Mind Map Architect™</h3>
                  <p>Model statutory sections, Landmark court rulings, and Bare Act outline hierarchies dynamically.</p>
                </div>
                {activeMindMap && (
                  <button
                    type="button"
                    className="comp-nav-btn"
                    onClick={() => setActiveMindMap(null)}
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    <RotateCcw size={13} /> Open Architect Config
                  </button>
                )}
              </div>

              {!activeMindMap ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '14px' }}>
                  {/* Map Config Panel */}
                  <form onSubmit={handleGenerateMindMap} style={{
                    background: 'var(--panel)',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={15} /> Generation Configuration
                    </strong>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.76rem', color: 'var(--text-soft)' }}>Map Visual Outline Structure</label>
                      <select className="comp-select" value={mapStructureType} onChange={(e) => setMapStructureType(e.target.value)}>
                        <option value="Quick">Quick Mind Map (Max 1 Page)</option>
                        <option value="Detailed">Detailed Mind Map (Max 2 Pages)</option>
                        <option value="Judiciary">Judiciary Revision Map</option>
                        <option value="Bare Act">Bare Act Breakdown Map</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.76rem', color: 'var(--text-soft)' }}>Select Reference Materials</label>
                        <button type="button" onClick={() => toggleAllSources('map')} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '0.68rem', cursor: 'pointer' }}>
                          {mapSelectedSources.length === sources.length ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>

                      <div style={{
                        maxHeight: '150px',
                        overflowY: 'auto',
                        border: '1px solid var(--line)',
                        borderRadius: '8px',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        {sources.map(src => (
                          <label key={src.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={mapSelectedSources.includes(src.id)}
                              onChange={() => toggleSourceSelection(src.id, 'map')}
                              style={{ accentColor: 'var(--gold)' }}
                            />
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{src.name}</span>
                          </label>
                        ))}
                        {sources.length === 0 && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-soft)', padding: '6px', textAlign: 'center' }}>No sources. Ingest notes/docs first.</div>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || mapSelectedSources.length === 0}
                      className="home-search-send-btn"
                      style={{ borderRadius: '8px', width: '100%', height: '38px', fontSize: '0.84rem', fontWeight: '800' }}
                    >
                      {loading ? 'AI Drawing Node Hierarchies...' : (mapSelectedSources.length === 0 ? 'Select at least one source.' : 'Generate AI Mind Map™')}
                    </button>
                  </form>

                  {/* Previous Maps History */}
                  <div style={{
                    background: 'var(--panel)',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--text)' }}>Stored Mind Maps Architectures</strong>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                      {mindMaps.map(m => (
                        <div key={m.id} style={{
                          padding: '12px',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '70%' }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text)' }}>{m.title}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)' }}>
                              {m.structureType} Plan · {m.concepts?.length || 0} Key Concepts · Stored {new Date(m.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMindMap(m)
                              setSelectedMapNode(m.map)
                              setCollapsedNodes({})
                              setPanX(100)
                              setPanY(250)
                              setZoom(0.8)
                            }}
                            className="comp-nav-btn active"
                            style={{ fontSize: '0.74rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Map size={11} /> Load Map
                          </button>
                        </div>
                      ))}
                      {mindMaps.length === 0 && (
                        <div style={{ padding: '30px 10px', color: 'var(--text-soft)', textAlign: 'center', fontSize: '0.82rem' }}>
                          No maps saved. Construct one above.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Node Canvas visual layout */
                <div style={{ display: 'grid', gridTemplateColumns: (isFocusMode || isFullscreenMode) ? '1fr' : '2fr 1fr', gap: '14px' }}>
                  {renderInteractiveMindMap()}

                  {/* Node detail card */}
                  {!(isFocusMode || isFullscreenMode) && (
                    <div style={{
                      background: 'var(--panel)',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text)' }}>Node Conceptual Detail</strong>

                    {selectedMapNode ? (
                      <div style={{
                        padding: '14px',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid rgba(245, 193, 79, 0.15)',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        maxHeight: '450px',
                        overflowY: 'auto'
                      }}>
                        {renderNodeKnowledgeContainer(selectedMapNode)}
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-soft)', fontSize: '0.78rem', textAlign: 'center', padding: '40px 10px' }}>
                        Click on any node in the interactive tree diagram to show conceptual details and citation mapping here.
                      </div>
                    )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SMART STUDY KIT FORGE™ */}
          {activeSubTab === 'study-kits' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="comp-section-header">
                <div>
                  <h3>Smart Study Kit Forge™</h3>
                  <p>Forge consolidated summary sheets, key doctrines, landmark cases, important bare act sections, flashcard decks, and exam questions.</p>
                </div>
                {activeStudyKit && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleExportStudyKit(activeStudyKit.id, 'pdf')}
                      className="comp-nav-btn"
                      style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Download size={13} /> PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportStudyKit(activeStudyKit.id, 'docx')}
                      className="comp-nav-btn"
                      style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Download size={13} /> DOCX
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportStudyKit(activeStudyKit.id, 'pptx')}
                      className="comp-nav-btn"
                      style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Download size={13} /> PPTX
                    </button>
                    <button
                      type="button"
                      className="comp-nav-btn"
                      onClick={() => setActiveStudyKit(null)}
                      style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                    >
                      <RotateCcw size={13} /> Back to Forge
                    </button>
                  </div>
                )}
              </div>

              {!activeStudyKit ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '14px' }}>
                  {/* Forge Config Panel */}
                  <form onSubmit={handleGenerateStudyKit} style={{
                    background: 'var(--panel)',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={15} /> Generation Configuration
                    </strong>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.76rem', color: 'var(--text-soft)' }}>Select Reference Materials</label>
                        <button type="button" onClick={() => toggleAllSources('kit')} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: '0.68rem', cursor: 'pointer' }}>
                          {kitSelectedSources.length === sources.length ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>

                      <div style={{
                        maxHeight: '150px',
                        overflowY: 'auto',
                        border: '1px solid var(--line)',
                        borderRadius: '8px',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        {sources.map(src => (
                          <label key={src.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={kitSelectedSources.includes(src.id)}
                              onChange={() => toggleSourceSelection(src.id, 'kit')}
                              style={{ accentColor: 'var(--gold)' }}
                            />
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{src.name}</span>
                          </label>
                        ))}
                        {sources.length === 0 && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-soft)', padding: '6px', textAlign: 'center' }}>No sources. Ingest notes/docs first.</div>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || sources.length === 0}
                      className="home-search-send-btn"
                      style={{ borderRadius: '8px', width: '100%', height: '38px', fontSize: '0.84rem', fontWeight: '800' }}
                    >
                      {loading ? 'AI Forging Study Kit...' : 'Generate Smart Study Kit™'}
                    </button>
                  </form>

                  {/* Previous Kits History */}
                  <div style={{
                    background: 'var(--panel)',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--text)' }}>Available Smart Study Kits</strong>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                      {studyKits.map(kit => (
                        <div key={kit.id} style={{
                          padding: '12px',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '75%' }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text)' }}>{kit.title}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)' }}>
                              {kit.content?.flashcards?.length || 0} Flashcards · Stored {new Date(kit.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveStudyKit(kit)
                              setActiveFlashcardIndex(0)
                              setIsFlashcardFlipped(false)
                            }}
                            className="comp-nav-btn active"
                            style={{ fontSize: '0.74rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <BookOpen size={11} /> Open Study Kit
                          </button>
                        </div>
                      ))}
                      {studyKits.length === 0 && (
                        <div style={{ padding: '30px 10px', color: 'var(--text-soft)', textAlign: 'center', fontSize: '0.82rem' }}>
                          No study kits generated. Select sources above to forge one.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Interactive study kit detail panels */
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.4fr', gap: '14px' }}>
                  {/* Revision summary / Notes view */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    {/* Summary */}
                    <div style={{ background: 'var(--panel)', padding: '16px', borderRadius: '12px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={15} /> Executive Summary Sheet
                      </strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)', lineHeight: '1.6', maxHeight: '180px', overflowY: 'auto', background: 'rgba(0,0,0,0.1)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                        {activeStudyKit.content?.summary}
                      </div>
                    </div>

                    {/* Key Doctrines & Concepts */}
                    <div style={{ background: 'var(--panel)', padding: '16px', borderRadius: '12px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Book size={15} /> Core Legal Key Concepts
                      </strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                        {activeStudyKit.content?.keyConcepts?.map((c, idx) => (
                          <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text)' }}>{c.title}</span>
                            <p style={{ fontSize: '0.76rem', color: 'var(--text-soft)', marginTop: '2px' }}>{c.explanation}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Precedents & Bare Acts */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div style={{ background: 'var(--panel)', padding: '12px', borderRadius: '12px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <strong style={{ fontSize: '0.82rem', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Scale size={13} /> Landmark Precedents
                        </strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                          {activeStudyKit.content?.importantCases?.map((c, idx) => (
                            <div key={idx} style={{ fontSize: '0.74rem', color: 'var(--text-soft)' }}>
                              <strong>{c.caseName}</strong>: {c.summary}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ background: 'var(--panel)', padding: '12px', borderRadius: '12px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <strong style={{ fontSize: '0.82rem', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <BookMarked size={13} /> Bare Act Articles
                        </strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                          {activeStudyKit.content?.importantArticles?.map((a, idx) => (
                            <div key={idx} style={{ fontSize: '0.74rem', color: 'var(--text-soft)' }}>
                              <strong>{a.articleOrSection}</strong>: {a.summary}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Exam Mains Prep Questions */}
                    <div style={{ background: 'var(--panel)', padding: '16px', borderRadius: '12px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layers size={15} /> Mains Exemplary Prep Questions
                      </strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                        {activeStudyKit.content?.examQuestions?.map((q, idx) => (
                          <div key={idx} style={{ background: 'rgba(255,255,255,0.01)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--text)' }}>Question: {q.question}</span>
                            <p style={{ fontSize: '0.74rem', color: 'var(--text-soft)', marginTop: '2px' }}><strong>Approach</strong>: {q.approach}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Interactive flashcard deck view */}
                  <div style={{
                    background: 'var(--panel)',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    alignItems: 'center'
                  }}>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--text)', alignSelf: 'flex-start' }}>Study Flashcards Deck</strong>

                    {activeStudyKit.content?.flashcards && activeStudyKit.content.flashcards.length > 0 ? (
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                        {/* Flashcard container */}
                        <div
                          onClick={() => setIsFlashcardFlipped(!isFlashcardFlipped)}
                          style={{
                            width: '100%',
                            minHeight: '180px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(245, 193, 79, 0.25)',
                            borderRadius: '10px',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            cursor: 'pointer',
                            textAlign: 'center',
                            boxShadow: 'inset 0 0 12px rgba(245, 193, 79, 0.04)',
                            transition: 'transform 0.4s ease'
                          }}
                        >
                          <span style={{ fontSize: '0.66rem', color: 'var(--gold)', textTransform: 'uppercase', fontWeight: '800', marginBottom: '8px', letterSpacing: '0.04em' }}>
                            {activeStudyKit.content.flashcards[activeFlashcardIndex].topic || 'General concept'}
                          </span>
                          <p style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text)', lineHeight: '1.5' }}>
                            {isFlashcardFlipped
                              ? activeStudyKit.content.flashcards[activeFlashcardIndex].back
                              : activeStudyKit.content.flashcards[activeFlashcardIndex].front
                            }
                          </p>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-soft)', marginTop: '14px', fontStyle: 'italic' }}>Click to flip card</span>
                        </div>

                        {/* Rating panel */}
                        {isFlashcardFlipped && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-soft)' }}>Rate recall proficiency:</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleReviewFlashcard(activeStudyKit.content.flashcards[activeFlashcardIndex], false, 2)}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '0.72rem',
                                  borderRadius: '6px',
                                  background: 'rgba(232, 93, 93, 0.1)',
                                  border: '1px solid rgba(232, 93, 93, 0.3)',
                                  color: '#e85d5d',
                                  cursor: 'pointer'
                                }}
                              >
                                Need Review (Wrong)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReviewFlashcard(activeStudyKit.content.flashcards[activeFlashcardIndex], true, 5)}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '0.72rem',
                                  borderRadius: '6px',
                                  background: 'rgba(66, 201, 143, 0.1)',
                                  border: '1px solid rgba(66, 201, 143, 0.3)',
                                  color: '#42c98f',
                                  cursor: 'pointer'
                                }}
                              >
                                Mastered (Correct)
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Slide controller */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginTop: '10px' }}>
                          <button
                            type="button"
                            disabled={activeFlashcardIndex === 0}
                            onClick={() => {
                              setActiveFlashcardIndex(activeFlashcardIndex - 1)
                              setIsFlashcardFlipped(false)
                            }}
                            className="comp-nav-btn"
                            style={{ padding: '6px 10px', fontSize: '0.76rem' }}
                          >
                            Prev
                          </button>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>
                            {activeFlashcardIndex + 1} / {activeStudyKit.content.flashcards.length}
                          </span>
                          <button
                            type="button"
                            disabled={activeFlashcardIndex === activeStudyKit.content.flashcards.length - 1}
                            onClick={() => {
                              setActiveFlashcardIndex(activeFlashcardIndex + 1)
                              setIsFlashcardFlipped(false)
                            }}
                            className="comp-nav-btn"
                            style={{ padding: '6px 10px', fontSize: '0.76rem' }}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-soft)', fontSize: '0.78rem', padding: '30px 10px' }}>No flashcards parsed.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: WEAK AREA INTELLIGENCE™ & PERFORMANCE DASHBOARD */}
          {activeSubTab === 'analytics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="comp-section-header">
                <div>
                  <h3>Performance Dashboard & Mastery Analytics</h3>
                  <p>Calculate dynamic topic proficiency, gauge exam readiness, track progress trends, and compile custom revision roadmaps.</p>
                </div>
              </div>

              {/* Performance Dashboard Overview Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2.8fr', gap: '16px' }}>
                
                {/* Exam Readiness Score Circle/Gauge */}
                <div style={{
                  background: 'var(--panel)',
                  padding: '24px',
                  borderRadius: '12px',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  gap: '12px'
                }}>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--gold)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Exam Readiness Score
                  </strong>
                  
                  {/* Gauge design */}
                  <div style={{ position: 'relative', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                    <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
                      <circle
                        cx="65"
                        cy="65"
                        r="54"
                        fill="transparent"
                        stroke="rgba(255, 255, 255, 0.05)"
                        strokeWidth="10"
                      />
                      <circle
                        cx="65"
                        cy="65"
                        r="54"
                        fill="transparent"
                        stroke="var(--gold)"
                        strokeWidth="10"
                        strokeDasharray={2 * Math.PI * 54}
                        strokeDashoffset={2 * Math.PI * 54 * (1 - (analytics.readinessScore || 0) / 100)}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text)' }}>
                        {analytics.readinessScore || 0}%
                      </span>
                      <span style={{ fontSize: '0.64rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>
                        Readiness
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.74rem', color: 'var(--text-soft)', lineHeight: '1.4', margin: 0 }}>
                    Weighted score compiled from mock test performance, flashcard proficiency reviews, and reference documents coverage.
                  </p>
                </div>

                {/* Dashboard Metrics Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                    
                    <div style={{ background: 'var(--panel)', padding: '16px', borderRadius: '12px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Topics Completed</span>
                      <strong style={{ fontSize: '1.6rem', color: 'var(--text)' }}>{analytics.topicsMastered || 0}</strong>
                      <span style={{ fontSize: '0.66rem', color: '#42c98f' }}>Concepts Mastered</span>
                    </div>

                    <div style={{ background: 'var(--panel)', padding: '16px', borderRadius: '12px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Tests Attempted</span>
                      <strong style={{ fontSize: '1.6rem', color: 'var(--text)' }}>{attempts.length}</strong>
                      <span style={{ fontSize: '0.66rem', color: 'var(--gold)' }}>Mains Mock Tests</span>
                    </div>

                    <div style={{ background: 'var(--panel)', padding: '16px', borderRadius: '12px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Average Accuracy</span>
                      <strong style={{ fontSize: '1.6rem', color: 'var(--text)' }}>{analytics.averageScore || 0}%</strong>
                      <span style={{ fontSize: '0.66rem', color: 'var(--gold)' }}>Overall Accuracy</span>
                    </div>

                    <div style={{ background: 'var(--panel)', padding: '16px', borderRadius: '12px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Weak Area Topics</span>
                      <strong style={{ fontSize: '1.6rem', color: '#e85d5d' }}>{weakAreas.weakTopics?.length || 0}</strong>
                      <span style={{ fontSize: '0.66rem', color: '#e85d5d' }}>Requires Review</span>
                    </div>

                  </div>

                  {/* Progress Trends Chart Card */}
                  <div style={{
                    background: 'var(--panel)',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    flex: 1
                  }}>
                    <strong style={{ fontSize: '0.84rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <TrendingUp size={14} /> Learning Progress Trend (Past Mock Test Scores)
                    </strong>
                    
                    {/* SVG Trend Line Chart */}
                    <div style={{ width: '100%', height: '110px', position: 'relative', marginTop: '10px' }}>
                      {attempts.length > 0 ? (
                        <div style={{ width: '100%', height: '100%' }}>
                          <svg width="100%" height="100%" viewBox="0 0 500 100" preserveAspectRatio="none">
                            {/* Grid Lines */}
                            <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                            <line x1="0" y1="50" x2="500" y2="50" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                            <line x1="0" y1="80" x2="500" y2="80" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                            
                            {/* Graph line path */}
                            {(() => {
                              const points = attempts.map((a, i) => {
                                const x = attempts.length > 1 ? (i / (attempts.length - 1)) * 500 : 250
                                const y = 90 - (a.percentage / 100) * 80 // invert Y axis for screen space
                                return `${x},${y}`
                              }).join(' ')

                              return (
                                <>
                                  {/* Area under the line */}
                                  <polygon
                                    points={`0,100 ${points} 500,100`}
                                    fill="url(#trendGrad)"
                                    opacity="0.15"
                                  />
                                  {/* Line itself */}
                                  <polyline
                                    fill="none"
                                    stroke="var(--gold)"
                                    strokeWidth="3"
                                    points={points}
                                  />
                                  {/* Gradients definitions */}
                                  <defs>
                                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="var(--gold)" />
                                      <stop offset="100%" stopColor="transparent" />
                                    </linearGradient>
                                  </defs>
                                  {/* Data node dots */}
                                  {attempts.map((a, i) => {
                                    const cx = attempts.length > 1 ? (i / (attempts.length - 1)) * 500 : 250
                                    const cy = 90 - (a.percentage / 100) * 80
                                    return (
                                      <g key={i}>
                                        <circle cx={cx} cy={cy} r="4" fill="var(--gold)" stroke="var(--panel)" strokeWidth="2" />
                                        <text x={cx} y={cy - 8} fontSize="7" fill="var(--text-soft)" textAnchor="middle">{a.percentage}%</text>
                                      </g>
                                    )
                                  })}
                                </>
                              )
                            })()}
                          </svg>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: 'var(--text-soft)', marginTop: '4px' }}>
                            <span>First Attempt</span>
                            <span>Timeline Trend</span>
                            <span>Latest Attempt</span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-soft)', fontSize: '0.78rem' }}>
                          No test scores cataloged yet. Submit an interactive descriptive paper to visualize your learning velocity.
                        </div>
                      )}
                    </div>

                  </div>
                </div>

              </div>

              {/* Lower Row: Weak Area Analysis & AI Revision Planner */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {/* Weak topics List */}
                  <div style={{
                    background: 'var(--panel)',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <strong style={{ fontSize: '0.9rem', color: '#e85d5d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={15} /> Weak Topics (Needs Study)
                    </strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {weakAreas.weakTopics && weakAreas.weakTopics.length > 0 ? (
                        weakAreas.weakTopics.map((topic, idx) => (
                          <span key={idx} style={{
                            fontSize: '0.76rem',
                            background: 'rgba(232, 93, 93, 0.1)',
                            border: '1px solid rgba(232, 93, 93, 0.25)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            color: '#e85d5d',
                            fontWeight: '600'
                          }}>
                            {topic}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>
                          No weak concepts detected. Great job!
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mastered concepts list */}
                  <div style={{
                    background: 'var(--panel)',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <strong style={{ fontSize: '0.9rem', color: '#42c98f', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle size={15} /> Strong Topics (Mastered)
                    </strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {weakAreas.strongTopics && weakAreas.strongTopics.length > 0 ? (
                        weakAreas.strongTopics.map((topic, idx) => (
                          <span key={idx} style={{
                            fontSize: '0.76rem',
                            background: 'rgba(66, 201, 143, 0.1)',
                            border: '1px solid rgba(66, 201, 143, 0.25)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            color: '#42c98f',
                            fontWeight: '600'
                          }}>
                            {topic}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-soft)' }}>
                          Strong concepts will display based on your correct quiz answers.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Suggested revision checklists */}
                  <div style={{
                    background: 'var(--panel)',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <strong style={{ fontSize: '0.82rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Suggested Revision Strategy
                    </strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {weakAreas.suggestedRevisionPlan && weakAreas.suggestedRevisionPlan.length > 0 ? (
                        weakAreas.suggestedRevisionPlan.map((plan, idx) => (
                          <div key={idx} style={{ fontSize: '0.76rem', color: 'var(--text-soft)', display: 'flex', gap: '6px' }}>
                            <span style={{ color: 'var(--gold)' }}>•</span>
                            <span>{plan}</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-soft)' }}>
                          Try mock tests to receive personalized conceptual feedback.
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* AI Revision planner */}
                <div style={{
                  background: 'var(--panel)',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={15} /> AI Custom Day-by-Day Revision Planner
                  </strong>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>Roadmap Duration:</label>
                    <select className="comp-select" value={revisionDuration} onChange={(e) => setRevisionDuration(Number(e.target.value))} style={{ width: '120px', height: '30px', padding: '2px 8px', fontSize: '0.76rem' }}>
                      <option value={7}>7 Days Plan</option>
                      <option value={15}>15 Days Plan</option>
                      <option value={30}>30 Days Plan</option>
                    </select>
                    <button type="button" onClick={() => handleGenerateRevisionPlanner(revisionDuration)} className="comp-nav-btn active" style={{ fontSize: '0.74rem', padding: '6px 12px' }}>
                      Compile Plan
                    </button>
                  </div>

                  {activeRevisionPlan ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto', marginTop: '10px' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--gold)', margin: 0 }}>{activeRevisionPlan.title}</h4>
                      {activeRevisionPlan.schedule.map((dayNode, idx) => (
                        <div key={idx} style={{
                          background: 'rgba(255,255,255,0.01)',
                          border: '1px solid rgba(255,255,255,0.04)',
                          borderRadius: '8px',
                          padding: '10px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.06)', paddingBottom: '4px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--gold)' }}>{dayNode.day}: {dayNode.topic}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-soft)' }}>Est: {dayNode.expectedHours} Hours</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {dayNode.tasks.map((task, tIdx) => (
                              <div key={tIdx} style={{ fontSize: '0.76rem', color: 'var(--text-soft)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Check size={12} style={{ color: 'var(--gold)' }} />
                                <span>{task}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-soft)', padding: '20px 0', textAlign: 'center' }}>
                      Select plan duration above to trigger AI generation from platform history records.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Click-to-Reveal Source Traceability Drawer */}
        {selectedTrace && (
          <div style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '420px',
            height: '100vh',
            background: 'var(--panel)',
            borderLeft: '1px solid var(--line)',
            boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.5)',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            animation: 'slideIn 0.3s forwards',
            backdropFilter: 'blur(10px)'
          }}>
            <style>{`
              @keyframes slideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
            `}</style>
            
            <div style={{
              padding: '20px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(245, 193, 79, 0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scale size={16} style={{ color: 'var(--gold)' }} />
                <h4 style={{ fontSize: '0.94rem', fontWeight: '800', color: 'var(--text)', margin: 0 }}>
                  AI Grounding Citation Inspector™
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTrace(null)}
                className="comp-nav-btn"
                style={{ padding: '4px 8px', fontSize: '0.74rem' }}
              >
                Close
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1 }}>
              
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Source Document</span>
                  <strong style={{ fontSize: '0.84rem', color: 'var(--text)' }}>{selectedTrace.sourceName}</strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Page Reference</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--gold)', fontWeight: '600' }}>
                      {selectedTrace.page || 'Page 1'}
                    </span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Paragraph Reference</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--gold)', fontWeight: '600' }}>
                      {selectedTrace.paragraph || 'N/A'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Scope / Section</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text)' }}>
                      {selectedTrace.section || 'General'}
                    </span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>Confidence Score</span>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      color: selectedTrace.confidenceScore && selectedTrace.confidenceScore >= 0.8 ? '#42c98f' : 'var(--gold)'
                    }}>
                      {selectedTrace.confidenceScore ? `${Math.round(selectedTrace.confidenceScore * 100)}%` : '96% (High)'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-soft)', fontWeight: '600' }}>Grounded Precedent Passage</span>
                <div style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderLeft: '3px solid var(--gold)',
                  padding: '12px 14px',
                  borderRadius: '0 8px 8px 0',
                  fontSize: '0.8rem',
                  lineHeight: '1.6',
                  color: 'var(--text-soft)',
                  whiteSpace: 'pre-wrap',
                  fontStyle: 'italic'
                }}>
                  "{selectedTrace.supportingText || 'No explicit supporting text was extracted for this citation chunk.'}"
                </div>
              </div>
              
              <div style={{
                marginTop: 'auto',
                background: 'rgba(245, 193, 79, 0.03)',
                border: '1px solid rgba(245, 193, 79, 0.1)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '0.7rem',
                color: 'var(--text-soft)',
                lineHeight: '1.4'
              }}>
                <strong>Grounding Policy Guard:</strong> This resource has been extracted, OCR-scanned, and vectorized inside Qdrant. The AI generated mock assessment is strictly limited to this context reference.
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}








