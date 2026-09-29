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
var MockTestEngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockTestEngineService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const axios_1 = require("axios");
const question_bank_entry_entity_1 = require("../question-bank/entities/question-bank-entry.entity");
const question_plan_entity_1 = require("../question-planning/entities/question-plan.entity");
const question_planning_types_1 = require("../question-planning/question-planning.types");
const mock_test_paper_entity_1 = require("./entities/mock-test-paper.entity");
const mock_test_paper_question_entity_1 = require("./entities/mock-test-paper-question.entity");
const qdrant_service_1 = require("../retrieval/qdrant.service");
const bge_m3_provider_1 = require("../retrieval/bge-m3.provider");
const mock_test_engine_types_1 = require("./mock-test-engine.types");
const PDFDocument = require('pdfkit');
const USER_DOCS_COLLECTION = 'user_documents';
const ANSWER_WORD_TARGETS = {
    5: '600-900 words (approximately 1 written page)',
    10: '1200-1800 words (approximately 2-3 written pages)',
    15: '1800-2500 words (approximately 3-4 written pages)',
    20: '2500-3500 words (approximately 4-5 written pages)',
};
let MockTestEngineService = MockTestEngineService_1 = class MockTestEngineService {
    constructor(questionBank, plans, papers, paperQuestions, qdrantService, bgeM3Provider) {
        this.questionBank = questionBank;
        this.plans = plans;
        this.papers = papers;
        this.paperQuestions = paperQuestions;
        this.qdrantService = qdrantService;
        this.bgeM3Provider = bgeM3Provider;
        this.logger = new common_1.Logger(MockTestEngineService_1.name);
    }
    async generatePaper(userId, request) {
        const startedAt = Date.now();
        const prompt = (request.prompt || '').trim() || 'Generate a mock test from my uploaded study material.';
        const specification = this.resolveSpecification(prompt, request.mode);
        const existingBank = await this.questionBank.find({
            where: { userId, validationStatus: 'valid' },
            order: { topic: 'ASC', subtopic: 'ASC', markValue: 'ASC', qualityScore: 'DESC' },
        });
        const needed = this.computeNeededCounts(specification, existingBank);
        const totalNeeded = Object.values(needed).reduce((s, n) => s + n, 0);
        let questionsGenerated = 0;
        if (totalNeeded > 0) {
            this.logger.log(`Question bank has insufficient questions for this paper. Generating ${totalNeeded} questions from AI...`);
            questionsGenerated = await this.aiGenerateAndBankQuestions(userId, prompt, specification, needed, existingBank);
            this.logger.log(`AI generated and banked ${questionsGenerated} questions.`);
        }
        const bank = await this.questionBank.find({
            where: { userId, validationStatus: 'valid' },
            order: { topic: 'ASC', subtopic: 'ASC', markValue: 'ASC', qualityScore: 'DESC' },
        });
        const coverageSnapshot = await this.readCoverage(userId);
        const recentQuestionIds = await this.readRecentQuestionIds(userId, specification.mode);
        const selected = this.selectQuestions(bank, specification, coverageSnapshot, recentQuestionIds);
        const assemblySections = this.buildSections(selected.questions);
        const status = selected.questions.length === 0 ? 'failed' : selected.shortfalls.length > 0 ? 'partial' : 'ready';
        const totalMarks = selected.questions.reduce((sum, question) => sum + question.markValue, 0);
        const pdf = await this.generatePdf(prompt, specification, coverageSnapshot, selected.questions, selected.shortfalls);
        const paper = await this.papers.save(this.papers.create({
            userId,
            mode: specification.mode,
            prompt,
            specification,
            coverageSnapshot,
            assemblySections,
            questionIds: selected.questions.map((question) => question.questionId),
            totalMarks,
            durationMinutes: specification.durationMinutes,
            status,
            shortfalls: selected.shortfalls,
            pdfBase64: pdf.toString('base64'),
            generationTimeMs: Date.now() - startedAt,
        }));
        if (selected.questions.length > 0) {
            await this.paperQuestions.save(selected.questions.map((question) => this.paperQuestions.create({
                paperId: paper.id,
                userId,
                questionId: question.questionId,
                questionNumber: question.questionNumber,
                sectionLabel: question.sectionLabel,
                question: question.question,
                questionType: question.questionType,
                difficulty: question.difficulty,
                topic: question.topic,
                subtopic: question.subtopic,
                markValue: question.markValue,
                qualityScore: question.qualityScore,
            })));
        }
        return {
            paperId: paper.id,
            status,
            mode: paper.mode,
            totalMarks,
            durationMinutes: paper.durationMinutes,
            generationTimeMs: paper.generationTimeMs,
            pdfBytes: pdf.length,
            selectedQuestions: selected.questions,
            shortfalls: selected.shortfalls,
            questionsGenerated,
        };
    }
    computeNeededCounts(specification, existing) {
        const needed = {};
        for (const markValue of [5, 10, 15, 20]) {
            const required = specification.markMix[markValue] || 0;
            if (required === 0)
                continue;
            const have = existing.filter((q) => q.markValue === markValue).length;
            const deficit = Math.max(0, required * 2 - have);
            if (deficit > 0)
                needed[markValue] = deficit;
        }
        return needed;
    }
    async aiGenerateAndBankQuestions(userId, prompt, specification, needed, existingBank) {
        const openrouterKey = process.env.OPENROUTER_API_KEY;
        if (!openrouterKey || openrouterKey.includes('placeholder')) {
            this.logger.warn('No OpenRouter key — skipping AI question generation. Paper will use existing bank or return partial.');
            return 0;
        }
        const searchQuery = `${prompt} ${specification.topicHints.join(' ')}`.trim();
        const chunks = await this.retrieveRelevantChunks(userId, searchQuery, 25);
        if (!chunks.length) {
            this.logger.warn('No Qdrant chunks found for user — cannot generate questions from material. Ensure documents are uploaded and indexed.');
            return 0;
        }
        const material = this.formatChunksForPrompt(chunks);
        const questionRequirements = [];
        for (const [markStr, count] of Object.entries(needed)) {
            const marks = Number(markStr);
            const types = this.resolveTypeMix(specification.mode);
            const preferredType = Object.keys(types)[0] || 'long';
            questionRequirements.push(`- ${count} question(s) worth ${marks} marks each, type: ${preferredType.replace(/_/g, ' ')}, requiring ${this.answerLengthLabel(marks)} to answer`);
        }
        const totalNeeded = Object.values(needed).reduce((s, n) => s + n, 0);
        const existingTopics = [...new Set(existingBank.map((q) => q.topic))].slice(0, 8).join(', ');
        const systemPrompt = `You are an expert Indian law professor generating examination questions for LLB and judiciary aspirants. You generate only descriptive long-answer questions grounded in the provided study material. You never fabricate facts, statutes, or case names not present in the material.`;
        const userPrompt = `Generate exactly ${totalNeeded} examination questions from the supplied Indian law study material. These questions will be stored in a question bank and used to assemble mock test papers.

EXAM MODE: ${specification.mode}
PROMPT / TOPIC HINT: ${prompt}
${existingTopics ? `TOPICS ALREADY IN BANK (avoid repeating these subtopics): ${existingTopics}` : ''}

QUESTIONS NEEDED:
${questionRequirements.join('\n')}

ABSOLUTE QUESTION REQUIREMENTS:
- Every question must be a DESCRIPTIVE LONG-ANSWER question — minimum 2 sentences long, requiring the student to write 2-5 pages.
- NEVER generate MCQs, fill-in-the-blanks, true/false, one-word, or short-answer questions.
- Ground every question strictly in the study material below. Do not ask about topics not covered in the source.
- Questions must cover multiple dimensions: definition, statutory provisions, judicial interpretation, application, and analysis.
- Prefer Indian constitutional law, statutory law, judicial decisions, and Indian examination terminology.
- Each question must be clearly answerable from the provided material.
- Mark values must match exactly what is listed in QUESTIONS NEEDED.
- Do NOT invent fake case names, statutes, parties, dates, or holdings.
- Vary the topics and subtopics across questions for broad coverage.

VALID question types: long, analytical, case_based, problem_based, critical, comparative
VALID difficulty: easy, medium, hard
VALID markValue: 5, 10, 15, 20

Return ONLY a valid JSON object in this exact schema (no markdown, no explanation):
{
  "questions": [
    {
      "question": "Full descriptive 2-4 sentence examination question that requires 3-4 pages to answer comprehensively",
      "questionType": "long",
      "difficulty": "medium",
      "topic": "Main area of law (e.g. Constitutional Law)",
      "subtopic": "Specific doctrine or concept (e.g. Doctrine of Basic Structure)",
      "markValue": 15,
      "rubric": [
        { "label": "Introduction and Definition", "marks": 3, "criteria": "Clear definition with legal context and statutory grounding" },
        { "label": "Statutory Provisions and Articles", "marks": 4, "criteria": "Accurate citation and explanation of relevant provisions" },
        { "label": "Case Law and Judicial Pronouncements", "marks": 4, "criteria": "Correct identification and application of binding precedents" },
        { "label": "Analysis and Critical Reasoning", "marks": 2, "criteria": "Logical analysis demonstrating depth of understanding" },
        { "label": "Conclusion", "marks": 2, "criteria": "Clear, well-reasoned conclusion addressing the question directly" }
      ]
    }
  ]
}

STUDY MATERIAL:
${material}`;
        const providers = [
            process.env.OPENROUTER_GEMINI_MODEL || 'google/gemini-2.5-flash',
            process.env.OPENROUTER_QWEN_MODEL || 'qwen/qwen3-30b-a3b-instruct:free',
            process.env.OPENROUTER_DEEPSEEK_MODEL || 'deepseek/deepseek-r1-0528:free',
        ];
        let parsed = null;
        for (const model of providers) {
            try {
                this.logger.log(`Generating questions via OpenRouter: ${model}`);
                const resp = await axios_1.default.post('https://openrouter.ai/api/v1/chat/completions', {
                    model,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    temperature: 0.25,
                    max_tokens: 8000,
                }, {
                    headers: {
                        Authorization: `Bearer ${openrouterKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': process.env.CLIENT_ORIGIN || 'http://localhost:5173',
                        'X-Title': 'LEGATRIXON Mock Test Engine',
                    },
                    timeout: 90000,
                });
                const content = resp.data?.choices?.[0]?.message?.content || '';
                if (!content.trim())
                    throw new Error('Empty response');
                try {
                    parsed = JSON.parse(content.trim());
                }
                catch {
                    const match = content.match(/\{[\s\S]*\}/);
                    if (match)
                        parsed = JSON.parse(match[0]);
                    else
                        throw new Error('No JSON found in response');
                }
                this.logger.log(`Question generation successful via ${model}: ${parsed?.questions?.length || 0} questions`);
                break;
            }
            catch (err) {
                const msg = err.response?.data?.error?.message || err.message || String(err);
                this.logger.warn(`Question generation failed via ${model}: ${msg}`);
            }
        }
        if (!parsed?.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
            this.logger.warn('AI question generation returned no valid questions. Paper may be partial.');
            return 0;
        }
        const validQuestionTypes = new Set(['short', 'long', 'analytical', 'comparative', 'critical', 'case_based', 'problem_based']);
        const validDifficulties = new Set(['easy', 'medium', 'hard']);
        const validMarkValues = new Set([5, 10, 15, 20]);
        const toSave = [];
        const sharedSlotPrefix = `ai-${userId.slice(0, 8)}-${Date.now()}`;
        for (const [idx, raw] of parsed.questions.entries()) {
            const questionText = String(raw.question || '').trim();
            if (!questionText || questionText.length < 40)
                continue;
            const questionType = validQuestionTypes.has(raw.questionType) ? raw.questionType : 'long';
            const difficulty = validDifficulties.has(raw.difficulty) ? raw.difficulty : 'medium';
            const markValue = validMarkValues.has(Number(raw.markValue)) ? Number(raw.markValue) : 15;
            const topic = String(raw.topic || specification.topicHints[0] || 'Law').slice(0, 120);
            const subtopic = String(raw.subtopic || topic).slice(0, 120);
            const rubric = this.buildRubric(raw.rubric, markValue);
            const entry = this.questionBank.create({
                userId,
                planId: `ai-generated-${userId.slice(0, 8)}`,
                slotId: `${sharedSlotPrefix}-${idx}`,
                tkuId: `ai-tku-${userId.slice(0, 8)}-${idx}`,
                question: questionText,
                questionType,
                difficulty,
                topic,
                subtopic,
                markValue,
                rubric,
                boundEntityRefs: [],
                groundingSources: chunks.slice(0, 5).map((c) => ({
                    documentId: String(c.payload?.source_id || c.payload?.document_id || ''),
                    sourceType: 'document',
                    text: String(c.payload?.text || '').slice(0, 200) || undefined,
                })),
                qualityScore: 0.72,
                validationStatus: 'valid',
                validationReasons: ['AI-generated from uploaded study material'],
                sourceTkuVersion: 1,
            });
            toSave.push(entry);
        }
        if (toSave.length === 0)
            return 0;
        try {
            await this.questionBank.save(toSave);
            this.logger.log(`Saved ${toSave.length} AI-generated questions to question bank.`);
            return toSave.length;
        }
        catch (err) {
            this.logger.error(`Failed to save AI-generated questions: ${err.message}`);
            return 0;
        }
    }
    buildRubric(rawRubric, markValue) {
        if (Array.isArray(rawRubric) && rawRubric.length > 0) {
            const totalFromRubric = rawRubric.reduce((s, r) => s + Number(r.marks || 0), 0);
            if (totalFromRubric > 0 && totalFromRubric <= markValue + 2) {
                return rawRubric.map((r) => ({
                    label: String(r.label || r.criterion || 'Component'),
                    marks: Number(r.marks || 0),
                    criteria: String(r.criteria || r.description || ''),
                    boundEntityRefs: [],
                }));
            }
        }
        const templates = {
            5: [{ label: 'Definition and Introduction', marks: 2, criteria: 'Clear legal definition' }, { label: 'Analysis', marks: 2, criteria: 'Brief analysis with authority' }, { label: 'Conclusion', marks: 1, criteria: 'Clear conclusion' }],
            10: [{ label: 'Introduction and Definition', marks: 2, criteria: 'Legal definition with context' }, { label: 'Statutory Provisions', marks: 3, criteria: 'Relevant provisions cited and explained' }, { label: 'Case Law', marks: 3, criteria: 'Precedents applied correctly' }, { label: 'Conclusion', marks: 2, criteria: 'Sound conclusion' }],
            15: [{ label: 'Introduction and Definition', marks: 3, criteria: 'Comprehensive definition with legal framework' }, { label: 'Statutory Provisions and Articles', marks: 4, criteria: 'All relevant provisions cited and explained' }, { label: 'Case Law and Judicial Pronouncements', marks: 4, criteria: 'Leading cases discussed with holdings' }, { label: 'Critical Analysis', marks: 2, criteria: 'Analytical evaluation of legal position' }, { label: 'Conclusion', marks: 2, criteria: 'Well-reasoned conclusion' }],
            20: [{ label: 'Introduction and Definition', marks: 4, criteria: 'Comprehensive definition with constitutional/statutory framework' }, { label: 'Statutory Provisions and Articles', marks: 5, criteria: 'All relevant provisions with scope and operation' }, { label: 'Case Law and Judicial Pronouncements', marks: 5, criteria: 'Leading and landmark cases discussed in depth' }, { label: 'Critical Analysis and Application', marks: 4, criteria: 'Deep analytical evaluation and application' }, { label: 'Conclusion', marks: 2, criteria: 'Authoritative conclusion' }],
        };
        return (templates[markValue] || templates[15]).map((r) => ({ ...r, boundEntityRefs: [] }));
    }
    answerLengthLabel(marks) {
        if (marks <= 5)
            return '1 written page';
        if (marks <= 10)
            return '2-3 written pages';
        if (marks <= 15)
            return '3-4 written pages';
        return '4-5 written pages';
    }
    async listPapers(userId) {
        return this.papers.find({ where: { userId }, order: { createdAt: 'DESC' } });
    }
    async getPaper(userId, id) {
        const paper = await this.papers.findOne({ where: { id, userId } });
        if (!paper)
            throw new common_1.NotFoundException('Mock test paper not found.');
        return paper;
    }
    async getPaperQuestions(userId, paperId) {
        await this.getPaper(userId, paperId);
        return this.paperQuestions.find({ where: { userId, paperId }, order: { questionNumber: 'ASC' } });
    }
    async getPaperPdf(userId, id) {
        const paper = await this.getPaper(userId, id);
        return Buffer.from(paper.pdfBase64, 'base64');
    }
    resolveSpecification(prompt, requestedMode) {
        const mode = requestedMode && mock_test_engine_types_1.MOCK_TEST_MODES.includes(requestedMode) ? requestedMode : this.detectMode(prompt);
        const totalMarks = this.parseTotalMarks(prompt) || this.defaultTotalMarks(mode);
        const durationMinutes = this.parseDurationMinutes(prompt) || this.defaultDuration(mode, totalMarks);
        return {
            mode,
            totalMarks,
            durationMinutes,
            markMix: this.resolveMarkMix(mode, totalMarks),
            typeMix: this.resolveTypeMix(mode),
            difficultyTargets: this.resolveDifficultyTargets(mode),
            topicHints: this.extractTopicHints(prompt),
        };
    }
    detectMode(prompt) {
        const text = prompt.toLowerCase();
        if (/\bsemester\b/.test(text))
            return 'semester';
        if (/\buniversity\b|\bend[- ]?term\b|\bfinal\b/.test(text))
            return 'university';
        if (/\bjudiciary\b|\bjudicial\b|\bprelims\b|\bmains\b/.test(text))
            return 'judiciary';
        if (/\bteacher\b|\bclass\b|\bassignment\b/.test(text))
            return 'teacher';
        if (/\brevision\b|\bpractice\b|\bquick\b/.test(text))
            return 'revision';
        return 'custom';
    }
    defaultTotalMarks(mode) {
        const totals = {
            semester: 80,
            university: 100,
            judiciary: 100,
            teacher: 50,
            revision: 30,
            custom: 50,
        };
        return totals[mode];
    }
    defaultDuration(mode, totalMarks) {
        const minutes = {
            semester: 180,
            university: 180,
            judiciary: 180,
            teacher: 120,
            revision: 60,
            custom: Math.max(30, Math.ceil(totalMarks * 2)),
        };
        return minutes[mode];
    }
    resolveMarkMix(mode, totalMarks) {
        const templates = {
            semester: { 5: 1, 10: 2, 15: 1, 20: 2 },
            university: { 5: 1, 10: 2, 15: 1, 20: 3 },
            judiciary: { 5: 2, 10: 2, 15: 2, 20: 2 },
            teacher: { 5: 3, 10: 2, 15: 1, 20: 0 },
            revision: { 5: 2, 10: 2, 15: 0, 20: 0 },
            custom: { 5: 2, 10: 2, 15: 0, 20: 1 },
        };
        const template = { ...templates[mode] };
        const templateTotal = this.markMixTotal(template);
        if (templateTotal === totalMarks)
            return template;
        return this.greedyMarkMix(totalMarks);
    }
    greedyMarkMix(totalMarks) {
        const mix = { 5: 0, 10: 0, 15: 0, 20: 0 };
        let remaining = Math.max(5, Math.round(totalMarks / 5) * 5);
        for (const markValue of [20, 15, 10, 5]) {
            while (remaining >= markValue) {
                mix[markValue] += 1;
                remaining -= markValue;
            }
        }
        return mix;
    }
    markMixTotal(mix) {
        return [5, 10, 15, 20].reduce((sum, markValue) => sum + markValue * (mix[markValue] || 0), 0);
    }
    resolveTypeMix(mode) {
        if (mode === 'revision')
            return { short: 2, analytical: 1, case_based: 1 };
        if (mode === 'judiciary')
            return { problem_based: 2, case_based: 2, analytical: 1, critical: 1 };
        if (mode === 'teacher')
            return { short: 2, long: 1, comparative: 1, case_based: 1 };
        if (mode === 'university')
            return { long: 2, analytical: 2, critical: 1, case_based: 1 };
        if (mode === 'semester')
            return { short: 1, long: 2, analytical: 1, case_based: 1 };
        return { short: 1, long: 1, analytical: 1, case_based: 1, critical: 1 };
    }
    resolveDifficultyTargets(mode) {
        if (mode === 'revision')
            return { easy: 0.45, medium: 0.45, hard: 0.1 };
        if (mode === 'judiciary')
            return { easy: 0.15, medium: 0.45, hard: 0.4 };
        if (mode === 'teacher')
            return { easy: 0.3, medium: 0.5, hard: 0.2 };
        return { easy: 0.2, medium: 0.5, hard: 0.3 };
    }
    parseTotalMarks(prompt) {
        const match = prompt.match(/(\d{2,3})\s*(?:mark|marks)/i);
        if (!match)
            return null;
        const marks = Number(match[1]);
        return Number.isFinite(marks) && marks >= 5 ? Math.min(200, Math.round(marks / 5) * 5) : null;
    }
    parseDurationMinutes(prompt) {
        const hourMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(?:hour|hours|hr|hrs)/i);
        if (hourMatch)
            return Math.round(Number(hourMatch[1]) * 60);
        const minuteMatch = prompt.match(/(\d{2,3})\s*(?:minute|minutes|min|mins)/i);
        return minuteMatch ? Number(minuteMatch[1]) : null;
    }
    extractTopicHints(prompt) {
        const stopWords = new Set(['generate', 'mock', 'test', 'paper', 'marks', 'hours', 'hour', 'minutes', 'semester', 'university', 'judiciary', 'teacher', 'revision', 'custom', 'from', 'with', 'for']);
        return [...new Set((prompt.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || []).filter((word) => !stopWords.has(word)))].slice(0, 12);
    }
    async readCoverage(userId) {
        const plan = await this.plans.findOne({ where: { userId } });
        if (!plan)
            return { planId: null, totalSlots: 0, totalMarks: 0, topicCount: 0, rows: [] };
        return {
            planId: plan.id,
            totalSlots: plan.summary?.totalSlots || 0,
            totalMarks: plan.summary?.totalMarks || 0,
            topicCount: plan.summary?.topicCount || 0,
            rows: (plan.coverageMatrix || []).map((row) => ({
                topic: row.topic,
                subtopic: row.subtopic,
                coverageScore: row.coverageScore,
                confidenceScore: row.confidenceScore,
            })),
        };
    }
    async readRecentQuestionIds(userId, mode) {
        const recent = await this.papers.find({ where: { userId, mode }, order: { createdAt: 'DESC' }, take: 3 });
        return new Set(recent.flatMap((paper) => paper.questionIds || []));
    }
    selectQuestions(bank, specification, coverageSnapshot, recentQuestionIds) {
        const slots = this.buildSelectionSlots(specification);
        const coverageByTopic = new Map(coverageSnapshot.rows.map((row) => [`${row.topic}\u0000${row.subtopic}`, row]));
        const topicScoped = this.filterByTopicHints(bank, specification.topicHints);
        const candidates = topicScoped.length > 0 ? topicScoped : bank;
        const selected = [];
        const shortfalls = [];
        const usedIds = new Set();
        const usedText = new Set();
        const topicCounts = new Map();
        const difficultyCounts = { easy: 0, medium: 0, hard: 0 };
        slots.forEach((slot, index) => {
            const hasNonRecentCandidate = candidates.some((question) => {
                if (question.markValue !== slot.markValue)
                    return false;
                if (usedIds.has(question.id) || usedText.has(this.normalizeText(question.question)))
                    return false;
                return !recentQuestionIds.has(question.id);
            });
            const available = candidates.filter((question) => {
                if (question.markValue !== slot.markValue)
                    return false;
                if (usedIds.has(question.id) || usedText.has(this.normalizeText(question.question)))
                    return false;
                if (hasNonRecentCandidate && recentQuestionIds.has(question.id))
                    return false;
                return true;
            });
            const question = this.pickBestCandidate(available, slot, coverageByTopic, topicCounts, difficultyCounts, specification);
            if (!question) {
                shortfalls.push(`No available ${slot.markValue}-mark question for slot ${index + 1}.`);
                return;
            }
            usedIds.add(question.id);
            usedText.add(this.normalizeText(question.question));
            const topicKey = `${question.topic}\u0000${question.subtopic}`;
            topicCounts.set(topicKey, (topicCounts.get(topicKey) || 0) + 1);
            difficultyCounts[question.difficulty] += 1;
            selected.push({
                questionId: question.id,
                questionNumber: selected.length + 1,
                sectionLabel: this.sectionLabel(question.markValue),
                question: question.question,
                questionType: question.questionType,
                difficulty: question.difficulty,
                topic: question.topic,
                subtopic: question.subtopic,
                markValue: question.markValue,
                qualityScore: question.qualityScore,
            });
        });
        return { questions: selected, shortfalls };
    }
    buildSelectionSlots(specification) {
        const preferredTypes = this.expandTypePreference(specification.typeMix);
        const slots = [];
        for (const markValue of [20, 15, 10, 5]) {
            for (let index = 0; index < (specification.markMix[markValue] || 0); index++) {
                slots.push({ markValue, preferredTypes });
            }
        }
        return slots;
    }
    expandTypePreference(typeMix) {
        const expanded = Object.entries(typeMix).flatMap(([type, count]) => Array.from({ length: count || 0 }, () => type));
        return expanded.length > 0 ? expanded : [...question_planning_types_1.QUESTION_TYPES];
    }
    filterByTopicHints(bank, topicHints) {
        if (topicHints.length === 0)
            return bank;
        return bank.filter((question) => {
            const haystack = `${question.topic} ${question.subtopic} ${question.question}`.toLowerCase();
            return topicHints.some((hint) => haystack.includes(hint));
        });
    }
    pickBestCandidate(candidates, slot, coverageByTopic, topicCounts, difficultyCounts, specification) {
        if (candidates.length === 0)
            return null;
        return candidates
            .map((question) => ({ question, score: this.candidateScore(question, slot, coverageByTopic, topicCounts, difficultyCounts, specification) }))
            .sort((a, b) => b.score - a.score || b.question.qualityScore - a.question.qualityScore || a.question.createdAt.getTime() - b.question.createdAt.getTime())[0].question;
    }
    candidateScore(question, slot, coverageByTopic, topicCounts, difficultyCounts, specification) {
        const coverage = coverageByTopic.get(`${question.topic}\u0000${question.subtopic}`);
        const typeScore = slot.preferredTypes.includes(question.questionType) ? 1 : 0.35;
        const coverageScore = coverage ? coverage.coverageScore * 0.6 + coverage.confidenceScore * 0.4 : 0.55;
        const topicPenalty = Math.min(0.35, (topicCounts.get(`${question.topic}\u0000${question.subtopic}`) || 0) * 0.12);
        const selectedCount = Object.values(difficultyCounts).reduce((sum, count) => sum + count, 0);
        const projectedRatio = (difficultyCounts[question.difficulty] + 1) / Math.max(1, selectedCount + 1);
        const difficultyScore = 1 - Math.abs(projectedRatio - specification.difficultyTargets[question.difficulty]);
        return question.qualityScore * 0.35 + typeScore * 0.2 + coverageScore * 0.25 + difficultyScore * 0.2 - topicPenalty;
    }
    buildSections(questions) {
        return [5, 10, 15, 20]
            .map((markValue) => {
            const matching = questions.filter((question) => question.markValue === markValue);
            return {
                label: this.sectionLabel(markValue),
                markValue,
                questionIds: matching.map((question) => question.questionId),
                totalMarks: matching.reduce((sum, question) => sum + question.markValue, 0),
            };
        })
            .filter((section) => section.questionIds.length > 0);
    }
    sectionLabel(markValue) {
        const labels = {
            5: 'Section A',
            10: 'Section B',
            15: 'Section C',
            20: 'Section D',
        };
        return labels[markValue];
    }
    async generatePdf(prompt, specification, coverageSnapshot, questions, shortfalls) {
        const doc = new PDFDocument({ margin: 48, size: 'A4' });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
        doc.fontSize(18).text('Mock Test Paper', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).text(`Mode: ${this.titleCase(specification.mode)} | Marks: ${questions.reduce((sum, question) => sum + question.markValue, 0)}/${specification.totalMarks} | Duration: ${specification.durationMinutes} minutes`);
        doc.text(`Coverage topics available: ${coverageSnapshot.topicCount}`);
        doc.text(`Prompt: ${prompt}`);
        if (shortfalls.length > 0)
            doc.text(`Shortfalls: ${shortfalls.join(' ')}`);
        doc.moveDown();
        let currentSection = '';
        for (const question of questions) {
            if (question.sectionLabel !== currentSection) {
                currentSection = question.sectionLabel;
                doc.moveDown(0.5).fontSize(13).text(`${currentSection} - ${question.markValue} mark questions`);
            }
            doc.moveDown(0.35);
            doc.fontSize(11).text(`${question.questionNumber}. ${question.question}`, { continued: false });
            doc.fontSize(9).text(`Topic: ${question.topic} / ${question.subtopic} | Type: ${question.questionType.replace(/_/g, ' ')} | Difficulty: ${question.difficulty} | Marks: ${question.markValue}`);
        }
        if (questions.length === 0)
            doc.fontSize(11).text('No validated question-bank entries were available for assembly.');
        doc.end();
        return done;
    }
    normalizeText(value) {
        return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }
    titleCase(value) {
        return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    }
    async getModelAnswer(userId, questionId) {
        const entry = await this.questionBank.findOne({ where: { id: questionId, userId } });
        if (!entry)
            throw new common_1.NotFoundException('Question not found in your question bank.');
        return { questionId, modelAnswer: entry.modelAnswer || null, cached: !!entry.modelAnswer };
    }
    async generateModelAnswer(userId, questionId, question, topic, markValue, force = false) {
        const entry = await this.questionBank.findOne({ where: { id: questionId, userId } });
        if (!entry)
            throw new common_1.NotFoundException('Question not found in your question bank.');
        if (entry.modelAnswer && !force) {
            const wordCount = entry.modelAnswer.split(/\s+/).filter(Boolean).length;
            return { questionId, modelAnswer: entry.modelAnswer, cached: true, wordCount };
        }
        const searchQuery = `${topic} ${question}`;
        const chunks = await this.retrieveRelevantChunks(userId, searchQuery, 20);
        const wordTarget = ANSWER_WORD_TARGETS[markValue] || ANSWER_WORD_TARGETS[15];
        const chunkText = this.formatChunksForPrompt(chunks);
        const modelAnswer = await this.generateLongAnswer(question, topic, markValue, wordTarget, chunkText);
        entry.modelAnswer = modelAnswer;
        await this.questionBank.save(entry);
        const wordCount = modelAnswer.split(/\s+/).filter(Boolean).length;
        this.logger.log(`Model answer generated for question ${questionId}: ${wordCount} words, ${chunks.length} chunks used.`);
        return { questionId, modelAnswer, cached: false, wordCount };
    }
    async retrieveRelevantChunks(userId, query, limit) {
        const client = this.qdrantService.getClient();
        if (!client)
            return [];
        let vector;
        try {
            if (this.bgeM3Provider?.isAvailable()) {
                vector = await this.bgeM3Provider.generateEmbedding(query);
            }
            else {
                vector = this.deterministicVector(query, 1024);
            }
        }
        catch {
            vector = this.deterministicVector(query, 1024);
        }
        try {
            const results = await client.search(USER_DOCS_COLLECTION, {
                vector,
                limit,
                filter: { must: [{ key: 'user_id', match: { value: userId } }] },
                with_payload: true,
            });
            return (results || []).map((hit) => ({ id: hit.id, score: hit.score, payload: hit.payload || {} }));
        }
        catch (err) {
            this.logger.warn(`Qdrant search failed during model answer generation: ${err.message}`);
            return [];
        }
    }
    formatChunksForPrompt(chunks) {
        if (!chunks.length)
            return 'No retrieved study material available. Generate the answer from general Indian law knowledge only.';
        return chunks.map((chunk, i) => {
            const p = chunk.payload || {};
            const lines = [
                `[Source Chunk ${i + 1}]`,
                p.name || p.document_name ? `SOURCE: ${p.name || p.document_name}` : '',
                p.page ? `PAGE: ${p.page}` : '',
                p.text ? `TEXT: ${String(p.text).slice(0, 1200)}` : '',
            ].filter(Boolean);
            return lines.join('\n');
        }).join('\n\n---\n\n');
    }
    async generateLongAnswer(question, topic, markValue, wordTarget, retrievedMaterial) {
        const openrouterKey = process.env.OPENROUTER_API_KEY;
        if (!openrouterKey || openrouterKey.includes('placeholder')) {
            throw new common_1.BadRequestException('AI provider not configured. Set OPENROUTER_API_KEY in server/.env');
        }
        const systemPrompt = `You are an expert Indian law professor writing a model examination answer for LLB / judiciary mains students. Your answer must be comprehensive, grounded in the provided study material, and written exactly as a top-scoring student would write in a physical examination hall.`;
        const userPrompt = `Generate a complete model answer for the following law examination question.

QUESTION: ${question}
TOPIC: ${topic}
MARKS: ${markValue}
TARGET LENGTH: ${wordTarget}

ABSOLUTE FORMATTING RULES:
- Write ONLY in plain flowing prose paragraphs.
- Use numbered section headings as plain text ONLY, for example: "1. Introduction" on its own line, then full paragraphs below it.
- BANNED: ** (bold), * (italic), # (headings with hash), - (bullet dashes), > (blockquotes), _ (underlines), backticks, asterisks.
- Every section must contain multiple full paragraphs — no single-sentence sections.
- Write in formal legal English as a top-scoring LLB or judiciary mains candidate.

REQUIRED STRUCTURE (write every section in full paragraphs):
1. Introduction — Define the legal concept, state its constitutional/statutory significance, and frame the question precisely. Minimum 2 paragraphs.
2. Meaning and Definition — Doctrinal meaning with any statutory or judicial definitions found in the material. Minimum 2 paragraphs.
3. Relevant Statutory Provisions and Constitutional Articles — Every relevant provision from the material, explained in full sentences with scope and operation discussed.
4. Essential Ingredients and Legal Elements — Each ingredient or condition explained as a separate paragraph (not a bullet point). Start each paragraph with the ingredient name.
5. Governing Legal Principles and Doctrines — Key doctrines, rules of interpretation, and fundamental principles directly from the material.
6. Case Laws and Judicial Pronouncements — Discuss every judgment found in the material: facts, legal issue, holding. If no case law is in the material, write one sentence: "The specific judicial authority on this point should be verified from current law reports."
7. Application and Critical Analysis — Apply the law to the question's scenario or issues. For problem questions, work through each ingredient against the given facts.
8. Exceptions, Defences, and Special Rules — Any exceptions, provisos, or special rules from the material.
9. Comparative and Policy Perspective — Brief comparison with related doctrines or policy rationale if available in the material.
10. Conclusion — Restate the legal position in 2-3 paragraphs, answer the question directly, and end with the examiner's expected conclusion.

STRICT GROUNDING RULES:
- Ground every proposition in the retrieved study material below.
- Do NOT invent fake statutes, sections, judgments, case names, dates, or parties not in the material.
- If authority is absent from the material, write: "The specific authority on this point should be verified from current law reports."
- Prefer Indian law, Indian statutory terminology, and Indian examination style.

RETRIEVED STUDY MATERIAL:
${retrievedMaterial}

Return ONLY the plain-text model answer. No JSON. No markdown. No preamble. Start directly with "1. Introduction".`;
        const providers = [
            process.env.OPENROUTER_GEMINI_MODEL || 'google/gemini-2.5-flash',
            process.env.OPENROUTER_QWEN_MODEL || 'qwen/qwen3-30b-a3b-instruct:free',
            process.env.OPENROUTER_DEEPSEEK_MODEL || 'deepseek/deepseek-r1-0528:free',
        ];
        let lastError = null;
        for (const model of providers) {
            try {
                this.logger.log(`Generating model answer via OpenRouter: ${model}`);
                const resp = await axios_1.default.post('https://openrouter.ai/api/v1/chat/completions', {
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    temperature: 0.15,
                    max_tokens: 6000,
                }, {
                    headers: {
                        Authorization: `Bearer ${openrouterKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': process.env.CLIENT_ORIGIN || 'http://localhost:5173',
                        'X-Title': 'LEGATRIXON Mock Test Engine',
                    },
                    timeout: 90000,
                });
                const content = resp.data?.choices?.[0]?.message?.content || '';
                if (!content.trim())
                    throw new Error('Empty response from model');
                const cleaned = content
                    .replace(/^#+\s+/gm, '')
                    .replace(/\*\*(.+?)\*\*/g, '$1')
                    .replace(/\*(.+?)\*/g, '$1')
                    .replace(/^[*-]\s+/gm, '')
                    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, ''))
                    .replace(/_{1,2}(.+?)_{1,2}/g, '$1')
                    .replace(/>\s*/gm, '')
                    .replace(/\n{4,}/g, '\n\n\n')
                    .trim();
                this.logger.log(`Model answer generated via ${model}: ${cleaned.split(/\s+/).length} words`);
                return cleaned;
            }
            catch (err) {
                const msg = err.response?.data?.error?.message || err.message || String(err);
                this.logger.warn(`OpenRouter model ${model} failed for answer generation: ${msg}`);
                lastError = new Error(msg);
            }
        }
        throw new common_1.BadRequestException(`All AI providers failed to generate model answer: ${lastError?.message}`);
    }
    deterministicVector(text, size) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = (hash << 5) - hash + text.charCodeAt(i);
            hash |= 0;
        }
        const v = new Array(size);
        let sum = 0;
        for (let i = 0; i < size; i++) {
            hash = (hash * 1664525 + 1013904223) % 4294967296;
            v[i] = hash / 4294967296 * 2 - 1;
            sum += v[i] * v[i];
        }
        const mag = Math.sqrt(sum) || 1;
        return v.map((x) => x / mag);
    }
};
exports.MockTestEngineService = MockTestEngineService;
exports.MockTestEngineService = MockTestEngineService = MockTestEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(question_bank_entry_entity_1.QuestionBankEntryEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(question_plan_entity_1.QuestionPlanEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(mock_test_paper_entity_1.MockTestPaperEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(mock_test_paper_question_entity_1.MockTestPaperQuestionEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        qdrant_service_1.QdrantService,
        bge_m3_provider_1.BgeM3Provider])
], MockTestEngineService);
//# sourceMappingURL=mock-test-engine.service.js.map