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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnswerEvaluationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const model_answer_entry_entity_1 = require("../model-answer/entities/model-answer-entry.entity");
const question_bank_entry_entity_1 = require("../question-bank/entities/question-bank-entry.entity");
const answer_evaluation_attempt_entity_1 = require("./entities/answer-evaluation-attempt.entity");
const answer_evaluation_types_1 = require("./answer-evaluation.types");
let AnswerEvaluationService = class AnswerEvaluationService {
    constructor(questions, modelAnswers, attempts) {
        this.questions = questions;
        this.modelAnswers = modelAnswers;
        this.attempts = attempts;
    }
    async evaluate(userId, request) {
        const studentAnswer = (request.studentAnswer || '').trim();
        if (studentAnswer.length < 20)
            throw new common_1.BadRequestException('Student answer is too short to evaluate.');
        const context = await this.resolveContext(userId, request);
        const criteriaScores = this.evaluateDimensions(studentAnswer, context);
        const marksAwarded = this.round(criteriaScores.reduce((sum, criterion) => sum + criterion.marksAwarded, 0));
        const percentage = context.maxMarks > 0 ? this.round((marksAwarded / context.maxMarks) * 100, 2) : 0;
        const strengths = this.buildStrengths(criteriaScores);
        const weaknesses = this.buildWeaknesses(criteriaScores);
        const suggestions = this.buildSuggestions(criteriaScores, context);
        const feedback = this.buildFeedbackNarrative(marksAwarded, context.maxMarks, percentage, criteriaScores, strengths, weaknesses);
        const status = context.components.length === 0 || context.rubric.length === 0 ? 'needs_review' : 'evaluated';
        const attempt = await this.attempts.save(this.attempts.create({
            userId,
            questionId: context.questionId,
            modelAnswerId: context.modelAnswerId,
            studentAnswer,
            question: context.question,
            rubric: context.rubric,
            modelAnswerComponents: context.components,
            examinerKeywords: context.examinerKeywords,
            criteriaScores,
            dimensionMarks: Object.fromEntries(criteriaScores.map((criterion) => [criterion.dimension, criterion.marksAwarded])),
            marksAwarded,
            maxMarks: context.maxMarks,
            percentage,
            timeSpentSeconds: this.normalizeTimeSpent(request.timeSpentSeconds),
            strengths,
            weaknesses,
            suggestions,
            status,
        }));
        return {
            attemptId: attempt.id,
            questionId: context.questionId || undefined,
            modelAnswerId: context.modelAnswerId || undefined,
            marksAwarded,
            maxMarks: context.maxMarks,
            percentage,
            status,
            criteriaScores,
            strengths,
            weaknesses,
            suggestions,
            feedback,
        };
    }
    buildFeedbackNarrative(marksAwarded, maxMarks, percentage, criteriaScores, strengths, weaknesses) {
        const grade = percentage >= 75 ? 'Excellent' : percentage >= 60 ? 'Good' : percentage >= 40 ? 'Satisfactory' : 'Needs Improvement';
        const topStrength = strengths[0] || 'general engagement with the question';
        const topWeakness = weaknesses[0];
        const dimensionNarrative = criteriaScores.map((dim) => {
            const pct = dim.maxMarks > 0 ? Math.round((dim.marksAwarded / dim.maxMarks) * 100) : 0;
            const label = dim.label || dim.dimension.replace(/_/g, ' ');
            return `**${label}**: ${dim.marksAwarded}/${dim.maxMarks} marks (${pct}%)`;
        }).join('\n');
        const parts = [
            `**Overall Assessment: ${grade}** — ${marksAwarded}/${maxMarks} marks (${Math.round(percentage)}%)\n`,
            `**Dimension Breakdown:**\n${dimensionNarrative}\n`,
            strengths.length > 0 ? `**Strengths:** ${strengths.slice(0, 3).join('; ')}.` : '',
            topWeakness ? `**Key Gap:** ${topWeakness}.` : '',
        ];
        if (percentage < 40) {
            parts.push(`\n**Examiner Note:** The answer requires significantly more legal analysis. Focus on stating the applicable rule clearly, applying it to the facts, and citing authority from the study material. Aim for 1,800–2,500 words for a 15-mark question.`);
        }
        else if (percentage < 60) {
            parts.push(`\n**Examiner Note:** The answer shows understanding but lacks depth in ${topWeakness || 'application and authority usage'}. Strengthen your answer by adding statutory provisions and judicial authority from the uploaded material.`);
        }
        else {
            parts.push(`\n**Examiner Note:** Good answer demonstrating ${topStrength}. To reach distinction level, ensure every legal proposition is supported by authority cited from the study material.`);
        }
        return parts.filter(Boolean).join('\n');
    }
    async listHistory(userId) {
        return this.attempts.find({ where: { userId }, order: { createdAt: 'DESC' } });
    }
    async listQuestionHistory(userId, questionId) {
        return this.attempts.find({ where: { userId, questionId }, order: { createdAt: 'DESC' } });
    }
    async getAttempt(userId, id) {
        const attempt = await this.attempts.findOne({ where: { id, userId } });
        if (!attempt)
            throw new common_1.NotFoundException('Answer evaluation attempt not found.');
        return attempt;
    }
    async resolveContext(userId, request) {
        if (request.questionId) {
            const question = await this.questions.findOne({ where: { id: request.questionId, userId, validationStatus: 'valid' } });
            if (!question)
                throw new common_1.NotFoundException('Validated question not found.');
            const modelAnswer = await this.modelAnswers.findOne({ where: { questionId: question.id, userId, validationStatus: 'valid' } });
            if (!modelAnswer)
                throw new common_1.NotFoundException('Validated model answer not found for this question.');
            return {
                questionId: question.id,
                modelAnswerId: modelAnswer.id,
                question: question.question,
                rubric: question.rubric || [],
                components: modelAnswer.components || [],
                examinerKeywords: modelAnswer.examinerKeywords || [],
                maxMarks: question.markValue,
            };
        }
        const question = (request.question || '').trim();
        const rubric = request.rubric || [];
        const components = request.modelAnswer?.components || [];
        const examinerKeywords = request.modelAnswer?.examinerKeywords || [];
        const maxMarks = Number(request.maxMarks || rubric.reduce((sum, item) => sum + Number(item.marks || 0), 0));
        if (!question)
            throw new common_1.BadRequestException('Question is required when questionId is not supplied.');
        if (!Number.isFinite(maxMarks) || maxMarks <= 0)
            throw new common_1.BadRequestException('A positive maxMarks value or scored rubric is required.');
        return { questionId: null, modelAnswerId: null, question, rubric, components, examinerKeywords, maxMarks };
    }
    evaluateDimensions(studentAnswer, context) {
        const weights = {
            rule_statement: 0.25,
            application: 0.25,
            authority_usage: 0.2,
            issue_spotting: 0.15,
            conclusion: 0.15,
        };
        const normalizedAnswer = this.normalize(studentAnswer);
        return answer_evaluation_types_1.ANSWER_EVALUATION_DIMENSIONS.map((dimension) => {
            const maxMarks = this.round(context.maxMarks * weights[dimension]);
            const expectedSignals = this.expectedSignals(dimension, context);
            const matchedSignals = expectedSignals.filter((signal) => this.containsSignal(normalizedAnswer, signal));
            const missingSignals = expectedSignals.filter((signal) => !matchedSignals.includes(signal)).slice(0, 8);
            const structuralScore = this.structuralSignalScore(dimension, normalizedAnswer);
            const rawCoverageScore = expectedSignals.length ? matchedSignals.length / expectedSignals.length : structuralScore;
            const coverageScore = Math.max(rawCoverageScore, matchedSignals.length >= 6 ? 0.75 : matchedSignals.length >= 4 ? 0.65 : rawCoverageScore);
            const rubricScore = this.rubricAlignmentScore(dimension, normalizedAnswer, context.rubric);
            const score = this.clamp(coverageScore * 0.55 + structuralScore * 0.3 + rubricScore * 0.15);
            return {
                dimension,
                label: this.dimensionLabel(dimension),
                maxMarks,
                marksAwarded: this.round(maxMarks * score),
                score: this.round(score, 3),
                matchedSignals: matchedSignals.slice(0, 10),
                missingSignals,
            };
        });
    }
    expectedSignals(dimension, context) {
        const componentTypes = {
            rule_statement: ['relevant_sections', 'legal_principles', 'explanation'],
            application: ['explanation', 'critical_analysis'],
            authority_usage: ['relevant_sections', 'case_law'],
            issue_spotting: ['introduction', 'explanation'],
            conclusion: ['conclusion'],
        };
        const selectedText = context.components
            .filter((component) => componentTypes[dimension].includes(component.type))
            .flatMap((component) => component.paragraphs || [])
            .map((paragraph) => paragraph.text)
            .join(' ');
        const keywordSignals = dimension === 'authority_usage' || dimension === 'rule_statement'
            ? context.examinerKeywords.map((keyword) => keyword.keyword)
            : [];
        const questionSignals = dimension === 'issue_spotting' ? this.keyTerms(context.question, 12) : [];
        const rubricSignals = this.keyTerms(context.rubric
            .filter((item) => this.rubricMatchesDimension(dimension, item))
            .map((item) => `${item.label} ${item.criteria}`)
            .join(' '), 8);
        return [...new Set([...this.keyTerms(selectedText, 18), ...keywordSignals, ...questionSignals, ...rubricSignals].map((signal) => this.normalizeSignal(signal)).filter(Boolean))].slice(0, 24);
    }
    structuralSignalScore(dimension, normalizedAnswer) {
        const patterns = {
            rule_statement: [/\b(section|article|rule|principle|provision|defines?|requires?)\b/, /\bmeans|must|shall|where\b/],
            application: [/\b(apply|application|therefore|because|facts?|in this case|on these facts)\b/, /\bhowever|whereas|thus\b/],
            authority_usage: [/\b(v\.| vs |case|held|court|judgment|authority|section|article)\b/, /\b\d{4}\b|\b[A-Z]?[a-z]+ v\b/i],
            issue_spotting: [/\b(issue|whether|question is|dispute|problem)\b/, /\bconcerns?|turns on|arises\b/],
            conclusion: [/\b(conclusion|conclude|therefore|hence|accordingly|liable|not liable|valid|invalid)\b/],
        };
        const matches = patterns[dimension].filter((pattern) => pattern.test(normalizedAnswer)).length;
        return Math.min(1, matches / patterns[dimension].length);
    }
    rubricAlignmentScore(dimension, normalizedAnswer, rubric) {
        const terms = rubric
            .filter((item) => this.rubricMatchesDimension(dimension, item))
            .flatMap((item) => this.keyTerms(`${item.label} ${item.criteria}`, 8));
        if (terms.length === 0)
            return 0.5;
        return terms.filter((term) => this.containsSignal(normalizedAnswer, term)).length / terms.length;
    }
    rubricMatchesDimension(dimension, item) {
        const text = `${item.label} ${item.criteria}`.toLowerCase();
        const needles = {
            rule_statement: ['rule', 'legal basis', 'framework', 'provision', 'principle', 'definition'],
            application: ['application', 'analysis', 'apply', 'explain'],
            authority_usage: ['authority', 'case', 'section', 'provision'],
            issue_spotting: ['issue', 'frame', 'identify'],
            conclusion: ['conclusion', 'conclude', 'takeaway'],
        };
        return needles[dimension].some((needle) => text.includes(needle));
    }
    buildStrengths(criteriaScores) {
        const strengths = criteriaScores
            .filter((criterion) => criterion.score >= 0.65)
            .map((criterion) => `${criterion.label} is adequately covered${criterion.matchedSignals.length ? ` with signals such as ${criterion.matchedSignals.slice(0, 3).join(', ')}` : ''}.`);
        return strengths.length ? strengths : ['The answer makes a genuine attempt to address the question.'];
    }
    buildWeaknesses(criteriaScores) {
        return criteriaScores
            .filter((criterion) => criterion.score < 0.55)
            .map((criterion) => `${criterion.label} needs improvement${criterion.missingSignals.length ? `; missing signals include ${criterion.missingSignals.slice(0, 3).join(', ')}` : ''}.`);
    }
    buildSuggestions(criteriaScores, context) {
        const suggestions = criteriaScores
            .filter((criterion) => criterion.score < 0.7)
            .map((criterion) => this.suggestionFor(criterion));
        if (suggestions.length === 0)
            suggestions.push('Refine the answer by tightening structure and using examiner keywords more deliberately.');
        if (context.rubric.length > 0)
            suggestions.push('Use the rubric headings as paragraph anchors so each mark-bearing component is visible.');
        return [...new Set(suggestions)].slice(0, 8);
    }
    suggestionFor(criterion) {
        const suggestions = {
            rule_statement: 'State the governing rule, provision, or principle at the start before moving into explanation.',
            application: 'Apply the rule expressly to the facts or question demand instead of leaving the analysis abstract.',
            authority_usage: 'Cite the relevant section, case, or authority and explain the legal proposition it supports.',
            issue_spotting: 'Open with the precise legal issue, preferably framed as a “whether” question.',
            conclusion: 'End with a clear legal conclusion that answers the question directly.',
        };
        return suggestions[criterion.dimension];
    }
    containsSignal(normalizedAnswer, signal) {
        const normalizedSignal = this.normalizeSignal(signal);
        if (!normalizedSignal)
            return false;
        if (normalizedAnswer.includes(normalizedSignal))
            return true;
        const tokens = normalizedSignal.split(' ').filter((token) => token.length > 3);
        if (tokens.length === 0)
            return false;
        const hits = tokens.filter((token) => normalizedAnswer.includes(token)).length;
        return hits / tokens.length >= 0.65;
    }
    keyTerms(text, limit) {
        const normalized = this.normalize(text);
        const stopWords = new Set(['that', 'this', 'with', 'from', 'into', 'under', 'answer', 'question', 'legal', 'must', 'should', 'where', 'there', 'their', 'which', 'these', 'those', 'will', 'shall', 'have', 'been', 'case']);
        return [...new Set(normalized.split(' ').filter((token) => token.length > 3 && !stopWords.has(token)))].slice(0, limit);
    }
    normalize(value) {
        return (value || '').toLowerCase().replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' ').trim();
    }
    normalizeTimeSpent(value) {
        const seconds = Number(value || 0);
        if (!Number.isFinite(seconds) || seconds <= 0)
            return null;
        return Math.min(24 * 60 * 60, Math.round(seconds));
    }
    normalizeSignal(value) {
        return this.normalize(value).replace(/\b(the|and|or|of|to|in|is|are|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
    }
    dimensionLabel(dimension) {
        const labels = {
            rule_statement: 'Rule Statement',
            application: 'Application',
            authority_usage: 'Authority Usage',
            issue_spotting: 'Issue Spotting',
            conclusion: 'Conclusion',
        };
        return labels[dimension];
    }
    clamp(value) {
        return Math.max(0, Math.min(1, value));
    }
    round(value, places = 2) {
        const factor = 10 ** places;
        return Math.round(value * factor) / factor;
    }
};
exports.AnswerEvaluationService = AnswerEvaluationService;
exports.AnswerEvaluationService = AnswerEvaluationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(question_bank_entry_entity_1.QuestionBankEntryEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(model_answer_entry_entity_1.ModelAnswerEntryEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(answer_evaluation_attempt_entity_1.AnswerEvaluationAttemptEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AnswerEvaluationService);
//# sourceMappingURL=answer-evaluation.service.js.map