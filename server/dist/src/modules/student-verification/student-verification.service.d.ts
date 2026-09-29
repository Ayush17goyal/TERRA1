import { Repository } from 'typeorm';
import { VerificationRequest, VerificationDocument, VerificationAuditLog } from './student-verification.entities';
export declare class StudentVerificationService {
    private readonly requestRepo;
    private readonly documentRepo;
    private readonly auditRepo;
    private readonly logger;
    constructor(requestRepo: Repository<VerificationRequest>, documentRepo: Repository<VerificationDocument>, auditRepo: Repository<VerificationAuditLog>);
    isAcademicEmail(email: string): boolean;
    getRequestByUser(userId: string): Promise<VerificationRequest | null>;
    getDocumentsForRequest(requestId: string): Promise<VerificationDocument[]>;
    submitRequest(userId: string, body: {
        fullName: string;
        universityName: string;
        course: string;
        yearOfStudy: string;
        studentEmail: string;
        studentIdNumber: string;
    }, files: Array<{
        originalname: string;
        buffer: Buffer;
        mimetype: string;
        fieldname: string;
    }>): Promise<VerificationRequest>;
    getAdminList(): Promise<any[]>;
    getDocumentFile(docId: string): Promise<{
        buffer: Buffer;
        fileName: string;
        mimeType: string;
    }>;
    approveRequest(requestId: string, adminUserId: string): Promise<VerificationRequest>;
    rejectRequest(requestId: string, adminUserId: string, reason: string): Promise<VerificationRequest>;
    getAnalytics(): Promise<any>;
    private writeAuditLog;
}
