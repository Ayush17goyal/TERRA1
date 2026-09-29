import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OpenRouterAiProviderService } from '../chat/openrouter-ai-provider.service';
import { academyLesson } from './academy-curriculum';

export type AcademyLessonContent={
  // Core fields (existing)
  learningObjective:string;
  whyThisMatters:string;
  learn:string[];
  professionalInsight:string;
  observe:Array<{source:string;example:string;reasoning:string}>;
  judgesLens:string;
  draftingPrinciple:string;
  beginnerMistakes:Array<{mistake:string;whyWrong:string;counselApproach:string}>;
  guidedPractice:{task:string;steps:string[]};
  independentChallenge:string;
  masteryQuestion:string;
  keyTakeaways:string[];
  wordSelection?:Array<{chosen:string;alt:string;reason:string}>;
};

const rubric=['legislativeLogic','legalAccuracy','draftingStyle','professionalLanguage','consistency','structure'] as const;

const SYSTEM_PROMPT=`You are a Senior Parliamentary Counsel and Legislative Drafting Expert with over 35 years of experience in the Legislative Department, Government of India. You have drafted Bills, Rules, Regulations, Notifications, Ordinances, and Constitutional Amendments, and have trained IAS officers, judges, and legislative clerks.

Your responsibility is not to explain the law or list textbook definitions. Your responsibility is to teach students how Parliament thinks while creating law, developing their professional judgment rather than memorization.

Write exactly as an experienced professor naturally teaches. Do not write like an AI assistant (avoid textbook filler, obvious transitions, and mechanical list-making). Speak directly, calmly, and thoughtfully to the student. Sometimes ask rhetorical legal questions, pause to explain why a drafting choice matters, compare two drafting options, explain how judges read statutory text, and mention the debates Parliamentary Counsel engage in while drafting.

═══════════════════════════════════════════════════════════
PRIMARY PURPOSE
═══════════════════════════════════════════════════════════

Every lesson must build professional drafting judgment. Every section must answer a different question:
• Why did Parliament need this provision?
• What legislative problem existed before it?
• Why was this wording selected?
• What wording was rejected?
• How would a court interpret this?
• What practical drafting mistake does this prevent?
• How would an experienced Legislative Counsel think?

Never repeat the same idea across sections. Replace simple definitions with deep reasoning on legislative intent, policy objectives, drafting strategy, legal consequences, judicial implications, and professional drafting practice.

═══════════════════════════════════════════════════════════
DEPTH & DRAFTING JUDGMENT
═══════════════════════════════════════════════════════════

Provide insights rarely found in ordinary law books. Address:
- Legislative intent and policy objectives
- Drafting decisions: why specific words are chosen, what alternatives were rejected, and the consequences of those choices
- Statutory architecture: how provisions relate to definitions, exceptions, and other Acts
- Judicial construction: how judges apply statutory interpretation canons in practice, what syntactic defects create litigation, and how to insulate drafts against judicial rewrite.

═══════════════════════════════════════════════════════════
REAL INDIAN LAW ONLY
═══════════════════════════════════════════════════════════

Use only verified Indian Constitution, Bare Acts, Supreme Court judgments, and Law Commission reports. Never fabricate case citations or section numbers. If no verified authority is available, clearly state so.

═══════════════════════════════════════════════════════════
MODULE BOUNDARIES — INVIOLABLE
═══════════════════════════════════════════════════════════

MODULE 0 — FOUNDATIONS: Build professional mindset only. Teach what legislation is, why it exists, and how to read a Bare Act. NEVER teach drafting language, definitions, sections, offences, penalties, or any drafting technique.

MODULE 1 — UNDERSTANDING THE PROBLEM: Teach problem identification and analysis only. NEVER begin drafting. NEVER introduce language devices.

MODULE 2 — LEGAL RESEARCH: Teach research methodology only. NEVER draft or plan legislation.

MODULE 3 — PLANNING: Teach legislative design before drafting begins. NEVER write actual legislative provisions.

MODULE 4 — DRAFTING LANGUAGE: Teach only the specific language device assigned. NEVER teach other devices in the same lesson. If another device is relevant, name it and say it will be covered later. NEVER draft a complete section — illustrate the device only.

MODULE 5 — DRAFTING THE BARE ACT: Teach how to draft the specific component assigned. NEVER combine with other Act components. NEVER review or critique a draft — only teach and demonstrate drafting this specific component.

MODULE 6 — LEGISLATIVE REVIEW: Teach the specific review methodology assigned. Draft only as illustration of a correction — never as primary content.

MODULE 7 — PRACTICAL DRAFTING: Assign the task. Minimal theory. Students write; AI reviews.

MODULE 8 — ADVANCED MODULE: Analyse the specified Indian Act. Extract drafting lessons. NEVER draft new legislation.

═══════════════════════════════════════════════════════════
LESSON STRUCTURE — RETURN EXACTLY THESE FIELDS
═══════════════════════════════════════════════════════════

Return strict JSON only. No markdown. No prose outside the JSON object.`;

const LESSON_SCHEMA=`{
  "learningObjective": "A natural, professional introductory paragraph (3-4 sentences) written from the perspective of a Senior Parliamentary Counsel. Do NOT use textbook phrasing like 'Students will understand', 'Students will learn', or 'By the end of this lesson...'. Instead, introduce the intellectual purpose of the lesson, explain why this lesson exists, what professional problem it solves, what drafting judgment or thinking process the student will develop, and why this knowledge matters in practice.",

  "whyThisMatters": "Two to three sentences written as professional legal commentary. Explain the precise consequence in legislative drafting practice when this concept is misunderstood or misapplied, connecting it to a real-world risk such as constitutional invalidity, unpreventable administrative discretion, or systemic litigation.",

  "learn": [
    "Paragraph 1 — Legislative Purpose and Context. Explain why Parliament requires this concept to exist. What legal problem does it solve? What pre-existing mischief or gap in the legal framework is it designed to cure? Write like a senior Parliamentary Counsel explaining to a legislative committee.",
    "Paragraph 2 — Drafting Strategy. Explain why the statutory language takes the precise form it does. What does each word choice accomplish? Why would alternative wording fail to achieve the policy objective?",
    "Paragraph 3 — Judicial Interpretation. Explain how courts have approached this concept — whether by literal rule, golden rule, or purposive construction. What ambiguity arises when this concept is poorly handled?"
  ],

  "professionalInsight": "One focused paragraph written from the perspective of a Parliamentary Counsel. Explain the specific questions they ask themselves when applying this concept, or a common pitfall they warn a junior drafter about. This must reflect genuine institutional practice, focusing on drafting judgment.",

  "wordSelection": [
    {
      "chosen": "The precise statutory word or modal verb chosen by the drafter (e.g. 'shall', 'means', 'person', 'deemed')",
      "alt": "The alternative wording that was rejected or could have been used instead (e.g. 'may', 'includes', 'citizen', 'presumed')",
      "reason": "Explain why Parliament selected the chosen word, why the alternative was rejected, and how substituting the word alters the statutory intent, legal operation, or enforceability."
    }
  ],

  "observe": [
    {
      "source": "Exact citation: Act Name, Year, Section number. Use a real Indian Act (e.g. Right to Information Act 2005 or Indian Contract Act 1872). Do not fabricate.",
      "example": "The exact provision text, or an accurate paraphrase clearly marked as such.",
      "reasoning": "Explain why the drafter wrote it in precisely this form. Account for every material word: why this modal verb, why this definition technique, why this condition, why this exception. Show the legal consequences of changing this structure."
    }
  ],

  "judgesLens": "One focused paragraph explaining how a Supreme Court or High Court judge approaches this concept during statutory interpretation. Extract the binding principle from Indian jurisprudence. Explain the interpretive outcome of ambiguity here.",

  "draftingPrinciple": "One rule that a Parliamentary Counsel applies without exception when dealing with this concept. State it as a professional maxim — direct, precise, and immediately applicable.",

  "beginnerMistakes": [
    {
      "mistake": "Describe the specific error a law student or junior drafter makes when first applying this concept.",
      "whyWrong": "Explain the precise legal consequence of this error (e.g., creating unguided administrative discretion, rendering the right unenforceable, or inviting constitutional challenge).",
      "counselApproach": "State the correct professional technique or check the Parliamentary Counsel applies to avoid this error."
    }
  ],

  "guidedPractice": {
    "task": "A focused analytical task based on the provision cited in 'observe'. Ask the student to apply the specific concept from this lesson to that provision. The task must require application of this lesson's concept, not general legal knowledge.",
    "steps": ["Step 1: Identify the specific element in the provision relevant to this lesson's concept.", "Step 2: Explain the legal effect of that element using the analytical framework from this lesson.", "Step 3: Identify what would change — legally — if that element were drafted differently."]
  },

  "independentChallenge": "Assign a realistic legislative drafting brief similar to those given inside the Legislative Department. The student must write a specific provision that satisfies the legal constraints, ensures enforceability, and prevents judicial misinterpretation.",

  "masteryQuestion": "One precise conceptual question that tests whether the student has internalised this concept at the level required for professional practice. The question must require the student to apply the concept to a new situation they have not encountered in the lesson.",

  "keyTakeaways": [
    "Point 1: The single most important drafting judgment this lesson has established — stated as a professional principle.",
    "Point 2: The precise legal consequence that follows when this concept is correctly applied.",
    "Point 3: The most common drafting error and its specific legal consequence.",
    "Point 4: How courts approach this concept under Indian statutory interpretation.",
    "Point 5: The exam-ready formulation of this concept."
  ]
}`;

@Injectable()
export class AcademyProfessorService{
 private readonly logger=new Logger(AcademyProfessorService.name);
 private readonly CACHE_VERSION=4;
 private cache=new Map<number,AcademyLessonContent>();
 constructor(private readonly ai:OpenRouterAiProviderService){}

 async lesson(userId:string,index:number){
  const meta=academyLesson(index),cached=this.cache.get(index);
  if(cached)return{meta,content:cached};
  const fallback=this.fallback(index,meta.title,meta.module,meta.moduleIndex);
  let lastError:unknown;
  for(let attempt=1;attempt<=2;attempt++){
    try{
     const priorKnowledge=index===0?'This is the FIRST lesson — no prior knowledge assumed.':index<6?'Students have completed Module 0 (Foundations) and understand legislative drafting as a professional discipline.':index<14?'Students have completed Foundations and Module 1 (Legislative Problem Identification).':index<24?'Students have completed Foundations, Problem Identification, and Module 2 (Legislative Research).':index<32?'Students have completed all analytical modules and Module 3 (Legislative Planning).':index<44?'Students have mastered the analytical foundation and are now in Module 4 (Drafting Language devices).':index<62?'Students have mastered all prior modules and are now in Module 5 (Drafting every component of a Bare Act).':index<70?'Students have drafted a complete Act and are now in Module 6 (Legislative Review methodology).':index<80?'Students are in Module 7 (Supervised Practice) — they apply all prior knowledge independently to assigned tasks.':'Students have completed the full programme and are in Module 8 (Advanced Analysis and Capstone).';
     const moduleBoundary=meta.moduleIndex===0?'This lesson covers professional mindset only. NEVER teach a drafting language device, a specific statutory provision, or any drafting technique. Treat every example as an illustration of the professional discipline, not a drafting instruction.':meta.moduleIndex===1?'This lesson covers legislative problem identification and analysis only. NEVER begin drafting. NEVER introduce language devices. Every example must demonstrate problem analysis, not solution design.':meta.moduleIndex===2?'This lesson covers legislative research methodology only. NEVER draft or plan any provision or Act structure. Every example must demonstrate how to find and use a source, not what to write.':meta.moduleIndex===3?'This lesson covers planning and design before drafting begins. NEVER write an actual legislative provision. Plan only — blueprints, scope statements, structural diagrams, and design analysis.':meta.moduleIndex===4?'This lesson covers ONLY the specific language device: '+meta.title+'. NEVER introduce other language devices in the same lesson. If another device is relevant, name it and say it will be covered later. NEVER draft a complete section — illustrate the device only.':meta.moduleIndex===5?'This lesson covers ONLY how to draft '+meta.title+'. NEVER combine with other Act components. NEVER review or critique a draft — only teach and demonstrate drafting this specific component.':meta.moduleIndex===6?'This lesson covers ONLY the review methodology: '+meta.title+'. NEVER draft new provisions as the primary content. Draft only as a corrected illustration showing what the reviewed provision should look like after the error is fixed.':meta.moduleIndex===7?'This is a PRACTICE lesson — assign the drafting task directly and concisely. Keep explanatory content to the absolute minimum. The exercise is primary; theory is incidental.':'This lesson analyses a specific Indian Act to extract drafting lessons. NEVER draft new legislation as primary content. Analyse the actual provisions and explain what the enacted wording accomplishes.';
     const userPrompt=`Generate Lesson ${meta.number}: "${meta.title}"
Module ${meta.moduleIndex}: ${meta.module}
Student prior knowledge: ${priorKnowledge}

Teaching brief: ${meta.concept}

CONTENT STANDARD REMINDER: Every field in the JSON response must meet the standard of professional legal commentary. Do not write like a chatbot, lecture notes, or a blog. Every paragraph must introduce a new legal insight. Every sentence must contribute meaningful legal analysis. Avoid filler, repetition, generic explanations, and motivational language. Write like a legal commentary prepared for judges, legislative researchers, and advanced law students.

MODULE BOUNDARY: ${moduleBoundary}

Return exactly this JSON schema:
${LESSON_SCHEMA}`;

    const result=await this.ai.complete({userId,module:'research',jsonMode:true,temperature:.1,maxTokens:3000,messages:[{role:'system',content:SYSTEM_PROMPT},{role:'user',content:userPrompt}]});
    const parsed=this.parse(result.content);
    const content=this.validateLesson(parsed);
    this.cache.set(index,content);
    return{meta,content};
   }catch(error){
     lastError=error;
     this.logger.warn(`Lesson generation attempt ${attempt} failed: ${error instanceof Error?error.message:String(error)}`);
   }
  }
  this.logger.error(`Lesson generation exhausted retries, returning fallback for index ${index}`);
  return{meta,content:fallback};
 }

 async review(userId:string,index:number,answer:string){
  const meta=academyLesson(index),text=String(answer||'').trim();
  if(text.length<20)throw new BadRequestException('Draft at least 20 characters before checking the answer.');
  const system='You are a senior Indian Parliamentary Counsel evaluating a law student\'s legislative drafting work. You are assessing understanding of one specific drafting concept. Evaluate semantically — never grade by keyword matching. The student is learning to draft Bare Acts; evaluate their answer against the single drafting concept being taught. Do not penalise for absence of research, citations, or adjacent concepts not covered in this lesson. Explain every mistake constructively. Always encourage revision. Return one strict JSON object and no markdown or prose outside it.';
  const prompt=`Lesson ${meta.number}: "${meta.title}" (Module: ${meta.module}). Drafting concept being assessed: ${meta.concept}.\nStudent answer:\n${text}\nReturn exactly {"status":"correct"|"partial"|"incorrect","overallScore":number,"conceptUnderstanding":number,"legalAccuracy":number,"draftingLogic":number,"professionalLanguage":number,"structuralLogic":number,"strengths":string[],"mistakes":string[],"weakConcepts":string[],"feedback":string,"improvedAnswer":string}. Scoring rules: every score 0-100. "correct" requires conceptUnderstanding>=80, legalAccuracy>=80, draftingLogic>=80 — meaning the student demonstrates they understand the drafting concept and can apply it. "partial" means genuine understanding but with a correctable omission or drafting imprecision. "incorrect" means a fundamental misunderstanding of the drafting concept or a material legal error. strengths: what the student understood correctly about the drafting concept. mistakes: specific drafting errors in the student's answer — must be correctable and explained. feedback: 2-3 sentences of constructive assessment explaining the drafting principle and how to improve. improvedAnswer: a short model answer or sentence-level improvement showing correct application of the drafting concept — never a wholesale replacement.`;
  const gradingCalibration='\nCalibration: This is a legislative drafting lesson, not a legal research or bar examination. Grade only the student\'s understanding of the single drafting concept stated above. A correct answer identifies the relevant actor, legal effect, and structural purpose of the drafting device. Do not penalise for: absence of case citations, not naming the specific Act section number, not covering adjacent drafting concepts, or being concise. A student who correctly explains what the provision does and why a drafter writes it that way demonstrates mastery. "partial" requires a genuine and material omission in understanding the drafting concept — not merely imprecise phrasing.';
  this.logger.log(`Evaluation request user=${userId}; lesson=${meta.number}; payload=${JSON.stringify({answer:text}).slice(0,4000)}`);
  let lastError:unknown;
  for(let attempt=1;attempt<=3;attempt++){
   try{
    const retryPrompt=attempt===1?prompt+gradingCalibration:`${prompt}${gradingCalibration}\nPrevious response was invalid JSON. This is retry ${attempt}; return only a complete valid JSON object matching the schema.`;
    const result=await this.ai.complete({userId,module:'research',jsonMode:true,temperature:0,maxTokens:1600,timeoutMs:25000,messages:[{role:'system',content:system},{role:'user',content:retryPrompt}]});
    this.logger.log(`Evaluation raw response lesson=${meta.number}; attempt=${attempt}; provider=${result.provider}; model=${result.model}; raw=${result.content.slice(0,8000)}`);
    const parsed=this.parseEvaluation(result.content);
    const validated=this.validateEvaluation(parsed,meta.concept);
    this.logger.log(`Evaluation parsed lesson=${meta.number}; attempt=${attempt}; result=${JSON.stringify(validated)}`);
    return validated;
   }catch(error:any){lastError=error;this.logger.warn(`Evaluation attempt failed lesson=${meta.number}; attempt=${attempt}; error=${error?.message||String(error)}`)}
  }
  this.logger.error(`Evaluation exhausted retries user=${userId}; lesson=${meta.number}; error=${lastError instanceof Error?lastError.message:String(lastError)}`);
  throw new BadGatewayException('Unable to evaluate your answer right now.');
 }

 async mastery(userId:string,index:number,answer:string){
  const meta=academyLesson(index),text=String(answer||'').trim();
  if(text.length<5)throw new BadRequestException('Answer the mastery question before submission.');
  try{
   const result=await this.ai.complete({userId,module:'research',jsonMode:true,temperature:0,maxTokens:650,messages:[{role:'system',content:'You are an Indian legislative drafting professor grading one mastery check. Do not demand verbatim wording. Accept an answer only when it demonstrates the lesson concept. Return strict JSON only.'},{role:'user',content:`Lesson ${meta.number}: ${meta.title}. Concept: ${meta.concept}. Student mastery answer: ${text}. Return {"correct":boolean,"feedback":string,"hint":string}. If correct, hint must be empty. If incorrect, give a conceptual hint without supplying the answer.`}]});
   const p=this.parse(result.content);
   return{correct:p.correct===true,feedback:String(p.feedback||''),hint:p.correct===true?'':String(p.hint||'Review the drafting principle and identify its legal function.')};
  }catch{return{correct:false,feedback:'The mastery service is temporarily unavailable; your answer remains saved.',hint:'Retry when the AI evaluation service is available.'}}
 }

 async generatePractice(userId:string,index:number,prompt:string,difficulty?:string){
  const meta=academyLesson(index);
  const difficultyContext=difficulty?`Set the difficulty level of the questions to: ${difficulty}.`:'';
  const systemPrompt=`You are a Senior Parliamentary Counsel and Legislative Drafting Expert with over 35 years of experience in the Legislative Department, Government of India.
Your responsibility is to generate practice questions for a student based strictly on the current lesson concept and the student's specific request.

Current Lesson:
- Title: ${meta.title}
- Concept: ${meta.concept}
- Module: ${meta.module}

${difficultyContext}

Guidelines:
1. The questions MUST relate strictly to the current lesson concept. Do not generate generic law questions or unrelated legal questions.
2. The format of the questions must match the user's request (e.g., if they ask for MCQs, generate MCQs; if they ask for CLAT questions, generate CLAT-style questions; if they ask for UPSC, viva, or drafting exercises, generate accordingly).
3. The tone must be authoritative, professional, and academic. Do not include introductory chit-chat, boilerplate remarks, or meta-commentary. Start directly with the questions.
4. Output must be clean Markdown formatting.`;

  try{
   const result=await this.ai.complete({
    userId,
    module:'research',
    temperature:0.7,
    maxTokens:1500,
    messages:[{role:'system',content:systemPrompt},{role:'user',content:`Student Request: "${prompt}"`}]
   });
   return {questions:result.content};
  }catch{
   throw new BadGatewayException('Failed to generate practice questions. Please retry.');
  }
 }

 private parse(raw:string){return JSON.parse(raw.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim())}

 private validateLesson(p:any):AcademyLessonContent{
  if(!p||typeof p.learningObjective!=='string'||!p.learningObjective.trim()||!Array.isArray(p.learn)||!Array.isArray(p.observe)||typeof p.independentChallenge!=='string'||typeof p.masteryQuestion!=='string')
   throw new Error('Invalid lesson');
  return{
   learningObjective:p.learningObjective,
   whyThisMatters:String(p.whyThisMatters||''),
   learn:p.learn.map(String).slice(0,4),
   professionalInsight:String(p.professionalInsight||''),
   observe:p.observe.slice(0,3),
   judgesLens:String(p.judgesLens||''),
   draftingPrinciple:String(p.draftingPrinciple||''),
   beginnerMistakes:Array.isArray(p.beginnerMistakes)?p.beginnerMistakes.slice(0,3):[],
   guidedPractice:p.guidedPractice||{task:'Apply the concept to the supplied example.',steps:[]},
   independentChallenge:p.independentChallenge,
   masteryQuestion:p.masteryQuestion,
   keyTakeaways:Array.isArray(p.keyTakeaways)?p.keyTakeaways.map(String).slice(0,5):[],
   wordSelection:Array.isArray(p.wordSelection)?p.wordSelection.slice(0,4):undefined,
  };
 }

 private parseEvaluation(raw:string){
  const cleaned=raw.trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  const start=cleaned.indexOf('{'),end=cleaned.lastIndexOf('}');
  if(start<0||end<=start)throw new Error('AI response contains no JSON object.');
  const candidate=cleaned.slice(start,end+1).replace(/[“”„‟"]/g,'"').replace(/[‘’‚‛']/g,"'").replace(/,\s*([}\]])/g,'$1');
  try{return JSON.parse(candidate)}catch(first){
   const repaired=candidate.replace(/\r?\n/g,' ').replace(/([{,])\s*([A-Za-z][A-Za-z0-9_]*)\s*:/g,'$1"$2":');
   try{return JSON.parse(repaired)}catch{throw new Error(`Invalid evaluation JSON: ${first instanceof Error?first.message:String(first)}`)}
   }
  }

  private validateEvaluation(p:any,fallbackConcept:string){
  const scoreNames=['overallScore','conceptUnderstanding','legalAccuracy','draftingLogic','professionalLanguage','structuralLogic'] as const;
  const scores:any={};
  for(const name of scoreNames){if(p?.[name]===undefined||p?.[name]===null||p?.[name]==='')throw new Error(`Missing required score: ${name}`);const value=Number(p[name]);if(!Number.isFinite(value))throw new Error(`Invalid score: ${name}`);scores[name]=Math.round(Math.max(0,Math.min(100,value)))}
  const suppliedStatus=String(p?.status||'');if(!['correct','partial','incorrect'].includes(suppliedStatus))throw new Error('Invalid evaluation status.');
  const meetsMastery=scores.conceptUnderstanding>=80&&scores.legalAccuracy>=80&&scores.draftingLogic>=80;
  const status:'correct'|'partial'|'incorrect'=suppliedStatus==='correct'&&!meetsMastery?'partial':suppliedStatus as any;
  const unlockNextLesson=true,xpAward=status==='correct'?50:status==='partial'?25:10;
  return{status,overallScore:scores.overallScore,conceptUnderstanding:scores.conceptUnderstanding,legalAccuracy:scores.legalAccuracy,draftingLogic:scores.draftingLogic,professionalLanguage:scores.professionalLanguage,structuralLogic:scores.structuralLogic,strengths:this.stringArray(p?.strengths),mistakes:this.stringArray(p?.mistakes),weakConcepts:Array.isArray(p?.weakConcepts)?p.weakConcepts.map(String).filter(Boolean).slice(0,8):status==='correct'?[]:[fallbackConcept],feedback:String(p?.feedback||''),improvedAnswer:String(p?.improvedAnswer||''),unlockNextLesson,lessonCompleted:true,needsRevision:status!=='correct',xpAward};
 }

private stringArray(value:any){if(!Array.isArray(value))throw new Error('Expected an array in evaluation response.'); return value.map(String).filter(Boolean).slice(0,8)}

 private fallback(index:number,title:string,module:string,moduleIndex:number):AcademyLessonContent{
   if (index === 0) {
     return {
       learningObjective: "Legislative drafting is a distinct constitutional discipline, not mere legal writing. This lesson establishes why good drafting protects the rule of law and why Parliament cannot afford ambiguity. You will develop the professional judgment required to analyze how every word affects rights and liabilities, transitioning from an ordinary lawyer's mindset to the precise thinking process of a Legislative Counsel who designs clear, enforceable legal norms.",
       whyThisMatters: "Inexperienced drafters often write statutory provisions that resemble narrative essays or contract clauses, leading to severe enforcement gaps and systemic litigation. Understanding that legislative drafting is a distinct constitutional discipline is crucial for producing Bare Acts that constrain administrative arbitrariness and survive strict judicial review.",
       learn: [
         "Paragraph 1 — The Constitutional Imperative. Legislative drafting is not the recording of policy agreements or the writing of textbook descriptions. It is the exercise of the sovereign lawmaking power to establish binding legal norms. Every statutory sentence must translate policy goals into a clear system of commands, permissions, or prohibitions. A Parliamentary Counsel must analyze the social mischief or regulatory gap that necessitates the Act, planning how the new law will operate dynamically within the existing constitutional framework.",
         "Paragraph 2 — The Operative Sentence Structure. To prevent administrative overreach and judicial rewrite, experienced drafters structure every legislative sentence around a strict grammatical formula. The core of any provision consists of: (a) a clearly identified Actor; (b) a precise Legal Action (mandatory obligation, discretionary authority, or absolute prohibition); (c) the Conditions precedent to the action; and (d) any Exceptions or provisos. Mixing these elements or using passive, actor-less sentences creates ambiguity that invites litigation.",
         "Paragraph 3 — Statutory Construction and Judicial Review. Courts do not read legislation like literature; they interpret it through established canons of statutory construction. A judge begins with the Literal Rule, giving words their ordinary grammatical meaning. If ambiguity is detected, the court shifts to the Purposive Rule, seeking to advance the legislative intent. Parliamentary Counsel must draft with such precision that the provision is clear not only to a sympathetic administrator, but to an adversarial advocate seeking to exploit every syntactic loophole."
       ],
       professionalInsight: "Institutional drafting practice in the Legislative Department dictates that you must write for the bad actor, not the good one. A junior drafter writes hoping everyone will cooperate; a Parliamentary Counsel drafts assuming administrators will abuse their powers, citizens will seek evasion, and courts will scrutinize every comma. Always ask: 'How could this provision be interpreted to defeat its own objective?'",
       wordSelection: [
         {
           chosen: "shall",
           alt: "may",
           reason: "Parliament selects 'shall' to impose a mandatory, non-discretionary duty on the public authority, leaving no room for administrative excuse. Substituting 'shall' with 'may' transforms the duty into a permissive discretion, rendering the citizen's right unenforceable and creating unguided administrative authority."
         },
         {
           chosen: "citizen",
           alt: "person",
           reason: "By choosing 'citizen' rather than 'person', the drafter explicitly limits the scope of the statutory right to natural persons holding Indian citizenship. If 'person' had been chosen, the right would automatically extend to foreign nationals, corporations, and other artificial legal entities under the General Clauses Act."
         },
         {
           chosen: "means",
           alt: "includes",
           reason: "Using 'means' creates an exhaustive, closed definition, strictly confining the term to the specified categories to provide absolute certainty. Using 'includes' would make the definition open-ended and illustrative, delegating authority to courts to expand the category case-by-case."
         }
       ],
       observe: [
         {
           source: "The Right to Information Act, 2005 - Section 3",
           example: "Subject to the provisions of this Act, all citizens shall have the right to information.",
           reasoning: "This provision is a masterpiece of legislative economy and structural discipline. The opening phrase 'Subject to the provisions of this Act' acts as a scope-control device, subordinate to subsequent restrictions (like exemptions in Section 8). The subject is 'all citizens', deliberately excluding foreign corporations. The modal verb is 'shall', creating a mandatory obligation on the State to deliver information, and the object is 'the right to information'."
         }
       ],
       judgesLens: "In the landmark case of State of Uttar Pradesh v. Hari Ram, the Supreme Court of India observed that when the legislature uses the word 'shall' in an operative provision, it raises a strong presumption of mandatory intent. However, if the statutory context reveals that non-compliance does not lead to a penalty or defeat the public interest, courts may read it as directory. Drafters must therefore combine 'shall' with explicit legal consequences to guarantee mandatory judicial construction.",
       draftingPrinciple: "Never write a passive sentence without an explicit legal actor. Every statutory obligation must name the specific authority or person who must act, state the exact trigger condition, and specify the legal consequence of failure.",
       beginnerMistakes: [
         {
           mistake: "Drafting passive obligations without naming a clear legal actor (e.g., 'The applications must be processed within thirty days').",
           whyWrong: "It creates administrative vacuum. When an application is delayed, the court cannot issue a mandamus because the statute fails to identify which officer is legally responsible for performing the duty.",
           counselApproach: "Identify the specific officer or authority responsible, and draft actively: 'The designated officer shall process the application within thirty days.'"
         },
         {
           mistake: "Using vague qualitative standards like 'promptly', 'reasonably', or 'adequately' to define administrative duties.",
           whyWrong: "This delegates lawmaking authority to administrators, leading to inconsistent enforcement, allegations of bias, and endless litigation over what constitutes 'reasonable' delay.",
           counselApproach: "Always define the standard quantitatively (e.g., 'within fifteen business days') or establish an objective administrative rule."
         }
       ],
       guidedPractice: {
         task: "Read Section 3 of the Right to Information Act, 2005. Rewrite it to (a) grant the right to all persons (not just citizens) and (b) make the right subject to a specific time-limit condition of five years from the commencement of the Act.",
         steps: [
           "Step 1: Replace 'citizens' with the broader legislative actor category 'persons' to expand scope.",
           "Step 2: Add a temporal condition clause using statutory language: 'for a period of five years from the commencement of this Act'.",
           "Step 3: Ensure the transition preserves the mandatory nature of the right by keeping the word 'shall'."
         ]
       },
       independentChallenge: "LEGISLATIVE BRIEF: The Ministry of Environment requires a provision for the upcoming Air Quality (Control) Bill. \nObjective: Mandate all commercial factories to install real-time emission monitors.\nInstructions: Write a single, active, enforceable statutory provision. Identify the actor (factory occupier), the obligation (install and maintain monitors), the condition precedent (size of chimney or location), and specify the administrative consequence of non-compliance (immediate suspension of license). Avoid vague standards like 'appropriate monitors' or 'prompt installation'.",
       masteryQuestion: "Why does a Parliamentary Counsel prefer to write 'The Commissioner shall, upon receipt of an application, register...' rather than 'Upon receipt of an application, registration shall be granted by the Commissioner'?",
       keyTakeaways: [
         "Professional Rule: Legislative language is a functional system of commands and conditions, not a literary description of policy intent.",
         "Professional Rule: Every legal duty must identify its duty-holder actively. Avoid passive rules.",
         "Professional Rule: Passive statutory drafting creates unguided administrative discretion and makes judicial enforcement difficult.",
         "Professional Rule: Courts interpret enacted words, not assumed intentions; the drafter must anticipate and block hostile adversarial readings.",
         "Professional Rule: Every exception narrows a right, and every proviso changes the legal operation of the parent clause."
       ]
     };
   }

   const isFoundations=moduleIndex===0,isProblem=moduleIndex===1,isResearch=moduleIndex===2,isPlanning=moduleIndex===3,isLanguage=moduleIndex===4,isDrafting=moduleIndex===5,isReview=moduleIndex===6,isPractice=moduleIndex===7;
   const details = isDrafting
      ? `This lesson provides the strategic framework for drafting a legally precise, enforceable ${title.toLowerCase()} provision. You will acquire the drafting judgment to define clear administrative boundaries and insulate your text against judicial rewrite, ensuring that the legislative intent is fully realized in practice.`
      : isLanguage
      ? `This lesson examines how to employ the specific linguistic device of ${title.toLowerCase()} to construct precise statutory commands, conditions, or exclusions. You will develop the analytical process to select appropriate drafting devices and prevent unintended legal consequences.`
      : isReview
      ? `This lesson focuses on the rigorous methodology of legislative review. You will learn to conduct a systematic analysis of a draft Act, identifying syntactic ambiguities, structural defects, and constitutional conflicts before they result in litigation.`
      : isPractice
      ? `This lesson offers hands-on practice in drafting legislative clauses. You will develop the technical discipline to write clear, concise provisions according to established Parliamentary guidelines and institutional standards.`
      : isResearch
      ? `This lesson covers the methodology of legislative research. You will learn to trace statutory precedents, evaluate constitutional competence, and establish a sound evidentiary foundation before drafting begins.`
      : isPlanning
      ? `This lesson introduces the design phase of legislative planning. You will learn to construct structural blueprints, map regulatory fields, and define the scope parameters of proposed legislation to prevent future gaps.`
      : isProblem
      ? `This lesson analyzes the transition from policy to law. You will learn to dissect social and regulatory problems, determine whether a legislative instrument is required, and assess the feasibility of legislative intervention.`
      : `This lesson examines the institutional role of ${title.toLowerCase()} in statutory design. You will analyze why this device exists, what professional problems it solves, and how it governs rights and liabilities in practice.`;

   return{
    learningObjective: details,
    whyThisMatters:`Mastery of ${title.toLowerCase()} is crucial to prevent unguided administrative discretion, systemic litigation, or constitutional challenges that invalidate key provisions of the Act.`,
    learn:[
      `Paragraph 1 — Legislative Purpose. The implementation of ${title.toLowerCase()} in a Bare Act is never a stylistic choice; it is a structural mechanism designed to resolve a specific legal problem. Parliamentary Counsel introduce this device to establish a clear statutory rule, cure pre-existing mischief, or define administrative authority. A senior drafter must analyze the exact regulatory objective and plan how this provision operates in harmony with constitutional limits.`,
      `Paragraph 2 — Drafting Strategy. To prevent administrative arbitrariness and litigation, the language of the provision must be engineered with absolute precision. We select the modal verbs and terms deliberately: mandatory commands must be clear, conditions must be explicit, and definitions must be closed or open-ended depending on policy intent. Alternative wording is rejected because it shifts power or introduces ambiguity.`,
      `Paragraph 3 — Statutory Construction. When a court reviews a provision, it applies established interpretive rules. The Literal Rule gives terms their ordinary grammatical meaning, while the Purposive Rule seeks to realize the legislative objective. Poorly drafted clauses force judges to reconstruct the text, which can lead to unintended judicial rewrite. Experienced Counsel draft to withstand the most hostile adversarial reading.`
    ],
    professionalInsight:`In legislative practice, always draft with the assumption that your provision will be read by a hostile advocate seeking a loophole. A Parliamentary Counsel warns against passive verbs and unguided discretion. Before finalizing the draft, test if the obligation is tied to a specific actor, if the triggers are objective, and if the legal consequences are clear.`,
    observe:[{source:'Right to Information Act 2005, Section 3',example:`"Subject to the provisions of this Act, all citizens shall have the right to information."`,reasoning:`This provision demonstrates how Parliamentary Counsel express ${title.toLowerCase()} with precision. The phrase "subject to the provisions of this Act" controls scope; "shall" makes the right mandatory; "all citizens" identifies the right-holder without ambiguity. Every word performs a specific legal function.`}],
    judgesLens:`Courts approach ${title.toLowerCase()} by applying the golden rule of statutory interpretation: give words their ordinary grammatical meaning unless it leads to an absurd result. When this concept is poorly drafted, courts must choose between competing interpretations — and they will typically adopt the interpretation that best serves the legislative purpose identified in the Preamble.`,
    draftingPrinciple:`Every use of ${title.toLowerCase()} must identify the actor, state the legal effect using the correct modal verb, and control scope through clear conditions or exceptions. Any provision that fails any of these three tests must be redrafted.`,
    beginnerMistakes:[{mistake:`Using vague language when drafting ${title.toLowerCase()} — words like "appropriate", "reasonable", or "adequate" without defining the standard.`,whyWrong:'Vague standards give unguided discretion to administrators and create litigation. Every standard must be defined or stated precisely.',counselApproach:'Define the standard in the Definitions section, or state it as a specific threshold in the provision itself.'},{mistake:`Omitting the actor — writing what must happen without clearly stating who must do it.`,whyWrong:'A provision without a named actor cannot be enforced. The court has no one to direct a mandamus against.',counselApproach:'Always name the duty-bearer first: "The [Authority/Person] shall..."'},{mistake:`Confusing "shall" and "may" in provisions relating to ${title.toLowerCase()}.`,whyWrong:'"Shall" imposes a mandatory obligation; "may" confers discretion. Using "may" where a duty is intended makes the provision unenforceable.',counselApproach:'Ask: is Parliament insisting on this, or permitting it? Use "shall" for the former, "may" for the latter.'}],
    guidedPractice:{task:`Read the Right to Information Act 2005, Section 3. Identify: (a) the actor; (b) the legal effect; (c) the scope-control device; and (d) why "shall" was used instead of "may". Then explain how these elements connect to the concept of ${title.toLowerCase()}.`,steps:['Identify the legal actor in the provision.','State what right or duty the provision creates.','Identify the phrase that controls the scope of application.','Explain the modal verb choice and its legal consequence.']},
    independentChallenge:`LEGISLATIVE BRIEF: Prepare a draft provision for the proposed legislation on this topic. Identify the primary actor, state their duties or powers using active statutory verbs, establish the objective triggers for exercise of power, and specify the administrative consequences of non-compliance. Ensure it is legally sound and enforceable.`,
    masteryQuestion:`What is the legal function of ${title.toLowerCase()} in a Bare Act, and what is the single most common drafting error that makes it ineffective?`,
    keyTakeaways:[
      `Professional Rule: Legislative drafting is the translation of policy into enforceable legal commands, not general description.`,
      `Professional Rule: Every statutory obligation must identify the actor, the trigger conditions, and the legal consequences.`,
      `Professional Rule: Avoid passive phrasing and qualitative standards which create administrative vacuum and invite litigation.`,
      `Professional Rule: Courts will construct terms literally first; the drafter must ensure the plain meaning matches the policy intent.`,
      `Professional Rule: Mastering drafting judgment requires designing provisions that withstand adversarial judicial interpretation.`
    ],
   };
  }
}
