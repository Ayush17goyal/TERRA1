import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  VerificationRequest,
  VerificationDocument,
  VerificationAuditLog,
} from './student-verification.entities';

const ACADEMIC_DOMAINS = ['.ac.in', '.edu', '.edu.in', '.ac.uk'];

@Injectable()
export class StudentVerificationService {
  private readonly logger = new Logger(StudentVerificationService.name);

  constructor(
    @InjectRepository(VerificationRequest)
    private readonly requestRepo: Repository<VerificationRequest>,
    @InjectRepository(VerificationDocument)
    private readonly documentRepo: Repository<VerificationDocument>,
    @InjectRepository(VerificationAuditLog)
    private readonly auditRepo: Repository<VerificationAuditLog>,
  ) {}

  isAcademicEmail(email: string): boolean {
    if (!email) return false;
    const lowerEmail = email.toLowerCase().trim();
    return ACADEMIC_DOMAINS.some(domain => lowerEmail.endsWith(domain));
  }

  async getRequestByUser(userId: string): Promise<VerificationRequest | null> {
    return this.requestRepo.findOne({ where: { userId } });
  }

  async getDocumentsForRequest(requestId: string): Promise<VerificationDocument[]> {
    return this.documentRepo.find({ where: { verificationRequestId: requestId } });
  }

  async submitRequest(
    userId: string,
    body: {
      fullName: string;
      universityName: string;
      course: string;
      yearOfStudy: string;
      studentEmail: string;
      studentIdNumber: string;
    },
    files: Array<{ originalname: string; buffer: Buffer; mimetype: string; fieldname: string }>,
  ): Promise<VerificationRequest> {
    // Check if user already has a verification request
    let request = await this.getRequestByUser(userId);
    if (request && request.status === 'verified') {
      throw new BadRequestException('User is already verified.');
    }

    const isAcademic = this.isAcademicEmail(body.studentEmail);
    if (!isAcademic) {
      throw new BadRequestException('Only academic student emails (ending in .edu, .ac.in, .edu.in, .ac.uk) are accepted.');
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
    } else {
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

    // Save uploaded files if any (required for personal email flows)
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
    } else if (!isAcademic) {
      throw new BadRequestException('Documents are required for personal email addresses.');
    }

    // Write audit log
    await this.writeAuditLog(
      savedRequest.id,
      'submitted',
      'system',
      `Verification request submitted. Academic email detected: ${isAcademic}. Status: ${savedRequest.status}`
    );

    return savedRequest;
  }

  async getAdminList(): Promise<any[]> {
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

  async getDocumentFile(docId: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const doc = await this.documentRepo.findOne({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document record not found');

    if (!fs.existsSync(doc.filePath)) {
      throw new NotFoundException('Physical file not found on disk');
    }

    const buffer = fs.readFileSync(doc.filePath);
    const ext = path.extname(doc.fileName).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === '.pdf') mimeType = 'application/pdf';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';

    return {
      buffer,
      fileName: doc.fileName,
      mimeType,
    };
  }

  async approveRequest(requestId: string, adminUserId: string): Promise<VerificationRequest> {
    const request = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Verification request not found');

    request.status = 'verified';
    request.rejectionReason = null;
    const updated = await this.requestRepo.save(request);

    await this.writeAuditLog(requestId, 'approved', adminUserId, 'Law student verified by administrator.');
    return updated;
  }

  async rejectRequest(requestId: string, adminUserId: string, reason: string): Promise<VerificationRequest> {
    const request = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Verification request not found');

    request.status = 'rejected';
    request.rejectionReason = reason;
    const updated = await this.requestRepo.save(request);

    await this.writeAuditLog(requestId, 'rejected', adminUserId, `Law student rejected by administrator. Reason: ${reason}`);
    return updated;
  }

  async getAnalytics(): Promise<any> {
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

  private async writeAuditLog(requestId: string, action: string, performedBy: string, notes: string) {
    const log = this.auditRepo.create({
      verificationRequestId: requestId,
      action,
      performedBy,
      notes,
    });
    await this.auditRepo.save(log);
  }
}
