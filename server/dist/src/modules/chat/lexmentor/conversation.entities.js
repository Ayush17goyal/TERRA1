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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineAnalyticRecord = exports.ConversationTurn = exports.ConversationSession = void 0;
const typeorm_1 = require("typeorm");
let ConversationSession = class ConversationSession {
};
exports.ConversationSession = ConversationSession;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ConversationSession.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], ConversationSession.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ConversationSession.prototype, "sessionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ConversationSession.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], ConversationSession.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], ConversationSession.prototype, "lastActiveAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ConversationSession.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ConversationSession.prototype, "updatedAt", void 0);
exports.ConversationSession = ConversationSession = __decorate([
    (0, typeorm_1.Entity)('lexmentor_sessions'),
    (0, typeorm_1.Index)(['userId', 'sessionId'], { unique: true })
], ConversationSession);
let ConversationTurn = class ConversationTurn {
};
exports.ConversationTurn = ConversationTurn;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ConversationTurn.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ConversationTurn.prototype, "sessionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16 }),
    __metadata("design:type", String)
], ConversationTurn.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ConversationTurn.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], ConversationTurn.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ConversationTurn.prototype, "createdAt", void 0);
exports.ConversationTurn = ConversationTurn = __decorate([
    (0, typeorm_1.Entity)('lexmentor_turns'),
    (0, typeorm_1.Index)(['sessionId'])
], ConversationTurn);
let PipelineAnalyticRecord = class PipelineAnalyticRecord {
};
exports.PipelineAnalyticRecord = PipelineAnalyticRecord;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PipelineAnalyticRecord.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PipelineAnalyticRecord.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PipelineAnalyticRecord.prototype, "sessionId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PipelineAnalyticRecord.prototype, "requestId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PipelineAnalyticRecord.prototype, "intent", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PipelineAnalyticRecord.prototype, "provider", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PipelineAnalyticRecord.prototype, "model", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], PipelineAnalyticRecord.prototype, "pipelineTotalMs", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PipelineAnalyticRecord.prototype, "retrievedChunks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PipelineAnalyticRecord.prototype, "promptTokens", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], PipelineAnalyticRecord.prototype, "completionTokens", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PipelineAnalyticRecord.prototype, "depth", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], PipelineAnalyticRecord.prototype, "stageTimings", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], PipelineAnalyticRecord.prototype, "createdAt", void 0);
exports.PipelineAnalyticRecord = PipelineAnalyticRecord = __decorate([
    (0, typeorm_1.Entity)('lexmentor_analytics'),
    (0, typeorm_1.Index)(['userId']),
    (0, typeorm_1.Index)(['createdAt'])
], PipelineAnalyticRecord);
//# sourceMappingURL=conversation.entities.js.map