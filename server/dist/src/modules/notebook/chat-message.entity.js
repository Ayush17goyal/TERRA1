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
exports.NotebookChatMessage = void 0;
const typeorm_1 = require("typeorm");
let NotebookChatMessage = class NotebookChatMessage {
};
exports.NotebookChatMessage = NotebookChatMessage;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], NotebookChatMessage.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id' }),
    __metadata("design:type", String)
], NotebookChatMessage.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'document_id' }),
    __metadata("design:type", String)
], NotebookChatMessage.prototype, "documentId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], NotebookChatMessage.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], NotebookChatMessage.prototype, "text", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], NotebookChatMessage.prototype, "citations", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'float', nullable: true }),
    __metadata("design:type", Number)
], NotebookChatMessage.prototype, "confidence", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], NotebookChatMessage.prototype, "createdAt", void 0);
exports.NotebookChatMessage = NotebookChatMessage = __decorate([
    (0, typeorm_1.Entity)('notebook_chat_messages')
], NotebookChatMessage);
//# sourceMappingURL=chat-message.entity.js.map