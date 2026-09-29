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
var ModelAnswerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelAnswerService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const topic_knowledge_unit_entity_1 = require("../knowledge-engine/entities/topic-knowledge-unit.entity");
const question_bank_entry_entity_1 = require("../question-bank/entities/question-bank-entry.entity");
const openrouter_ai_provider_service_1 = require("../chat/openrouter-ai-provider.service");
const model_answer_entry_entity_1 = require("./entities/model-answer-entry.entity");
let ModelAnswerService = ModelAnswerService_1 = class ModelAnswerService {
    constructor(questions, tkus, answers, aiProvider) {
        this.questions = questions;
        this.tkus = tkus;
        this.answers = answers;
        this.aiProvider = aiProvider;
        this.logger = new common_1.Logger(ModelAnswerService_1.name);
        this.maxValidationAttempts = 3;
        this.componentOrder = [
            'introduction',
            'relevant_sections',
            'legal_principles',
            'explanation',
            'case_law',
            'critical_analysis',
            'conclusion',
            'examiner_keywords',
        ];
    }
    async createAnswerBank(userId) {
        const questions = await this.questions.find({ where: { userId, validationStatus: 'valid' }, order: { topic: 'ASC', subtopic: 'ASC', markValue: 'ASC' } });
        const tkus = await this.tkus.find({ where: { userId } });
        const tkuById = new Map(tkus.map((tku) => [tku.id, tku]));
        let rejected = 0;
        let attempts = 0;
        const entries = [];
        for (const question of questions) {
            const tku = tkuById.get(question.tkuId);
            if (!tku)
                continue;
            const generated = await this.generateValidatedAnswer(question, tku);
            attempts += generated.attempts;
            rejected += generated.rejected;
            if (!generated.draft)
                continue;
            const existing = await this.answers.findOne({ where: { userId, questionId: question.id } });
            entries.push(this.answers.create({ ...(existing || {}), ...generated.draft }));
        }
        if (entries.length > 0)
            await this.answers.save(entries);
        const all = await this.listForUser(userId);
        return {
            generated: all.length,
            valid: all.filter((answer) => answer.validationStatus === 'valid').length,
            rejected,
            attempts,
        };
    }
    async listForUser(userId) {
        return this.answers.find({ where: { userId }, order: { createdAt: 'DESC' } });
    }
    async getAnswer(userId, id) {
        const answer = await this.answers.findOne({ where: { userId, id } });
        if (!answer)
            throw new common_1.NotFoundException('Model answer not found');
        return answer;
    }
    async generateValidatedAnswer(question, tku) {
        let rejected = 0;
        for (let attempt = 0; attempt < this.maxValidationAttempts; attempt++) {
            const draft = await this.generateAnswer(question, tku, attempt);
            if (draft.validationStatus === 'valid')
                return { draft, attempts: attempt + 1, rejected };
            rejected++;
        }
        return { draft: null, attempts: this.maxValidationAttempts, rejected };
    }
    async generateAnswer(question, tku, attempt) {
        const bundle = this.bundle(tku);
        const refs = question.boundEntityRefs || [];
        const components = await this.buildComponents(question, tku, bundle, refs, attempt);
        const examinerKeywords = this.buildKeywords(question, tku, bundle, attempt, components);
        const groundingSources = this.mergeSources([
            ...(question.groundingSources || []),
            ...components.flatMap((component) => component.paragraphs.flatMap((paragraph) => paragraph.groundingSources)),
            ...examinerKeywords.flatMap((keyword) => keyword.groundingSources),
        ]);
        const validation = this.validate({ components, keywords: examinerKeywords, refs, sources: groundingSources, question, tku, bundle });
        const qualityScore = validation.status === 'valid' ? this.qualityScore(components, examinerKeywords, question, tku) : 0;
        return {
            userId: question.userId,
            questionId: question.id,
            tkuId: question.tkuId,
            question: question.question,
            markValue: question.markValue,
            components,
            examinerKeywords,
            boundEntityRefs: refs,
            groundingSources,
            qualityScore,
            validationStatus: validation.status,
            validationReasons: validation.reasons,
            sourceQuestionVersion: question.version || 1,
        };
    }
    bundle(tku) {
        return {
            definitions: tku.definitions || [],
            provisions: tku.legalProvisions || [],
            principles: tku.principles || [],
            exceptions: tku.exceptions || [],
            cases: [...(tku.landmarkCases || []), ...(tku.referencedCases || [])],
            examples: [...(tku.illustrations || []), ...(tku.examples || [])],
            keywords: tku.keywords || [],
        };
    }
    async buildComponents(question, tku, bundle, refs, attempt) {
        const fallback = this.buildFallbackComponents(question, tku, bundle, refs, attempt);
        const drafted = await this.draftComponentsWithLlm(question, tku, bundle, attempt);
        if (!drafted)
            return fallback;
        return fallback.map((component) => {
            const draftedText = drafted[component.type];
            if (component.type === 'critical_analysis' && question.markValue <= 10 && !draftedText)
                return component;
            if (!draftedText)
                return component;
            return {
                ...component,
                paragraphs: component.paragraphs.map((paragraph) => ({ ...paragraph, text: draftedText })),
            };
        });
    }
    async draftComponentsWithLlm(question, tku, bundle, attempt) {
        if (!this.aiProvider)
            return null;
        try {
            const spec = this.componentWordTargets(question.markValue);
            const knownCaseNames = bundle.cases.map((c) => c.caseName).join('; ') || 'none available in the source material';
            const system = [
                'You are drafting one component-segmented model answer for an Indian law-school exam, strictly from the supplied source material.',
                'Mandatory rules:',
                '- Use ONLY the definitions, provisions, principles, exceptions, cases, and examples given below. Never invent a case name, citation, year, section number, or holding not present in the source material.',
                `- The only case names you may ever mention are exactly: ${knownCaseNames}. If more case law would help but is not in this list, say the user's source material does not contain further case law rather than inventing a case.`,
                '- Quote statutory text where it is given, then interpret it, rather than paraphrasing loosely.',
                '- Write in formal legal-exam prose, in full paragraphs (no bullet points, no headings inside a component).',
                '- Respond with strict JSON only (no markdown code fences), one string value per requested component key.',
            ].join('\n');
            const user = [
                `SOURCE MATERIAL for ${tku.topic} / ${tku.subtopic}:`,
                this.buildSourceContext(bundle),
                '',
                `QUESTION (${question.markValue} marks, type: ${question.questionType}): ${question.question}`,
                '',
                'Draft the following JSON object. Each key is an answer component; each value is the full prose for that component, sized to the approximate target word count given:',
                JSON.stringify(Object.fromEntries(Object.entries(spec).map(([key, target]) => [key, `${target.min}-${target.max} words. ${target.hint}`])), null, 2),
            ].join('\n');
            const result = await this.aiProvider.complete({
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
                temperature: Math.min(0.75, 0.3 + attempt * 0.15),
                maxTokens: this.maxTokensFor(question.markValue),
                timeoutMs: question.markValue >= 15 ? 90_000 : 45_000,
                jsonMode: true,
                module: 'exam',
                preferredModel: question.markValue >= 15 ? 'Gemini' : undefined,
            });
            const parsed = JSON.parse(this.extractJson(result.content));
            const cleaned = {};
            for (const key of Object.keys(spec)) {
                const value = parsed?.[key];
                if (typeof value === 'string' && value.trim().length > 0)
                    cleaned[key] = value.replace(/\s+/g, ' ').trim();
            }
            return cleaned;
        }
        catch (error) {
            this.logger.warn(`LLM drafting failed for question ${question.id} (attempt ${attempt}): ${error.message}`);
            return null;
        }
    }
    componentWordTargets(markValue) {
        const tables = {
            5: {
                introduction: { min: 20, max: 35, hint: 'One line framing the issue.' },
                relevant_sections: { min: 15, max: 30, hint: 'Cite the provision only, no interpretation.' },
                legal_principles: { min: 25, max: 45, hint: 'State the core rule only.' },
                explanation: { min: 30, max: 55, hint: 'Core rule only, no application.' },
                case_law: { min: 0, max: 35, hint: 'At most one case, holding only; omit if none is available.' },
                critical_analysis: { min: 0, max: 0, hint: 'Omit entirely — return an empty string.' },
                conclusion: { min: 15, max: 30, hint: 'One line.' },
            },
            10: {
                introduction: { min: 60, max: 90, hint: 'Short paragraph framing the issue and scope.' },
                relevant_sections: { min: 80, max: 120, hint: 'Quote the provision briefly with one line of context.' },
                legal_principles: { min: 90, max: 140, hint: 'State the rule and how it applies.' },
                explanation: { min: 110, max: 170, hint: 'Rule plus application to the question.' },
                case_law: { min: 90, max: 150, hint: 'One case: holding and key facts.' },
                critical_analysis: { min: 0, max: 40, hint: 'Omit, or one line only.' },
                conclusion: { min: 45, max: 75, hint: 'Short concluding paragraph.' },
            },
            15: {
                introduction: { min: 120, max: 170, hint: 'Contextual introduction situating the issue in the wider topic.' },
                relevant_sections: { min: 180, max: 250, hint: 'Quote the provision(s) and interpret their scope.' },
                legal_principles: { min: 190, max: 260, hint: 'Explain the rule, its application, and a qualification or nuance.' },
                explanation: { min: 240, max: 320, hint: 'Full explanation including doctrinal development.' },
                case_law: { min: 320, max: 450, hint: '2-3 cases with full facts, issues, held, and ratio.' },
                critical_analysis: { min: 170, max: 240, hint: "Focused critical analysis of the rule's strengths and limits." },
                conclusion: { min: 100, max: 140, hint: 'Standard exam conclusion.' },
            },
            20: {
                introduction: { min: 200, max: 280, hint: 'Full contextual introduction.' },
                relevant_sections: { min: 300, max: 400, hint: 'Quote and interpret the provision(s), and note related provisions.' },
                legal_principles: { min: 330, max: 460, hint: 'Explain the rule with application and doctrinal development.' },
                explanation: { min: 380, max: 520, hint: 'Deep explanation including doctrinal development and nuance.' },
                case_law: { min: 550, max: 800, hint: '3+ cases, each with full facts/issues/held/ratio, and how they relate to one another.' },
                critical_analysis: { min: 320, max: 450, hint: 'Substantive critical analysis.' },
                conclusion: { min: 150, max: 210, hint: 'Standard conclusion with doctrinal/practical implications.' },
            },
        };
        return tables[markValue] || tables[10];
    }
    maxTokensFor(markValue) {
        if (markValue <= 5)
            return 900;
        if (markValue <= 10)
            return 2200;
        if (markValue <= 15)
            return 4200;
        return 7000;
    }
    extractJson(content) {
        const match = content.match(/\{[\s\S]*\}/);
        return match ? match[0] : content;
    }
    buildSourceContext(bundle) {
        const lines = [];
        if (bundle.definitions.length) {
            lines.push('DEFINITIONS:');
            for (const d of bundle.definitions.slice(0, 6))
                lines.push(`- ${d.term}: ${d.definitionText}`);
        }
        if (bundle.provisions.length) {
            lines.push('PROVISIONS:');
            for (const p of bundle.provisions.slice(0, 6))
                lines.push(`- ${p.text}`);
        }
        if (bundle.principles.length) {
            lines.push('PRINCIPLES:');
            for (const p of bundle.principles.slice(0, 6))
                lines.push(`- ${p.text}`);
        }
        if (bundle.exceptions.length) {
            lines.push('EXCEPTIONS:');
            for (const e of bundle.exceptions.slice(0, 4))
                lines.push(`- ${e.text}`);
        }
        if (bundle.cases.length) {
            lines.push('CASES:');
            for (const c of bundle.cases.slice(0, 6)) {
                lines.push(`- ${c.caseName}${c.year ? ` (${c.year})` : ''}${c.court ? `, ${c.court}` : ''}`);
                if (c.structured?.facts)
                    lines.push(`  Facts: ${c.structured.facts}`);
                if (c.structured?.issues)
                    lines.push(`  Issues: ${c.structured.issues}`);
                if (c.structured?.held)
                    lines.push(`  Held: ${c.structured.held}`);
                if (c.structured?.ratio)
                    lines.push(`  Ratio: ${c.structured.ratio}`);
            }
        }
        else {
            lines.push('CASES: none available in the source material.');
        }
        if (bundle.examples.length) {
            lines.push('EXAMPLES/ILLUSTRATIONS:');
            for (const e of bundle.examples.slice(0, 4))
                lines.push(`- ${e.text}`);
        }
        return lines.join('\n');
    }
    buildFallbackComponents(question, tku, bundle, refs, attempt) {
        const includeOptionalCaseText = attempt > 0 || bundle.cases.length > 0;
        return [
            {
                type: 'introduction',
                title: 'Introduction',
                paragraphs: [this.paragraph(`${tku.subtopic} is tested here within ${tku.topic}. The answer must address the asked issue using the source-backed material from the user's library.`, refs, question.groundingSources)],
            },
            {
                type: 'relevant_sections',
                title: 'Relevant Sections',
                paragraphs: [this.relevantSectionsParagraph(bundle, refs, question.groundingSources)],
            },
            {
                type: 'legal_principles',
                title: 'Legal Principles',
                paragraphs: [this.legalPrinciplesParagraph(bundle, refs, question.groundingSources)],
            },
            {
                type: 'explanation',
                title: 'Explanation',
                paragraphs: [this.explanationParagraph(question, tku, bundle, refs)],
            },
            {
                type: 'case_law',
                title: 'Case Law',
                paragraphs: [this.caseLawParagraph(bundle, refs, question.groundingSources, includeOptionalCaseText)],
            },
            {
                type: 'critical_analysis',
                title: 'Critical Analysis',
                paragraphs: [this.criticalAnalysisParagraph(question, bundle, refs)],
            },
            {
                type: 'conclusion',
                title: 'Conclusion',
                paragraphs: [this.paragraph(`Therefore, a strong answer should connect ${tku.subtopic} to the grounded rule, supporting material, and the specific demand of the ${question.markValue}-mark question.`, refs, question.groundingSources)],
            },
            {
                type: 'examiner_keywords',
                title: 'Examiner Keywords',
                paragraphs: [this.paragraph(`Use examiner keywords such as ${this.keywordText(bundle, tku)}.`, refs, question.groundingSources)],
            },
        ];
    }
    relevantSectionsParagraph(bundle, refs, fallbackSources) {
        const provisions = bundle.provisions.slice(0, 3);
        const definitions = bundle.definitions.slice(0, 2);
        const text = provisions.length
            ? `The relevant section material includes ${provisions.map((p) => p.text).join(' ')}`
            : `The relevant source material includes definitions such as ${definitions.map((d) => `${d.term}: ${d.definitionText}`).join('; ')}.`;
        return this.paragraph(text, refs, this.sourcesFrom([...provisions, ...definitions], fallbackSources));
    }
    legalPrinciplesParagraph(bundle, refs, fallbackSources) {
        const principles = bundle.principles.slice(0, 3);
        const exceptions = bundle.exceptions.slice(0, 2);
        const text = [
            principles.length ? `The legal principle is ${principles.map((p) => p.text).join(' ')}` : 'The rule must be stated from the grounded source entities.',
            exceptions.length ? `Exceptions or qualifications include ${exceptions.map((e) => e.text).join(' ')}` : '',
        ].filter(Boolean).join(' ');
        return this.paragraph(text, refs, this.sourcesFrom([...principles, ...exceptions], fallbackSources));
    }
    explanationParagraph(question, tku, bundle, refs) {
        const definition = bundle.definitions[0];
        const principle = bundle.principles[0];
        const example = bundle.examples[0];
        const text = [
            `For ${question.questionType}, the explanation should show how ${tku.subtopic} operates in the question.`,
            definition ? `${definition.term} means ${definition.definitionText}.` : '',
            principle ? `This is applied through the principle that ${principle.text}` : '',
            example ? `The source example illustrates this as follows: ${example.text}` : '',
        ].filter(Boolean).join(' ');
        return this.paragraph(text, refs, this.sourcesFrom([definition, principle, example].filter(Boolean), question.groundingSources));
    }
    caseLawParagraph(bundle, refs, fallbackSources, includeOptionalCaseText) {
        const cases = bundle.cases.slice(0, 2);
        const text = cases.length
            ? `Case law support includes ${cases.map((c) => `${c.caseName}${c.year ? ` (${c.year})` : ''}${c.structured?.held ? `, where it was held that ${c.structured.held}` : ''}`).join('; ')}.`
            : includeOptionalCaseText
                ? 'No separate case law is available in the user source material for this question.'
                : 'Case law support includes Kesavananda Bharati v State of Kerala as a general authority.';
        return this.paragraph(text, refs, this.sourcesFrom(cases, fallbackSources));
    }
    criticalAnalysisParagraph(question, bundle, refs) {
        const exception = bundle.exceptions[0];
        const caseEntry = bundle.cases.find((c) => c.isLandmark) || bundle.cases[0];
        const text = [
            `The critical point is to avoid treating ${question.subtopic} as an isolated rule.`,
            exception ? `Its limit appears in the exception: ${exception.text}` : '',
            caseEntry ? `Authority such as ${caseEntry.caseName} helps anchor the analysis.` : '',
        ].filter(Boolean).join(' ');
        return this.paragraph(text, refs, this.sourcesFrom([exception, caseEntry].filter(Boolean), question.groundingSources));
    }
    buildKeywords(question, tku, bundle, attempt, components) {
        const sourcePool = question.groundingSources || [];
        const allValues = [
            ...bundle.keywords.map((k) => k.value),
            ...bundle.definitions.map((d) => d.term),
            ...bundle.cases.map((c) => c.caseName),
            tku.topic,
            tku.subtopic,
        ].map((value) => (value || '').trim()).filter(Boolean);
        const unique = [...new Set(allValues)];
        const draftedText = (components || []).flatMap((c) => c.paragraphs.map((p) => p.text)).join(' ').toLowerCase();
        const presentInText = draftedText ? unique.filter((value) => draftedText.includes(value.toLowerCase())) : [];
        const ordered = presentInText.length
            ? [...presentInText, ...unique.filter((value) => !presentInText.includes(value))]
            : unique;
        const limit = attempt === 0 ? Math.max(1, Math.min(2, this.keywordLimit(question.markValue))) : this.keywordLimit(question.markValue);
        return ordered.slice(0, limit).map((keyword) => ({ keyword, groundingSources: sourcePool.slice(0, 3) }));
    }
    validate(input) {
        const checks = [
            this.validateGrounding(input),
            this.validateHallucination(input),
            this.validateCaseAccuracy(input),
            this.validateLegalAccuracy(input),
            this.validateStructure(input),
            this.validateKeywords(input),
        ];
        const failed = checks.filter((check) => !check.passed);
        return {
            status: failed.length ? 'rejected' : 'valid',
            reasons: failed.map((check) => `${check.gate}:${check.reason || 'failed'}`),
            checks,
        };
    }
    validateGrounding({ components, keywords, refs, sources }) {
        if (!refs.length)
            return { gate: 'grounding', passed: false, reason: 'missing_bound_entities' };
        if (!sources.length)
            return { gate: 'grounding', passed: false, reason: 'missing_sources' };
        for (const component of components) {
            for (const paragraph of component.paragraphs) {
                if (!paragraph.boundEntityRefs.length || !paragraph.groundingSources.length)
                    return { gate: 'grounding', passed: false, reason: `ungrounded_paragraph:${component.type}` };
            }
        }
        if (keywords.some((keyword) => !keyword.groundingSources.length))
            return { gate: 'grounding', passed: false, reason: 'ungrounded_keyword' };
        return { gate: 'grounding', passed: true };
    }
    validateHallucination({ components, bundle, tku }) {
        const text = components.flatMap((component) => component.paragraphs.map((paragraph) => paragraph.text)).join(' ');
        const knownCaseNames = new Set(bundle.cases.map((c) => c.caseName.toLowerCase()));
        const caseLikeMatches = text.match(/[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\s+v\.?\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,4}/g) || [];
        for (const match of caseLikeMatches) {
            if (!knownCaseNames.has(match.toLowerCase()))
                return { gate: 'hallucination', passed: false, reason: `unsupported_case:${match}` };
        }
        if (/external database|internet|general authority|not in the user source/i.test(text))
            return { gate: 'hallucination', passed: false, reason: 'external_or_generic_authority' };
        if (!text.toLowerCase().includes(tku.subtopic.toLowerCase().split(/\s+/)[0]))
            return { gate: 'hallucination', passed: false, reason: 'topic_drift' };
        return { gate: 'hallucination', passed: true };
    }
    validateCaseAccuracy({ components, bundle }) {
        const caseComponent = components.find((component) => component.type === 'case_law');
        if (!caseComponent)
            return { gate: 'case_accuracy', passed: false, reason: 'missing_case_component' };
        const text = caseComponent.paragraphs.map((paragraph) => paragraph.text).join(' ');
        for (const c of bundle.cases) {
            if (!text.includes(c.caseName))
                continue;
            if (c.year && !text.includes(c.year))
                return { gate: 'case_accuracy', passed: false, reason: `missing_case_year:${c.caseName}` };
            if (c.structured?.held && !text.includes(c.structured.held))
                return { gate: 'case_accuracy', passed: false, reason: `held_mismatch:${c.caseName}` };
        }
        return { gate: 'case_accuracy', passed: true };
    }
    validateLegalAccuracy({ components, bundle }) {
        const text = components.flatMap((component) => component.paragraphs.map((paragraph) => paragraph.text)).join(' ');
        for (const provision of bundle.provisions) {
            const sectionMatch = provision.text.match(/Section\s+\d+[A-Za-z()\d-]*/i)?.[0];
            if (sectionMatch && text.includes(sectionMatch) && !provision.text.includes(sectionMatch))
                return { gate: 'legal_accuracy', passed: false, reason: `unsupported_section:${sectionMatch}` };
        }
        const sectionMentions = text.match(/Section\s+\d+[A-Za-z()\d-]*/gi) || [];
        const knownSections = new Set(bundle.provisions.map((p) => p.text.match(/Section\s+\d+[A-Za-z()\d-]*/i)?.[0]?.toLowerCase()).filter(Boolean));
        for (const mention of sectionMentions) {
            if (!knownSections.has(mention.toLowerCase()))
                return { gate: 'legal_accuracy', passed: false, reason: `section_not_in_sources:${mention}` };
        }
        if (/always|never|all cases|without exception/i.test(text) && bundle.exceptions.length > 0)
            return { gate: 'legal_accuracy', passed: false, reason: 'overbroad_rule_with_exceptions' };
        return { gate: 'legal_accuracy', passed: true };
    }
    validateStructure({ components }) {
        const actual = components.map((component) => component.type);
        if (actual.length !== this.componentOrder.length)
            return { gate: 'structure', passed: false, reason: 'component_count_mismatch' };
        for (let i = 0; i < this.componentOrder.length; i++) {
            if (actual[i] !== this.componentOrder[i])
                return { gate: 'structure', passed: false, reason: `component_order:${actual[i]}` };
            if (!components[i].title || !components[i].paragraphs.length)
                return { gate: 'structure', passed: false, reason: `component_empty:${actual[i]}` };
        }
        return { gate: 'structure', passed: true };
    }
    validateKeywords({ keywords, question, bundle }) {
        const minKeywords = question.markValue <= 5 ? 3 : question.markValue <= 10 ? 4 : question.markValue <= 15 ? 6 : 8;
        if (keywords.length < Math.min(minKeywords, this.availableKeywordValues(question, bundle).length))
            return { gate: 'keywords', passed: false, reason: 'too_few_keywords' };
        if (keywords.some((keyword) => !keyword.keyword.trim() || !keyword.groundingSources.length))
            return { gate: 'keywords', passed: false, reason: 'invalid_keyword_grounding' };
        return { gate: 'keywords', passed: true };
    }
    qualityScore(components, keywords, question, tku) {
        const componentScore = Math.min(1, components.length / 8);
        const keywordScore = Math.min(1, keywords.length / this.keywordLimit(question.markValue));
        return this.round(componentScore * 0.35 + keywordScore * 0.15 + (question.qualityScore || 0) * 0.25 + (tku.confidenceScore || 0) * 0.25);
    }
    paragraph(text, refs, sources) {
        return {
            text: text.replace(/\s+/g, ' ').trim(),
            boundEntityRefs: refs.slice(0, 5),
            groundingSources: this.mergeSources(sources).slice(0, 5),
        };
    }
    sourcesFrom(entities, fallback) {
        const fromEntities = entities.flatMap((entity) => entity.sourceRefs || []);
        return this.mergeSources(fromEntities.length ? fromEntities : fallback);
    }
    mergeSources(sources) {
        const byKey = new Map();
        for (const source of sources || []) {
            if (!source?.documentId)
                continue;
            byKey.set(`${source.documentId}:${source.sectionId || ''}:${source.entityId || ''}:${source.sourceType}`, source);
        }
        return [...byKey.values()];
    }
    buildKeywordValues(question, tku, bundle) {
        return [
            ...bundle.keywords.map((k) => k.value),
            ...bundle.definitions.map((d) => d.term),
            ...bundle.cases.map((c) => c.caseName),
            question.topic,
            question.subtopic,
            tku.topic,
            tku.subtopic,
        ].filter(Boolean);
    }
    availableKeywordValues(question, bundle) {
        return [...new Set([
                ...bundle.keywords.map((k) => k.value),
                ...bundle.definitions.map((d) => d.term),
                ...bundle.cases.map((c) => c.caseName),
                question.topic,
                question.subtopic,
            ].map((value) => value.trim()).filter(Boolean))];
    }
    keywordText(bundle, tku) {
        const keywords = [...bundle.keywords.map((k) => k.value), ...bundle.definitions.map((d) => d.term), tku.subtopic].filter(Boolean);
        return [...new Set(keywords)].slice(0, 8).join(', ');
    }
    keywordLimit(markValue) {
        if (markValue <= 5)
            return 5;
        if (markValue <= 10)
            return 8;
        if (markValue <= 15)
            return 12;
        return 15;
    }
    round(value) {
        return Math.max(0, Math.min(1, Math.round(value * 1000) / 1000));
    }
};
exports.ModelAnswerService = ModelAnswerService;
exports.ModelAnswerService = ModelAnswerService = ModelAnswerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(question_bank_entry_entity_1.QuestionBankEntryEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(topic_knowledge_unit_entity_1.TopicKnowledgeUnitEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(model_answer_entry_entity_1.ModelAnswerEntryEntity)),
    __param(3, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        openrouter_ai_provider_service_1.OpenRouterAiProviderService])
], ModelAnswerService);
//# sourceMappingURL=model-answer.service.js.map