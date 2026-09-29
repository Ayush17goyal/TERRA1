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
var QuestionPlanningQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionPlanningQueueService = void 0;
const common_1 = require("@nestjs/common");
const question_planning_service_1 = require("./question-planning.service");
const question_bank_queue_service_1 = require("../question-bank/question-bank-queue.service");
let QuestionPlanningQueueService = QuestionPlanningQueueService_1 = class QuestionPlanningQueueService {
    constructor(questionPlanning, questionBankQueue) {
        this.questionPlanning = questionPlanning;
        this.questionBankQueue = questionBankQueue;
        this.logger = new common_1.Logger(QuestionPlanningQueueService_1.name);
        this.maxConcurrent = Number(process.env.QUESTION_PLANNING_MAX_CONCURRENT_JOBS || 2);
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
                    const plan = await this.questionPlanning.buildPlan(userId);
                    if (plan.status === 'ready' && plan.summary?.totalSlots > 0) {
                        this.questionBankQueue?.enqueue(userId);
                    }
                }
                catch (error) {
                    this.logger.error(`Unhandled question-planning job error for user ${userId}: ${error.message}`, error.stack);
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
exports.QuestionPlanningQueueService = QuestionPlanningQueueService;
exports.QuestionPlanningQueueService = QuestionPlanningQueueService = QuestionPlanningQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [question_planning_service_1.QuestionPlanningService,
        question_bank_queue_service_1.QuestionBankQueueService])
], QuestionPlanningQueueService);
//# sourceMappingURL=question-planning-queue.service.js.map