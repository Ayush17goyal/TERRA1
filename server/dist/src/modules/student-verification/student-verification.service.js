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
var StudentVerificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentVerificationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const student_verification_entities_1 = require("./student-verification.entities");
const ACADEMIC_DOMAINS = ['.ac.in', '.edu', '.edu.in', '.ac.uk'];
let StudentVerificationService = StudentVerificationService_1 = class StudentVerificationService {
    constructor(requestRepo, documentRepo, auditRepo) {
        this.requestRepo = requestRepo;
        this.documentRepo = documentRepo;
        this.auditRepo = auditRepo;
        this.logger = new common_1.Logger(StudentVerificationService_1.name);
    }
    isAcademicEmail(email) {
        if (!email)
            return false;
        const lowerEmail = email.toLowerCase().trim();
        return ACADEMIC_DOMAINS.some(domain => lowerEmail.endsWith(domain));
    }
    async getRequestByUser(userId) {
        return this.requestRepo.findOne({ where: { userId } });
    }
    async getDocumentsForRequest(requestId) {
        return this.documentRepo.find({ where: { verificationRequestId: requestId } });
    }
    async submitRequest(userId, body, files) {
        let request = await this.getRequestByUser(userId);
        if (request && request.status === 'verified') {
            throw new common_1.BadRequestException('User is already verified.');
        }
        const isAcademic = this.isAcademicEmail(body.studentEmail);
        if (!isAcademic) {
            throw new common_1.BadRequestException('Only academic student emails (ending in .edu, .ac.in, .edu.in, .ac.uk) are accepted.');
        }
        if (request) {
            request.fullName = body.fullName;
            request.universityName = body.universityName;
            request.course = body.course;
            request.yearOfStudy = body.yearOfStudy;
            request.studentEmail = body.studentEmail;
            request.studentIdNumber = body.studentIdNumber;
            request.isAcademicEmail = isAcademic;
            request.status = isAcademic ? 'verified' : 'pending';
            request.rejectionReason = null;
        }
        else {
            request = this.requestRepo.create({
                userId,
                fullName: body.fullName,
                universityName: body.universityName,
                course: body.course,
                yearOfStudy: body.yearOfStudy,
                studentEmail: body.studentEmail,
                studentIdNumber: body.studentIdNumber,
                isAcademicEmail: isAcademic,
                status: isAcademic ? 'verified' : 'pending',
            });
        }
        const savedRequest = await this.requestRepo.save(request);
        if (files && files.length > 0) {
            const dir = path.resolve(process.cwd(), 'uploads', 'student-verification', userId);
            fs.mkdirSync(dir, { recursive: true });
            for (const file of files) {
                const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
                const uniqueFileName = `${crypto.randomUUID()}-${safeName}`;
                const filePath = path.join(dir, uniqueFileName);
                fs.writeFileSync(filePath, file.buffer);
                const docType = file.fieldname === 'studentIdCard' ? 'Student ID Card' : 'Enrollment Proof';
                const document = this.documentRepo.create({
                    verificationRequestId: savedRequest.id,
                    fileName: file.originalname,
                    filePath,
                    documentType: docType,
                });
                await this.documentRepo.save(document);
            }
        }
        else if (!isAcademic) {
            throw new common_1.BadRequestException('Documents are required for personal email addresses.');
        }
        await this.writeAuditLog(savedRequest.id, 'submitted', 'system', `Verification request submitted. Academic email detected: ${isAcademic}. Status: ${savedRequest.status}`);
        return savedRequest;
    }
    async getAdminList() {
        const requests = await this.requestRepo.find({ order: { createdAt: 'DESC' } });
        const result = [];
        for (const req of requests) {
            const docs = await this.getDocumentsForRequest(req.id);
            result.push({
                ...req,
                documents: docs.map(d => ({
                    id: d.id,
                    fileName: d.fileName,
                    documentType: d.documentType,
                    createdAt: d.createdAt,
                })),
            });
        }
        return result;
    }
    async getDocumentFile(docId) {
        const doc = await this.documentRepo.findOne({ where: { id: docId } });
        if (!doc)
            throw new common_1.NotFoundException('Document record not found');
        if (!fs.existsSync(doc.filePath)) {
            throw new common_1.NotFoundException('Physical file not found on disk');
        }
        const buffer = fs.readFileSync(doc.filePath);
        const ext = path.extname(doc.fileName).toLowerCase();
        let mimeType = 'application/octet-stream';
        if (ext === '.pdf')
            mimeType = 'application/pdf';
        else if (ext === '.jpg' || ext === '.jpeg')
            mimeType = 'image/jpeg';
        else if (ext === '.png')
            mimeType = 'image/png';
        return {
            buffer,
            fileName: doc.fileName,
            mimeType,
        };
    }
    async approveRequest(requestId, adminUserId) {
        const request = await this.requestRepo.findOne({ where: { id: requestId } });
        if (!request)
            throw new common_1.NotFoundException('Verification request not found');
        request.status = 'verified';
        request.rejectionReason = null;
        const updated = await this.requestRepo.save(request);
        await this.writeAuditLog(requestId, 'approved', adminUserId, 'Law student verified by administrator.');
        return updated;
    }
    async rejectRequest(requestId, adminUserId, reason) {
        const request = await this.requestRepo.findOne({ where: { id: requestId } });
        if (!request)
            throw new common_1.NotFoundException('Verification request not found');
        request.status = 'rejected';
        request.rejectionReason = reason;
        const updated = await this.requestRepo.save(request);
        await this.writeAuditLog(requestId, 'rejected', adminUserId, `Law student rejected by administrator. Reason: ${reason}`);
        return updated;
    }
    async getAnalytics() {
        const totalRequests = await this.requestRepo.count();
        const verifiedRequests = await this.requestRepo.count({ where: { status: 'verified' } });
        const pendingRequests = await this.requestRepo.count({ where: { status: 'pending' } });
        const rejectedRequests = await this.requestRepo.count({ where: { status: 'rejected' } });
        const totalDecided = verifiedRequests + rejectedRequests;
        const successRate = totalDecided ? Math.round((verifiedRequests / totalDecided) * 100) : 0;
        return {
            totalVerifiedStudents: verifiedRequests,
            pendingReviews: pendingRequests,
            rejectedApplications: rejectedRequests,
            verificationSuccessRate: `${successRate}%`,
            totalRequests,
        };
    }
    async writeAuditLog(requestId, action, performedBy, notes) {
        const log = this.auditRepo.create({
            verificationRequestId: requestId,
            action,
            performedBy,
            notes,
        });
        await this.auditRepo.save(log);
    }
};
exports.StudentVerificationService = StudentVerificationService;
exports.StudentVerificationService = StudentVerificationService = StudentVerificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(student_verification_entities_1.VerificationRequest)),
    __param(1, (0, typeorm_1.InjectRepository)(student_verification_entities_1.VerificationDocument)),
    __param(2, (0, typeorm_1.InjectRepository)(student_verification_entities_1.VerificationAuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], StudentVerificationService);
//# sourceMappingURL=student-verification.service.js.map