declare const ADMIN_SESSION_AUDIENCE = "legatrixon-admin-portal";
export type AdminSessionClaims = {
    sub: string;
    role: string;
    aud: typeof ADMIN_SESSION_AUDIENCE;
    iat: number;
    exp: number;
    nonce: string;
};
export declare function hashAdminSecret(secret: string): string;
export declare function verifyAdminSecret(candidate: string, encodedHash: string): boolean;
export declare function issueAdminSessionToken(adminId: string, role: string, ttlSeconds?: number): string;
export declare function verifyAdminSessionToken(token: string): AdminSessionClaims | null;
export {};
