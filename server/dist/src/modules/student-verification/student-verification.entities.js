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
exports.VerificationAuditLog = exports.VerificationDocument = exports.VerificationRequest = void 0;
const typeorm_1 = require("typeorm");
let VerificationRequest = class VerificationRequest {
};
exports.VerificationRequest = VerificationRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], VerificationRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', unique: true }),
    __metadata("design:type", String)
], VerificationRequest.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'full_name' }),
    __metadata("design:type", String)
], VerificationRequest.prototype, "fullName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'university_name' }),
    __metadata("design:type", String)
], VerificationRequest.prototype, "universityName", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], VerificationRequest.prototype, "course", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'year_of_study' }),
    __metadata("design:type", String)
], VerificationRequest.prototype, "yearOfStudy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'student_email' }),
    __metadata("design:type", String)
], VerificationRequest.prototype, "studentEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'student_id_number' }),
    __metadata("design:type", String)
], VerificationRequest.prototype, "studentIdNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'pending' }),
    __metadata("design:type", String)
], VerificationRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_academic_email', default: false }),
    __metadata("design:type", Boolean)
], VerificationRequest.prototype, "isAcademicEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'rejection_reason', nullable: true }),
    __metadata("design:type", String)
], VerificationRequest.prototype, "rejectionReason", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], VerificationRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], VerificationRequest.prototype, "updatedAt", void 0);
exports.VerificationRequest = VerificationRequest = __decorate([
    (0, typeorm_1.Entity)('verification_requests')
], VerificationRequest);
let VerificationDocument = class VerificationDocument {
};
exports.VerificationDocument = VerificationDocument;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], VerificationDocument.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'verification_request_id' }),
    __metadata("design:type", String)
], VerificationDocument.prototype, "verificationRequestId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_name' }),
    __metadata("design:type", String)
], VerificationDocument.prototype, "fileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_path' }),
    __metadata("design:type", String)
], VerificationDocument.prototype, "filePath", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'document_type' }),
    __metadata("design:type", String)
], VerificationDocument.prototype, "documentType", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], VerificationDocument.prototype, "createdAt", void 0);
exports.VerificationDocument = VerificationDocument = __decorate([
    (0, typeorm_1.Entity)('verification_documents')
], VerificationDocument);
let VerificationAuditLog = class VerificationAuditLog {
};
exports.VerificationAuditLog = VerificationAuditLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], VerificationAuditLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'verification_request_id' }),
    __metadata("design:type", String)
], VerificationAuditLog.prototype, "verificationRequestId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], VerificationAuditLog.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'performed_by' }),
    __metadata("design:type", String)
], VerificationAuditLog.prototype, "performedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], VerificationAuditLog.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], VerificationAuditLog.prototype, "createdAt", void 0);
exports.VerificationAuditLog = VerificationAuditLog = __decorate([
    (0, typeorm_1.Entity)('verification_audit_logs')
], VerificationAuditLog);
//# sourceMappingURL=student-verification.entities.js.map