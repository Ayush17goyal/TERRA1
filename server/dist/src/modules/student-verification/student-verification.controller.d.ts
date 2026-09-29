import { Response } from 'express';
import { StudentVerificationService } from './student-verification.service';
export declare class StudentVerificationController {
    private readonly service;
    constructor(service: StudentVerificationService);
    submitVerification(req: any, body: any, files: any[]): Promise<import("./student-verification.entities").VerificationRequest>;
    getStatus(req: any): Promise<import("./student-verification.entities").VerificationRequest | {
        status: string;
    }>;
    listAllRequests(req: any): Promise<any[]>;
    getAnalytics(req: any): Promise<any>;
    approveRequest(req: any, id: string): Promise<import("./student-verification.entities").VerificationRequest>;
    rejectRequest(req: any, id: string, reason: string): Promise<import("./student-verification.entities").VerificationRequest>;
    getDocument(req: any, id: string, res: Response): Promise<void>;
    private isAdmin;
    private enforceAdmin;
}
