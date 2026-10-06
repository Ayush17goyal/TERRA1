import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Sparkles, BookOpen, FileText, CheckCircle2, AlertCircle, Clock,
  ArrowLeft, Award, RotateCcw, UploadCloud, Trash2, Eye, Play,
  Layers, FileCheck, RefreshCw, BookmarkCheck, FileUp, BrainCircuit,
  CheckSquare, Square, Plus, Minus, Settings2, Target, Check, Sliders, Save, ChevronRight, ChevronDown
} from 'lucide-react'
import { API_BASE_URL } from '../lib/api'
import { DemoUsageBadge } from '../components/DemoUsageBadge'

interface Props { apiToken?: string; theme?: 'dark' | 'light' }

interface SectionConfig {
  id: string; name: string; questionsGenerated: number; questionsToAttempt: number
  marksPerQuestion: number; questionTypes: string[]; isCompulsory: boolean
}

const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'secA', name: 'Section A', questionsGenerated: 5, questionsToAttempt: 4, marksPerQuestion: 5, questionTypes: ['Descriptive'], isCompulsory: false },
  { id: 'secB', name: 'Section B', questionsGenerated: 3, questionsToAttempt: 2, marksPerQuestion: 10, questionTypes: ['Long Answer'], isCompulsory: false },
  { id: 'secC', name: 'Section C', questionsGenerated: 1, questionsToAttempt: 1, marksPerQuestion: 15, questionTypes: ['Case Based'], isCompulsory: true },
]

const QUESTION_TYPE_OPTIONS = ['Descriptive','Short Answer','Long Answer','Case Based','MCQ','Multiple-Select','True/False']

const PROMPT_PRESETS = [
  { label: '50-Q Constitutional Law', prompt: 'Create a 50-question Constitutional Law mock test with 40 MCQs and 10 short answer questions, 90 minutes duration, with negative marking.' },
  { label: 'Judiciary Prelims (MCQs)', prompt: 'Create a 30-question Judiciary Prelims style MCQ mock test with negative marking (0.25 rate), covering statutory provisions and case law.' },
  { label: 'CLAT Style Mock', prompt: 'Generate a 25-question CLAT-style test with passage and case-based MCQs, 4 options each, testing analytical reasoning.' },
  { label: 'Criminal Law & BNS 2023', prompt: 'Generate a difficult Criminal Law test covering Bharatiya Nyaya Sanhita 2023, comparing with erstwhile IPC provisions.' },
  { label: 'Mains: Descriptive Only', prompt: 'Create a purely descriptive / long-answer mains style paper with no MCQs, graded by rubric.' },
  { label: 'Replicate Reference Paper', prompt: 'Analyze the selected reference question paper and reproduce its exact section structure, question types, and marking scheme.' },
]

export interface LearningSource { id:string; name:string; kind:string; subject?:string; status:string; indexingProgress?:number; textLength?:number; createdAt:string; metadata?:any }
export interface QuestionCitation { sourceName:string; section?:string; chapter?:string; page?:string|number; supportingText?:string }
export interface MockQuestion { id:string; type:string; topic:string; question:string; questionText?:string; options?:string[]; correct?:number; correctAnswer?:string; marks:number; negativeMarks?:number; difficulty?:string; legalRef?:string; explanation?:string; modelAnswer?:string; expectedAnswerLength?:string; citations?:QuestionCitation[]; sectionName?:string }
export interface MockTest { id:string; userId:string; topic:string; difficulty:string; questionType:string; questionCount:number; mode:string; sourceIds:string[]; questions:MockQuestion[]; scoreReport?:{examTitle?:string;subjectTopic?:string;totalMarks?:number;durationMinutes?:number;negativeMarkingRate?:number;instructions?:string[];sections?:any[];extractionWarning?:string}; createdAt:string }
export interface QuestionEvaluation { questionId:string; questionNumber:number; questionText:string; type:string; topic:string; marks:number; awardedMarks:number; isCorrect:boolean|null; result:string; userAnswer:string; correctAnswer:string; explanation:string; legalRef?:string; rubricBreakdown?:{legalAccuracy:number;issueIdentification:number;reasoningAnalysis:number;useOfAuthorities:number;structureClarity:number}; keyStrengths?:string[]; missingPoints?:string[]; suggestedImprovement?:string; modelAnswer?:string }
export interface MockTestAttempt { id:string; userId:string; mockTestId:string; score:number; total:number; percentage:number; timeTaken:number; accuracy:number; answers:{rawAnswers?:Record<string,any>;questionEvaluations?:QuestionEvaluation[];scoreBreakdown?:{positiveMarks:number;negativeMarks:number;descriptiveScore:number;finalScore:number;totalPossibleMarks:number;percentage:number;accuracy:number;correct:number;incorrect:number;unanswered:number;totalQuestions:number};topicBreakdown?:Array<{topic:string;score:number;totalMarks:number;questions:number;correct:number;attempted:number;accuracy:number;percentage:number}>;strongAreas?:string[];weakAreas?:string[]}; createdAt:string }
export interface HandwrittenDetectedAnswer { questionId:string; questionNumber:number; questionText:string; type:string; options?:string[]; marks:number; detectedAnswer:string; confidence:number; confidenceLevel:'High'|'Medium'|'Low'; requiresReview:boolean; notes?:string }

const LS_CONFIG='legatrixon_mock_section_config', LS_STRUCT='legatrixon_mock_structure_mode', LS_ATTEMPT='legatrixon_active_mock_attempt'

function loadSections():SectionConfig[]|null{ try{ const r=localStorage.getItem(LS_CONFIG); if(r) return JSON.parse(r) }catch{} return null }
function sectionInstruction(s:SectionConfig):string{ if(s.isCompulsory) return 'This section is compulsory.'; if(s.questionsToAttempt<s.questionsGenerated) return `Attempt any ${s.questionsToAttempt} out of ${s.questionsGenerated}.`; return 'Attempt all questions.' }
function maxMarks(sections:SectionConfig[]):number{ return sections.reduce((sum,s)=>sum+s.questionsToAttempt*s.marksPerQuestion,0) }
function secLabel(i:number):string{ return String.fromCharCode(65+i) }

export default function MockTestPlatform({ apiToken }: Props) {
  const [activeMainTab, setActiveMainTab] = useState<'studio'|'my-tests'>('studio')
  const [sources, setSources] = useState<LearningSource[]>([])
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [mockTests, setMockTests] = useState<MockTest[]>([])
  const [loadingSources, setLoadingSources] = useState(false)
  const [inspectingSource, setInspectingSource] = useState<any|null>(null)
  const [loadingInspect, setLoadingInspect] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [testTopic, setTestTopic] = useState('Constitutional & General Indian Law')
  const [difficulty, setDifficulty] = useState('Intermediate')
  const [durationMinutes, setDurationMinutes] = useState(45)
  const [negativeMarkingRate, setNegativeMarkingRate] = useState<number|null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [structureMode, setStructureMode] = useState<'reference'|'custom'|'default'>(() => {
    try { return (localStorage.getItem(LS_STRUCT) as any) || 'default' } catch { return 'default' }
  })
  const [customSections, setCustomSections] = useState<SectionConfig[]>(() => loadSections() || DEFAULT_SECTIONS)
  const [referenceStructure, setReferenceStructure] = useState<any|null>(null)
  const [isAnalyzingStructure, setIsAnalyzingStructure] = useState(false)
  const [flowState, setFlowState] = useState<'IDLE'|'GENERATING'|'PREVIEW'|'ATTEMPT'|'EVALUATING'|'RESULT'>('IDLE')
  const [activeTest, setActiveTest] = useState<MockTest|null>(null)
  const [activeAttempt, setActiveAttempt] = useState<MockTestAttempt|null>(null)
  const [previewQuestionIndex, setPreviewQuestionIndex] = useState(0)
  const [attemptQuestionIndex, setAttemptQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string,any>>({})
  const [markedForReview, setMarkedForReview] = useState<Record<string,boolean>>({})
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [evalFilter, setEvalFilter] = useState<'all'|'correct'|'incorrect'|'unanswered'|'subjective'>('all')
  const [isUploadingSheet, setIsUploadingSheet] = useState(false)
  const [ocrModalOpen, setOcrModalOpen] = useState(false)
  const [detectedAnswers, setDetectedAnswers] = useState<HandwrittenDetectedAnswer[]>([])
  const [editingOcrQId, setEditingOcrQId] = useState<string|null>(null)
  const [editOcrText, setEditOcrText] = useState('')
  const [ocrFileName, setOcrFileName] = useState('')
  const [notification, setNotification] = useState<{type:'success'|'error'|'info';message:string}|null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sheetInputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<any>(null)

  useEffect(() => { try { localStorage.setItem(LS_CONFIG, JSON.stringify(customSections)) } catch {} }, [customSections])
  useEffect(() => { try { localStorage.setItem(LS_STRUCT, structureMode) } catch {} }, [structureMode])

  const getAuthToken = async ():Promise<string> => {
    if (apiToken) return apiToken
    try { const c=(window as any).Clerk; if(c?.session) return await c.session.getToken() } catch {}
    return ''
  }
  const getHeaders = async (includeJson=true) => {
    const token=await getAuthToken(); const h:Record<string,string>={}
    if(includeJson) h['Content-Type']='application/json'
    if(token) h['Authorization']=`Bearer ${token}`
    return h
  }
  const showBanner = (type:'success'|'error'|'info', message:string) => {
    setNotification({type,message}); setTimeout(()=>setNotification(null),6000)
  }

  const fetchWorkspaceData = async () => {
    setLoadingSources(true)
    try {
      const headers=await getHeaders()
      const res=await fetch(`${API_BASE_URL}/learning-workspace`,{headers})
      if(res.ok){
        const data=await res.json(); const fetchedSources:LearningSource[]=data.sources||[]
        setSources(fetchedSources); setMockTests(data.mockTests||[])
        if(selectedSourceIds.length===0 && fetchedSources.length>0){
          const ready=fetchedSources.filter(s=>s.status==='Indexed'||s.status==='Completed'||(s.textLength&&s.textLength>100))
          setSelectedSourceIds(ready.slice(0,3).map(s=>s.id))
        }
      }
    } catch(err:any){console.warn('workspace load failed',err)} finally{setLoadingSources(false)}
  }
  useEffect(()=>{ fetchWorkspaceData() },[])

  useEffect(()=>{
    try {
      const raw=localStorage.getItem(LS_ATTEMPT)
      if(raw){
        const p=JSON.parse(raw)
        if(p.test&&p.answers&&p.startTimestamp&&p.durationSeconds){
          const elapsed=Math.floor((Date.now()-p.startTimestamp)/1000)
          const remaining=p.durationSeconds-elapsed
          if(remaining>0){ setActiveTest(p.test); setAnswers(p.answers||{}); setMarkedForReview(p.markedForReview||{}); setTimeRemainingSeconds(remaining); setAttemptQuestionIndex(p.currentIndex||0); setFlowState('ATTEMPT'); setIsTimerRunning(true) }
          else localStorage.removeItem(LS_ATTEMPT)
        }
      }
    } catch{}
  },[])

  useEffect(()=>{
    if(flowState==='ATTEMPT'&&activeTest){
      const stored=localStorage.getItem(LS_ATTEMPT); let startTimestamp=Date.now()
      try{ const prev=stored?JSON.parse(stored):null; if(prev?.startTimestamp) startTimestamp=prev.startTimestamp }catch{}
      localStorage.setItem(LS_ATTEMPT,JSON.stringify({test:activeTest,answers,markedForReview,durationSeconds:(activeTest.scoreReport?.durationMinutes||durationMinutes||45)*60,startTimestamp,currentIndex:attemptQuestionIndex}))
    } else if(flowState==='RESULT'||flowState==='IDLE'){ localStorage.removeItem(LS_ATTEMPT) }
  },[flowState,activeTest,answers,markedForReview,attemptQuestionIndex])

  useEffect(()=>{
    if(isTimerRunning&&timeRemainingSeconds>0){
      timerRef.current=setInterval(()=>setTimeRemainingSeconds(prev=>{ if(prev<=1){clearInterval(timerRef.current);handleAutoSubmit();return 0} return prev-1 }),1000)
    } else { if(timerRef.current) clearInterval(timerRef.current) }
    return ()=>{if(timerRef.current) clearInterval(timerRef.current)}
  },[isTimerRunning,timeRemainingSeconds])

  const formatTime=(seconds:number)=>{
    const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60
    if(h>0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  const handleFileUpload=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    if(!e.target.files||e.target.files.length===0) return
    const file=e.target.files[0]; const formData=new FormData(); formData.append('file',file); formData.append('kind','PDF Upload')
    setLoadingSources(true); showBanner('info',`Uploading and indexing ${file.name}...`)
    try{
      const token=await getAuthToken()
      const res=await fetch(`${API_BASE_URL}/learning-workspace/sources/upload`,{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body:formData})
      if(res.ok){showBanner('success',`${file.name} uploaded!`);await fetchWorkspaceData()}
      else{const err=await res.json().catch(()=>({}));showBanner('error',err.message||'Upload failed.')}
    }catch(err:any){showBanner('error',`Upload error: ${err.message}`)}
    finally{setLoadingSources(false);if(fileInputRef.current) fileInputRef.current.value=''}
  }

  const handleInspectSource=async(sourceId:string)=>{
    setLoadingInspect(true); setInspectingSource(null)
    try{
      const headers=await getHeaders()
      const res=await fetch(`${API_BASE_URL}/learning-workspace/sources/${sourceId}/indexed-content`,{headers})
      if(res.ok){setInspectingSource(await res.json())}
      else{
        const src=sources.find(s=>s.id===sourceId)
        if(src) setInspectingSource({id:src.id,name:src.name,kind:src.kind,status:src.status,wordCount:src.textLength?Math.round(src.textLength/5):1200,estimatedPages:Math.max(1,Math.round((src.textLength||4000)/1800)),totalChunks:6,sections:['Fundamental Principles','Statutory Clauses','Precedent Analysis'],chunks:[{id:'chk-1',chunkIndex:1,textSnippet:'Statutory interpretation and primary definitions under the governing Act...',estPage:1},{id:'chk-2',chunkIndex:2,textSnippet:'Exceptions, provisos, and judicial tests formulated by the Supreme Court...',estPage:2}]})
      }
    }catch{}finally{setLoadingInspect(false)}
  }

  const handleAnalyzeReferenceStructure=async(sourceId:string)=>{
    setIsAnalyzingStructure(true); showBanner('info','Analyzing reference document structure...')
    try{
      const headers=await getHeaders()
      const res=await fetch(`${API_BASE_URL}/learning-workspace/mock-tests/analyze-structure`,{method:'POST',headers,body:JSON.stringify({sourceId})})
      if(res.ok){
        const data=await res.json(); const struct=data.structure; setReferenceStructure(struct)
        if(struct.sections&&struct.sections.length>0){
          const newSections:SectionConfig[]=struct.sections.map((sec:any,idx:number)=>({id:`ref-sec-${idx}`,name:sec.name||`Section ${secLabel(idx)}`,questionsGenerated:sec.questionsGenerated||sec.questionCount||5,questionsToAttempt:sec.questionsToAttempt||sec.questionsRequired||sec.questionCount||5,marksPerQuestion:sec.marksPerQuestion||sec.marks||5,questionTypes:sec.questionType?[sec.questionType]:['Descriptive'],isCompulsory:Boolean(sec.compulsory||sec.isCompulsory)}))
          if(struct.durationMinutes) setDurationMinutes(struct.durationMinutes)
          if(struct.negativeMarkingRate!==undefined) setNegativeMarkingRate(struct.negativeMarkingRate)
          showBanner('success',`Pattern detected: ${struct.patternName||'Reference Exam Pattern'} — ${newSections.length} sections. Set mode to "Follow Reference" to apply.`)
        } else { if(struct.durationMinutes) setDurationMinutes(struct.durationMinutes); showBanner('success','Reference analyzed. No clear section structure detected.') }
      }
    }catch(err:any){showBanner('error',`Structure analysis failed: ${err.message}`)}
    finally{setIsAnalyzingStructure(false)}
  }

  const activeSections=useMemo<SectionConfig[]>(()=>{
    if(structureMode==='reference'&&referenceStructure?.sections?.length)
      return referenceStructure.sections.map((sec:any,idx:number)=>({id:`ref-${idx}`,name:sec.name||`Section ${secLabel(idx)}`,questionsGenerated:sec.questionsGenerated||sec.questionCount||5,questionsToAttempt:sec.questionsToAttempt||sec.questionCount||5,marksPerQuestion:sec.marksPerQuestion||5,questionTypes:sec.questionType?[sec.questionType]:['Descriptive'],isCompulsory:Boolean(sec.compulsory)}))
    if(structureMode==='default') return DEFAULT_SECTIONS
    return customSections
  },[structureMode,customSections,referenceStructure])

  const addSection=()=>{ const idx=customSections.length; setCustomSections(prev=>[...prev,{id:`sec-${Date.now()}`,name:`Section ${secLabel(idx)}`,questionsGenerated:3,questionsToAttempt:2,marksPerQuestion:5,questionTypes:['Descriptive'],isCompulsory:false}]) }
  const removeSection=(id:string)=>{ if(customSections.length<=1){showBanner('error','At least one section required.');return} setCustomSections(prev=>prev.filter(s=>s.id!==id)) }
  const updateSection=(id:string,patch:Partial<SectionConfig>)=>setCustomSections(prev=>prev.map(s=>s.id===id?{...s,...patch}:s))
  const toggleSectionType=(sectionId:string,type:string)=>setCustomSections(prev=>prev.map(s=>{ if(s.id!==sectionId) return s; const types=s.questionTypes.includes(type)?s.questionTypes.filter(t=>t!==type):[...s.questionTypes,type]; return{...s,questionTypes:types.length?types:[type]} }))
  const toggleSourceSelection=(id:string)=>setSelectedSourceIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])

  const applyPreset=(preset:{label:string;prompt:string})=>{
    setAiPrompt(preset.prompt)
    if(preset.prompt.toLowerCase().includes('replicate')&&selectedSourceIds.length>0){ handleAnalyzeReferenceStructure(selectedSourceIds[0]); setStructureMode('reference') }
  }

  const handleGenerateTest=async()=>{
    if(selectedSourceIds.length===0){showBanner('error','Please select at least one reference document.');return}
    setFlowState('GENERATING'); showBanner('info','AI is generating your grounded mock test...')
    const allTypes=Array.from(new Set(activeSections.flatMap(s=>s.questionTypes)))
    const totalQuestions=activeSections.reduce((sum,s)=>sum+s.questionsGenerated,0)
    const bodyPayload={topic:testTopic,customPrompt:aiPrompt||`Create a comprehensive ${difficulty} mock test with ${totalQuestions} questions across ${activeSections.length} sections.`,questionCount:totalQuestions,difficulty,questionType:allTypes.join(', '),paperType:allTypes.join(', '),durationMinutes,negativeMarkingRate:negativeMarkingRate??0,sourceIds:selectedSourceIds,mode:'interactive',structureMode,sections:activeSections.map(sec=>({name:sec.name,questionsGenerated:sec.questionsGenerated,questionsToAttempt:sec.questionsToAttempt,marksPerQuestion:sec.marksPerQuestion,questionTypes:sec.questionTypes,isCompulsory:sec.isCompulsory,instruction:sectionInstruction(sec)})),referenceStructure:structureMode==='reference'?referenceStructure:undefined}
    try{
      const headers=await getHeaders()
      const res=await fetch(`${API_BASE_URL}/learning-workspace/mock-tests/generate`,{method:'POST',headers,body:JSON.stringify(bodyPayload)})
      if(res.ok){ const test:MockTest=await res.json(); setActiveTest(test); setMockTests(prev=>[test,...prev.filter(t=>t.id!==test.id)]); setPreviewQuestionIndex(0); setFlowState('PREVIEW'); showBanner('success',`Mock Test "${test.scoreReport?.examTitle||test.topic}" generated!`) }
      else{ const err=await res.json().catch(()=>({})); showBanner('error',err.message||'Generation failed.'); setFlowState('IDLE') }
    }catch(err:any){ showBanner('error',`Generation error: ${err.message}`); setFlowState('IDLE') }
  }

  const handleStartAttempt=()=>{
    if(!activeTest||!activeTest.questions||activeTest.questions.length===0) return
    const durMins=activeTest.scoreReport?.durationMinutes||durationMinutes||45
    setTimeRemainingSeconds(durMins*60); setAnswers({}); setMarkedForReview({}); setAttemptQuestionIndex(0); setFlowState('ATTEMPT'); setIsTimerRunning(true)
    showBanner('info',`Examination started! Timer running for ${durMins} minutes.`)
  }

  const handleSelectOption=(questionId:string,optionIndex:number)=>setAnswers(prev=>({...prev,[questionId]:optionIndex}))
  const handleMultipleSelectOption=(questionId:string,optionText:string)=>setAnswers(prev=>{
    const cur:string[]=Array.isArray(prev[questionId])?prev[questionId]:[]
    const next=cur.includes(optionText)?cur.filter(x=>x!==optionText):[...cur,optionText]
    return{...prev,[questionId]:next}
  })
  const handleTextAnswer=(questionId:string,text:string)=>setAnswers(prev=>({...prev,[questionId]:text}))
  const toggleMarkForReview=(questionId:string)=>setMarkedForReview(prev=>({...prev,[questionId]:!prev[questionId]}))
  const clearCurrentAnswer=(questionId:string)=>setAnswers(prev=>{const next={...prev};delete next[questionId];return next})
  const handleAutoSubmit=()=>{setIsTimerRunning(false);showBanner('info','Time is up! Submitting automatically...');handleSubmitAttempt()}

  const handleSubmitAttempt=async()=>{
    if(!activeTest) return
    setShowSubmitConfirm(false); setIsTimerRunning(false); setFlowState('EVALUATING')
    try{
      const headers=await getHeaders()
      const totalSeconds=(activeTest.scoreReport?.durationMinutes||45)*60
      const timeTaken=Math.max(1,totalSeconds-timeRemainingSeconds)
      const negRate=activeTest.scoreReport?.negativeMarkingRate!==undefined?activeTest.scoreReport.negativeMarkingRate:(negativeMarkingRate??0)
      const res=await fetch(`${API_BASE_URL}/learning-workspace/mock-tests/${activeTest.id}/submit`,{method:'POST',headers,body:JSON.stringify({answers,timeTaken,negativeMarkingRate:negRate})})
      if(res.ok){ const r:MockTestAttempt=await res.json(); setActiveAttempt(r); setFlowState('RESULT'); showBanner('success',`Evaluated! Score: ${r.score}/${r.total} (${r.percentage}%)`) }
      else{ const err=await res.json().catch(()=>({})); showBanner('error',err.message||'Submission failed.'); setFlowState('ATTEMPT'); setIsTimerRunning(true) }
    }catch(err:any){ showBanner('error',`Submission error: ${err.message}`); setFlowState('ATTEMPT'); setIsTimerRunning(true) }
  }

  const handleHandwrittenUpload=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    if(!e.target.files||e.target.files.length===0||!activeTest) return
    const file=e.target.files[0]; setOcrFileName(file.name); setIsUploadingSheet(true); showBanner('info',`Processing "${file.name}" with AI OCR...`)
    const formData=new FormData(); formData.append('file',file)
    try{
      const token=await getAuthToken()
      const res=await fetch(`${API_BASE_URL}/learning-workspace/mock-tests/${activeTest.id}/handwritten-ocr`,{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body:formData})
      if(res.ok){const data=await res.json();setDetectedAnswers(data.extractedAnswers||[]);setOcrModalOpen(true);showBanner('success',`OCR transcribed ${data.detectedQuestionCount} answers!`)}
      else{const err=await res.json().catch(()=>({}));showBanner('error',err.message||'OCR failed.')}
    }catch(err:any){showBanner('error',`OCR error: ${err.message}`)}
    finally{setIsUploadingSheet(false);if(sheetInputRef.current) sheetInputRef.current.value=''}
  }

  const handleConfirmOcrAnswers=()=>{
    const updated={...answers}
    detectedAnswers.forEach(ans=>{
      if(ans.detectedAnswer){
        if(ans.type==='MCQ'&&ans.options&&ans.options.length>0){
          const m=ans.detectedAnswer.trim().match(/^([A-D])/i)
          if(m){const idx=m[1].toUpperCase().charCodeAt(0)-65;if(idx>=0&&idx<ans.options.length){updated[ans.questionId]=idx;return}}
        }
        updated[ans.questionId]=ans.detectedAnswer
      }
    })
    setAnswers(updated); setOcrModalOpen(false); showBanner('success','Handwritten answers applied!')
  }

  const handleSaveOcrCorrection=(qId:string,newText:string)=>{ setDetectedAnswers(prev=>prev.map(a=>a.questionId===qId?{...a,detectedAnswer:newText,confidence:95,confidenceLevel:'High' as const,requiresReview:false}:a)); setEditingOcrQId(null) }
  const handleSelectPastTest=(test:MockTest)=>{ setActiveTest(test); setPreviewQuestionIndex(0); setFlowState('PREVIEW'); setActiveMainTab('studio') }
  const handleDeleteTest=async(testId:string)=>{
    if(!confirm('Delete this mock test?')) return
    try{ const headers=await getHeaders(); await fetch(`${API_BASE_URL}/learning-workspace/mock-tests/${testId}`,{method:'DELETE',headers}); setMockTests(prev=>prev.filter(t=>t.id!==testId)); if(activeTest?.id===testId){setActiveTest(null);setFlowState('IDLE')}; showBanner('success','Mock test deleted.') }catch{}
  }
  const handleRetakeTest=()=>{ setFlowState('PREVIEW'); setActiveAttempt(null); setAnswers({}); setMarkedForReview({}) }

  const answeredCount=useMemo(()=>Object.keys(answers).filter(k=>answers[k]!==undefined&&answers[k]!=='').length,[answers])
  const markedCount=useMemo(()=>Object.keys(markedForReview).filter(k=>markedForReview[k]).length,[markedForReview])
  const currentAttemptQ=activeTest?.questions?.[attemptQuestionIndex]
  const currentPreviewQ=activeTest?.questions?.[previewQuestionIndex]
  const filteredEvaluations=useMemo(()=>{
    if(!activeAttempt?.answers?.questionEvaluations) return []
    const evals=activeAttempt.answers.questionEvaluations
    if(evalFilter==='correct') return evals.filter(e=>e.isCorrect===true)
    if(evalFilter==='incorrect') return evals.filter(e=>e.isCorrect===false&&e.result!=='Unanswered'&&!e.result?.includes('Optional')&&!e.result?.includes('Not Selected'))
    if(evalFilter==='unanswered') return evals.filter(e=>e.result==='Unanswered')
    if(evalFilter==='subjective') return evals.filter(e=>e.type!=='MCQ'&&e.type!=='True/False')
    return evals
  },[activeAttempt,evalFilter])


  // Design Tokens strictly bound to the application's CSS variables
  const bg = 'var(--bg)'
  const card = 'var(--card, #ffffff)'
  const cardAlt = 'var(--card-alt, #f8f7f2)'
  const bgElev = 'var(--bg-elev, #ffffff)'
  const panel = 'var(--panel)'
  const panelStrong = 'var(--panel-strong)'
  const line = 'var(--line)'
  const text = 'var(--text)'
  const textSoft = 'var(--text-soft)'
  const gold = 'var(--gold)'
  const cardBorder = `1px solid ${line}`
  const cardShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)'

  const totalQuestions = activeSections.reduce((s, x) => s + x.questionsGenerated, 0)
  const totalToAttempt = activeSections.reduce((s, x) => s + x.questionsToAttempt, 0)
  const totalMaxMarks = maxMarks(activeSections)

  const handleSelectAllSources = () => setSelectedSourceIds(sources.map(s => s.id))
  const handleClearSourceSelection = () => setSelectedSourceIds([])

  return (
    <div style={{ minHeight: '100vh', background: bg, color: text, padding: '28px 32px', fontFamily: 'inherit', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><DemoUsageBadge feature="mock_test" /></div>
      {/* Hidden File Inputs */}
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.txt,.doc,.docx" style={{ display: 'none' }} />
      <input type="file" ref={sheetInputRef} onChange={handleHandwrittenUpload} accept="image/*,.pdf" style={{ display: 'none' }} />

      {/* Floating Notification */}
      {notification && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999,
          padding: '12px 22px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
          background: notification.type === 'error' ? '#ef4444' : notification.type === 'info' ? '#3b82f6' : '#10b981',
          color: '#ffffff', boxShadow: '0 10px 28px rgba(0,0,0,0.22)', fontWeight: 600, fontSize: 13
        }}>
          {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notification.message}</span>
          {notification.type === 'error' && /upgrade|limit|trial/i.test(notification.message) && (
            <a href="/pricing" style={{ color: '#ffffff', fontWeight: 800, textDecoration: 'underline' }}>View Plans</a>
          )}
        </div>
      )}

      {/* Main Studio Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={24} color={gold} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: '-0.02em', color: text }}>
                Mock Test Studio & Exam Platform
              </h1>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '3px 10px', borderRadius: 12, background: 'rgba(217, 119, 6, 0.1)', color: gold, border: '1px solid rgba(217, 119, 6, 0.25)' }}>
                {flowState}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: textSoft, fontWeight: 500 }}>
              Dynamic Section Blueprints • Multi-Type Exams • Grounded in Legal Sources • AI Evaluation
            </p>
          </div>
        </div>

        {/* Top Navigation Tabs */}
        {flowState !== 'ATTEMPT' && (
          <div style={{ display: 'flex', gap: 6, background: bgElev, padding: 5, borderRadius: 12, border: `1px solid ${line}` }}>
            <button
              onClick={() => setActiveMainTab('studio')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: activeMainTab === 'studio' ? card : 'transparent',
                color: activeMainTab === 'studio' ? text : textSoft,
                boxShadow: activeMainTab === 'studio' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <Layers size={16} color={activeMainTab === 'studio' ? gold : undefined} /> Studio
            </button>
            <button
              onClick={() => setActiveMainTab('my-tests')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: activeMainTab === 'my-tests' ? card : 'transparent',
                color: activeMainTab === 'my-tests' ? text : textSoft,
                boxShadow: activeMainTab === 'my-tests' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <BookOpen size={16} color={activeMainTab === 'my-tests' ? gold : undefined} /> My Tests ({mockTests.length})
            </button>
          </div>
        )}
      </div>

      {/* TAB: MY TESTS */}
      {activeMainTab === 'my-tests' && flowState !== 'ATTEMPT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0, color: text }}>Saved Mock Tests & Archives</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: textSoft }}>Review, inspect, or practice tests previously generated by AI.</p>
            </div>
            <button
              onClick={() => { setActiveMainTab('studio'); setFlowState('IDLE') }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.25)' }}
            >
              <Plus size={16} /> Create New Test
            </button>
          </div>

          {mockTests.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', background: card, borderRadius: 16, border: cardBorder, boxShadow: cardShadow }}>
              <BookOpen size={42} color={gold} style={{ margin: '0 auto 14px', opacity: 0.8 }} />
              <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: text }}>No mock tests generated yet</h3>
              <p style={{ margin: 0, fontSize: 13, color: textSoft }}>Create tests in Studio grounded in legal papers or custom blueprints.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
              {mockTests.map(t => (
                <div key={t.id} style={{ background: card, border: cardBorder, borderRadius: 14, padding: 20, boxShadow: cardShadow, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: 'rgba(217, 119, 6, 0.1)', color: gold, border: '1px solid rgba(217, 119, 6, 0.2)' }}>
                        {t.difficulty || 'Custom'}
                      </span>
                      <span style={{ fontSize: 11, color: textSoft, fontWeight: 500 }}>
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: text, lineHeight: 1.4 }}>
                      {t.scoreReport?.examTitle || t.topic}
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12, color: textSoft, marginBottom: 16 }}>
                      <span style={{ background: bgElev, padding: '3px 8px', borderRadius: 6, border: `1px solid ${line}` }}>
                        • {t.questions?.length || t.questionCount} Questions
                      </span>
                      <span style={{ background: bgElev, padding: '3px 8px', borderRadius: 6, border: `1px solid ${line}` }}>
                        • {t.scoreReport?.durationMinutes || 45} mins
                      </span>
                      <span style={{ background: bgElev, padding: '3px 8px', borderRadius: 6, border: `1px solid ${line}` }}>
                        • {t.scoreReport?.totalMarks || 100} Marks
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, paddingTop: 14, borderTop: `1px solid ${line}` }}>
                    <button
                      onClick={() => handleSelectPastTest(t)}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, background: bgElev, color: text, border: `1px solid ${line}`, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease' }}
                    >
                      <Eye size={15} color={gold} /> Preview & Practice
                    </button>
                    <button
                      onClick={() => handleDeleteTest(t.id)}
                      style={{ padding: '9px 12px', borderRadius: 8, background: bgElev, color: '#ef4444', border: `1px solid ${line}`, cursor: 'pointer', transition: 'all 0.15s ease' }}
                      title="Delete Test"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: STUDIO */}
      {activeMainTab === 'studio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* FLOW: IDLE or GENERATING */}
          {(flowState === 'IDLE' || flowState === 'GENERATING') && (
            <>
              {/* CARD 1: AI MOCK TEST ARCHITECT / PROMPT AREA */}
              <div style={{ background: card, border: cardBorder, borderRadius: 16, padding: '24px', boxShadow: cardShadow }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={22} color={gold} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: text, letterSpacing: '-0.01em' }}>
                          AI Mock Test Architect
                        </h2>
                        {selectedSourceIds.length > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'rgba(217, 119, 6, 0.08)', color: gold, border: '1px solid rgba(217, 119, 6, 0.2)' }}>
                            <FileText size={12} /> {selectedSourceIds.length} Source{selectedSourceIds.length === 1 ? '' : 's'} Selected
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: textSoft, fontWeight: 500 }}>
                        Describe your desired examination in natural language. Questions are rigorously synthesized strictly from your selected reference materials.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowConfig(!showConfig)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: bgElev, border: `1px solid ${line}`, borderRadius: 8, padding: '7px 14px', color: text, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease' }}
                  >
                    <Settings2 size={14} color={gold} /> {showConfig ? 'Hide Blueprint' : 'Configure Blueprint & Rules'}
                  </button>
                </div>

                {/* Prompt Textarea */}
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="Describe the mock test you want... (e.g. 'Create a 50-question Constitutional Law mock test with negative marking', 'Generate a 2-hour judiciary-level test from uploaded Bare Acts', 'Make the paper follow the structure of my uploaded PYQ PDF')"
                  rows={4}
                  style={{
                    width: '100%', background: bgElev, border: `1px solid ${line}`, borderRadius: 12,
                    padding: '14px 16px', color: text, fontSize: 14, lineHeight: 1.6, resize: 'vertical',
                    boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s', marginBottom: 14,
                    fontFamily: 'inherit'
                  }}
                />

                {/* Action Bar below Textarea */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <button
                    onClick={() => setShowConfig(!showConfig)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: bgElev, border: `1px solid ${line}`, borderRadius: 8, padding: '7px 14px', color: text, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    <Settings2 size={14} color={gold} /> {showConfig ? 'Hide Config' : 'Configure Blueprint & Rules'}
                  </button>

                  <button
                    onClick={handleGenerateTest}
                    disabled={flowState === 'GENERATING' || selectedSourceIds.length === 0}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 10,
                      background: selectedSourceIds.length > 0 ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' : bgElev,
                      color: selectedSourceIds.length > 0 ? '#ffffff' : textSoft,
                      border: 'none', fontWeight: 800, fontSize: 14,
                      cursor: selectedSourceIds.length > 0 && flowState !== 'GENERATING' ? 'pointer' : 'not-allowed',
                      boxShadow: selectedSourceIds.length > 0 ? '0 4px 14px rgba(217, 119, 6, 0.3)' : 'none',
                      opacity: flowState === 'GENERATING' ? 0.7 : 1, transition: 'all 0.2s ease'
                    }}
                  >
                    {flowState === 'GENERATING' ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        <span>Generating Mock Test...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} />
                        <span>Generate Mock Test</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Click Prompts & Blueprint Presets */}
                <div>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: gold, textTransform: 'uppercase', marginBottom: 8 }}>
                    Click Prompts & Blueprint Presets:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {PROMPT_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => setAiPrompt(p.prompt)}
                        style={{
                          background: bgElev, border: `1px solid ${line}`, borderRadius: 20,
                          padding: '5px 13px', color: textSoft, fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ color: gold, fontWeight: 800 }}>+</span> {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* CARD 2: TEST BLUEPRINT & SECTION RULE CONFIGURATION */}
              {showConfig && (
                <div style={{ background: card, border: cardBorder, borderRadius: 16, padding: '24px', boxShadow: cardShadow }}>
                  {/* Blueprint Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${line}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Sliders size={20} color={gold} />
                      </div>
                      <div>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: text }}>
                          Test Blueprint & Section Rule Configuration
                        </h2>
                        <p style={{ margin: '3px 0 0', fontSize: 13, color: textSoft }}>
                          Define the exact structure, section choices, questions count, and marks. Saved configurations persist indefinitely.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => { setCustomSections(DEFAULT_SECTIONS); setStructureMode('default'); showBanner('info', 'Reset to default blueprint.') }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: bgElev, border: `1px solid ${line}`, borderRadius: 8, padding: '6px 12px', color: textSoft, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                        title="Restore Default"
                      >
                        <RotateCcw size={13} /> Restore Default
                      </button>
                      <button
                        onClick={() => { localStorage.setItem(LS_CONFIG, JSON.stringify(customSections)); showBanner('success', 'Custom blueprint saved!') }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(217, 119, 6, 0.12)', border: '1px solid rgba(217, 119, 6, 0.25)', borderRadius: 8, padding: '6px 12px', color: gold, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        <Save size={13} /> Save Custom Structure
                      </button>
                    </div>
                  </div>

                  {/* Structure Source Mode */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: textSoft }}>Structure Source Mode:</span>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[
                        { id: 'reference', label: 'Follow Reference Paper', desc: 'Auto-extracted from uploaded reference paper' },
                        { id: 'custom', label: 'Use My Custom Structure', desc: 'Full custom section builder' },
                        { id: 'default', label: 'Use Default Structure', desc: 'Standard 3-Tier Exam (A, B, C)' }
                      ].map(m => {
                        const isSelected = structureMode === m.id
                        return (
                          <button
                            key={m.id}
                            onClick={() => setStructureMode(m.id as any)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 9,
                              border: `1.5px solid ${isSelected ? gold : line}`,
                              background: isSelected ? 'rgba(217, 119, 6, 0.08)' : bgElev,
                              color: isSelected ? text : textSoft,
                              fontWeight: isSelected ? 700 : 600, fontSize: 12, cursor: 'pointer',
                              boxShadow: isSelected ? '0 1px 4px rgba(217, 119, 6, 0.15)' : 'none',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {isSelected && <Check size={14} color={gold} />}
                            {m.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Summary KPI Strip */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', borderRadius: 12, background: bgElev, border: `1px solid ${line}`, padding: '16px 20px', gap: 16, marginBottom: 22 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', color: textSoft, textTransform: 'uppercase' }}>Sections</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: text, marginTop: 4 }}>{activeSections.length}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', color: textSoft, textTransform: 'uppercase' }}>To Generate</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: text, marginTop: 4 }}>{totalQuestions} Questions</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', color: textSoft, textTransform: 'uppercase' }}>To Attempt</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: text, marginTop: 4 }}>{totalToAttempt} Questions</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', color: textSoft, textTransform: 'uppercase' }}>Maximum Marks</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: gold, marginTop: 4 }}>{totalMaxMarks} Marks</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', color: textSoft, textTransform: 'uppercase' }}>Duration</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: text, marginTop: 4 }}>
                        {durationMinutes} Minutes {durationMinutes >= 60 ? `(${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60 ? `${durationMinutes % 60}m` : ''})` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Configured Examination Sections List */}
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: text, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Layers size={16} color={gold} /> Configured Examination Sections ({activeSections.length})
                      </span>
                      {structureMode === 'custom' && (
                        <button
                          onClick={addSection}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, background: bgElev, border: `1px solid ${line}`, padding: '6px 14px', borderRadius: 8, color: text, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          <Plus size={14} color={gold} /> Add Section
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {activeSections.map((sec, idx) => (
                        <div key={sec.id} style={{ background: card, border: `1px solid ${line}`, borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                          {/* Section Card Top Row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: bgElev, color: textSoft, border: `1px solid ${line}` }}>
                                #{idx + 1}
                              </span>
                              <input
                                type="text"
                                value={sec.name}
                                disabled={structureMode === 'reference'}
                                onChange={e => updateSection(sec.id, { name: e.target.value })}
                                style={{ fontWeight: 800, fontSize: 15, background: bgElev, border: `1px solid ${line}`, borderRadius: 8, padding: '5px 12px', color: text, width: 170 }}
                              />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 14, background: 'rgba(217, 119, 6, 0.08)', color: gold, border: '1px solid rgba(217, 119, 6, 0.2)' }}>
                                {sec.questionsToAttempt * sec.marksPerQuestion} Marks
                              </span>
                              {structureMode === 'custom' && activeSections.length > 1 && (
                                <button
                                  onClick={() => removeSection(sec.id)}
                                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                                  title="Remove Section"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Numeric Inputs Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, marginBottom: 14 }}>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: textSoft, marginBottom: 5 }}>Questions to Generate</label>
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={sec.questionsGenerated}
                                disabled={structureMode === 'reference'}
                                onChange={e => updateSection(sec.id, { questionsGenerated: parseInt(e.target.value) || 1 })}
                                style={{ width: '100%', background: bgElev, border: `1px solid ${line}`, borderRadius: 8, padding: '7px 10px', color: text, fontWeight: 700, boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: textSoft, marginBottom: 5 }}>Student Must Attempt</label>
                              <input
                                type="number"
                                min={1}
                                max={sec.questionsGenerated}
                                value={sec.questionsToAttempt}
                                disabled={structureMode === 'reference'}
                                onChange={e => updateSection(sec.id, { questionsToAttempt: parseInt(e.target.value) || 1 })}
                                style={{ width: '100%', background: bgElev, border: `1px solid ${line}`, borderRadius: 8, padding: '7px 10px', color: text, fontWeight: 700, boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: textSoft, marginBottom: 5 }}>Marks per Question</label>
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={sec.marksPerQuestion}
                                disabled={structureMode === 'reference'}
                                onChange={e => updateSection(sec.id, { marksPerQuestion: parseInt(e.target.value) || 1 })}
                                style={{ width: '100%', background: bgElev, border: `1px solid ${line}`, borderRadius: 8, padding: '7px 10px', color: text, fontWeight: 700, boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>

                          {/* Question Types Multi-Select Interactive Chips */}
                          <div style={{ marginBottom: 14 }}>
                            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: textSoft, marginBottom: 6 }}>Question Types:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              {QUESTION_TYPE_OPTIONS.map(opt => {
                                const isChecked = sec.questionTypes.includes(opt)
                                return (
                                  <label
                                    key={opt}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 8,
                                      border: `1.5px solid ${isChecked ? gold : line}`,
                                      background: isChecked ? 'rgba(217, 119, 6, 0.08)' : bgElev,
                                      color: isChecked ? text : textSoft,
                                      fontSize: 12, fontWeight: isChecked ? 700 : 500, cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={structureMode === 'reference'}
                                      onChange={() => toggleSectionType(sec.id, opt)}
                                      style={{ cursor: 'pointer', accentColor: gold }}
                                    />
                                    {opt}
                                  </label>
                                )
                              })}
                            </div>
                          </div>

                          {/* Section Card Bottom Row: Compulsory toggle & Rule Badge */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: `1px solid ${line}` }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: textSoft, cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={sec.isCompulsory}
                                disabled={structureMode === 'reference'}
                                onChange={e => updateSection(sec.id, { isCompulsory: e.target.checked })}
                                style={{ cursor: 'pointer', accentColor: gold }}
                              />
                              Compulsory Section: All questions must be attempted
                            </label>

                            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 12, background: 'rgba(217, 119, 6, 0.06)', border: '1px solid rgba(217, 119, 6, 0.18)', color: gold }}>
                              Rule: {sectionInstruction(sec)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Settings Cards: Duration, Difficulty, Negative Marking */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                    {/* Card A: Duration */}
                    <div style={{ background: bgElev, border: `1px solid ${line}`, borderRadius: 12, padding: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: text, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={15} color={gold} /> Exam Duration: {durationMinutes} Minutes
                        </span>
                      </div>
                      <input
                        type="range"
                        min={15}
                        max={240}
                        step={15}
                        value={durationMinutes}
                        onChange={e => setDurationMinutes(parseInt(e.target.value) || 45)}
                        style={{ width: '100%', accentColor: gold, marginBottom: 10, cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[30, 45, 60, 90, 120, 180].map(mins => (
                          <button
                            key={mins}
                            onClick={() => setDurationMinutes(mins)}
                            style={{
                              padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: durationMinutes === mins ? 'rgba(217, 119, 6, 0.15)' : card,
                              border: `1px solid ${durationMinutes === mins ? gold : line}`,
                              color: durationMinutes === mins ? gold : textSoft,
                              cursor: 'pointer'
                            }}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Card B: Difficulty Spectrum */}
                    <div style={{ background: bgElev, border: `1px solid ${line}`, borderRadius: 12, padding: 16 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: text, marginBottom: 8 }}>
                        Difficulty Spectrum
                      </label>
                      <select
                        value={difficulty}
                        onChange={e => setDifficulty(e.target.value)}
                        style={{ width: '100%', background: card, border: `1px solid ${line}`, borderRadius: 8, padding: '9px 12px', color: text, fontWeight: 600, fontSize: 13, boxSizing: 'border-box' }}
                      >
                        <option value="Beginner">Beginner / Foundational</option>
                        <option value="Intermediate">Intermediate / Degree Level</option>
                        <option value="Advanced">Advanced / Bar Exam</option>
                        <option value="Judiciary">Judiciary / Master Level</option>
                      </select>
                      <p style={{ margin: '8px 0 0', fontSize: 11, color: textSoft }}>
                        Calibrates analytical complexity, rubric standards, and grading stringency.
                      </p>
                    </div>

                    {/* Card C: Negative Marking Rate & Objective MCQ Inclusion */}
                    <div style={{ background: bgElev, border: `1px solid ${line}`, borderRadius: 12, padding: 16 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: text, marginBottom: 8 }}>
                        Negative Marking Rate
                      </label>
                      <select
                        value={negativeMarkingRate === null ? 'none' : negativeMarkingRate.toString()}
                        onChange={e => setNegativeMarkingRate(e.target.value === 'none' ? null : parseFloat(e.target.value))}
                        style={{ width: '100%', background: card, border: `1px solid ${line}`, borderRadius: 8, padding: '9px 12px', color: text, fontWeight: 600, fontSize: 13, boxSizing: 'border-box' }}
                      >
                        <option value="none">No Negative Marking</option>
                        <option value="0.25">0.25 (1/4th Marks)</option>
                        <option value="0.33">0.33 (1/3rd Marks)</option>
                        <option value="0.5">0.5 (Half Mark)</option>
                      </select>
                      <p style={{ margin: '8px 0 0', fontSize: 11, color: textSoft, lineHeight: 1.4 }}>
                        By default, mock tests are composed of written descriptive questions mirroring actual law papers.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* CARD 3: REFERENCE MATERIAL STACK */}
              <div style={{ background: card, border: cardBorder, borderRadius: 16, padding: '24px', boxShadow: cardShadow }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BookOpen size={20} color={gold} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: text }}>Reference Material Stack</h2>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: 'rgba(217, 119, 6, 0.08)', color: gold, border: '1px solid rgba(217, 119, 6, 0.2)' }}>
                          {selectedSourceIds.length} of {sources.length} active
                        </span>
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: textSoft }}>
                        Select documents to ground exam questions and mirror reference paper structure.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={handleSelectAllSources}
                      style={{ padding: '6px 12px', borderRadius: 7, background: bgElev, border: `1px solid ${line}`, color: textSoft, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={handleClearSourceSelection}
                      style={{ padding: '6px 12px', borderRadius: 7, background: bgElev, border: `1px solid ${line}`, color: textSoft, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Clear Selection
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loadingSources}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'rgba(217, 119, 6, 0.12)', border: '1px solid rgba(217, 119, 6, 0.25)', color: gold, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    >
                      <UploadCloud size={16} /> Upload Material
                    </button>
                  </div>
                </div>

                {/* Dropzone Area */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `1.5px dashed ${line}`, borderRadius: 12, background: bgElev, padding: '22px',
                    textAlign: 'center', cursor: 'pointer', marginBottom: 18, transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(217, 119, 6, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                    <UploadCloud size={18} color={gold} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: text }}>
                    Drop Bare Acts, Judgment PDFs, Teacher Notes, or PYQ papers here or <span style={{ color: gold, textDecoration: 'underline' }}>Browse files</span>
                  </div>
                  <div style={{ fontSize: 11, color: textSoft, marginTop: 4 }}>
                    PDF, DOCX, TXT. Scanned Notes & Images automatically vectorized and indexed
                  </div>
                </div>

                {/* Sources Table */}
                {loadingSources ? (
                  <div style={{ padding: 32, textAlign: 'center', color: textSoft }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px', color: gold }} />
                    <span>Loading workspace documents...</span>
                  </div>
                ) : sources.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', background: bgElev, borderRadius: 10, border: `1px solid ${line}` }}>
                    <FileUp size={28} color={textSoft} style={{ margin: '0 auto 8px', opacity: 0.7 }} />
                    <p style={{ margin: 0, fontSize: 13, color: textSoft }}>No reference documents uploaded yet.</p>
                  </div>
                ) : (
                  <div style={{ border: `1px solid ${line}`, borderRadius: 10, overflow: 'hidden' }}>
                    {/* Table Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 140px 140px 110px 200px', background: bgElev, padding: '10px 14px', borderBottom: `1px solid ${line}`, fontSize: 11, fontWeight: 800, color: textSoft, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      <span style={{ textAlign: 'center' }}>Use</span>
                      <span>Document Name</span>
                      <span>Category</span>
                      <span>Size / Chunks</span>
                      <span style={{ textAlign: 'center' }}>Status</span>
                      <span style={{ textAlign: 'right' }}>Actions</span>
                    </div>

                    {/* Table Rows */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {sources.map(src => {
                        const isSelected = selectedSourceIds.includes(src.id)
                        return (
                          <div
                            key={src.id}
                            style={{
                              display: 'grid', gridTemplateColumns: '48px 1fr 140px 140px 110px 200px',
                              alignItems: 'center', padding: '12px 14px', borderBottom: `1px solid ${line}`,
                              background: isSelected ? 'rgba(217, 119, 6, 0.04)' : card,
                              transition: 'background 0.15s ease'
                            }}
                          >
                            {/* Checkbox */}
                            <div style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSourceSelection(src.id)}
                                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: gold }}
                              />
                            </div>

                            {/* Name */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                              <FileText size={16} color={gold} style={{ flexShrink: 0 }} />
                              <span style={{ fontWeight: 700, fontSize: 13, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {src.name}
                              </span>
                            </div>

                            {/* Category */}
                            <div>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: bgElev, color: textSoft, border: `1px solid ${line}` }}>
                                {src.kind || 'Document'}
                              </span>
                            </div>

                            {/* Size / Chunks */}
                            <div style={{ fontSize: 12, color: textSoft, fontWeight: 500 }}>
                              {src.textLength ? `${Math.round(src.textLength / 1000)}k chars` : 'Indexed'}
                            </div>

                            {/* Status */}
                            <div style={{ textAlign: 'center' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Indexed
                              </span>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              <button
                                onClick={() => handleInspectSource(src.id)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, background: bgElev, border: `1px solid ${line}`, color: text, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                              >
                                <Eye size={12} color={gold} /> Inspect
                              </button>
                              <button
                                onClick={() => handleAnalyzeReferenceStructure(src.id)}
                                disabled={isAnalyzingStructure}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, background: bgElev, border: `1px solid ${line}`, color: gold, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                              >
                                <Target size={12} /> Extract Blueprint
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* CARD 4: INDEXED KNOWLEDGE BASE & SOURCE CHUNKS (GROUNDING & INSPECT) */}
              <div style={{ background: card, border: cardBorder, borderRadius: 16, padding: '24px', boxShadow: cardShadow }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: inspectingSource ? 14 : 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 size={16} color="#10b981" />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: text }}>
                        Indexed Knowledge Base & Source Chunks
                      </h3>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                    Strict Grounding Active
                  </span>
                </div>

                <p style={{ margin: '0 0 14px', fontSize: 12, color: textSoft }}>
                  Transparency guarantee: AI generates mock test questions strictly grounded in the extracted sections, topics, and verified chunks below.
                </p>

                {inspectingSource ? (
                  <div style={{ background: bgElev, border: `1px solid ${line}`, borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${line}` }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: text, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FileText size={15} color={gold} /> {inspectingSource.name}
                        <span style={{ fontSize: 11, color: textSoft, fontWeight: 500 }}>
                          ({inspectingSource.kind} • {inspectingSource.textLength || 0} characters)
                        </span>
                      </div>
                      <button
                        onClick={() => setInspectingSource(null)}
                        style={{ background: 'transparent', border: 'none', color: textSoft, cursor: 'pointer', fontSize: 16, fontWeight: 700 }}
                      >
                        × Close
                      </button>
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: card, padding: 14, borderRadius: 8, border: `1px solid ${line}`, color: text, fontFamily: 'monospace', maxHeight: 380, overflowY: 'auto', margin: 0 }}>
                      {inspectingSource.fullText || inspectingSource.text || 'No text content available for this source.'}
                    </pre>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sources.filter(s => selectedSourceIds.includes(s.id)).slice(0, 3).map(src => (
                      <div
                        key={src.id}
                        onClick={() => handleInspectSource(src.id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ChevronRight size={14} color={gold} />
                          <FileText size={14} color={gold} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: text }}>{src.name}</span>
                          <span style={{ fontSize: 11, color: textSoft }}>• {src.textLength ? `${Math.round(src.textLength / 1000)}k chars` : 'Indexed'}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: card, color: textSoft, border: `1px solid ${line}` }}>
                          {src.kind || 'TXT'}
                        </span>
                      </div>
                    ))}
                    {selectedSourceIds.length === 0 && (
                      <div style={{ padding: 14, background: bgElev, borderRadius: 8, border: `1px dashed ${line}`, fontSize: 12, color: textSoft, textAlign: 'center' }}>
                        No sources currently selected. Check one or more documents above to inspect vector grounding.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* CARD 5: MY GENERATED MOCK TESTS & ATTEMPT RECORDS */}
              <div style={{ background: card, border: cardBorder, borderRadius: 16, padding: '24px', boxShadow: cardShadow }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(217, 119, 6, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Award size={18} color={gold} />
                    </div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: text }}>
                      My Generated Mock Tests & Attempt Records
                    </h3>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: bgElev, color: textSoft, border: `1px solid ${line}` }}>
                    {mockTests.length} Papers Available
                  </span>
                </div>

                {mockTests.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', background: bgElev, borderRadius: 10, border: `1px solid ${line}`, fontSize: 13, color: textSoft }}>
                    No mock tests generated yet. Click "Generate Mock Test" above to synthesize an exam.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                    {mockTests.slice(0, 4).map(t => (
                      <div key={t.id} style={{ background: bgElev, border: `1px solid ${line}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: gold }}>{t.difficulty || 'Custom'}</span>
                            <span style={{ fontSize: 11, color: textSoft }}>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}</span>
                          </div>
                          <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: text }}>
                            {t.scoreReport?.examTitle || t.topic}
                          </h4>
                          <div style={{ fontSize: 11, color: textSoft, marginBottom: 12 }}>
                            {t.questions?.length || t.questionCount} Questions • {t.scoreReport?.totalMarks || 100} Marks • {t.scoreReport?.durationMinutes || 45}m
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, paddingTop: 10, borderTop: `1px solid ${line}` }}>
                          <button
                            onClick={() => handleSelectPastTest(t)}
                            style={{ flex: 1, padding: '6px 10px', borderRadius: 6, background: card, border: `1px solid ${line}`, color: text, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                          >
                            <Eye size={13} color={gold} /> Preview & Practice
                          </button>
                          <button
                            onClick={() => handleDeleteTest(t.id)}
                            style={{ padding: '6px 10px', borderRadius: 6, background: card, border: `1px solid ${line}`, color: '#ef4444', cursor: 'pointer' }}
                            title="Delete Test"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* FLOW: PREVIEW */}
          {flowState === 'PREVIEW' && activeTest && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Test Action Bar */}
              <div style={{ background: card, border: cardBorder, borderRadius: 16, padding: '24px', boxShadow: cardShadow, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <button
                    onClick={() => setFlowState('IDLE')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: textSoft, fontSize: 13, cursor: 'pointer', marginBottom: 8, fontWeight: 600 }}
                  >
                    <ArrowLeft size={16} /> Back to Studio
                  </button>
                  <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: text }}>
                    {activeTest.scoreReport?.examTitle || activeTest.topic}
                  </h2>
                  <div style={{ display: 'flex', gap: 14, fontSize: 13, color: textSoft, marginTop: 6, flexWrap: 'wrap' }}>
                    <span>Total Questions: <strong style={{ color: text }}>{activeTest.questions?.length || 0}</strong></span>
                    {activeTest.scoreReport?.questionsToAttempt && (
                      <span>Questions to Attempt: <strong style={{ color: text }}>{activeTest.scoreReport.questionsToAttempt}</strong></span>
                    )}
                    <span>Maximum Marks: <strong style={{ color: gold }}>{activeTest.scoreReport?.totalMarks || 100} Marks</strong></span>
                    {activeTest.scoreReport?.totalPaperMarks && (
                      <span>Available Paper Marks: <strong style={{ color: textSoft }}>{activeTest.scoreReport.totalPaperMarks} Marks</strong></span>
                    )}
                    <span>Duration: <strong style={{ color: text }}>{activeTest.scoreReport?.durationMinutes || 45} mins</strong></span>
                    <span>Difficulty: <strong style={{ color: text }}>{activeTest.difficulty}</strong></span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={handleStartAttempt}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 26px', borderRadius: 10, background: '#10b981', color: '#ffffff', border: 'none', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)' }}
                  >
                    <Play size={18} /> Start Exam Attempt
                  </button>
                  <button
                    onClick={() => handleDeleteTest(activeTest.id)}
                    style={{ padding: '12px 16px', borderRadius: 10, background: bgElev, color: '#ef4444', border: `1px solid ${line}`, cursor: 'pointer' }}
                    title="Delete Test"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Instructions if any */}
              {activeTest.scoreReport?.instructions && activeTest.scoreReport.instructions.length > 0 && (
                <div style={{ background: card, border: cardBorder, borderRadius: 14, padding: 20, boxShadow: cardShadow }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: gold, display: 'block', marginBottom: 8 }}>General Exam Instructions:</span>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: textSoft, lineHeight: 1.6 }}>
                    {activeTest.scoreReport.instructions.map((ins, i) => (
                      <li key={i}>{ins}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Question Preview Carousel */}
              {currentPreviewQ && (
                <div style={{ background: card, border: cardBorder, borderRadius: 16, padding: '28px', boxShadow: cardShadow }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 8, background: bgElev, color: gold, border: `1px solid ${line}` }}>
                        Question {previewQuestionIndex + 1} of {activeTest.questions.length}
                      </span>
                      {currentPreviewQ.sectionName && (
                        <span style={{ fontSize: 13, color: textSoft, fontWeight: 600 }}>• {currentPreviewQ.sectionName}</span>
                      )}
                      <span style={{ fontSize: 12, color: textSoft }}>({currentPreviewQ.type})</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: gold }}>
                      +{currentPreviewQ.marks} Marks {currentPreviewQ.negativeMarks ? `(-${currentPreviewQ.negativeMarks})` : ''}
                    </span>
                  </div>

                  <p style={{ fontSize: 16, lineHeight: 1.6, fontWeight: 600, color: text, margin: '0 0 24px' }}>
                    {currentPreviewQ.question || currentPreviewQ.questionText}
                  </p>

                  {/* MCQ Options preview if applicable */}
                  {currentPreviewQ.options && currentPreviewQ.options.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                      {currentPreviewQ.options.map((opt, oIdx) => (
                        <div key={oIdx} style={{ padding: '12px 16px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, fontSize: 14, color: text }}>
                          <strong style={{ marginRight: 10, color: gold }}>{String.fromCharCode(65 + oIdx)}.</strong> {opt}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Grounding Citations */}
                  {currentPreviewQ.citations && currentPreviewQ.citations.length > 0 && (
                    <div style={{ background: bgElev, padding: 14, borderRadius: 10, border: `1px solid ${line}`, marginTop: 16 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: gold, display: 'block', marginBottom: 6 }}>Grounded Legal Citation:</span>
                      {currentPreviewQ.citations.map((c, cIdx) => (
                        <div key={cIdx} style={{ fontSize: 12, color: textSoft, lineHeight: 1.5 }}>
                          • <strong>{c.sourceName}</strong> {c.section ? `[${c.section}]` : ''}: {c.supportingText || ''}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Navigation in Preview */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, paddingTop: 18, borderTop: `1px solid ${line}` }}>
                    <button
                      onClick={() => setPreviewQuestionIndex(prev => Math.max(0, prev - 1))}
                      disabled={previewQuestionIndex === 0}
                      style={{ padding: '8px 18px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, color: text, fontWeight: 600, cursor: previewQuestionIndex === 0 ? 'not-allowed' : 'pointer' }}
                    >
                      Previous
                    </button>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 450 }}>
                      {activeTest.questions.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setPreviewQuestionIndex(i)}
                          style={{
                            width: 34, height: 34, borderRadius: 8, border: `1.5px solid ${i === previewQuestionIndex ? gold : line}`,
                            background: i === previewQuestionIndex ? gold : bgElev,
                            color: i === previewQuestionIndex ? '#000000' : text,
                            fontSize: 12, fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setPreviewQuestionIndex(prev => Math.min(activeTest.questions.length - 1, prev + 1))}
                      disabled={previewQuestionIndex === activeTest.questions.length - 1}
                      style={{ padding: '8px 18px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, color: text, fontWeight: 600, cursor: previewQuestionIndex === activeTest.questions.length - 1 ? 'not-allowed' : 'pointer' }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FLOW: ATTEMPT */}
          {flowState === 'ATTEMPT' && activeTest && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Sticky Exam Top Bar */}
              <div style={{ background: card, border: cardBorder, borderRadius: 16, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 12, zIndex: 100, boxShadow: '0 6px 20px rgba(0,0,0,0.1)' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: text }}>
                    {activeTest.scoreReport?.examTitle || activeTest.topic}
                  </h2>
                  <span style={{ fontSize: 12, color: textSoft, fontWeight: 500 }}>
                    Answered: <strong style={{ color: text }}>{answeredCount}</strong> / {activeTest.questions.length} • Marked: <strong style={{ color: '#8b5cf6' }}>{markedCount}</strong>
                  </span>
                </div>

                {/* Center Timer */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 24,
                  background: timeRemainingSeconds < 300 ? '#ef4444' : 'rgba(217, 119, 6, 0.1)',
                  color: timeRemainingSeconds < 300 ? '#ffffff' : gold,
                  border: `1.5px solid ${timeRemainingSeconds < 300 ? '#ef4444' : 'rgba(217, 119, 6, 0.25)'}`,
                  fontWeight: 800, fontSize: 17
                }}>
                  <Clock size={19} />
                  <span>{formatTime(timeRemainingSeconds)}</span>
                </div>

                {/* Right Actions: OCR upload & Submit */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => sheetInputRef.current?.click()}
                    disabled={isUploadingSheet}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, color: text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    title="Upload handwritten answer sheet for AI OCR transcription"
                  >
                    <UploadCloud size={16} color={gold} />
                    {isUploadingSheet ? 'Scanning...' : 'Upload Sheet (OCR)'}
                  </button>
                  <button
                    onClick={() => setShowSubmitConfirm(true)}
                    style={{ padding: '9px 20px', borderRadius: 8, background: '#10b981', color: '#ffffff', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }}
                  >
                    Submit Test
                  </button>
                </div>
              </div>

              {/* Main Attempt Split View */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: 20 }}>
                {/* Left: Active Question Card */}
                {currentAttemptQ && (
                  <div style={{ background: card, border: cardBorder, borderRadius: 16, padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 480, boxShadow: cardShadow }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, padding: '4px 12px', borderRadius: 8, background: bgElev, color: gold, border: `1px solid ${line}` }}>
                            Question {attemptQuestionIndex + 1}
                          </span>
                          {currentAttemptQ.sectionName && (
                            <span style={{ fontSize: 13, color: textSoft, fontWeight: 600 }}>• {currentAttemptQ.sectionName}</span>
                          )}
                          <span style={{ fontSize: 12, color: textSoft }}>({currentAttemptQ.type})</span>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: gold }}>
                          +{currentAttemptQ.marks} Marks {currentAttemptQ.negativeMarks ? `(-${currentAttemptQ.negativeMarks})` : ''}
                        </span>
                      </div>

                      <p style={{ fontSize: 16, lineHeight: 1.6, fontWeight: 600, color: text, margin: '0 0 24px' }}>
                        {currentAttemptQ.question || currentAttemptQ.questionText}
                      </p>

                      {/* 1. MCQ Radio Options */}
                      {currentAttemptQ.type === 'MCQ' && currentAttemptQ.options && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {currentAttemptQ.options.map((opt, oIdx) => {
                            const isSelected = answers[currentAttemptQ.id] === oIdx
                            return (
                              <div
                                key={oIdx}
                                onClick={() => handleSelectOption(currentAttemptQ.id, oIdx)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderRadius: 10,
                                  background: isSelected ? 'rgba(217, 119, 6, 0.08)' : bgElev,
                                  border: `1.5px solid ${isSelected ? gold : line}`,
                                  cursor: 'pointer', transition: 'all 0.15s ease'
                                }}
                              >
                                <div style={{
                                  width: 24, height: 24, borderRadius: '50%', border: `2px solid ${isSelected ? gold : line}`,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800,
                                  background: isSelected ? gold : 'transparent', color: isSelected ? '#000000' : text
                                }}>
                                  {String.fromCharCode(65 + oIdx)}
                                </div>
                                <span style={{ fontSize: 14, fontWeight: isSelected ? 700 : 500, color: text }}>{opt}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* 2. Multiple-Select Checkbox Options */}
                      {currentAttemptQ.type === 'Multiple-Select' && currentAttemptQ.options && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {currentAttemptQ.options.map((opt, oIdx) => {
                            const currentArr = Array.isArray(answers[currentAttemptQ.id]) ? answers[currentAttemptQ.id] : []
                            const isChecked = currentArr.includes(opt)
                            return (
                              <div
                                key={oIdx}
                                onClick={() => handleMultipleSelectOption(currentAttemptQ.id, opt)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderRadius: 10,
                                  background: isChecked ? 'rgba(217, 119, 6, 0.08)' : bgElev,
                                  border: `1.5px solid ${isChecked ? gold : line}`,
                                  cursor: 'pointer', transition: 'all 0.15s ease'
                                }}
                              >
                                <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${isChecked ? gold : line}`, background: isChecked ? gold : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {isChecked && <Check size={14} color="#000000" />}
                                </div>
                                <span style={{ fontSize: 14, fontWeight: isChecked ? 700 : 500, color: text }}>{opt}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* 3. True / False */}
                      {currentAttemptQ.type === 'True/False' && (
                        <div style={{ display: 'flex', gap: 16 }}>
                          {['True', 'False'].map(val => {
                            const isSelected = answers[currentAttemptQ.id] === val
                            return (
                              <button
                                key={val}
                                onClick={() => setAnswers(prev => ({ ...prev, [currentAttemptQ.id]: val }))}
                                style={{
                                  flex: 1, padding: '16px', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer',
                                  background: isSelected ? 'rgba(217, 119, 6, 0.1)' : bgElev,
                                  border: `2px solid ${isSelected ? gold : line}`,
                                  color: isSelected ? gold : text,
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {val}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* 4. Descriptive / Long Answer / Case Based */}
                      {currentAttemptQ.type !== 'MCQ' && currentAttemptQ.type !== 'Multiple-Select' && currentAttemptQ.type !== 'True/False' && (
                        <div>
                          <textarea
                            value={answers[currentAttemptQ.id] || ''}
                            onChange={e => handleTextAnswer(currentAttemptQ.id, e.target.value)}
                            placeholder="Draft your structured legal answer here (Issue, Rule/Statutory Provision, Legal Analysis, and Conclusion)..."
                            rows={11}
                            style={{ width: '100%', background: bgElev, border: `1px solid ${line}`, borderRadius: 12, padding: 16, color: text, fontSize: 14, lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: textSoft, marginTop: 8 }}>
                            <span>Words: {(answers[currentAttemptQ.id] || '').trim().split(/\s+/).filter(Boolean).length}</span>
                            <span>Chars: {(answers[currentAttemptQ.id] || '').length}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Question Bottom Action Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, paddingTop: 18, borderTop: `1px solid ${line}` }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          onClick={() => setMarkedForReview(prev => ({ ...prev, [currentAttemptQ.id]: !prev[currentAttemptQ.id] }))}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
                            background: markedForReview[currentAttemptQ.id] ? '#8b5cf6' : bgElev,
                            color: markedForReview[currentAttemptQ.id] ? '#ffffff' : text,
                            border: `1px solid ${line}`, fontSize: 13, fontWeight: 700
                          }}
                        >
                          <BookmarkCheck size={16} />
                          {markedForReview[currentAttemptQ.id] ? 'Marked for Review' : 'Mark for Review'}
                        </button>
                        <button
                          onClick={() => setAnswers(prev => { const n = { ...prev }; delete n[currentAttemptQ.id]; return n })}
                          style={{ padding: '9px 14px', borderRadius: 8, background: bgElev, color: textSoft, border: `1px solid ${line}`, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Clear Response
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          onClick={() => setAttemptQuestionIndex(prev => Math.max(0, prev - 1))}
                          disabled={attemptQuestionIndex === 0}
                          style={{ padding: '9px 18px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, color: text, fontWeight: 600, cursor: attemptQuestionIndex === 0 ? 'not-allowed' : 'pointer' }}
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setAttemptQuestionIndex(prev => Math.min(activeTest.questions.length - 1, prev + 1))}
                          disabled={attemptQuestionIndex === activeTest.questions.length - 1}
                          style={{ padding: '9px 20px', borderRadius: 8, background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', color: '#ffffff', border: 'none', fontWeight: 800, cursor: attemptQuestionIndex === activeTest.questions.length - 1 ? 'not-allowed' : 'pointer' }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Right: Question Palette & Navigation */}
                <div style={{ background: card, border: cardBorder, borderRadius: 16, padding: 20, height: 'fit-content', boxShadow: cardShadow }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: '0 0 14px', color: text }}>Question Palette</h3>

                  {/* Legend */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11, color: textSoft, marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: '#10b981' }} /> Answered
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: '#8b5cf6' }} /> Marked
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: bgElev, border: `1px solid ${line}` }} /> Unanswered
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, border: `2px solid ${gold}` }} /> Current
                    </div>
                  </div>

                  {/* Palette Numbers */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                    {activeTest.questions.map((q, idx) => {
                      const isAnswered = answers[q.id] !== undefined && answers[q.id] !== ''
                      const isMarked = markedForReview[q.id]
                      const isCurrent = idx === attemptQuestionIndex

                      let bgCol = bgElev
                      let textCol = text
                      if (isMarked) { bgCol = '#8b5cf6'; textCol = '#ffffff' }
                      else if (isAnswered) { bgCol = '#10b981'; textCol = '#ffffff' }

                      return (
                        <button
                          key={q.id}
                          onClick={() => setAttemptQuestionIndex(idx)}
                          style={{
                            height: 40, borderRadius: 8, cursor: 'pointer',
                            background: bgCol, color: textCol,
                            border: isCurrent ? `2.5px solid ${gold}` : `1px solid ${line}`,
                            fontWeight: 800, fontSize: 12, transition: 'all 0.15s ease'
                          }}
                        >
                          {idx + 1}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FLOW: EVALUATING */}
          {flowState === 'EVALUATING' && (
            <div style={{ padding: 80, textAlign: 'center', background: card, borderRadius: 16, border: cardBorder, boxShadow: cardShadow }}>
              <RefreshCw size={52} className="animate-spin" color={gold} style={{ margin: '0 auto 18px' }} />
              <h2 style={{ fontSize: 21, fontWeight: 800, margin: '0 0 8px', color: text }}>Evaluating Exam Submission...</h2>
              <p style={{ margin: 0, fontSize: 14, color: textSoft }}>
                Applying legal grading rubrics, computing negative marks, and transcribing AI analytical feedback.
              </p>
            </div>
          )}

          {/* FLOW: RESULT */}
          {flowState === 'RESULT' && activeAttempt && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Score Overview Card */}
              <div style={{ background: card, border: cardBorder, borderRadius: 16, padding: '28px', boxShadow: cardShadow }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: text }}>Examination Scorecard & Rubric Analysis</h2>
                    <span style={{ fontSize: 13, color: textSoft }}>
                      Completed on {new Date(activeAttempt.createdAt || Date.now()).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={handleRetakeTest}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, color: text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    >
                      <RotateCcw size={15} color={gold} /> Retake Test
                    </button>
                    <button
                      onClick={() => setFlowState('IDLE')}
                      style={{ padding: '9px 20px', borderRadius: 8, background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', color: '#ffffff', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(217, 119, 6, 0.25)' }}
                    >
                      Return to Studio
                    </button>
                  </div>
                </div>

                {/* Score Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
                  <div style={{ background: bgElev, padding: 18, borderRadius: 12, border: `1px solid ${line}`, textAlign: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: textSoft, display: 'block', marginBottom: 4 }}>Score</span>
                    <strong style={{ fontSize: 26, fontWeight: 800, color: gold }}>{activeAttempt.score} / {activeAttempt.total}</strong>
                  </div>
                  <div style={{ background: bgElev, padding: 18, borderRadius: 12, border: `1px solid ${line}`, textAlign: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: textSoft, display: 'block', marginBottom: 4 }}>Percentage</span>
                    <strong style={{ fontSize: 26, fontWeight: 800, color: activeAttempt.percentage >= 50 ? '#10b981' : '#ef4444' }}>{activeAttempt.percentage}%</strong>
                  </div>
                  <div style={{ background: bgElev, padding: 18, borderRadius: 12, border: `1px solid ${line}`, textAlign: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: textSoft, display: 'block', marginBottom: 4 }}>Accuracy</span>
                    <strong style={{ fontSize: 26, fontWeight: 800, color: text }}>{activeAttempt.accuracy}%</strong>
                  </div>
                  <div style={{ background: bgElev, padding: 18, borderRadius: 12, border: `1px solid ${line}`, textAlign: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: textSoft, display: 'block', marginBottom: 4 }}>Time Taken</span>
                    <strong style={{ fontSize: 26, fontWeight: 800, color: text }}>{Math.round((activeAttempt.timeTaken || 0) / 60)}m</strong>
                  </div>
                </div>

                {/* Strong & Weak Areas */}
                {(activeAttempt.answers?.strongAreas?.length || activeAttempt.answers?.weakAreas?.length) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 20 }}>
                    {activeAttempt.answers?.strongAreas && (
                      <div style={{ background: bgElev, padding: 16, borderRadius: 10, border: `1px solid ${line}` }}>
                        <strong style={{ fontSize: 13, fontWeight: 800, color: '#10b981', display: 'block', marginBottom: 6 }}>Key Strengths:</strong>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: textSoft, lineHeight: 1.6 }}>
                          {activeAttempt.answers.strongAreas.map((s, idx) => <li key={idx}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {activeAttempt.answers?.weakAreas && (
                      <div style={{ background: bgElev, padding: 16, borderRadius: 10, border: `1px solid ${line}` }}>
                        <strong style={{ fontSize: 13, fontWeight: 800, color: '#ef4444', display: 'block', marginBottom: 6 }}>Areas for Improvement:</strong>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: textSoft, lineHeight: 1.6 }}>
                          {activeAttempt.answers.weakAreas.map((w, idx) => <li key={idx}>{w}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Question Level Evaluation Filters */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'all', label: 'All Questions' },
                  { id: 'correct', label: 'Correct' },
                  { id: 'incorrect', label: 'Incorrect' },
                  { id: 'unanswered', label: 'Unanswered' },
                  { id: 'subjective', label: 'Subjective / Graded' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setEvalFilter(f.id as any)}
                    style={{
                      padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${evalFilter === f.id ? gold : line}`,
                      background: evalFilter === f.id ? 'rgba(217, 119, 6, 0.08)' : card,
                      color: evalFilter === f.id ? text : textSoft,
                      fontSize: 12, fontWeight: evalFilter === f.id ? 700 : 500, cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Question Evaluations List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filteredEvaluations.map((ev, idx) => (
                  <div key={idx} style={{ background: card, border: cardBorder, borderRadius: 14, padding: 22, boxShadow: cardShadow }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: bgElev, color: text, border: `1px solid ${line}` }}>
                          Q{ev.questionNumber}
                        </span>
                        <span style={{ fontSize: 12, color: textSoft, fontWeight: 500 }}>({ev.type})</span>
                        <span style={{
                          fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 12,
                          background: ev.isCorrect === true ? 'rgba(16, 185, 129, 0.15)' : (ev.result?.includes('Optional') || ev.result?.includes('Not Selected')) ? 'rgba(100, 116, 139, 0.15)' : ev.isCorrect === false ? 'rgba(239, 68, 68, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                          color: ev.isCorrect === true ? '#10b981' : (ev.result?.includes('Optional') || ev.result?.includes('Not Selected')) ? '#64748b' : ev.isCorrect === false ? '#ef4444' : '#8b5cf6'
                        }}>
                          {ev.result || (ev.isCorrect ? 'Correct' : 'Incorrect')}
                        </span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: gold }}>
                        {ev.awardedMarks} / {ev.marks} Marks
                      </span>
                    </div>

                    <p style={{ fontSize: 15, fontWeight: 600, color: text, margin: '0 0 16px', lineHeight: 1.5 }}>
                      {ev.questionText}
                    </p>

                    <div style={{ background: bgElev, padding: 14, borderRadius: 10, border: `1px solid ${line}`, fontSize: 13, marginBottom: 12 }}>
                      <strong style={{ color: textSoft, display: 'block', marginBottom: 4 }}>Your Answer:</strong>
                      <span style={{ color: text }}>{ev.userAnswer || 'No response provided.'}</span>
                    </div>

                    {ev.correctAnswer && (
                      <div style={{ background: bgElev, padding: 14, borderRadius: 10, border: `1px solid ${line}`, fontSize: 13, marginBottom: 12 }}>
                        <strong style={{ color: gold, display: 'block', marginBottom: 4 }}>Model / Correct Answer:</strong>
                        <span style={{ color: text }}>{ev.correctAnswer}</span>
                      </div>
                    )}

                    {ev.explanation && (
                      <div style={{ fontSize: 13, color: textSoft, lineHeight: 1.6, marginTop: 12 }}>
                        <strong>Explanation:</strong> {ev.explanation}
                      </div>
                    )}

                    {/* Rubric Breakdown for descriptive questions */}
                    {ev.rubricBreakdown && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${line}` }}>
                        <div style={{ fontSize: 11, color: textSoft }}>Legal Accuracy: <strong style={{ color: text }}>{ev.rubricBreakdown.legalAccuracy}%</strong></div>
                        <div style={{ fontSize: 11, color: textSoft }}>Issue Identification: <strong style={{ color: text }}>{ev.rubricBreakdown.issueIdentification}%</strong></div>
                        <div style={{ fontSize: 11, color: textSoft }}>Reasoning & Analysis: <strong style={{ color: text }}>{ev.rubricBreakdown.reasoningAnalysis}%</strong></div>
                        <div style={{ fontSize: 11, color: textSoft }}>Use of Authorities: <strong style={{ color: text }}>{ev.rubricBreakdown.useOfAuthorities}%</strong></div>
                        <div style={{ fontSize: 11, color: textSoft }}>Structure & Clarity: <strong style={{ color: text }}>{ev.rubricBreakdown.structureClarity}%</strong></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: SUBMIT CONFIRMATION */}
      {showSubmitConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: card, border: cardBorder, borderRadius: 16, padding: '26px', width: '100%', maxWidth: 440, boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800, color: text }}>Confirm Test Submission</h3>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: textSoft, lineHeight: 1.5 }}>
              Are you sure you want to end and submit your examination? Once submitted, your answers will be finalized and evaluated by AI.
            </p>
            <div style={{ background: bgElev, padding: 16, borderRadius: 10, border: `1px solid ${line}`, marginBottom: 22, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: textSoft }}>Answered:</span> <strong style={{ color: '#10b981' }}>{answeredCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: textSoft }}>Marked for Review:</span> <strong style={{ color: '#8b5cf6' }}>{markedCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: textSoft }}>Unanswered:</span> <strong style={{ color: text }}>{(activeTest?.questions?.length || 0) - answeredCount}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowSubmitConfirm(false)}
                style={{ padding: '9px 18px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, color: text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Continue Exam
              </button>
              <button
                onClick={handleSubmitAttempt}
                style={{ padding: '9px 22px', borderRadius: 8, background: '#10b981', color: '#ffffff', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }}
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HANDWRITTEN OCR REVIEW */}
      {ocrModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: card, border: cardBorder, borderRadius: 16, padding: '26px', width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: text }}>Review OCR Detected Answers</h3>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: textSoft }}>
              AI transcribed responses from "{ocrFileName}". Verify and edit before applying them to your exam.
            </p>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {detectedAnswers.map(ans => (
                <div key={ans.questionId} style={{ background: bgElev, border: `1px solid ${line}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: text }}>Q{ans.questionNumber}: {ans.questionText?.slice(0, 60)}...</span>
                    <span style={{
                      fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 10,
                      background: ans.confidenceLevel === 'High' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: ans.confidenceLevel === 'High' ? '#10b981' : '#f59e0b'
                    }}>
                      {ans.confidenceLevel} Confidence ({ans.confidence}%)
                    </span>
                  </div>

                  {editingOcrQId === ans.questionId ? (
                    <div>
                      <textarea
                        value={editOcrText}
                        onChange={e => setEditOcrText(e.target.value)}
                        rows={3}
                        style={{ width: '100%', background: card, border: `1px solid ${line}`, borderRadius: 8, padding: 10, color: text, fontSize: 13, boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => setEditingOcrQId(null)}
                          style={{ padding: '5px 12px', borderRadius: 6, background: bgElev, border: `1px solid ${line}`, color: text, fontSize: 12, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveOcrCorrection(ans.questionId, editOcrText)}
                          style={{ padding: '5px 14px', borderRadius: 6, background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', color: '#ffffff', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <p style={{ margin: 0, fontSize: 13, fontStyle: 'italic', color: text, lineHeight: 1.4 }}>"{ans.detectedAnswer}"</p>
                      <button
                        onClick={() => { setEditingOcrQId(ans.questionId); setEditOcrText(ans.detectedAnswer) }}
                        style={{ padding: '4px 10px', borderRadius: 6, background: card, border: `1px solid ${line}`, color: textSoft, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setOcrModalOpen(false)}
                style={{ padding: '9px 18px', borderRadius: 8, background: bgElev, border: `1px solid ${line}`, color: text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Discard
              </button>
              <button
                onClick={handleConfirmOcrAnswers}
                style={{ padding: '9px 20px', borderRadius: 8, background: '#10b981', color: '#ffffff', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }}
              >
                Apply Answers to Exam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
