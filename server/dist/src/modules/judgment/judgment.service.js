"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var JudgmentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JudgmentService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const judgment_analysis_entity_1 = require("./judgment-analysis.entity");
const chunk_entity_1 = require("../notebook/chunk.entity");
const notebook_entity_1 = require("../notebook/notebook.entity");
const openrouter_ai_provider_service_1 = require("../chat/openrouter-ai-provider.service");
const token_optimization_service_1 = require("../chat/token-optimization.service");
const semantic_cache_service_1 = require("../chat/semantic-cache.service");
let JudgmentService = JudgmentService_1 = class JudgmentService {
    constructor(analysisRepo, chunkRepo, docRepo, aiProvider, tokenService, cacheService) {
        this.analysisRepo = analysisRepo;
        this.chunkRepo = chunkRepo;
        this.docRepo = docRepo;
        this.aiProvider = aiProvider;
        this.tokenService = tokenService;
        this.cacheService = cacheService;
        this.logger = new common_1.Logger(JudgmentService_1.name);
    }
    async analyzeJudgment(documentId, userId) {
        const doc = await this.docRepo.findOne({ where: { id: documentId, userId } });
        if (!doc) {
            throw new common_1.NotFoundException(`Document with ID ${documentId} not found.`);
        }
        const existingAnalysis = await this.analysisRepo.findOne({ where: { documentId, userId } });
        if (existingAnalysis && doc.status === 'Indexed' && doc.legalMetadata) {
            this.logger.log(`[Judgment Analysis] Returning cached analysis record for document [${documentId}] instantly.`);
            return existingAnalysis;
        }
        const chunks = await this.chunkRepo.find({
            where: { documentId },
            order: { chunkIndex: 'ASC' },
        });
        if (chunks.length === 0) {
            throw new common_1.NotFoundException(`No text chunks found for document ${documentId}. Ensure the document has been ingested and processed.`);
        }
        const fullText = chunks.map(c => c.text).join('\n\n');
        this.logger.log(`[Judgment Analysis] Reconstructed ${fullText.length} characters from ${chunks.length} chunks for document [${documentId}].`);
        const maxTextLength = 60000;
        const truncatedText = fullText.length > maxTextLength
            ? fullText.substring(0, maxTextLength) + '\n\n[... document truncated for analysis ...]'
            : fullText;
        const extractionResult = await this.extractJudgmentStructure(truncatedText, userId);
        const sourceChunkRefs = this.buildSourceChunkRefs(extractionResult, chunks);
        let analysis = await this.analysisRepo.findOne({ where: { documentId, userId } });
        if (analysis) {
            Object.assign(analysis, {
                userId,
                title: extractionResult.title || doc.name,
                citation: extractionResult.citation || '',
                court: extractionResult.court || '',
                bench: extractionResult.bench || '',
                dateOfJudgment: extractionResult.dateOfJudgment || '',
                judges: extractionResult.judges || [],
                facts: extractionResult.facts || '',
                issues: extractionResult.issues || [],
                argumentsPetitioner: extractionResult.argumentsPetitioner || [],
                argumentsRespondent: extractionResult.argumentsRespondent || [],
                statutes: extractionResult.statutes || [],
                precedents: extractionResult.precedents || [],
                ratioDecidendi: extractionResult.ratioDecidendi || '',
                obiterDicta: extractionResult.obiterDicta || '',
                holding: extractionResult.holding || '',
                finalVerdict: extractionResult.finalVerdict || '',
                timeline: extractionResult.timeline || [],
                citationNetwork: extractionResult.citationNetwork || [],
                examRelevanceScore: extractionResult.examRelevanceScore || 0,
                landmarkImpactScore: extractionResult.landmarkImpactScore || 0,
                sourceChunkRefs,
            });
        }
        else {
            analysis = this.analysisRepo.create({
                documentId,
                userId,
                title: extractionResult.title || doc.name,
                citation: extractionResult.citation || '',
                court: extractionResult.court || '',
                bench: extractionResult.bench || '',
                dateOfJudgment: extractionResult.dateOfJudgment || '',
                judges: extractionResult.judges || [],
                facts: extractionResult.facts || '',
                issues: extractionResult.issues || [],
                argumentsPetitioner: extractionResult.argumentsPetitioner || [],
                argumentsRespondent: extractionResult.argumentsRespondent || [],
                statutes: extractionResult.statutes || [],
                precedents: extractionResult.precedents || [],
                ratioDecidendi: extractionResult.ratioDecidendi || '',
                obiterDicta: extractionResult.obiterDicta || '',
                holding: extractionResult.holding || '',
                finalVerdict: extractionResult.finalVerdict || '',
                timeline: extractionResult.timeline || [],
                citationNetwork: extractionResult.citationNetwork || [],
                examRelevanceScore: extractionResult.examRelevanceScore || 0,
                landmarkImpactScore: extractionResult.landmarkImpactScore || 0,
                sourceChunkRefs,
            });
        }
        const saved = await this.analysisRepo.save(analysis);
        this.logger.log(`[Judgment Analysis] Analysis saved for document [${documentId}], ID: ${saved.id}`);
        return saved;
    }
    async getAnalysis(documentId, userId) {
        const analysis = await this.analysisRepo.findOne({ where: { documentId, userId } });
        if (!analysis) {
            throw new common_1.NotFoundException(`No judgment analysis found for document ${documentId}. Run analysis first.`);
        }
        return analysis;
    }
    async explainLike(documentId, mode, userId) {
        const analysis = await this.getAnalysis(documentId, userId);
        const cacheKey = `judgment:explain:${analysis.userId || 'unknown'}:${documentId}:${mode}`;
        const cachedResult = await this.cacheService.get('judgment', cacheKey, analysis.userId);
        if (cachedResult) {
            return cachedResult;
        }
        const modePrompts = {
            first_year: `You are an award-winning law professor teaching students who have just entered law school.
OBJECTIVE: Help beginners understand the judgment without legal confusion.
RESPONSE STYLE: Very simple English, explain every legal term, use examples, use analogies, use storytelling, break difficult concepts into steps.
OUTPUT FORMAT:
1. What happened?
2. Why did the case reach court?
3. What question did the court decide?
4. What did the court say?
5. Why is this important?
6. Simple example
AVOID: Complex legal jargon, Latin phrases without explanation, dense paragraphs.`,
            professor: `You are a senior constitutional law professor from a top National Law University.
OBJECTIVE: Provide deep academic analysis.
FOCUS: Jurisprudence, constitutional philosophy, legal theory, historical evolution, comparative law, academic interpretation.
OUTPUT FORMAT:
1. Background
2. Legal Context
3. Jurisprudential Analysis
4. Constitutional Significance
5. Long-Term Impact
6. Academic Critique
DEPTH LEVEL: Very High.`,
            lawyer: `You are a Senior Advocate arguing before the Supreme Court of India.
OBJECTIVE: Analyze the case from a litigation perspective.
FOCUS: Legal strategy, courtroom arguments, strengths, weaknesses, practical implications, future litigation use.
OUTPUT FORMAT:
1. Petitioner Arguments
2. Respondent Arguments
3. Court Analysis
4. Winning Strategy
5. Weak Points
6. Future Use in Court
DEPTH LEVEL: Professional.`,
            judge: `You are a Supreme Court Judge writing a judicial opinion.
OBJECTIVE: Explain the reasoning process behind the judgment.
FOCUS: Interpretation, judicial reasoning, legal principles, constitutional validity, public policy considerations.
OUTPUT FORMAT:
1. Facts
2. Issues
3. Applicable Law
4. Analysis
5. Judicial Reasoning
6. Final Holding
STYLE: Formal judicial writing.`,
            exam_prep: `You are India's top Judiciary Examination Mentor.
OBJECTIVE: Convert the judgment into exam-oriented preparation material.
FOCUS: Exam questions, frequently tested areas, one-liners, revision notes, judiciary preparation.
OUTPUT FORMAT:
IMPORTANT FACTS
IMPORTANT SECTIONS
IMPORTANT CASES
PYQ ANGLES
EXPECTED QUESTIONS
MCQs
SHORT NOTES
REVISION SUMMARY
EXAM ALERTS
Highlight frequently tested concepts.`,
            hindi: `You are a Hindi-medium law professor.
OBJECTIVE: Explain the judgment in natural Hindi.
RULES: No word-by-word translation. Teach naturally. Explain legal concepts in Hindi. Use examples.
OUTPUT FORMAT:
मामले की पृष्ठभूमि
मुख्य तथ्य
कानूनी प्रश्न
न्यायालय का निर्णय
महत्व
परीक्षा दृष्टिकोण`,
            moot_prep: `You are a National Moot Court Champion.
OBJECTIVE: Prepare students for Moot Court competitions.
OUTPUT FORMAT:
Facts
Issues
Petitioner Arguments
Respondent Arguments
Authorities
Case Laws
Counter Arguments
Oral Submissions
Rebuttal Strategy`,
            interview_prep: `You are a law firm hiring partner.
OBJECTIVE: Test the student's understanding of the judgment.
OUTPUT FORMAT:
5 Easy Questions
5 Moderate Questions
5 Difficult Questions
Model Answers
Evaluation Criteria
Common Mistakes`,
            case_brief: `You are an Elite Legal Researcher.
OBJECTIVE: Create a professional case brief.
OUTPUT FORMAT:
Case Name
Court
Bench
Facts
Issues
Arguments
Decision
Ratio Decidendi
Obiter Dicta
Significance`,
            cram_mode: `You are a Top Judiciary Crash Course Mentor.
OBJECTIVE: Help students revise the judgment in under 5 minutes.
OUTPUT FORMAT:
30 Second Summary
1 Minute Summary
3 Minute Summary
Must Remember Points
Sections
Cases
Exam Traps
Memory Tricks`
        };
        const systemPrompt = modePrompts[mode.toLowerCase()] || modePrompts.exam_prep;
        const globalQualityCheck = `
GLOBAL QUALITY CHECK:
You MUST verify that your response complies with the following guidelines before outputting:
1. Grounded strictly in the uploaded judgment (use ONLY the provided analysis context below).
2. Uses the specified persona, objectives, and output format exactly.
3. Includes case citations and specific source references.
4. Includes extracted legal concepts, relevant statutes, and precedents.
5. Displays page references whenever possible (incorporate page numbers and chunk indices from the context).
6. ABSOLUTELY NO generic AI filler, placeholders, or hallucinated facts.
`;
        const analysisContext = this.buildAnalysisContext(analysis);
        let content;
        try {
            const result = await this.aiProvider.complete({
                temperature: 0.3,
                maxTokens: 3000,
                timeoutMs: 30000,
                module: 'judgment',
                userId: analysis.userId,
                messages: [
                    {
                        role: 'system',
                        content: `${systemPrompt}\n\n${globalQualityCheck}\n\nYou MUST base your explanation ENTIRELY on the following judgment analysis. Do NOT add information that is not present in the analysis. Reference specific facts, issues, holdings, and statutes from the analysis below.\n\n${analysisContext}`,
                    },
                    {
                        role: 'user',
                        content: `Explain the judgment "${analysis.title}" in the ${mode} mode. Ground every point in the actual judgment content provided.`,
                    },
                ],
            });
            content = result.content;
        }
        catch (error) {
            this.logger.warn(`AI explainLike failed: ${error.message}. Returning local database summary fallback.`);
            const judgesList = (analysis.judges || []).join(', ');
            content = `# ${analysis.title} (${mode.toUpperCase()} MODE SUMMARY)

The detailed AI-generated explanation in **${mode}** mode is temporarily unavailable due to system capacity limits. However, here is the structured summary extracted from the judgment analysis:

- **Court**: ${analysis.court || 'N/A'}
- **Bench / Judges**: ${analysis.bench || 'N/A'}${judgesList ? ` (${judgesList})` : ''}
- **Date of Judgment**: ${analysis.dateOfJudgment || 'N/A'}
- **Citation**: ${analysis.citation || 'N/A'}

## Core Facts Overview
${analysis.facts || 'N/A'}

## Framed Issues
${analysis.issues?.map((issue, i) => `${i + 1}. ${issue}`).join('\n') || 'N/A'}

## Ratio Decidendi
${analysis.ratioDecidendi || 'N/A'}

## Final Holding & Verdict
${analysis.holding || 'N/A'}

---
*Note: The complete personalized learning explanation is temporarily undergoing system updates. Please review the core judgment points above.*`;
        }
        const sourceRefs = (analysis.sourceChunkRefs || []).slice(0, 5).map(ref => ({
            field: ref.field,
            page: ref.pageNumber,
            chunk: ref.chunkIndex,
            excerpt: ref.excerpt,
        }));
        const finalExplanation = {
            mode,
            content,
            sourceRefs,
        };
        await this.cacheService.set('judgment', cacheKey, finalExplanation);
        return finalExplanation;
    }
    async evaluateVerdict(documentId, userVerdict, userId) {
        const analysis = await this.getAnalysis(documentId, userId);
        let parsed;
        try {
            const result = await this.aiProvider.complete({
                temperature: 0.2,
                maxTokens: 2000,
                timeoutMs: 25000,
                module: 'judgment',
                userId: analysis.userId,
                messages: [
                    {
                        role: 'system',
                        content: `You are a legal evaluation AI. Compare a user's judicial verdict against the actual court judgment.

ACTUAL JUDGMENT DETAILS:
- Title: ${analysis.title}
- Ratio Decidendi: ${analysis.ratioDecidendi}
- Holding: ${analysis.holding}
- Final Verdict: ${analysis.finalVerdict}
- Key Issues: ${analysis.issues.join('; ')}
- Statutes Applied: ${analysis.statutes.join('; ')}
- Precedents Cited: ${analysis.precedents.join('; ')}

Evaluate the user's verdict and return ONLY valid JSON with these fields:
{
  "similarityPercentage": <number 0-100>,
  "reasoningScore": <number 0-100>,
  "feedback": "<detailed evaluation feedback explaining what the user got right, what they missed, and how their reasoning compares to the actual court's logic. Be specific and educational.>"
}

SCORING CRITERIA:
- similarityPercentage: How close the user's conclusion matches the actual verdict (outcome alignment)
- reasoningScore: Quality of legal reasoning, use of principles, identification of key issues

Be generous but honest. If the user identifies the core legal principle even partially, acknowledge it.`,
                    },
                    {
                        role: 'user',
                        content: `USER'S VERDICT:\n${userVerdict}`,
                    },
                ],
            });
            const jsonMatch = result.content.match(/\{[\s\S]*\}/);
            parsed = JSON.parse(jsonMatch?.[0] || result.content);
        }
        catch (error) {
            this.logger.warn(`AI evaluateVerdict failed: ${error.message}. Returning local comparison fallback.`);
            parsed = {
                similarityPercentage: 65,
                reasoningScore: 65,
                feedback: `The automated AI evaluation tool is temporarily unavailable due to system capacity limits. 

Based on the official records for this judgment:
- **Actual Court Verdict**: ${analysis.finalVerdict || 'N/A'}
- **Ratio Decidendi**: ${analysis.ratioDecidendi || 'N/A'}

Please review the court's official ratio decidendi and final holding above to self-evaluate your proposed verdict.`,
            };
        }
        const sourceRefs = (analysis.sourceChunkRefs || [])
            .filter(ref => ['ratioDecidendi', 'holding', 'finalVerdict'].includes(ref.field))
            .map(ref => ({
            field: ref.field,
            page: ref.pageNumber,
            chunk: ref.chunkIndex,
            excerpt: ref.excerpt,
        }));
        return {
            similarityPercentage: Math.max(0, Math.min(100, parsed.similarityPercentage || 50)),
            reasoningScore: Math.max(0, Math.min(100, parsed.reasoningScore || 50)),
            feedback: parsed.feedback || 'Evaluation completed.',
            actualVerdict: analysis.finalVerdict,
            actualRatio: analysis.ratioDecidendi,
            sourceRefs,
        };
    }
    async generateRevisionNotes(documentId, userId) {
        const analysis = await this.getAnalysis(documentId, userId);
        const cacheKey = `judgment:revision:${analysis.userId || 'unknown'}:${documentId}`;
        const cachedResult = await this.cacheService.get('judgment', cacheKey, analysis.userId);
        if (cachedResult) {
            return cachedResult;
        }
        const analysisContext = this.buildAnalysisContext(analysis);
        let content;
        try {
            const result = await this.aiProvider.complete({
                temperature: 0.2,
                maxTokens: 3000,
                timeoutMs: 25000,
                module: 'judgment',
                userId: analysis.userId,
                messages: [
                    {
                        role: 'system',
                        content: `Generate concise, exam-ready revision notes from the following judgment analysis. Structure them as:

### CASE SNAPSHOT
- Case Name, Citation, Court, Bench, Date

### KEY FACTS (3-5 bullet points)

### ISSUES FRAMED

### RATIO DECIDENDI (Core Holding)

### OBITER DICTA (if any)

### STATUTES & ARTICLES INVOLVED

### PRECEDENTS CITED

### EXAM KEYWORDS

### MNEMONIC / MEMORY HOOK

### FREQUENTLY ASKED QUESTIONS (3 Q&A pairs)

### ONE-LINE SUMMARY

Base everything ONLY on the analysis below. No external content.

${analysisContext}`,
                    },
                    {
                        role: 'user',
                        content: `Generate revision notes for: ${analysis.title}`,
                    },
                ],
            });
            content = result.content;
        }
        catch (error) {
            this.logger.warn(`AI generateRevisionNotes failed: ${error.message}. Returning local database summary fallback.`);
            content = `### CASE SNAPSHOT
- **Case Name**: ${analysis.title}
- **Citation**: ${analysis.citation || 'N/A'}
- **Court**: ${analysis.court || 'N/A'}
- **Bench**: ${analysis.bench || 'N/A'}
- **Date of Judgment**: ${analysis.dateOfJudgment || 'N/A'}

### KEY FACTS
${analysis.facts || 'N/A'}

### ISSUES FRAMED
${analysis.issues?.map((issue, i) => `- ${issue}`).join('\n') || 'N/A'}

### RATIO DECIDENDI (Core Holding)
${analysis.ratioDecidendi || 'N/A'}

### HOLDING
${analysis.holding || 'N/A'}

### STATUTES & ARTICLES INVOLVED
${analysis.statutes?.join(', ') || 'N/A'}

### PRECEDENTS CITED
${analysis.precedents?.join(', ') || 'N/A'}

---
*Note: Advanced AI study notes are temporarily unavailable due to system capacity limits. Please use the core revision timeline and holdings summarized above.*`;
        }
        await this.analysisRepo.update({ documentId, userId }, { revisionNotes: content });
        const sourceRefs = (analysis.sourceChunkRefs || [])
            .map(ref => ({
            field: ref.field,
            page: ref.pageNumber,
            chunk: ref.chunkIndex,
            excerpt: ref.excerpt,
        }));
        const notesResult = { content, sourceRefs };
        await this.cacheService.set('judgment', cacheKey, notesResult);
        return notesResult;
    }
    async generateMootCourtKit(documentId, userId) {
        const analysis = await this.getAnalysis(documentId, userId);
        const cacheKey = `judgment:mootkit:${analysis.userId || 'unknown'}:${documentId}`;
        const cachedResult = await this.cacheService.get('judgment', cacheKey, analysis.userId);
        if (cachedResult) {
            return cachedResult;
        }
        const analysisContext = this.buildAnalysisContext(analysis);
        const dynamicMaxTokens = this.tokenService.calculateMaxTokens('judgment', {
            query: analysis.title,
            contextSize: analysisContext ? analysisContext.length : 0,
        });
        let content;
        try {
            const result = await this.aiProvider.complete({
                temperature: 0.3,
                maxTokens: dynamicMaxTokens,
                timeoutMs: 30000,
                module: 'judgment',
                userId: analysis.userId,
                messages: [
                    {
                        role: 'system',
                        content: `Generate a comprehensive Moot Court Preparation Kit from the following judgment analysis. Structure it as:

### CASE IDENTIFICATION
- Full Title, Citation, Court, Bench Composition

### MEMORIAL OUTLINE — PETITIONER SIDE
- Jurisdiction Statement
- Statement of Facts (from petitioner perspective)
- Issues to Frame
- Arguments to Advance (with authorities)
- Prayer

### MEMORIAL OUTLINE — RESPONDENT SIDE
- Counter-Statement of Facts
- Counter-Arguments (with authorities)
- Objections to Petitioner's Claims

### ORAL ARGUMENT STRATEGY
- Opening Statement Template
- Key Questions Judges May Ask
- Rebuttal Points

### AUTHORITY INDEX
- List of all statutes and precedents from the judgment

### JUDGE'S LIKELY QUESTIONS
- 5-7 probing questions a bench might ask during oral arguments

Base everything ONLY on the analysis below. No external content.

${analysisContext}`,
                    },
                    {
                        role: 'user',
                        content: `Generate moot court preparation kit for: ${analysis.title}`,
                    },
                ],
            });
            content = result.content;
        }
        catch (error) {
            this.logger.warn(`AI generateMootCourtKit failed: ${error.message}. Returning local database summary fallback.`);
            content = `### CASE IDENTIFICATION
- **Case Name**: ${analysis.title}
- **Court**: ${analysis.court || 'N/A'}
- **Bench Composition**: ${analysis.bench || 'N/A'}
- **Date**: ${analysis.dateOfJudgment || 'N/A'}

### MEMORIAL OUTLINE — SUMMARY
- **Factual Background**: ${analysis.facts || 'N/A'}
- **Issues Framed**: ${analysis.issues?.join('; ') || 'N/A'}
- **Core Ratio Decidendi**: ${analysis.ratioDecidendi || 'N/A'}
- **Court Holding**: ${analysis.holding || 'N/A'}

### AUTHORITY INDEX
- **Statutes/Articles**: ${analysis.statutes?.join(', ') || 'N/A'}
- **Precedents**: ${analysis.precedents?.join(', ') || 'N/A'}

---
*Note: Advanced Moot Court practice kits, argument templates, and probing questions are temporarily unavailable due to system capacity limits. Please refer to the case outline above.*`;
        }
        await this.analysisRepo.update({ documentId, userId }, { mootCourtKit: { content, generatedAt: new Date().toISOString() } });
        const sourceRefs = (analysis.sourceChunkRefs || [])
            .map(ref => ({
            field: ref.field,
            page: ref.pageNumber,
            chunk: ref.chunkIndex,
            excerpt: ref.excerpt,
        }));
        const kitResult = { content, sourceRefs };
        await this.cacheService.set('judgment', cacheKey, kitResult);
        return kitResult;
    }
    async generateAlternativeReasoning(documentId, userId) {
        const analysis = await this.getAnalysis(documentId, userId);
        const cacheKey = `judgment:alternative:${analysis.userId || 'unknown'}:${documentId}`;
        const cachedResult = await this.cacheService.get('judgment', cacheKey, analysis.userId);
        if (cachedResult) {
            return cachedResult;
        }
        const prompt = `You are a dissenting Judge on the Supreme Court.
Generate an alternative reasoning and ruling for this case based STRICTLY AND ONLY on the facts of the case provided. 
Do NOT use external knowledge. Rely purely on the facts and legal issues.

FACTS OF THE CASE:
${analysis.facts}

ISSUES FRAMED:
${(analysis.issues || []).join('; ')}

ACTUAL DECISION (for reference, you must take a different or alternative logical path):
${analysis.holding}

OUTPUT FORMAT:
### ALTERNATIVE RULING SUMMARY
- The outcome and brief alternative conclusion.

### ALTERNATIVE LEGAL REASONING
- Propose a different logical or statutory interpretation. How could the court have decided otherwise? What principles could have been applied differently to the facts?

### CRITICAL FACTUAL DOTS
- Detail which facts are key to this alternative interpretation.
`;
        let content;
        try {
            const result = await this.aiProvider.complete({
                temperature: 0.3,
                maxTokens: 2500,
                timeoutMs: 25000,
                module: 'judgment',
                userId: analysis.userId,
                messages: [
                    { role: 'system', content: 'You are an alternative judicial reasoning generator. Do NOT use external knowledge. Rely only on the uploaded facts.' },
                    { role: 'user', content: prompt }
                ]
            });
            content = result.content;
        }
        catch (err) {
            content = `AI failed to generate alternative reasoning: ${err.message}`;
        }
        const finalRes = { content };
        await this.cacheService.set('judgment', cacheKey, finalRes);
        return finalRes;
    }
    async extractJudgmentStructure(text, userId) {
        const extractionPrompt = `You are a legal judgment analyzer specializing in Indian law. Extract ALL of the following fields from the judgment text provided. Return ONLY valid JSON — no markdown, no explanation, no code fences.

Return this exact JSON structure:
{
  "title": "Full case title (e.g., 'Kesavananda Bharati v. State of Kerala')",
  "citation": "Case citation if mentioned (e.g., '1973 4 SCC 225')",
  "court": "Name of the court",
  "bench": "Bench composition (e.g., '5-Judge Bench')",
  "dateOfJudgment": "Date of judgment if mentioned",
  "judges": ["List of judges who heard the case"],
  "facts": "Comprehensive factual background of the case",
  "issues": ["Each legal issue framed by the court, as a separate array element"],
  "argumentsPetitioner": ["Each argument advanced by the petitioner/appellant"],
  "argumentsRespondent": ["Each argument advanced by the respondent/defendant"],
  "statutes": ["All statutes, articles, sections mentioned (e.g., 'Article 21', 'Section 302 IPC')"],
  "precedents": ["All case precedents cited in the judgment"],
  "ratioDecidendi": "The core legal principle established — the binding part of the judgment",
  "obiterDicta": "Non-binding observations, side remarks, or suggestions made by the court",
  "holding": "The specific holding/decision of the court on each issue",
  "finalVerdict": "The final order/verdict — appeal allowed/dismissed, conviction upheld, etc.",
  "timeline": [{"year": "Year", "event": "What happened"}],
  "citationNetwork": [{"case": "Case name cited", "relationship": "How it was used (followed/distinguished/overruled)", "relevance": "Brief note on relevance"}],
  "examRelevanceScore": 0,
  "landmarkImpactScore": 0
}

SCORING GUIDELINES:
- examRelevanceScore (0-100): How important is this judgment for law exams? Consider: frequency in exam questions, constitutional significance, doctrinal importance.
- landmarkImpactScore (0-100): How impactful is this judgment on the legal landscape? Consider: whether it changed the law, bench strength, citations by subsequent courts.

If any field cannot be determined from the text, use empty string "" for text fields, empty array [] for arrays, or 0 for numbers. NEVER leave a field out.

JUDGMENT TEXT:
${text}`;
        this.logger.log('[Judgment Analysis] Sending extraction prompt to AI provider...');
        let content = '';
        try {
            const result = await this.aiProvider.complete({
                temperature: 0.1,
                maxTokens: 4000,
                timeoutMs: 60000,
                module: 'judgment',
                userId,
                messages: [
                    { role: 'system', content: 'You are a legal judgment extraction engine. Return ONLY valid JSON. No markdown formatting, no code fences, no explanation text.' },
                    { role: 'user', content: extractionPrompt },
                ],
            });
            content = result.content;
        }
        catch (error) {
            this.logger.error(`[Judgment Analysis] AI provider failed during extraction: ${error.message}`);
            return {
                title: 'Judgment Analysis',
                citation: '',
                court: '',
                bench: '',
                dateOfJudgment: '',
                judges: [],
                facts: text.substring(0, 3000),
                issues: [],
                argumentsPetitioner: [],
                argumentsRespondent: [],
                statutes: [],
                precedents: [],
                ratioDecidendi: 'Analysis unavailable.',
                obiterDicta: '',
                holding: 'Analysis unavailable.',
                finalVerdict: 'Analysis unavailable.',
                timeline: [],
                citationNetwork: [],
                examRelevanceScore: 0,
                landmarkImpactScore: 0,
            };
        }
        this.logger.log(`[Judgment Analysis] AI response received (${content.length} chars). Parsing JSON...`);
        try {
            let jsonContent = content.trim();
            if (jsonContent.startsWith('```')) {
                jsonContent = jsonContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
            }
            const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON object found in AI response.');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            this.logger.log(`[Judgment Analysis] Successfully parsed extraction result: "${parsed.title}"`);
            return parsed;
        }
        catch (parseError) {
            this.logger.error(`[Judgment Analysis] Failed to parse AI response as JSON: ${parseError.message}`);
            this.logger.debug(`[Judgment Analysis] Raw AI response: ${content.substring(0, 500)}...`);
            return {
                title: 'Judgment Analysis',
                citation: '',
                court: '',
                bench: '',
                dateOfJudgment: '',
                judges: [],
                facts: content.substring(0, 2000),
                issues: [],
                argumentsPetitioner: [],
                argumentsRespondent: [],
                statutes: [],
                precedents: [],
                ratioDecidendi: '',
                obiterDicta: '',
                holding: '',
                finalVerdict: '',
                timeline: [],
                citationNetwork: [],
                examRelevanceScore: 0,
                landmarkImpactScore: 0,
            };
        }
    }
    buildSourceChunkRefs(extraction, chunks) {
        const refs = [];
        const fieldsToMatch = [
            { field: 'facts', content: extraction.facts },
            { field: 'ratioDecidendi', content: extraction.ratioDecidendi },
            { field: 'holding', content: extraction.holding },
            { field: 'finalVerdict', content: extraction.finalVerdict },
            { field: 'obiterDicta', content: extraction.obiterDicta || '' },
        ];
        for (const { field, content } of fieldsToMatch) {
            if (!content || content.length < 10)
                continue;
            const searchTerms = content
                .toLowerCase()
                .split(/\s+/)
                .filter(word => word.length > 4)
                .slice(0, 8);
            let bestChunk = null;
            let bestScore = 0;
            for (const chunk of chunks) {
                const chunkLower = chunk.text.toLowerCase();
                const matchCount = searchTerms.filter(term => chunkLower.includes(term)).length;
                if (matchCount > bestScore) {
                    bestScore = matchCount;
                    bestChunk = chunk;
                }
            }
            if (bestChunk && bestScore >= 2) {
                refs.push({
                    field,
                    chunkIndex: bestChunk.chunkIndex,
                    pageNumber: bestChunk.pageNumber,
                    excerpt: bestChunk.text.substring(0, 200),
                });
            }
        }
        return refs;
    }
    buildAnalysisContext(analysis) {
        const sections = [
            `CASE TITLE: ${analysis.title}`,
            analysis.citation ? `CITATION: ${analysis.citation}` : '',
            analysis.court ? `COURT: ${analysis.court}` : '',
            analysis.bench ? `BENCH: ${analysis.bench}` : '',
            analysis.dateOfJudgment ? `DATE: ${analysis.dateOfJudgment}` : '',
            analysis.judges?.length ? `JUDGES: ${analysis.judges.join(', ')}` : '',
            `\nFACTS:\n${analysis.facts}`,
            analysis.issues?.length ? `\nISSUES:\n${analysis.issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}` : '',
            analysis.argumentsPetitioner?.length ? `\nARGUMENTS (PETITIONER):\n${analysis.argumentsPetitioner.map((arg, i) => `${i + 1}. ${arg}`).join('\n')}` : '',
            analysis.argumentsRespondent?.length ? `\nARGUMENTS (RESPONDENT):\n${analysis.argumentsRespondent.map((arg, i) => `${i + 1}. ${arg}`).join('\n')}` : '',
            analysis.statutes?.length ? `\nSTATUTES & ARTICLES: ${analysis.statutes.join(', ')}` : '',
            analysis.precedents?.length ? `\nPRECEDENTS CITED: ${analysis.precedents.join(', ')}` : '',
            `\nRATIO DECIDENDI:\n${analysis.ratioDecidendi}`,
            analysis.obiterDicta ? `\nOBITER DICTA:\n${analysis.obiterDicta}` : '',
            `\nHOLDING:\n${analysis.holding}`,
            `\nFINAL VERDICT:\n${analysis.finalVerdict}`,
            analysis.timeline?.length ? `\nTIMELINE:\n${analysis.timeline.map(t => `- ${t.year}: ${t.event}`).join('\n')}` : '',
        ];
        return sections.filter(Boolean).join('\n');
    }
    async getJudgmentMastery(documentId, action, userId) {
        let analysis;
        try {
            analysis = await this.getAnalysis(documentId, userId);
        }
        catch {
            analysis = await this.analyzeJudgment(documentId, userId);
        }
        const chunks = await this.chunkRepo.find({
            where: { documentId },
            order: { chunkIndex: 'ASC' },
        });
        const text = chunks.map(c => c.text).join('\n\n').substring(0, 30000);
        let systemPrompt = '';
        let userText = `Case Title: ${analysis.title}\n\nJudgment Excerpt:\n${text}`;
        switch (action) {
            case 'jm_case_summary':
                systemPrompt = `You are an elite legal education coach. Generate a highly interactive, comprehensive Case Summary of the uploaded judgment. Break it down into clear sections with interactive exercises or questions for students to self-test their understanding of the case facts and core outcomes.`;
                break;
            case 'jm_facts':
                systemPrompt = `You are a law school professor. Generate an interactive factual breakdown of the case. Highlight the chronological background, the parties involved, the procedural history, and include a 'Fact Check Quiz' at the end to test the reader's memory.`;
                break;
            case 'jm_issues':
                systemPrompt = `You are a constitutional/statutory law specialist. Formulate the core legal issues of the case in a highly interactive way. Include a brief analytical challenge asking the reader how they would frame or resolve each issue.`;
                break;
            case 'jm_arguments':
                systemPrompt = `You are a moot court trainer. Detail the arguments of both the Appellant/Petitioner and the Respondent. For each side's arguments, add an interactive 'Critique Session' listing counter-arguments or weaknesses for students to analyze.`;
                break;
            case 'jm_reasoning':
                systemPrompt = `You are a jurisprudential expert. Break down the judge's reasoning step-by-step. Highlight the legal doctrines applied, the statutory interpretations, and add interactive 'Logic Check' questions to help students follow the legal logic.`;
                break;
            case 'jm_ratio':
                systemPrompt = `You are a precedent researcher. Extract the Ratio Decidendi (binding legal principle) established in this case. Include an interactive explanation of how this ratio applies to future scenarios or hypothetical cases.`;
                break;
            case 'jm_obiter':
                systemPrompt = `You are a legal scholar. Extract the Obiter Dicta (court observations/dicta that are non-binding). Add an interactive discussion section evaluating how these observations might influence future policy or lawmaking.`;
                break;
            case 'jm_paragraphs':
                systemPrompt = `You are a Supreme Court advocate. Identify and extract 3-5 of the most critical paragraphs or passages from the judgment. For each paragraph, provide a detailed legal analysis and an interactive 'Why this matters' prompt.`;
                break;
            case 'jm_timeline':
                systemPrompt = `You are a legal historian. Generate an interactive chronological timeline of the case from the initial cause of action, district court filings, high court appeals, leading up to the final judgment. Include interactive milestone questions.`;
                break;
            case 'jm_citation_network':
                systemPrompt = `You are a legal citations analyst. Map out the citation network of cases cited by this judgment and cases that cite it. Explain the precedent flow and include an interactive checklist of precedent value (e.g. Overruled, Distinguished, Followed).`;
                break;
            case 'jm_related_cases':
                systemPrompt = `You are an academic researcher. List and summarize related landmark cases that share similar facts, statutory issues, or constitutional provisions. Include an interactive matrix comparing their outcomes.`;
                break;
            case 'jm_exam_notes':
                systemPrompt = `You are a bar exam preparatory instructor. Create high-yield exam preparation notes for this judgment. Highlight typical exam questions, potential traps, and include interactive flashcard-style QA blocks.`;
                break;
            case 'jm_perspective_judge':
                systemPrompt = `Adopt the persona of the presiding Judge. Explain the judgment from your perspective, highlighting the judicial dilemma, the weight of precedent vs. equity, and include an interactive challenge asking: 'Would you have ruled differently?'`;
                break;
            case 'jm_perspective_student':
                systemPrompt = `Adopt the persona of a senior Law Student tutor. Explain the case in simple, relatable terms. Highlight the key takeaways, study strategies for this case, and include an interactive 'Self-Check' quiz.`;
                break;
            case 'jm_perspective_lawyer':
                systemPrompt = `Adopt the persona of a practicing trial/appellate Lawyer. Explain how you would cite or leverage this judgment in your own briefs or oral arguments. Include an interactive strategy block with litigation tactics.`;
                break;
            case 'jm_perspective_professor':
                systemPrompt = `Adopt the persona of a tenured Law Professor. Provide an Socratic critique of the judgment's reasoning, constitutional theory, and societal impact. Include interactive Socratic questions.`;
                break;
            case 'jm_moot_notes':
                systemPrompt = `You are a Moot Court coach. Generate a specialized Moot Court guidebook based on this judgment. Frame moot propositions, identify key arguments for both sides, and suggest questions judges might ask during oral rounds.`;
                break;
            case 'jm_cross_references':
                systemPrompt = `You are a legal database architect. Map out the cross-references in this judgment (statutes, acts, international treaties, constitutional provisions). Create an interactive index explaining their relevance.`;
                break;
            case 'jm_current_position':
                systemPrompt = `You are a senior legal editor. Detail the current legal standing of this judgment (is it still good law, has it been watered down, distinguished, or overruled by a larger bench?). Add interactive analysis of its current authority.`;
                break;
            case 'jm_recent_developments':
                systemPrompt = `You are a legal news commentator. Discuss recent legal developments, subsequent judgments, amendments, or public debates that have been sparked by this judgment. Include interactive poll or debate questions.`;
                break;
            default:
                throw new Error(`Unsupported judgment mastery action: ${action}`);
        }
        const response = await this.aiProvider.complete({
            temperature: 0.2,
            maxTokens: 3000,
            module: 'judgment',
            preferredModel: 'GPT-4o-Mini',
            userId,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userText },
            ],
        });
        return {
            action,
            documentId,
            result: response.content || 'Mastery content failed to generate.',
        };
    }
};
exports.JudgmentService = JudgmentService;
exports.JudgmentService = JudgmentService = JudgmentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(judgment_analysis_entity_1.JudgmentAnalysis)),
    __param(1, (0, typeorm_1.InjectRepository)(chunk_entity_1.DocumentChunk)),
    __param(2, (0, typeorm_1.InjectRepository)(notebook_entity_1.NotebookDocument)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        openrouter_ai_provider_service_1.OpenRouterAiProviderService,
        token_optimization_service_1.TokenOptimizationService,
        semantic_cache_service_1.SemanticCacheService])
], JudgmentService);
//# sourceMappingURL=judgment.service.js.map