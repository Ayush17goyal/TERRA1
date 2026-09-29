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
var QuestionBankQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionBankQueueService = void 0;
const common_1 = require("@nestjs/common");
const question_bank_service_1 = require("./question-bank.service");
const model_answer_queue_service_1 = require("../model-answer/model-answer-queue.service");
let QuestionBankQueueService = QuestionBankQueueService_1 = class QuestionBankQueueService {
    constructor(questionBank, modelAnswerQueue) {
        this.questionBank = questionBank;
        this.modelAnswerQueue = modelAnswerQueue;
        this.logger = new common_1.Logger(QuestionBankQueueService_1.name);
        this.maxConcurrent = Number(process.env.QUESTION_BANK_MAX_CONCURRENT_JOBS || 2);
        this.active = 0;
        this.pending = [];
        this.queued = new Set();
    }
    enqueue(userId) {
        if (this.queued.has(userId))
            return;
        this.queued.add(userId);
        this.pending.push(userId);
        this.drain();
    }
    drain() {
        while (this.active < this.maxConcurrent && this.pending.length > 0) {
            const userId = this.pending.shift();
            this.active++;
            setImmediate(async () => {
                try {
                    const summary = await this.questionBank.createQuestionBank(userId);
                    if (summary.valid > 0) {
                        this.modelAnswerQueue?.enqueue(userId);
                    }
                }
                catch (error) {
                    this.logger.error(`Unhandled question-bank job error for user ${userId}: ${error.message}`, error.stack);
                }
                finally {
                    this.queued.delete(userId);
                    this.active--;
                    this.drain();
                }
            });
        }
    }
};
exports.QuestionBankQueueService = QuestionBankQueueService;
exports.QuestionBankQueueService = QuestionBankQueueService = QuestionBankQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [question_bank_service_1.QuestionBankService,
        model_answer_queue_service_1.ModelAnswerQueueService])
], QuestionBankQueueService);
//# sourceMappingURL=question-bank-queue.service.js.map