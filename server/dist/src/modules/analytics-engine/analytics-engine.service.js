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
exports.AnalyticsEngineService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const answer_evaluation_attempt_entity_1 = require("../answer-evaluation/entities/answer-evaluation-attempt.entity");
const answer_evaluation_types_1 = require("../answer-evaluation/answer-evaluation.types");
const question_bank_entry_entity_1 = require("../question-bank/entities/question-bank-entry.entity");
let AnalyticsEngineService = class AnalyticsEngineService {
    constructor(attempts, questions) {
        this.attempts = attempts;
        this.questions = questions;
    }
    async getDashboard(userId) {
        const attempts = await this.attempts.find({ where: { userId }, order: { createdAt: 'ASC' } });
        const attemptsWithTopic = await this.attachTopics(userId, attempts);
        const topicWisePerformance = this.buildTopicPerformance(attemptsWithTopic);
        const improvementGraph = this.buildImprovementGraph(attempts);
        const dailyProgress = this.buildDailyProgress(attempts);
        return {
            generatedAt: new Date().toISOString(),
            summary: this.buildSummary(attempts),
            topicWisePerformance,
            weakTopics: topicWisePerformance.filter((row) => row.averagePercentage < 60).sort((a, b) => a.averagePercentage - b.averagePercentage).slice(0, 5),
            strongTopics: topicWisePerformance.filter((row) => row.averagePercentage >= 75).sort((a, b) => b.averagePercentage - a.averagePercentage).slice(0, 5),
            dimensionPerformance: this.buildDimensionPerformance(attempts),
            timeAnalysis: this.buildTimeAnalysis(attempts, dailyProgress),
            improvementGraph,
            progressTracking: this.buildProgressTracking(attempts, topicWisePerformance, improvementGraph, dailyProgress),
        };
    }
    async getTopicPerformance(userId) {
        const attempts = await this.attempts.find({ where: { userId }, order: { createdAt: 'ASC' } });
        return this.buildTopicPerformance(await this.attachTopics(userId, attempts));
    }
    async getProgress(userId) {
        const dashboard = await this.getDashboard(userId);
        return {
            progressTracking: dashboard.progressTracking,
            improvementGraph: dashboard.improvementGraph,
            timeAnalysis: dashboard.timeAnalysis,
        };
    }
    async getWeakTopics(userId) {
        return (await this.getDashboard(userId)).weakTopics;
    }
    async getStrongTopics(userId) {
        return (await this.getDashboard(userId)).strongTopics;
    }
    async attachTopics(userId, attempts) {
        const questionIds = [...new Set(attempts.map((attempt) => attempt.questionId).filter(Boolean))];
        const questions = questionIds.length ? await this.questions.find({ where: { userId, id: (0, typeorm_2.In)(questionIds) } }) : [];
        const questionMap = new Map(questions.map((question) => [question.id, question]));
        return attempts.map((attempt) => {
            const question = attempt.questionId ? questionMap.get(attempt.questionId) : null;
            return {
                attempt,
                topic: question?.topic || this.inferTopic(attempt.question),
                subtopic: question?.subtopic || 'General',
            };
        });
    }
    buildSummary(attempts) {
        const totalMarksAwarded = attempts.reduce((sum, attempt) => sum + Number(attempt.marksAwarded || 0), 0);
        const totalMaxMarks = attempts.reduce((sum, attempt) => sum + Number(attempt.maxMarks || 0), 0);
        return {
            attempts: attempts.length,
            averageMarks: this.round(attempts.length ? totalMarksAwarded / attempts.length : 0),
            averageMaxMarks: this.round(attempts.length ? totalMaxMarks / attempts.length : 0),
            averagePercentage: this.round(totalMaxMarks > 0 ? (totalMarksAwarded / totalMaxMarks) * 100 : 0),
            totalMarksAwarded: this.round(totalMarksAwarded),
            totalMaxMarks: this.round(totalMaxMarks),
        };
    }
    buildTopicPerformance(attemptsWithTopic) {
        const grouped = new Map();
        for (const item of attemptsWithTopic) {
            const key = `${item.topic}\u0000${item.subtopic}`;
            grouped.set(key, [...(grouped.get(key) || []), item]);
        }
        return [...grouped.entries()]
            .map(([key, rows]) => {
            const [topic, subtopic] = key.split('\u0000');
            const percentages = rows.map((row) => Number(row.attempt.percentage || 0));
            const marks = rows.reduce((sum, row) => sum + Number(row.attempt.marksAwarded || 0), 0);
            const maxMarks = rows.reduce((sum, row) => sum + Number(row.attempt.maxMarks || 0), 0);
            const firstHalf = percentages.slice(0, Math.max(1, Math.floor(percentages.length / 2)));
            const secondHalf = percentages.slice(Math.max(0, Math.floor(percentages.length / 2)));
            return {
                topic,
                subtopic,
                attempts: rows.length,
                averageMarks: this.round(marks / rows.length),
                averageMaxMarks: this.round(maxMarks / rows.length),
                averagePercentage: this.round(maxMarks > 0 ? (marks / maxMarks) * 100 : this.average(percentages)),
                bestPercentage: this.round(Math.max(...percentages, 0)),
                latestPercentage: this.round(percentages[percentages.length - 1] || 0),
                trend: this.round(this.average(secondHalf) - this.average(firstHalf)),
                lastAttemptAt: rows[rows.length - 1]?.attempt.createdAt?.toISOString() || null,
            };
        })
            .sort((a, b) => a.topic.localeCompare(b.topic) || a.subtopic.localeCompare(b.subtopic));
    }
    buildDimensionPerformance(attempts) {
        return answer_evaluation_types_1.ANSWER_EVALUATION_DIMENSIONS.map((dimension) => {
            const scores = attempts.flatMap((attempt) => (attempt.criteriaScores || []).filter((criterion) => criterion.dimension === dimension));
            const marks = scores.reduce((sum, score) => sum + Number(score.marksAwarded || 0), 0);
            const maxMarks = scores.reduce((sum, score) => sum + Number(score.maxMarks || 0), 0);
            return {
                dimension,
                label: this.dimensionLabel(dimension),
                attempts: scores.length,
                averagePercentage: this.round(maxMarks > 0 ? (marks / maxMarks) * 100 : 0),
                averageMarks: this.round(scores.length ? marks / scores.length : 0),
                maxMarks: this.round(scores.length ? maxMarks / scores.length : 0),
            };
        });
    }
    buildImprovementGraph(attempts) {
        const points = [];
        attempts.forEach((attempt, index) => {
            const window = attempts.slice(Math.max(0, index - 4), index + 1);
            points.push({
                attemptId: attempt.id,
                sequence: index + 1,
                date: attempt.createdAt.toISOString(),
                percentage: this.round(Number(attempt.percentage || 0)),
                rollingAverage: this.round(this.average(window.map((item) => Number(item.percentage || 0)))),
                marksAwarded: this.round(Number(attempt.marksAwarded || 0)),
                maxMarks: this.round(Number(attempt.maxMarks || 0)),
            });
        });
        return points;
    }
    buildTimeAnalysis(attempts, practiceCadence) {
        const recorded = attempts.map((attempt) => Number(attempt.timeSpentSeconds || 0)).filter((seconds) => seconds > 0);
        const answerWords = attempts.map((attempt) => this.wordCount(attempt.studentAnswer));
        const averageAnswerWords = this.round(this.average(answerWords));
        const estimatedAverageTimeSeconds = Math.round((averageAnswerWords / 110) * 60);
        const averageTimeSeconds = recorded.length ? this.round(this.average(recorded)) : null;
        return {
            attemptsWithRecordedTime: recorded.length,
            averageTimeSeconds,
            fastestTimeSeconds: recorded.length ? Math.min(...recorded) : null,
            slowestTimeSeconds: recorded.length ? Math.max(...recorded) : null,
            estimatedAverageTimeSeconds,
            averageAnswerWords,
            averageWordsPerMinute: averageTimeSeconds ? this.round(averageAnswerWords / (averageTimeSeconds / 60)) : null,
            practiceCadence,
        };
    }
    buildDailyProgress(attempts) {
        const grouped = new Map();
        for (const attempt of attempts) {
            const key = attempt.createdAt.toISOString().slice(0, 10);
            grouped.set(key, [...(grouped.get(key) || []), attempt]);
        }
        return [...grouped.entries()]
            .map(([date, rows]) => {
            const totalMarksAwarded = rows.reduce((sum, attempt) => sum + Number(attempt.marksAwarded || 0), 0);
            const totalMaxMarks = rows.reduce((sum, attempt) => sum + Number(attempt.maxMarks || 0), 0);
            return {
                date,
                attempts: rows.length,
                averagePercentage: this.round(totalMaxMarks > 0 ? (totalMarksAwarded / totalMaxMarks) * 100 : 0),
                totalMarksAwarded: this.round(totalMarksAwarded),
                totalMaxMarks: this.round(totalMaxMarks),
            };
        })
            .sort((a, b) => a.date.localeCompare(b.date));
    }
    buildProgressTracking(attempts, topicRows, improvementGraph, dailyProgress) {
        const first = improvementGraph[0]?.percentage || 0;
        const latest = improvementGraph[improvementGraph.length - 1]?.percentage || 0;
        const average = this.buildSummary(attempts).averagePercentage;
        const topicCoverage = topicRows.length ? Math.min(100, (topicRows.filter((row) => row.attempts > 0).length / Math.max(1, topicRows.length)) * 100) : 0;
        return {
            totalAttempts: attempts.length,
            completedTopics: topicRows.filter((row) => row.attempts > 0).length,
            currentStreakDays: this.currentStreak(dailyProgress.map((point) => point.date)),
            bestStreakDays: this.bestStreak(dailyProgress.map((point) => point.date)),
            latestAttemptAt: attempts[attempts.length - 1]?.createdAt?.toISOString() || null,
            improvementSinceFirstAttempt: this.round(latest - first),
            readinessScore: this.round(average * 0.7 + topicCoverage * 0.2 + Math.min(100, attempts.length * 4) * 0.1),
        };
    }
    currentStreak(dates) {
        if (dates.length === 0)
            return 0;
        const set = new Set(dates);
        let cursor = new Date(dates[dates.length - 1]);
        let streak = 0;
        while (set.has(cursor.toISOString().slice(0, 10))) {
            streak += 1;
            cursor.setUTCDate(cursor.getUTCDate() - 1);
        }
        return streak;
    }
    bestStreak(dates) {
        let best = 0;
        let current = 0;
        let previous = null;
        for (const date of dates) {
            const currentDate = new Date(`${date}T00:00:00.000Z`);
            if (!previous)
                current = 1;
            else {
                const diffDays = (currentDate.getTime() - previous.getTime()) / 86400000;
                current = diffDays === 1 ? current + 1 : 1;
            }
            best = Math.max(best, current);
            previous = currentDate;
        }
        return best;
    }
    inferTopic(question) {
        const words = (question || '').match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g) || [];
        return words[0] || 'General';
    }
    wordCount(value) {
        return (value || '').trim().split(/\s+/).filter(Boolean).length;
    }
    average(values) {
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    }
    dimensionLabel(dimension) {
        return dimension.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    }
    round(value, places = 2) {
        const factor = 10 ** places;
        return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
    }
};
exports.AnalyticsEngineService = AnalyticsEngineService;
exports.AnalyticsEngineService = AnalyticsEngineService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(answer_evaluation_attempt_entity_1.AnswerEvaluationAttemptEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(question_bank_entry_entity_1.QuestionBankEntryEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], AnalyticsEngineService);
//# sourceMappingURL=analytics-engine.service.js.map