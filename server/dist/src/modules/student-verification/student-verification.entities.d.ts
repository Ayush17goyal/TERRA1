export declare class VerificationRequest {
    id: string;
    userId: string;
    fullName: string;
    universityName: string;
    course: string;
    yearOfStudy: string;
    studentEmail: string;
    studentIdNumber: string;
    status: 'pending' | 'verified' | 'rejected';
    isAcademicEmail: boolean;
    rejectionReason: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare class VerificationDocument {
    id: string;
    verificationRequestId: string;
    fileName: string;
    filePath: string;
    documentType: string;
    createdAt: Date;
}
export declare class VerificationAuditLog {
    id: string;
    verificationRequestId: string;
    action: string;
    performedBy: string;
    notes: string;
    createdAt: Date;
}
