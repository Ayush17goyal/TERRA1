import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import { ArrowLeft, ArrowRight, Award, Check, ChevronLeft, ChevronRight, Clock3, Flame, LockKeyhole, PenLine, BookOpen, Sparkles, Star, Target, Trophy } from 'lucide-react';
import './LearningPlatformPage.css';
import './LearningPlatformBrand.css';
import './LessonPremium.css';
import { API_BASE_URL } from '../../../lib/api';

type AnswerVerdict='correct'|'partial'|'incorrect';
type Review={scores:number[];overallScore:number;feedback:string;why:string;version?:number;createdAt?:string;passed?:boolean;verdict:AnswerVerdict;correctParts:string[];mistakes:string[];weakConcepts:string[];xpAward:number;needsRevision:boolean;pendingEvaluation?:boolean;localValidation?:string[]};
type RevisionItem={lessonId:number;module:string;mistakes:string[];weakConcepts:string[];aiFeedback:string;date:string;numberOfAttempts:number;score:number};
type PendingEvaluation={lessonId:number;answer:string;savedAt:string;retryCount:number;nextRetryAt:string};
type LessonContent={learningObjective:string;whyThisMatters?:string;learn:string[];professionalInsight?:string;observe:Array<{source:string;example:string;reasoning:string}>;judgesLens?:string;draftingPrinciple:string;beginnerMistakes:Array<{mistake:string;whyWrong:string;counselApproach:string}>;guidedPractice:{task:string;steps:string[]};independentChallenge:string;masteryQuestion:string;keyTakeaways?:string[];estimatedTime?:string;difficulty?:string;wordSelection?:Array<{chosen:string;alt:string;reason:string}>};
type LessonStatus='NOT_STARTED'|'IN_PROGRESS'|'PRACTICE_COMPLETED'|'CHALLENGE_COMPLETED'|'AI_REVIEW_COMPLETED'|'PASSED'|'UNLOCK_NEXT';
type State={topic:string;current:number;xp:number;answers:Record<number,string>;reviews:Record<number,Review>;pendingReviews:Record<number,Review>;masteryAnswers:Record<number,string>;reviewHistory:Record<number,Review[]>;lessonStates:Record<number,LessonStatus>;attempts:Record<number,number>;hintsUsed:Record<number,number>;timeSpent:Record<number,number>;badges:string[];streak:number;lastStudyDate:string;revisionQueue:Record<number,RevisionItem>;pendingEvaluations:Record<number,PendingEvaluation>;scrollPositions:Record<number,number>};
type Module={name:string;lessons:string[]};
const modules:Module[]=[
 {name:'Legislative Foundations',lessons:['Introduction to Legislative Drafting','What Makes a Good Law?','Characteristics of a Well Drafted Bare Act','Role and Responsibility of a Legislative Drafter','Life Cycle of a Law','Course Project: Drafting Your Own Bare Act']},
 {name:'Understanding the Legislative Problem',lessons:['Identifying a Legislative Problem','Choosing the Right Legislative Topic','Classifying Legislative Problems','Need for Legislation','Setting Legislative Objectives','Stakeholder Analysis','Constitutional Competence','Constitutional Limitations']},
 {name:'Legislative Research',lessons:['Planning Legislative Research','Research Existing Laws','Research Constitutional Provisions','Research Supreme Court Judgments','Research High Court Judgments','Research Law Commission Reports','Research Parliamentary Committee Reports','Comparative Foreign Legislation','Gap Analysis','Preparing a Legislative Research Report']},
 {name:'Legislative Planning',lessons:['Creating the Legislative Blueprint','Determining the Scope of the Act','Planning Parts, Chapters and Sections','Structuring Legislative Flow','Identifying Rights and Duties','Designing Regulatory Authorities','Planning Enforcement Mechanisms','Planning Rule Making Powers']},
 {name:'Legislative Drafting Language',lessons:['Principles of Legislative Drafting','Plain Legislative Language','Mandatory vs Directory Provisions','Using Shall, May and Must','Drafting Definitions','Interpretation Clauses','Provisos','Explanations','Illustrations','Exceptions','Non Obstante Clauses','Saving Clauses']},
 {name:'Drafting Every Part of a Bare Act',lessons:['Preamble','Statement of Objects and Reasons','Short Title','Extent','Commencement','Application','Definitions','Rights','Duties','Authorities','Powers','Procedures','Appeals','Offences','Penalties','Rule Making Powers','Repeal and Saving Clauses','Schedules and Forms']},
 {name:'Legislative Review',lessons:['Consistency Review','Constitutional Review','Cross Reference Review','Ambiguity Review','Plain Language Review','Drafting Error Review','Formatting and Structure Review','Final Legislative Review Checklist']},
 {name:'Practical Drafting Exercises',lessons:['Draft a Preamble','Draft Definitions','Draft Rights and Duties','Draft Powers of an Authority','Draft an Offence Provision','Draft a Penalty Clause','Draft an Appeal Provision','Draft Rule Making Powers','Draft a Complete Chapter','Draft a Mini Bare Act']},
 {name:'Advanced Legislative Drafting',lessons:['Drafting Amendment Acts','Drafting Repeal Acts','Drafting Rules and Regulations','Drafting Notifications and Orders','Drafting Delegated Legislation','Common Legislative Drafting Mistakes','Best Drafting Practices','AI Assisted Legislative Drafting']},
 {name:'Bare Act Analysis and Capstone',lessons:['Analyze the Indian Contract Act','Analyze the Bharatiya Nyaya Sanhita','Analyze the Right to Information Act','Analyze the Companies Act','Analyze a State Act','Improve a Poorly Drafted Provision','Draft a Complete Bare Act','Self Review and Peer Review','Graduation Project']},
];
const lessons=modules.flatMap((module,moduleIndex)=>module.lessons.map((title)=>({title,module:module.name,moduleIndex})));
const draftingExamples=['The Right to Information Act, 2005 — Section 3 grants every citizen the right to information.','The Indian Contract Act, 1872 — Section 10 lays down the essentials of a valid contract.','The Bharatiya Nyaya Sanhita, 2023 — Section 2 contains the definition clause.','The Companies Act, 2013 — Section 2(20) defines a company.','The Consumer Protection Act, 2019 — Preamble states the legislative purpose.','The Environment Protection Act, 1986 — Section 3 vests rule-making power in the Central Government.','The Arbitration and Conciliation Act, 1996 — Section 7 defines an arbitration agreement.','The Motor Vehicles Act, 1988 — Section 166 sets out procedure for compensation claims.','The Factories Act, 1948 — Section 2(m) defines a factory with a proviso and explanation.','The Transfer of Property Act, 1882 — Section 5 defines transfer of property.','The Specific Relief Act, 1963 — Section 10 uses "shall" to impose a mandatory duty on courts.','The Negotiable Instruments Act, 1881 — Section 6 defines a cheque using an inclusive definition.'];
const draftingLevels=['Legislative Apprentice','Junior Drafter','Legislative Analyst','Drafting Scholar','Parliamentary Drafter','Senior Legislative Counsel','Master Legislative Drafter'];
const skillAwards=['Introduction to Drafting','Good Law Principles','Well Drafted Act','Drafter\'s Role','Law Life Cycle','Course Project','Legislative Problem','Legislative Topic','Problem Classification','Need for Legislation','Legislative Objectives','Stakeholder Analysis','Constitutional Competence','Constitutional Limitations','Research Planning','Existing Laws Research','Constitutional Research','Supreme Court Research','High Court Research','Law Commission Research','Parliamentary Research','Comparative Legislation','Gap Analysis','Research Report','Legislative Blueprint','Scope Determination','Parts and Chapters','Legislative Flow Planning','Rights and Duties Planning','Regulatory Authorities Design','Enforcement Planning','Rule Making Planning','Drafting Principles','Plain Language','Mandatory vs Directory','Shall May Must','Definition Drafting','Interpretation Clauses','Proviso Drafting','Explanation Drafting','Illustration Drafting','Exception Drafting','Non Obstante Clauses','Saving Clauses','Preamble Drafting','Objects and Reasons','Short Title','Extent Clause','Commencement','Application Clause','Definitions Section','Rights Provisions','Duties Provisions','Authorities','Powers Clause','Procedures','Appeals Mechanism','Offences','Penalties','Rule Making Powers','Repeal and Saving','Schedules and Forms','Consistency Review','Constitutional Review','Cross Reference Review','Ambiguity Review','Plain Language Review','Drafting Error Review','Formatting Review','Final Checklist','Draft Preamble','Draft Definitions','Draft Rights and Duties','Draft Powers','Draft Offence','Draft Penalty','Draft Appeal','Draft Rule Making','Draft Chapter','Draft Mini Act','Amendment Acts','Repeal Acts','Rules and Regulations','Notifications and Orders','Delegated Legislation','Drafting Mistakes','Best Practices','AI Drafting','Contract Act Analysis','BNS Analysis','RTI Analysis','Companies Act Analysis','State Act Analysis','Improve Provision','Complete Bare Act','Self Review','Graduation Project'];
const specificGoals:Record<string,string>={
 'Introduction to Legislative Drafting':'Understand the professional role of a Legislative Counsel and why drafting is a distinct legal discipline.',
 'What Makes a Good Law?':'Identify the criteria by which Parliament, courts, and citizens judge whether legislation is well made.',
 'Characteristics of a Well Drafted Bare Act':'Recognise the hallmarks of precision, clarity, consistency, and accessibility in Indian legislation.',
 'Role and Responsibility of a Legislative Drafter':'Understand the institutional responsibilities and ethical obligations of a Parliamentary draftsperson.',
 'Life Cycle of a Law':'Trace the complete journey from identifying a social problem to a fully enacted and implemented Act.',
 'Course Project: Drafting Your Own Bare Act':'Identify a real legislative problem and commit to drafting an original Bare Act throughout this course.',
 'Identifying a Legislative Problem':'Articulate a precise social, economic, or legal gap that only legislation can remedy.',
 'Choosing the Right Legislative Topic':'Select a specific, actionable, and competence-appropriate topic for a new Parliamentary Act.',
 'Classifying Legislative Problems':'Classify proposed legislation correctly under the Union, State, or Concurrent List of the Seventh Schedule.',
 'Need for Legislation':'Justify why the identified problem requires an Act rather than an executive order or court direction.',
 'Setting Legislative Objectives':'Convert policy goals into measurable legal objectives each expressible as a provision.',
 'Stakeholder Analysis':'Map every rights-holder, duty-bearer, regulatory authority, and affected third party the Act will touch.',
 'Constitutional Competence':'Identify the correct legislature and constitutional authority for the proposed Act.',
 'Constitutional Limitations':'Anticipate fundamental rights challenges and design provisions to withstand constitutional scrutiny.',
 'Drafting Definitions':'Draft exhaustive, inclusive, extended, and deeming definitions correctly for a Bare Act.',
 'Graduation Project':'Present a complete, reviewed Bare Act draft demonstrating mastery of professional legislative drafting.'
};
const mistakes = [
  {
    mistake: 'Using vague standards like "appropriate", "reasonable", or "adequate" without defining the standard.',
    whyWrong: 'Vague standards grant unguided discretion to administrators, invite allegations of bias, and lead to systemic litigation over compliance.',
    counselApproach: 'Specify a quantitative standard or define the exact administrative criteria in the definitions section.'
  },
  {
    mistake: 'Drafting rights or benefits without identifying a corresponding actor or enforcement mechanism.',
    whyWrong: 'A right without a named duty-bearer is unenforceable. If the benefit is delayed, courts cannot issue a mandamus because no officer is held legally responsible.',
    counselApproach: 'Always designate the specific authority responsible for execution: "The [Authority] shall..."'
  },
  {
    mistake: 'Confusing mandatory "shall" with permissive "may" in operative clauses.',
    whyWrong: 'Using "may" when a duty is intended makes compliance optional, rendering the policy goal ineffective and leaving citizens without recourse.',
    counselApproach: 'Analyze the policy goal: use "shall" for mandatory duties and "may" for discretionary powers.'
  }
];
const KEY='legatrixon.research-academy.v1',blank:State={topic:'',current:0,xp:0,answers:{},reviews:{},pendingReviews:{},masteryAnswers:{},reviewHistory:{},lessonStates:{0:'NOT_STARTED'},attempts:{},hintsUsed:{},timeSpent:{},badges:[],streak:0,lastStudyDate:'',revisionQueue:{},pendingEvaluations:{},scrollPositions:{}};
const normalizeReview=(value:any):Review=>({scores:Array.isArray(value?.scores)?value.scores.map(Number):[0,0,0,0,0],overallScore:Number(value?.overallScore||0),feedback:String(value?.feedback||''),why:String(value?.why||''),version:Number(value?.version||1),createdAt:String(value?.createdAt||new Date().toISOString()),passed:value?.verdict==='correct'||value?.passed===true,verdict:value?.verdict==='correct'?'correct':value?.verdict==='partial'||value?.verdict==='almost_correct'?'partial':'incorrect',correctParts:Array.isArray(value?.correctParts)?value.correctParts:[],mistakes:Array.isArray(value?.mistakes)?value.mistakes.map((item:any)=>typeof item==='string'?item:String(item?.issue||item?.explanation||'')).filter(Boolean):[],weakConcepts:Array.isArray(value?.weakConcepts)?value.weakConcepts:[],xpAward:Number(value?.xpAward??(value?.verdict==='correct'?50:value?.verdict==='partial'||value?.verdict==='almost_correct'?25:10)),needsRevision:value?.verdict!=='correct',pendingEvaluation:value?.pendingEvaluation===true,localValidation:Array.isArray(value?.localValidation)?value.localValidation:[]});
const sanitizeState=(raw:any):State=>{const saved={...blank,...raw},reviews=Object.fromEntries(Object.entries(saved.reviews||{}).map(([key,value])=>[key,normalizeReview(value)])),pendingReviews=Object.fromEntries(Object.entries(saved.pendingReviews||{}).map(([key,value])=>[key,normalizeReview(value)]));for(const collection of [reviews,pendingReviews])for(const [key,value] of Object.entries(collection)){const review=value as Review,legacyUnavailable=review.pendingEvaluation===true||/evaluation.*unavailable|temporarily unavailable/i.test(review.feedback||''),legacyScores=!review.overallScore&&Array.isArray(review.scores)&&review.scores.length>0&&review.scores.every(score=>score<=5);if(legacyUnavailable||legacyScores)delete collection[Number(key)]}return{...saved,reviews,pendingReviews,revisionQueue:{...(saved.revisionQueue||{})},pendingEvaluations:{...(saved.pendingEvaluations||{})},scrollPositions:{...(saved.scrollPositions||{})},current:Math.min(Number(saved.current||0),lessons.length-1)}};
const load=()=>{try{return sanitizeState(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{return blank}};
const localValidate=(text:string,answers:Record<number,string>,lessonIndex:number)=>{const normalized=text.trim().replace(/\s+/g,' ').toLowerCase(),issues:string[]=[];if(!normalized)issues.push('The answer is empty.');else if(normalized.length<20)issues.push('The answer is too short for a meaningful review.');if(Object.entries(answers).some(([index,value])=>Number(index)!==lessonIndex&&String(value).trim().replace(/\s+/g,' ').toLowerCase()===normalized))issues.push('This duplicates a research note submitted for another lesson.');const legalSignals=(normalized.match(/\b(law|act|section|article|case|court|statute|legal|issue|ratio|constitutional|contract|bail|gst|arbitration|consumer|environment|cyber|company|intellectual|source|keyword|research|provision|definition)\w*/g)||[]).length;if(normalized.length>=80&&legalSignals<2)issues.push('The answer appears unrelated to legal research.');return issues};
const reviewFromAi=(data:any,lessonTitle:string,version:number,createdAt=new Date().toISOString()):Review=>{const ordered=['conceptUnderstanding','legalAccuracy','draftingLogic','professionalLanguage','structuralLogic'],verdict:AnswerVerdict=data.status==='correct'?'correct':data.status==='partial'?'partial':'incorrect';return{scores:ordered.map(k=>Number(data[k]||0)),overallScore:Number(data.overallScore||0),feedback:String(data.feedback||''),why:String(data.improvedAnswer||''),passed:verdict==='correct',verdict,correctParts:Array.isArray(data.strengths)?data.strengths:[],mistakes:Array.isArray(data.mistakes)?data.mistakes:[],weakConcepts:Array.isArray(data.weakConcepts)&&data.weakConcepts.length?data.weakConcepts:[lessonTitle],xpAward:Number(data.xpAward??(verdict==='correct'?50:verdict==='partial'?25:10)),needsRevision:verdict!=='correct',version,createdAt,pendingEvaluation:false,localValidation:[]}};

const processLessonTemplates = (obj: any, title: string, moduleName: string): any => {
  if (typeof obj === 'string') {
    return obj
      .replace(/\$\{title\.toLowerCase\(\)\}/g, title.toLowerCase())
      .replace(/\$\{title\}/g, title)
      .replace(/\$\{module\.toLowerCase\(\)\}/g, moduleName.toLowerCase())
      .replace(/\$\{module\}/g, moduleName);
  }
  if (Array.isArray(obj)) {
    return obj.map((item: any) => processLessonTemplates(item, title, moduleName));
  }
  if (obj !== null && typeof obj === 'object') {
    const res: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        res[key] = processLessonTemplates(obj[key], title, moduleName);
      }
    }
    return res;
  }
  return obj;
};

export default function LearningPlatformPage({ onOpenBareActAi, apiToken = '' }: { onOpenBareActAi?: () => void; apiToken?: string }){
 const { getToken }=useAuth();
 const [sessionToken,setSessionToken]=useState(''),[evaluationError,setEvaluationError]=useState(''),[reviewNotice,setReviewNotice]=useState('');
 const [sidebarOpen,setSidebarOpen]=useState(()=>localStorage.getItem('legatrixon.sidebar')!=='closed');
 const toggleSidebar=()=>setSidebarOpen(prev=>{const next=!prev;localStorage.setItem('legatrixon.sidebar',next?'open':'closed');return next});
 const [activeSection,setActiveSection]=useState('ll-s1');const [tooltipData,setTooltipData]=useState<{word:string;meaning:string;purpose:string;consequence:string}|null>(null);
 const effectiveToken=apiToken||sessionToken;
 useEffect(()=>{if(apiToken){setSessionToken('');return}let cancelled=false;getToken().then(token=>{if(!cancelled)setSessionToken(token||'')}).catch(()=>{if(!cancelled)setEvaluationError('Your session could not be verified. Please sign in again.')});return()=>{cancelled=true}},[apiToken,getToken]);
 const [s,setS]=useState<State>(load),[answer,setAnswer]=useState(s.answers[s.current]||''),[review,setReview]=useState<Review|null>(s.reviews[s.current]||s.pendingReviews[s.current]||null),[lessonContent,setLessonContent]=useState<LessonContent|null>(null),[masteryAnswer,setMasteryAnswer]=useState(s.masteryAnswers[s.current]||''),[masteryFeedback,setMasteryFeedback]=useState(''),[lessonLoading,setLessonLoading]=useState(false),[reviewLoading,setReviewLoading]=useState(false),[masteryLoading,setMasteryLoading]=useState(false),[showCelebration,setShowCelebration]=useState(false),[moduleComplete,setModuleComplete]=useState('');
 const complete=Object.keys(s.reviews).length,total=lessons.length,progress=Math.round(complete/total*100),lesson=lessons[s.current],example=draftingExamples[s.current%draftingExamples.length],skillAward=skillAwards[Math.min(s.current,skillAwards.length-1)],draftingLevel=draftingLevels[Math.min(draftingLevels.length-1,Math.floor(progress/15))],levelIndex=Math.min(draftingLevels.length-1,Math.floor(progress/15)),levelProgress=levelIndex<draftingLevels.length-1?(progress%15)/15*100:100,nextLevel=levelIndex<draftingLevels.length-1?draftingLevels[levelIndex+1]:'Master Legislative Drafter';
 const versionRef=useRef(0),hydratedRef=useRef(false),textareaRef=useRef<HTMLTextAreaElement|null>(null),lessonListRef=useRef<HTMLDivElement|null>(null);

  // ── New subjective practice state ────────────────────────────
  type PracticePhase = 'idle' | 'generating' | 'question' | 'error';
  const [practicePhase, setPracticePhase] = useState<PracticePhase>('idle');
  const [generatedQuestion, setGeneratedQuestion] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const [practiceError, setPracticeError] = useState('');
  const [practiceUserRequest, setPracticeUserRequest] = useState('');
  const [learningObjectiveRetries, setLearningObjectiveRetries] = useState(0);
  // Keep these so existing code that references them doesn't break
  const [generatedPractice] = useState('');
  const [practiceLoading] = useState(false);
  const [practiceDifficulty] = useState('Standard');

  useEffect(() => {
    setPracticePhase('idle');
    setGeneratedQuestion('');
    setPracticeAnswer('');
    setPracticeError('');
    setPracticeUserRequest('');
    setQuestionCount(0);
    setLearningObjectiveRetries(0);
  }, [s.current]);
 useEffect(()=>{
    let cancelled=false;
    setLessonLoading(true);
    setLessonContent(null);
    fetch(`${API_BASE_URL}/drafting-mentor/academy/lessons/${s.current}`,{headers:{Authorization:`Bearer ${effectiveToken}`}})
      .then(r=>r.ok?r.json():Promise.reject())
      .then(data=>{
        if(!cancelled && data.content) {
          const processed = processLessonTemplates(data.content, lesson.title, lesson.module);
          if (!processed.learningObjective || !processed.learningObjective.trim()) {
            if (learningObjectiveRetries < 2) {
              setLearningObjectiveRetries(prev => prev + 1);
              return;
            }
          }
          setLessonContent(processed);
        }
      })
      .catch(()=>{})
      .finally(()=>{if(!cancelled)setLessonLoading(false)});
    return()=>{cancelled=true}
  },[s.current,effectiveToken,lesson.title,lesson.module,learningObjectiveRetries]);  const score=useMemo(()=>{const all=Object.values(s.reviews).flatMap(r=>r.scores);return all.length?Math.round(all.reduce((a,b)=>a+b,0)/all.length):0},[s.reviews]); useEffect(()=>{const obs=new IntersectionObserver(entries=>{entries.forEach(ent=>{if(ent.isIntersecting)setActiveSection(ent.target.id)});},{rootMargin:'-20% 0px -70% 0px'});const secs=document.querySelectorAll('[id^="ll-s"]');secs.forEach(el=>obs.observe(el));return()=>obs.disconnect();},[s.current,lessonContent]); const LEGAL_KW:Record<string,{meaning:string;purpose:string;consequence:string}>={'shall':{meaning:'Creates a mandatory, non-discretionary legal obligation.',purpose:'Parliament uses "shall" when compliance is non-negotiable — no authority can excuse non-performance.',consequence:'Breach of a "shall" provision automatically creates legal liability. Courts cannot excuse non-compliance.'},'may':{meaning:'Creates a discretionary or permissive power — not an obligation.',purpose:'Parliament uses "may" when the authority has a choice. It confers power without compelling its exercise.',consequence:'No liability arises if the authority elects not to exercise the power.'},'means':{meaning:'Creates an exhaustive, closed definition. Nothing outside this definition qualifies legally.',purpose:'Parliament uses "means" to strictly confine the legal meaning to exactly what is stated.',consequence:'Courts automatically exclude anything not mentioned — the definition is conclusive.'},'includes':{meaning:'Creates a non-exhaustive, expansive definition. Items listed are illustrative, not exhaustive.',purpose:'Parliament uses "includes" when it intends the word to cover more than what is explicitly listed.',consequence:'Courts may add items not listed if they fit the legislative intent — the definition is expansive.'},'person':{meaning:'Includes every legal entity — natural persons, companies, governments, and foreign nationals.',purpose:'Parliament uses "person" rather than "citizen" to ensure comprehensive, universal coverage.',consequence:'Corporations, non-citizens, government bodies, and artificial persons are all bound.'},'deemed':{meaning:'A legal fiction — Parliament treats X as Y for all legal purposes even if factually untrue.',purpose:'Creates irrebuttable presumptions that provide certainty and eliminate administrative disputes.',consequence:'Courts cannot go behind the deem — it is conclusive and final for all legal purposes.'},'notwithstanding':{meaning:'Non obstante — this provision overrides and prevails over all conflicting legislation.',purpose:'Parliament uses this when it intends this provision to have supremacy over all other Acts and rules.',consequence:'All conflicting statutes, rules, and regulations automatically yield to this provision.'},}; const DRAFTING_PAIRS=[{chosen:'shall',alt:'may',reason:'Creates a mandatory obligation — non-compliance is automatically a legal breach regardless of intent.'},{chosen:'means',alt:'includes',reason:'Exhaustive definition — only what is listed qualifies. Nothing additional can be implied by courts.'},{chosen:'person',alt:'citizen',reason:'Covers every legal entity including companies, foreigners, and governments — maximum legislative reach.'},{chosen:'notwithstanding',alt:'subject to',reason:'This provision prevails absolutely over all conflicting legislation — Parliament grants it supremacy.'},]; const LESSON_SECTIONS=['Why This Exists','Think Like the Drafter','Dissect the Bare Act',"Judge's Lens",'Legislative Drafting Secret','Real Courtroom Application','Common Drafting Mistakes','You Are the Drafter','Supreme Court Commentary',"Examiner's Note",'Remember Forever']; const handleKW=(word:string)=>{const kd=LEGAL_KW[word.toLowerCase()];if(kd){setTooltipData({word,meaning:kd.meaning,purpose:kd.purpose,consequence:kd.consequence});return}const dynamicPair=lessonContent?.wordSelection?.find(x=>x.chosen.toLowerCase()===word.toLowerCase());if(dynamicPair){setTooltipData({word,meaning:`Legislative word choice: "${dynamicPair.chosen}" vs "${dynamicPair.alt}"`,purpose:dynamicPair.reason,consequence:`Substituting "${dynamicPair.chosen}" with "${dynamicPair.alt}" changes the statutory intent and legal effect of the provision.`})}};
 useEffect(()=>{if(!effectiveToken){return}let cancelled=false;fetch(`${API_BASE_URL}/drafting-mentor/academy/state`,{headers:{Authorization:`Bearer ${effectiveToken}`}}).then(r=>r.ok?r.json():Promise.reject(new Error(`Resume failed (${r.status})`))).then(remote=>{if(cancelled)return;versionRef.current=remote.version||0;if(remote.state&&Object.keys(remote.state).length){const restored=sanitizeState(remote.state);setS(restored);setAnswer(restored.answers[restored.current]||'');setReview(restored.reviews[restored.current]||restored.pendingReviews[restored.current]||null);setMasteryAnswer(restored.masteryAnswers[restored.current]||'');requestAnimationFrame(()=>{if(lessonListRef.current)lessonListRef.current.scrollTop=Number(remote.state.scrollPosition||0);if(textareaRef.current){const cursor=Math.min(Number(remote.state.cursorPosition||0),textareaRef.current.value.length);textareaRef.current.setSelectionRange(cursor,cursor)}})}hydratedRef.current=true}).catch(()=>{hydratedRef.current=true});return()=>{cancelled=true}},[effectiveToken]);
 useEffect(()=>{if(!hydratedRef.current)return;const timer=window.setTimeout(()=>{const answers={...s.answers,[s.current]:answer};const snapshot={...s,answers,completedLessons:Object.keys(s.reviews).map(Number),completedModules:modules.map((m,i)=>m.lessons.every((_,o)=>Boolean(s.reviews[lessons.findIndex(x=>x.module===m.name)+o]))?i:-1).filter(i=>i>=0),currentModule:s.current>=0?lessons[s.current].moduleIndex:0,currentStep:review?'AI_REVIEW_COMPLETED':answer.trim()?'IN_PROGRESS':'NOT_STARTED',totalScore:score,researchMethodScore:score,currentResearchNote:answer,researchNotebook:Object.entries(s.answers).map(([lessonIndex,text])=>({lessonIndex:Number(lessonIndex),text})),lastVisitedLesson:s.current,lastActivityTimestamp:new Date().toISOString(),journeyPercentage:Math.round(Object.keys(s.reviews).length/lessons.length*100),cursorPosition:textareaRef.current?.selectionStart||0,scrollPosition:lessonListRef.current?.scrollTop||0};localStorage.setItem(KEY,JSON.stringify(snapshot));if(effectiveToken&&navigator.onLine){fetch(`${API_BASE_URL}/drafting-mentor/academy/state`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${effectiveToken}`},body:JSON.stringify({version:versionRef.current,state:snapshot})}).then(async r=>{if(!r.ok)throw new Error(String(r.status));const result=await r.json();versionRef.current=result.version||versionRef.current;if(result.conflict&&result.state){setS({...blank,...result.state} as State)}}).catch(()=>localStorage.setItem(`${KEY}.pending`,JSON.stringify(snapshot))) }},1500);return()=>window.clearTimeout(timer)},[s,answer,review,score,effectiveToken]);
 useEffect(()=>{const sync=()=>{const pending=localStorage.getItem(`${KEY}.pending`);if(!pending||!effectiveToken)return;fetch(`${API_BASE_URL}/drafting-mentor/academy/state`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${effectiveToken}`},body:JSON.stringify({version:versionRef.current,state:JSON.parse(pending)})}).then(r=>r.ok?r.json():Promise.reject()).then(result=>{versionRef.current=result.version||versionRef.current;localStorage.removeItem(`${KEY}.pending`)}).catch(()=>{})};window.addEventListener('online',sync);return()=>window.removeEventListener('online',sync)},[effectiveToken]);
 useEffect(()=>{if(!effectiveToken)return;let running=false,cancelled=false;const processQueue=async()=>{if(running||cancelled)return;running=true;try{const snapshot=load(),due=Object.values(snapshot.pendingEvaluations||{}).filter(item=>new Date(item.nextRetryAt).getTime()<=Date.now()).sort((a,b)=>new Date(a.savedAt).getTime()-new Date(b.savedAt).getTime());if(!due.length)return;const item=due[0],authToken=effectiveToken||await getToken();if(!authToken)return;const response=await fetch(`${API_BASE_URL}/drafting-mentor/academy/lessons/${item.lessonId}/review`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${authToken}`},body:JSON.stringify({answer:item.answer})});if(!response.ok)throw new Error(String(response.status));const data=await response.json(),meta=lessons[item.lessonId],readyReview=reviewFromAi(data,meta?.title||`Lesson ${item.lessonId+1}`,(snapshot.reviewHistory[item.lessonId]||[]).length+1);setS(prev=>{if(!prev.pendingEvaluations[item.lessonId])return prev;const pendingEvaluations={...prev.pendingEvaluations};delete pendingEvaluations[item.lessonId];const revisionQueue={...prev.revisionQueue},attemptCount=prev.attempts[item.lessonId]||1;if(readyReview.needsRevision)revisionQueue[item.lessonId]={lessonId:item.lessonId,module:meta?.module||'',mistakes:readyReview.mistakes,weakConcepts:readyReview.weakConcepts,aiFeedback:readyReview.feedback,date:readyReview.createdAt||new Date().toISOString(),numberOfAttempts:attemptCount,score:readyReview.overallScore};else delete revisionQueue[item.lessonId];const next={...prev,reviews:{...prev.reviews,[item.lessonId]:readyReview},pendingReviews:{...prev.pendingReviews,[item.lessonId]:readyReview},reviewHistory:{...prev.reviewHistory,[item.lessonId]:[...(prev.reviewHistory[item.lessonId]||[]),readyReview]},revisionQueue,pendingEvaluations,xp:prev.xp+readyReview.xpAward};localStorage.setItem(KEY,JSON.stringify(next));return next});if(s.current===item.lessonId)setReview(readyReview);setReviewNotice('Your Senior Advocate Mentor Review is ready.')}catch{setS(prev=>{const snapshot=prev.pendingEvaluations||{},item=Object.values(snapshot).filter(entry=>new Date(entry.nextRetryAt).getTime()<=Date.now()).sort((a,b)=>new Date(a.savedAt).getTime()-new Date(b.savedAt).getTime())[0];if(!item)return prev;const retryCount=item.retryCount+1,delay=Math.min(300000,30000*Math.pow(2,Math.min(retryCount,3))),next={...prev,pendingEvaluations:{...prev.pendingEvaluations,[item.lessonId]:{...item,retryCount,nextRetryAt:new Date(Date.now()+delay).toISOString()}}};localStorage.setItem(KEY,JSON.stringify(next));return next})}finally{running=false}};const timer=window.setInterval(processQueue,30000),online=()=>processQueue();window.addEventListener('online',online);processQueue();return()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener('online',online)}},[effectiveToken,getToken,s.current]);
 const save=(n:State)=>{setS(n);localStorage.setItem(KEY,JSON.stringify(n))};
 const exportDraft=async()=>{const {jsPDF}=await import('jspdf');const pdf=new jsPDF({unit:'pt',format:'a4'}),margin=48,width=499;let y=54;pdf.setFont('times','bold');pdf.setFontSize(16);pdf.text((s.topic||'LEGISLATIVE DRAFTING NOTEBOOK').toUpperCase(),297, y,{align:'center'});y+=30;pdf.setFontSize(10);for(const [index,text] of Object.entries(s.answers).sort(([a],[b])=>Number(a)-Number(b))){if(!text.trim())continue;const heading=`Lesson ${Number(index)+1}: ${lessons[Number(index)]?.title||'Research notebook entry'}`;const lines=pdf.splitTextToSize(text,width);if(y+lines.length*13+32>790){pdf.addPage();y=54}pdf.setFont('times','bold');pdf.text(heading,margin,y);y+=16;pdf.setFont('times','normal');pdf.text(lines,margin,y);y+=lines.length*13+18}pdf.save('legatrixon-drafting-notebook.pdf')};
 const open=(i:number)=>{if(i<0||i>complete||i>=total)return;const scrollPositions={...(s.scrollPositions||{}),[s.current]:window.scrollY},answers={...s.answers,[s.current]:answer},nextState={...s,current:i,answers,scrollPositions};save(nextState);setAnswer(answers[i]||'');setReview(nextState.reviews[i]||nextState.pendingReviews[i]||null);setMasteryAnswer(nextState.masteryAnswers[i]||'');setMasteryFeedback('');setEvaluationError('');requestAnimationFrame(()=>window.scrollTo({top:scrollPositions[i]||0,behavior:'auto'}))};
 const submit=async()=>{
  const answerText=answer.trim();
  if(answerText.length<20||reviewLoading)return;
  setReviewLoading(true);setEvaluationError('');setReviewNotice('');
  const createdAt=new Date().toISOString(),prior=s.reviewHistory[s.current]||[],attempts={...s.attempts,[s.current]:(s.attempts[s.current]||0)+1},localIssues=localValidate(answerText,s.answers,s.current);
  const queued:PendingEvaluation={lessonId:s.current,answer:answerText,savedAt:createdAt,retryCount:0,nextRetryAt:createdAt};
  save({...s,answers:{...s.answers,[s.current]:answerText},attempts,pendingEvaluations:{...(s.pendingEvaluations||{}),[s.current]:queued}});
  try{
   const authToken=effectiveToken||await getToken()||'';
   const evaluationUrl=`${API_BASE_URL}/drafting-mentor/academy/lessons/${s.current}/review`,requestStarted=performance.now();
   console.info('[academy-evaluation] request',{url:evaluationUrl,method:'POST',lessonId:s.current,answerLength:answerText.length});
   const response=await fetch(evaluationUrl,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${authToken}`},body:JSON.stringify({answer:answerText})});
   const rawResponse=await response.text();
   console.info('[academy-evaluation] response',{url:evaluationUrl,status:response.status,ok:response.ok,durationMs:Math.round(performance.now()-requestStarted),rawResponse});
   let data:any;try{data=JSON.parse(rawResponse)}catch(error){console.error('[academy-evaluation] JSON parsing failure',{status:response.status,rawResponse,error});throw new Error(`AI review returned invalid JSON (HTTP ${response.status}).`)}
   if(!response.ok)throw new Error(data?.message||`AI evaluation failed (HTTP ${response.status}).`);
   console.info('[academy-evaluation] parsed response',{lessonId:s.current,status:data.status,overallScore:data.overallScore});
   const r=reviewFromAi(data,lesson.title,prior.length+1,createdAt),history={...s.reviewHistory,[s.current]:[...prior,r]},completedBefore=Boolean(s.reviews[s.current]),completeAfter=complete+(completedBefore?0:1),badges=[...(s.badges||[])],pendingEvaluations={...(s.pendingEvaluations||{})};
   delete pendingEvaluations[s.current];if(completeAfter>=1&&!badges.includes('First Lesson'))badges.push('First Lesson');if(completeAfter===total&&!badges.includes('Graduation'))badges.push('Graduation');
   const revisionQueue={...(s.revisionQueue||{})};if(r.needsRevision)revisionQueue[s.current]={lessonId:s.current,module:lesson.module,mistakes:r.mistakes,weakConcepts:r.weakConcepts,aiFeedback:r.feedback,date:createdAt,numberOfAttempts:attempts[s.current],score:r.overallScore};else delete revisionQueue[s.current];
   const _today=new Date().toDateString(),_dayBefore=new Date(Date.now()-86400000).toDateString(),_newStreak=!s.lastStudyDate?1:s.lastStudyDate===_today?s.streak:s.lastStudyDate===_dayBefore?s.streak+1:1;
   save({...s,answers:{...s.answers,[s.current]:answerText},reviews:{...s.reviews,[s.current]:r},pendingReviews:{...s.pendingReviews,[s.current]:r},reviewHistory:history,attempts,xp:completedBefore&&!s.reviews[s.current]?.pendingEvaluation?s.xp:s.xp+r.xpAward,badges,revisionQueue,pendingEvaluations,streak:_newStreak,lastStudyDate:_today,lessonStates:{...s.lessonStates,[s.current]:'UNLOCK_NEXT',...(s.current<total-1?{[s.current+1]:'NOT_STARTED'}:{})}});setReview(r);
   if(r.verdict==='correct'){const _modName=lesson.module,_modStart=lessons.findIndex(x=>x.module===_modName),_modLen=modules[lesson.moduleIndex].lessons.length,_allDone=Array.from({length:_modLen},(_,oi)=>_modStart+oi).every(li=>li===s.current||Boolean(s.reviews[li]));if(_allDone)setModuleComplete(_modName);setShowCelebration(true);setTimeout(()=>{setShowCelebration(false);setModuleComplete('')},3600);}
  }catch(error){
   console.error('[academy-evaluation] failed',{lessonId:s.current,error});
   setEvaluationError(error instanceof Error?error.message:'AI evaluation request failed.');
   if(error instanceof Error&&/upgrade|limit|paid feature/i.test(error.message)){
    setS(prev=>{const pendingEvaluations={...(prev.pendingEvaluations||{})};delete pendingEvaluations[s.current];const next={...prev,pendingEvaluations};localStorage.setItem(KEY,JSON.stringify(next));return next});
    return;
   }
   const fallback:Review={scores:[0,0,0,0,0],overallScore:0,feedback:'Your answer has been safely saved. The AI reviewer is temporarily unavailable.',why:localIssues.length?`Local checks: ${localIssues.join(' ')}`:'Local checks passed. Your Parliamentary Counsel Review will be generated automatically.',passed:false,verdict:'partial',correctParts:[],mistakes:localIssues,weakConcepts:[lesson.title],xpAward:0,needsRevision:true,version:prior.length+1,createdAt,pendingEvaluation:true,localValidation:localIssues};
   const pendingEvaluations={...(s.pendingEvaluations||{}),[s.current]:{...queued,retryCount:1,nextRetryAt:new Date(Date.now()+30000).toISOString()}},revisionQueue={...(s.revisionQueue||{}),[s.current]:{lessonId:s.current,module:lesson.module,mistakes:localIssues,weakConcepts:[lesson.title],aiFeedback:'AI review pending',date:createdAt,numberOfAttempts:attempts[s.current],score:0}},completedBefore=Boolean(s.reviews[s.current]);
   save({...s,answers:{...s.answers,[s.current]:answerText},reviews:{...s.reviews,[s.current]:fallback},pendingReviews:{...s.pendingReviews,[s.current]:fallback},reviewHistory:{...s.reviewHistory,[s.current]:[...prior,fallback]},attempts,pendingEvaluations,revisionQueue,lessonStates:{...s.lessonStates,[s.current]:'UNLOCK_NEXT',...(s.current<total-1?{[s.current+1]:'NOT_STARTED'}:{})},xp:s.xp+(completedBefore?0:0)});setReview(fallback);
  }finally{setReviewLoading(false)}
 }; const submitMastery=async()=>{if(!review?.passed||masteryAnswer.trim().length<5||masteryLoading)return;setMasteryLoading(true);try{const response=await fetch(`${API_BASE_URL}/drafting-mentor/academy/lessons/${s.current}/mastery`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${effectiveToken}`},body:JSON.stringify({answer:masteryAnswer.trim()})});if(!response.ok)throw new Error('Mastery check failed');const result=await response.json();setMasteryFeedback(result.correct?result.feedback:`${result.feedback} Hint: ${result.hint}`);const masteryAnswers={...s.masteryAnswers,[s.current]:masteryAnswer.trim()};if(!result.correct){save({...s,masteryAnswers,lessonStates:{...s.lessonStates,[s.current]:'AI_REVIEW_COMPLETED'}});return}const completedBefore=Boolean(s.reviews[s.current]),completeAfter=complete+(completedBefore?0:1),badges=[...(s.badges||[])];if(completeAfter>=1&&!badges.includes('First Lesson'))badges.push('First Lesson');if(completeAfter>=22&&!badges.includes('Legislative Analyst'))badges.push('Legislative Analyst');if(completeAfter>=36&&!badges.includes('Parliamentary Drafter'))badges.push('Parliamentary Drafter');if(completeAfter>=55&&!badges.includes('Senior Legislative Counsel'))badges.push('Senior Legislative Counsel');if(completeAfter>=71&&!badges.includes('Master Drafter'))badges.push('Master Drafter');if(completeAfter===total&&!badges.includes('Graduation'))badges.push('Graduation');save({...s,xp:completedBefore?s.xp:s.xp+50,reviews:{...s.reviews,[s.current]:review},masteryAnswers,badges,lessonStates:{...s.lessonStates,[s.current]:'UNLOCK_NEXT',...(s.current<total-1?{[s.current+1]:'NOT_STARTED'}:{})}})}catch{setMasteryFeedback('The mastery service is temporarily unavailable. Your answer has been autosaved; retry when connected.')}finally{setMasteryLoading(false)}};
  const handleGenerateSubjectiveQuestion = async () => {
    setPracticePhase('generating');
    setPracticeError('');
    setPracticeAnswer('');

    // Build full lesson context to send to AI
    const lessonContext = [
      `Lesson Title: ${lesson.title}`,
      `Module: ${lesson.module}`,
      lessonContent?.learningObjective ? `Learning Objective: ${lessonContent.learningObjective}` : '',
      lessonContent?.whyThisMatters ? `Why This Matters: ${lessonContent.whyThisMatters}` : '',
      lessonContent?.draftingPrinciple ? `Drafting Principle: ${lessonContent.draftingPrinciple}` : '',
      lessonContent?.learn?.length
        ? `Key Concepts Taught:\n${lessonContent.learn.map((l, i) => `${i + 1}. ${l}`).join('\n')}`
        : '',
      lessonContent?.keyTakeaways?.length
        ? `Key Takeaways:\n${lessonContent.keyTakeaways.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
        : '',
      lessonContent?.professionalInsight ? `Professional Insight: ${lessonContent.professionalInsight}` : '',
      lessonContent?.guidedPractice?.task ? `Guided Practice Task: ${lessonContent.guidedPractice.task}` : '',
      lessonContent?.masteryQuestion ? `Mastery Question Context: ${lessonContent.masteryQuestion}` : '',
      specificGoals[lesson.title] ? `Lesson Goal: ${specificGoals[lesson.title]}` : '',
    ].filter(Boolean).join('\n\n');

    const userFocus = practiceUserRequest.trim();
    const systemInstruction = `You are LexMentor AI inside LEGATRIXON's Bare Act Drafting Mentor.

Generate EXACTLY ONE subjective/descriptive practice question.

The student is currently studying:
${lessonContext}

${userFocus ? `The student's requested focus is: "${userFocus}"

IMPORTANT: The student's requested focus is ONLY a preference for which aspect of the current lesson to emphasise. It is NOT permission to introduce outside knowledge.
If the requested topic is not covered in the current lesson, do NOT introduce it. Instead, generate a question from the closest relevant concept that IS covered in this lesson.` : 'Generate an appropriate question from the concepts taught in this lesson.'}

Rules you MUST follow:
- Generate EXACTLY ONE question.
- The question must be subjective/descriptive (Explain / Discuss / Analyse / Compare / Describe / Why is / How would you...).
- Do NOT generate MCQs, True/False, fill-in-the-blank, or one-word questions.
- Do NOT provide answer options (A/B/C/D).
- Do NOT introduce advanced legal concepts not taught in this lesson.
- Do NOT use knowledge from future lessons or unrelated Bare Acts.
- The question must be answerable using ONLY the content of this lesson.
- Match the difficulty level of the current lesson.
- Return ONLY the question text — no preamble, no numbering, no explanation.`;

    try {
      const authToken = effectiveToken || await getToken() || '';
      const response = await fetch(`${API_BASE_URL}/drafting-mentor/academy/lessons/${s.current}/practice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          prompt: systemInstruction,
          lessonContext,
          lessonTitle: lesson.title,
          lessonModule: lesson.module,
          userRequest: userFocus || null,
          questionType: 'subjective',
          count: 1,
          difficulty: 'lesson-appropriate'
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.message || `Question generation failed (HTTP ${response.status}).`);
      }

      const data = await response.json();
      // Accept either data.questions or data.question or data.content
      const questionText = (data.question || data.questions || data.content || '').trim();
      if (!questionText) throw new Error('AI returned an empty question. Please try again.');

      setGeneratedQuestion(questionText);
      setQuestionCount(prev => prev + 1);
      setPracticePhase('question');
    } catch (err: any) {
      console.error('[practice-question] generation failed:', err);
      setPracticeError(err.message || 'Unable to generate your practice question. Please try again.');
      setPracticePhase('error');
    }
  };

  const formatMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('###')) {
        return <h4 key={i} className="ll-md-h4">{trimmed.replace(/^###\s*/, '')}</h4>;
      }
      if (trimmed.startsWith('##')) {
        return <h3 key={i} className="ll-md-h3">{trimmed.replace(/^##\s*/, '')}</h3>;
      }
      if (trimmed.startsWith('#')) {
        return <h2 key={i} className="ll-md-h2">{trimmed.replace(/^#\s*/, '')}</h2>;
      }
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        return <li key={i} className="ll-md-li">{trimmed.replace(/^[-*]\s*/, '')}</li>;
      }
      if (/^\d+\./.test(trimmed)) {
        return <li key={i} className="ll-md-ol-li">{trimmed}</li>;
      }
      if (!trimmed) {
        return <div key={i} className="ll-md-spacer" />;
      }
      return <p key={i} className="ll-md-p">{trimmed}</p>;
    });
  };

  const practiceExamples = [
    'Generate 5 Judiciary-level MCQs',
    'Give me 10 CLAT questions',
    'Generate UPSC Law questions',
    'Drafting practice questions',
    'Bare Act interpretation exercises',
    'Case-based legal reasoning',
    'One difficult drafting problem',
    'Viva questions',
    'Interview questions',
    'Previous year style questions',
    'Practical drafting exercises'
  ];

  const previous=()=>open(s.current-1);
  const next=()=>open(Math.min(total-1,s.current+1));
  const reviewAgain=()=>{setReview(null);setMasteryFeedback('');requestAnimationFrame(()=>textareaRef.current?.focus())};
  return (
    <div className={`journey-shell${sidebarOpen ? '' : ' nav-collapsed'}`}>
      {showCelebration && (
        <div className="celebration-overlay">
          <div className="celebration-banner">
            <div className="celebration-icon">⭐</div>
            <h2>Lesson Mastered!</h2>
            <p>+{s.reviews[s.current]?.xpAward || 50} {skillAward}</p>
            <div className="celebration-skill-chip">✓ {skillAward} unlocked</div>
            {moduleComplete && <div className="module-complete-badge">🏆 Module Complete: {moduleComplete}</div>}
          </div>
        </div>
      )}
      {moduleComplete && !showCelebration && (
        <div className="module-toast">🏆 Module Complete: {moduleComplete}</div>
      )}
      
      <div className="journey-sidebar-container">
        <aside className="journey-map">
          <div className="journey-brand">
            <img src="/Legatrixon logo.jpg" alt="Legatrixon" />
            <span>
              <strong>LexMentor</strong>
              <small>Drafting Academy</small>
            </span>
          </div>
          <div className="map-heading">
            <span>YOUR JOURNEY</span>
            <strong>{complete} of {total} lessons</strong>
          </div>
          <div className="lesson-path" ref={lessonListRef}>
            {modules.map((mod) => {
              const start = lessons.findIndex((x) => x.module === mod.name);
              return (
                <div className="journey-module" key={mod.name}>
                  <h3>{mod.name}</h3>
                  {mod.lessons.map((title, offset) => {
                    const i = start + offset;
                    return (
                      <button
                        key={title}
                        className={`${s.reviews[i] ? 'done' : ''} ${i === s.current ? 'current' : ''}`}
                        disabled={i > complete}
                        onClick={() => open(i)}
                      >
                        <i>{s.reviews[i] ? <Check /> : i > complete ? <LockKeyhole /> : i + 1}</i>
                        <span>
                          <small>{s.reviews[i]?.verdict === 'correct' ? '★ Mastered' : s.reviews[i] ? '🟡 Completed - Needs Revision' : `Lesson ${i + 1}`}</small>
                          <strong>{title}</strong>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
            <button disabled={complete < total}>
              <i><Trophy /></i>
              <span>
                <small>FINAL</small>
                <strong>Certificate Awarded</strong>
              </span>
            </button>
          </div>
          {complete > 0 && (
            <div className="notebook-strip">
              <strong>📓 Drafting Notebook ({complete} entries)</strong>
              <div className="notebook-strip-entries">
                {modules.map((mod) => {
                  const modStart = lessons.findIndex((x) => x.module === mod.name),
                    modDone = mod.lessons.filter((_, oi) => Boolean(s.reviews[modStart + oi])).length;
                  return modDone > 0 ? (
                    <div key={mod.name} className="notebook-strip-entry">
                      <span>{mod.name.split(' ').slice(0, 2).join(' ')}</span>
                      <span>{modDone}/{mod.lessons.length}</span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </aside>

        <button
          type="button"
          className="sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Collapse lesson navigator' : 'Expand lesson navigator'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
      
      <div className="sidebar-overlay" onClick={toggleSidebar} aria-hidden="true" />
      
      <main className="journey-main">
        
        <header className="journey-topbar">
          <div className="top-progress">
            <strong>{progress}% complete</strong>
            <small>{total-complete} lessons remaining</small>
            <div>
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="journey-top-actions">
            <div className="game-stats">
              <span>
                <Flame />
                <b>{s.streak || 1}</b>
                <small>day streak</small>
              </span>
              <span>
                <Sparkles />
                <b>{s.xp}</b>
                <small>XP earned</small>
              </span>
            </div>
            {onOpenBareActAi && (
              <button type="button" className="journey-ai-switch" onClick={onOpenBareActAi}>
                <BookOpen size={16} /> Bare Act AI
              </button>
            )}
          </div>
        </header>
        
        {reviewNotice && (
          <div className="review-ready" role="status">
            {reviewNotice}
          </div>
        )}
        {evaluationError && (
          <div className="review-ready review-limit" role="alert">
            <span>{evaluationError}</span>
            {/upgrade|limit|paid feature/i.test(evaluationError) && <a href="/pricing">View Plans</a>}
          </div>
        )}
        
        <div className="lesson-wrap">
          {tooltipData && (
            <div className="ll-tooltip-overlay" onClick={() => setTooltipData(null)}>
              <div className="ll-tooltip-card" onClick={(e) => e.stopPropagation()}>
                <button className="ll-tooltip-close" onClick={() => setTooltipData(null)}>&times;</button>
                <div className="ll-tooltip-word">{tooltipData.word}</div>
                <div className="ll-tooltip-body">
                  <div className="ll-tt-row">
                    <strong>Legal Meaning</strong>
                    <p>{tooltipData.meaning}</p>
                  </div>
                  <div className="ll-tt-row">
                    <strong>Why Parliament chose this word</strong>
                    <p>{tooltipData.purpose}</p>
                  </div>
                  <div className="ll-tt-row">
                    <strong>Legal Consequence</strong>
                    <p>{tooltipData.consequence}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="ll-main">
              <header className="ll-hd">
                <div className="ll-hd-meta">
                  <span>Module {lesson.moduleIndex + 1}</span>
                  <span className="ll-hd-dot">/</span>
                  <span>{lesson.module}</span>
                  <span className="ll-hd-dot">/</span>
                  <span>{lessonContent?.difficulty || 'Intermediate'}</span>
                  <span className="ll-hd-dot">/</span>
                  <span>&#9200;&nbsp;{lessonContent?.estimatedTime || '12 min'}</span>
                </div>
                <h1 className="ll-hd-title">{lesson.title}</h1>
                <div className="ll-hd-prog">
                  <div className="ll-pg-bar">
                    <div className="ll-pg-fill" style={{ width: progress + '%' }} />
                  </div>
                  <span className="ll-pg-label">{complete} of {total} lessons complete</span>
                </div>
              </header>
              
              <div className="ll-mentor-intro">
                <div className="ll-mentor-body">
                  <p>A study of the legislative design, statutory construction, and professional drafting principles of <strong>{lesson.title}</strong>.</p>
                </div>
              </div>
              
              {/* Section 1: Learning Objective */}
              <section id="ll-s1" className="ll-s">
                <span className="ll-eyebrow">01 — Learning Objective</span>
                <h2 className="ll-sh">Learning Objective</h2>
                {lessonLoading ? (
                  <div className="ll-skel-wrap">
                    <div className="ll-skel" />
                    <div className="ll-skel ll-skel--md" />
                  </div>
                ) : (
                  <>
                    {lessonContent?.learningObjective && (
                      <p className="ll-objective">{lessonContent.learningObjective}</p>
                    )}
                    {lessonContent?.whyThisMatters && (
                      <p className="ll-why-matters">{lessonContent.whyThisMatters}</p>
                    )}
                  </>
                )}
              </section>
              
              {/* Section 2: The Concept */}
              <section id="ll-s2" className="ll-s">
                <span className="ll-eyebrow">02 — The Concept</span>
                <h2 className="ll-sh">The Legislative Concept</h2>
                {lessonLoading ? (
                  <div className="ll-skel-wrap">
                    <div className="ll-skel" />
                    <div className="ll-skel ll-skel--md" />
                    <div className="ll-skel ll-skel--sm" />
                  </div>
                ) : (
                  <div className="ll-prose">
                    {((lessonContent?.learn?.length ? lessonContent.learn : [
                      'Before this provision existed, there was no clear legal standard — disputes were resolved inconsistently across jurisdictions, creating uncertainty for citizens and administrators.',
                      'The legislative drafter was given one task: create a provision that would be unambiguous, internally consistent, and capable of uniform judicial interpretation throughout India.',
                      'This concept now forms the foundation of how courts, administrators, advocates, and drafters approach this critical area of law.'
                    ])).slice(0, 1).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                )}
              </section>
              
              {/* Section 3: Why Parliament Drafts It This Way */}
              <section id="ll-s3" className="ll-s">
                <span className="ll-eyebrow">03 — Why Parliament Drafts It This Way</span>
                <h2 className="ll-sh">Legislative Purpose & Design Rationale</h2>
                {lessonLoading ? (
                  <div className="ll-skel-wrap">
                    <div className="ll-skel" />
                    <div className="ll-skel ll-skel--md" />
                  </div>
                ) : (
                  <div className="ll-prose">
                    {((lessonContent?.learn?.length && lessonContent.learn.length > 1 ? [lessonContent.learn[1]] : [
                      'Parliamentary Counsel select specific statutory wording to constrain administrative discretion, establish clear legal commands, and anticipate judicial interpretation challenges.'
                    ])).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                )}
              </section>
              
              {/* Section 4: Understanding the Language */}
              <section id="ll-s4" className="ll-s">
                <span className="ll-eyebrow">04 — Understanding the Language</span>
                <h2 className="ll-sh">Statutory Language & Word Selection</h2>
                <div className="ll-compare-list">
                  {((lessonContent?.wordSelection?.length ? lessonContent.wordSelection : DRAFTING_PAIRS)).map((kw, i) => (
                    <div key={i} className="ll-compare-row" onClick={() => handleKW(kw.chosen)}>
                      <div className="ll-compare-pair">
                        <span className="ll-cw ll-cw--chosen">{kw.chosen}</span>
                        <span className="ll-cw ll-cw--alt">{kw.alt}</span>
                      </div>
                      <p className="ll-compare-why">{kw.reason}</p>
                    </div>
                  ))}
                </div>
              </section>
              
              {/* Section 5: Reading the Bare Act */}
              <section id="ll-s5" className="ll-s">
                <span className="ll-eyebrow">05 — Reading the Bare Act</span>
                <h2 className="ll-sh">Statutory Text</h2>
                {lessonLoading ? (
                  <div className="ll-skel-wrap">
                    <div className="ll-skel" />
                    <div className="ll-skel ll-skel--md" />
                  </div>
                ) : (
                  <div className="ll-statute-block">
                    <div className="ll-statute-src">{lessonContent?.observe?.[0]?.source || 'Indian Legislation'}</div>
                    <blockquote className="ll-statute-q">
                      {(lessonContent?.observe?.[0]?.example || example).split(/\b/).map((w, i) => {
                        const k = w.toLowerCase().replace(/[^a-z]/g, '');
                        const hasDynamic = lessonContent?.wordSelection?.some(x => x.chosen.toLowerCase() === k);
                        return (LEGAL_KW[k] || hasDynamic) ? (
                          <span key={i} className="ll-kw-inline" onClick={() => handleKW(w)}>{w}</span>
                        ) : (
                          <span key={i}>{w}</span>
                        );
                      })}
                    </blockquote>
                  </div>
                )}
              </section>
              
              {/* Section 6: Drafting Commentary */}
              <section id="ll-s6" className="ll-s">
                <span className="ll-eyebrow">06 — Drafting Commentary</span>
                <h2 className="ll-sh">Statutory Annotations & Rationale</h2>
                {lessonLoading ? (
                  <div className="ll-skel-wrap">
                    <div className="ll-skel" />
                    <div className="ll-skel ll-skel--md" />
                  </div>
                ) : (
                  <div>
                    <div className="ll-statute-annots">
                      <div className="ll-sa">
                        <strong>The Actor</strong>
                        <span>Who is bound by or entitled under this provision? Identify the legal person.</span>
                      </div>
                      <div className="ll-sa">
                        <strong>Legal Effect</strong>
                        <span>{lessonContent?.observe?.[0]?.reasoning || 'This provision creates a legally enforceable obligation or right, cognisable in all courts of law.'}</span>
                      </div>
                    </div>
                    {lessonContent?.draftingPrinciple && (
                      <blockquote className="ll-bq">
                        <p>{lessonContent.draftingPrinciple}</p>
                      </blockquote>
                    )}
                  </div>
                )}
              </section>
              
              {/* Section 7: Judicial Interpretation */}
              <section id="ll-s7" className="ll-s ll-s--dark">
                <span className="ll-eyebrow ll-eyebrow--light">07 — Judicial Interpretation</span>
                <h2 className="ll-sh ll-sh--light">The Judicial Construction</h2>
                {lessonLoading ? (
                  <div className="ll-skel-wrap ll-skel-wrap--dark">
                    <div className="ll-skel" />
                    <div className="ll-skel ll-skel--md" />
                  </div>
                ) : (
                  <div className="ll-sc-prose">
                    {lessonContent?.judgesLens ? (
                      <p>{lessonContent.judgesLens}</p>
                    ) : (
                      <p>Courts interpret statutory wording using literal, golden, and purposive construction guidelines, testing administrative actions against the bounds defined in the Act.</p>
                    )}
                    {lessonContent?.learn?.length && lessonContent.learn.length > 2 && (
                      <p>{lessonContent.learn[2]}</p>
                    )}
                  </div>
                )}
                <div className="ll-interp-rules">
                  <div className="ll-ir-card">
                    <h3 className="ll-ir-card-title">Literal Rule</h3>
                    <div className="ll-ir-card-content">
                      <div className="ll-ir-field">
                        <strong>Meaning</strong>
                        <p>Words bear their ordinary grammatical meaning unless absurdity results.</p>
                      </div>
                      <div className="ll-ir-field">
                        <strong>When applied</strong>
                        <p>Used when the statutory language is clear, plain, and unambiguous.</p>
                      </div>
                      <div className="ll-ir-field">
                        <strong>Why it matters</strong>
                        <p>Respects Parliament's chosen wording and preserves legal certainty.</p>
                      </div>
                    </div>
                  </div>
                  <div className="ll-ir-card">
                    <h3 className="ll-ir-card-title">Golden Rule</h3>
                    <div className="ll-ir-card-content">
                      <div className="ll-ir-field">
                        <strong>Meaning</strong>
                        <p>Courts depart from literal meaning to avoid absurd or unjust outcomes.</p>
                      </div>
                      <div className="ll-ir-field">
                        <strong>When applied</strong>
                        <p>Used when a literal reading leads to a manifest absurdity or contradiction.</p>
                      </div>
                      <div className="ll-ir-field">
                        <strong>Why it matters</strong>
                        <p>Prevents unjust anomalies while remaining as close to the text's spirit as possible.</p>
                      </div>
                    </div>
                  </div>
                  <div className="ll-ir-card">
                    <h3 className="ll-ir-card-title">Mischief Rule</h3>
                    <div className="ll-ir-card-content">
                      <div className="ll-ir-field">
                        <strong>Meaning</strong>
                        <p>Identify the problem Parliament was remedying and interpret accordingly.</p>
                      </div>
                      <div className="ll-ir-field">
                        <strong>When applied</strong>
                        <p>Used when statutory gaps exist or the remedy's scope is ambiguous.</p>
                      </div>
                      <div className="ll-ir-field">
                        <strong>Why it matters</strong>
                        <p>Aligns the judicial interpretation with the historical purpose of the reform.</p>
                      </div>
                    </div>
                  </div>
                  <div className="ll-ir-card">
                    <h3 className="ll-ir-card-title">Purposive Construction</h3>
                    <div className="ll-ir-card-content">
                      <div className="ll-ir-field">
                        <strong>Meaning</strong>
                        <p>Read provisions to advance the legislative purpose, never to frustrate it.</p>
                      </div>
                      <div className="ll-ir-field">
                        <strong>When applied</strong>
                        <p>Used to support modern, policy-oriented statutory analysis.</p>
                      </div>
                      <div className="ll-ir-field">
                        <strong>Why it matters</strong>
                        <p>Ensures the statutory intent is fully realized in contemporary contexts.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
              
              {/* Section 8: Practical Drafting Note */}
              <section id="ll-s8" className="ll-s">
                <span className="ll-eyebrow">08 — Practical Drafting Note</span>
                <h2 className="ll-sh">Parliamentary Counsel Note</h2>
                {lessonContent?.professionalInsight && (
                  <div className="ll-pro-insight">
                    <span className="ll-pi-label">Institutional Practice</span>
                    <p>{lessonContent.professionalInsight}</p>
                  </div>
                )}
                <div className="ll-prose" style={{ marginTop: '20px' }}>
                  <div className="ll-drafting-point">
                    <strong>The Drafting Test</strong>
                    <p>Ask: could a court read this provision differently than Parliament intended? Could counsel argue both interpretations? If yes — it must be redrafted before it reaches Parliament.</p>
                  </div>
                  <div className="ll-drafting-point">
                    <strong>The Professional Standard</strong>
                    <p>Legislative counsel draft for the court of last resort. Every provision must make sense not just today but 50 years hence in cases Parliament never imagined.</p>
                  </div>
                  <div className="ll-drafting-point">
                    <strong>The Hidden Rule</strong>
                    <p>Definitions must precede obligations. Powers must precede duties. Structure is not aesthetic — it is constitutional architecture.</p>
                  </div>
                </div>
              </section>
              
              {/* Section 9: Common Drafting Mistakes */}
              <section id="ll-s9" className="ll-s">
                <span className="ll-eyebrow">09 — Common Drafting Mistakes</span>
                <h2 className="ll-sh">Common Drafting Failures</h2>
                <div className="ll-mistakes-list">
                  {(lessonContent?.beginnerMistakes?.length
                    ? lessonContent.beginnerMistakes.slice(0, 3)
                    : mistakes
                  ).map((bm, i) => (
                    <div key={i} className="ll-mistake-entry">
                      <div className="ll-me-wrong">
                        <p>{bm.mistake}</p>
                      </div>
                      <div className="ll-me-why">
                        <p><strong>Why this is wrong:</strong> {bm.whyWrong}</p>
                      </div>
                      <div className="ll-me-fix">
                        <p><strong>Counsel's approach:</strong> {bm.counselApproach}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>              {/* Section 10: Professional Takeaways */}
              <section id="ll-s10" className="ll-s">
                <span className="ll-eyebrow">10 — Professional Takeaways</span>
                <h2 className="ll-sh">Key Takeaways</h2>
                {lessonContent?.keyTakeaways?.length ? (
                  <div className="ll-remember-list">
                    {lessonContent.keyTakeaways.map((point, i) => (
                      <div key={i} className="ll-ri">
                        <span className="ll-ri-icon" />
                        <div>
                          <p>{point}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ll-remember-list">
                    <div className="ll-ri">
                      <span className="ll-ri-icon" />
                      <div>
                        <strong>The Analogy</strong>
                        <p>A legislative provision is a precise instruction to a robot. Ambiguity causes the robot to fail — and ambiguity in law causes decades of litigation.</p>
                      </div>
                    </div>
                    <div className="ll-ri">
                      <span className="ll-ri-icon" />
                      <div>
                        <strong>The Principle</strong>
                        <p>{lessonContent?.draftingPrinciple || 'Precision over Brevity. Every word must carry its legal weight. Remove nothing that creates clarity; add nothing that creates ambiguity.'}</p>
                      </div>
                    </div>
                    <div className="ll-ri">
                      <span className="ll-ri-icon" />
                      <div>
                        <strong>The Mnemonic</strong>
                        <p>PADS — Precise, Adequate, Definite, Standalone. Every provision that survives judicial scrutiny satisfies all four simultaneously.</p>
                      </div>
                    </div>
                    <div className="ll-ri">
                      <span className="ll-ri-icon" />
                      <div>
                        <strong>Exam Shorthand</strong>
                        <p>Shall = mandatory. May = discretionary. Means = closed. Includes = open. Notwithstanding = overrides. Proviso = exception.</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Section 11: Practice with LexMentor AI */}
              <section id="ll-s11" className="ll-s">
                <span className="ll-eyebrow">11 — Practice with LexMentor AI</span>
                <h2 className="ll-sh">Practice with LexMentor AI</h2>

                {/* PHASE: IDLE — generate button */}
                {practicePhase === 'idle' && (
                  <div className="llpq-idle">
                    <p className="llpq-idle-desc">
                      Generate a subjective practice question based strictly on this lesson.
                    </p>
                    <div className="llpq-idle-meta">
                      <span className="llpq-meta-pill">
                        <BookOpen size={12} />
                        {lesson.module}
                      </span>
                      <span className="llpq-meta-pill">
                        <PenLine size={12} />
                        Lesson {s.current + 1}: {lesson.title}
                      </span>
                    </div>

                    {/* Optional user request input */}
                    <div className="llpq-request-wrap">
                      <textarea
                        className="llpq-request-input"
                        rows={3}
                        placeholder="Tell LexMentor what you want to practice from this lesson..."
                        value={practiceUserRequest}
                        onChange={(e) => setPracticeUserRequest(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleGenerateSubjectiveQuestion();
                          }
                        }}
                      />
                      <p className="llpq-request-example">
                        Example: &ldquo;Ask me a question about statutory language&rdquo; &nbsp;&middot;&nbsp; Leave blank to auto-generate.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="llpq-generate-btn"
                      onClick={handleGenerateSubjectiveQuestion}
                    >
                      <Sparkles size={16} />
                      Generate Question
                    </button>
                  </div>
                )}

                {/* PHASE: GENERATING — animated orb */}
                {practicePhase === 'generating' && (
                  <div className="llpq-orb-screen">
                    <div className="llpq-orb-container">
                      <div className="llpq-orb">
                        <div className="llpq-orb-ring llpq-orb-ring--1" />
                        <div className="llpq-orb-ring llpq-orb-ring--2" />
                        <div className="llpq-orb-ring llpq-orb-ring--3" />
                        <div className="llpq-orb-core" />
                      </div>
                    </div>
                    <p className="llpq-orb-label">LEGATRIXON AI</p>
                    <p className="llpq-orb-title">Generating your practice question...</p>
                    <p className="llpq-orb-hint">Preparing a question from this lesson...</p>
                  </div>
                )}

                {/* PHASE: ERROR — retry */}
                {practicePhase === 'error' && (
                  <div className="llpq-error-screen">
                    <div className="llpq-orb-container">
                      <div className="llpq-orb llpq-orb--error">
                        <div className="llpq-orb-core llpq-orb-core--error" />
                      </div>
                    </div>
                    <p className="llpq-error-title">Unable to generate your practice question.</p>
                    <p className="llpq-error-desc">{practiceError}</p>
                    <p className="llpq-error-desc">Please try again.</p>
                    <button
                      type="button"
                      className="llpq-generate-btn"
                      onClick={handleGenerateSubjectiveQuestion}
                    >
                      <Sparkles size={16} />
                      Try Again
                    </button>
                  </div>
                )}

                {/* PHASE: QUESTION — answer screen */}
                {practicePhase === 'question' && (
                  <div className="llpq-question-screen">
                    <div className="llpq-question-meta">
                      <div className="llpq-question-meta-row">
                        <span className="llpq-meta-label">Module</span>
                        <span className="llpq-meta-value">{lesson.module}</span>
                      </div>
                      <div className="llpq-question-meta-row">
                        <span className="llpq-meta-label">Lesson</span>
                        <span className="llpq-meta-value">{lesson.title}</span>
                      </div>
                      <div className="llpq-question-meta-row">
                        <span className="llpq-meta-label">Question</span>
                        <span className="llpq-meta-value llpq-meta-qnum">#{questionCount}</span>
                      </div>
                    </div>

                    <div className="llpq-question-card">
                      <div className="llpq-question-badge">
                        <Sparkles size={13} />
                        Practice Question
                      </div>
                      <p className="llpq-question-text">{generatedQuestion}</p>
                    </div>

                    <p className="llpq-answer-label">Write your answer below.</p>
                    <textarea
                      className="llpq-answer-textarea"
                      placeholder="Write a detailed answer using what you learned in this lesson..."
                      value={practiceAnswer}
                      onChange={(e) => setPracticeAnswer(e.target.value)}
                      rows={8}
                    />

                    <div className="llpq-question-actions">
                      <button
                        type="button"
                        className="llpq-generate-btn llpq-generate-btn--outline"
                        onClick={handleGenerateSubjectiveQuestion}
                      >
                        <Sparkles size={14} />
                        Generate Another Question
                      </button>
                    </div>
                  </div>
                )}
              </section>
              
              <div className="ll-nav">
                <button className="ll-nav-btn" disabled={s.current === 0} onClick={previous}>
                  <ArrowLeft size={14} />&nbsp;Previous
                </button>
                <div className="ll-nav-mid">
                  {s.reviews[s.current] ? (
                    <span className="ll-nav-xp"><Sparkles size={11} />&nbsp;+{s.reviews[s.current].xpAward} XP earned</span>
                  ) : (
                    <span className="ll-nav-hint">Submit your draft to earn XP</span>
                  )}
                </div>
                <button className="ll-nav-btn ll-nav-btn--next" disabled={s.current >= total - 1} onClick={next}>
                  Next Lesson&nbsp;<ArrowRight size={14} />
                </button>
              </div>
              
              {review?.pendingEvaluation && (
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="review-panel review-pending">
              <header>
                <Sparkles />
                <div>
                  <small>8 — AI REVIEW</small>
                  <h2>⚠️ AI evaluation is temporarily unavailable</h2>
                </div>
              </header>
              <p><strong>Your answer has been safely saved.</strong></p>
              <p>You may continue to the next lesson now. The review will be generated automatically when the service becomes available.</p>
              {review.localValidation?.length ? (
                <div className="local-checks">
                  <strong>Local validation</strong>
                  <ul>
                    {review.localValidation.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="local-checks-ok">✓ Local validation passed.</p>
              )}
              <footer>
                <span>Learning progress is not blocked.</span>
                <div className="review-actions">
                  <button type="button" className="secondary" disabled={s.current === 0} onClick={previous}>
                    <ArrowLeft /> Previous Lesson
                  </button>
                  <button type="button" className="secondary" disabled={reviewLoading} onClick={submit}>
                    {reviewLoading ? 'Retrying…' : 'Retry Review'}
                  </button>
                  {s.current < total - 1 && <button onClick={next}>Continue <ArrowRight /></button>}
                </div>
              </footer>
            </motion.section>
          )}
          
          {review && !review.pendingEvaluation && (
            <motion.section
              initial={{ opacity: 0, scale: 0.98 }}
              animate={review.verdict === 'correct' ? { opacity: 1, scale: [0.98, 1.03, 1] } : { opacity: 1, scale: 1 }}
              className={`review-panel answer-${review.verdict}`}
            >
              <header>
                {review.verdict === 'correct' ? <Check /> : <Sparkles />}
                <div>
                  <small>8 — AI REVIEW</small>
                  <h2>{review.verdict === 'correct' ? '🟢 Excellent' : review.verdict === 'partial' ? '🟡 Good Attempt' : '🔴 Needs Improvement'}</h2>
                </div>
                <b><Star fill="currentColor" /> +{review.xpAward || 10} {skillAward}</b>
              </header>
              <p>
                {review.verdict === 'correct'
                  ? 'Your answer demonstrates solid understanding of this drafting concept.'
                  : review.verdict === 'partial'
                  ? 'Your answer shows promise. Sharpen your explanation of the drafting principle and its application.'
                  : 'Use this feedback to strengthen your understanding before moving to the next concept.'}
              </p>
              {review.verdict === 'correct' && (
                <div className="skill-gained-row">
                  <span className="skill-gained-chip">✓ {skillAward}</span>
                  {lesson.moduleIndex === 0 && <span className="skill-gained-chip">✓ Foundation Skills</span>}
                  {s.current > 0 && s.current % 5 === 0 && <span className="skill-gained-chip">✓ Drafting Consistency</span>}
                </div>
              )}
              <div className="score-row">
                {['Concept Understanding', 'Legal Accuracy', 'Research Methodology', 'Professional Language', 'Structural Logic'].map((x, i) => (
                  <div key={x}>
                    <span>{x}</span>
                    <strong>{review.scores[i]}%</strong>
                    <i>
                      <b style={{ width: `${review.scores[i]}%` }} />
                    </i>
                  </div>
                ))}
              </div>
              <div className="feedback-grid">
                <div>
                  <strong>{review.verdict === 'correct' ? 'What you did well' : 'What was correct'}</strong>
                  <ul>
                    {(review.correctParts?.length ? review.correctParts : ['You attempted the research task and created a basis for improvement.']).map((x) => (
                      <li key={x}>✓ {x}</li>
                    ))}
                  </ul>
                  {review.verdict !== 'correct' && (
                    <>
                      <strong>What needs improvement</strong>
                      <ul>
                        {(review.mistakes || []).map((x) => (
                          <li key={x}>• {x}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                <div>
                  <strong>Why Drafters Write This Way</strong>
                  <p>{review.feedback}</p>
                  {review.why && (
                    <div className="next-step-callout">
                      <strong>📍 Improved Version</strong>
                      <p>{review.why}</p>
                    </div>
                  )}
                </div>
              </div>
              <footer>
                <span>✓ {review.verdict === 'correct' ? '★ Mastered - progress updated' : '🟡 Completed - Needs Revision - added to Revision Queue'}</span>
                <div className="review-actions">
                  <button type="button" className="secondary" disabled={s.current === 0} onClick={previous}>
                    <ArrowLeft /> Previous Lesson
                  </button>
                  <button type="button" className="secondary" onClick={reviewAgain}>
                    Revise Answer
                  </button>
                  {s.current < total - 1 && <button onClick={next}>Continue to Next Lesson <ArrowRight /></button>}
                </div>
              </footer>
            </motion.section>
          )}
          
          {s.current === total - 1 && s.reviews[s.current] && (
            <section className="graduation-panel">
              <Trophy />
              <div>
                <span className="panel-label">LEGISLATIVE DRAFTING PORTFOLIO</span>
                <h2>Your drafts are ready for final review</h2>
                <p>Draft Acts · Provisions · Definitions · Rights · Duties · Schedules · Professional Review</p>
              </div>
            </section>
          )}
          </div>
        </div>
      </main>
    </div>
  );
}






