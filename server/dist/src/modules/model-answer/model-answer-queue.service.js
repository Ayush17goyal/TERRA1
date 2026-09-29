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
var ModelAnswerQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelAnswerQueueService = void 0;
const common_1 = require("@nestjs/common");
const model_answer_service_1 = require("./model-answer.service");
let ModelAnswerQueueService = ModelAnswerQueueService_1 = class ModelAnswerQueueService {
    constructor(modelAnswer) {
        this.modelAnswer = modelAnswer;
        this.logger = new common_1.Logger(ModelAnswerQueueService_1.name);
        this.maxConcurrent = Number(process.env.MODEL_ANSWER_MAX_CONCURRENT_JOBS || 1);
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
                    await this.modelAnswer.createAnswerBank(userId);
                }
                catch (error) {
                    this.logger.error(`Unhandled model-answer job error for user ${userId}: ${error.message}`, error.stack);
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
exports.ModelAnswerQueueService = ModelAnswerQueueService;
exports.ModelAnswerQueueService = ModelAnswerQueueService = ModelAnswerQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [model_answer_service_1.ModelAnswerService])
], ModelAnswerQueueService);
//# sourceMappingURL=model-answer-queue.service.js.map