"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashAdminSecret = hashAdminSecret;
exports.verifyAdminSecret = verifyAdminSecret;
exports.issueAdminSessionToken = issueAdminSessionToken;
exports.verifyAdminSessionToken = verifyAdminSessionToken;
const crypto_1 = require("crypto");
const SCRYPT_PREFIX = 'scrypt';
const ADMIN_SESSION_PREFIX = 'aps1';
const ADMIN_SESSION_AUDIENCE = 'legatrixon-admin-portal';
const DEFAULT_SESSION_TTL_SECONDS = 30 * 60;
function hashAdminSecret(secret) {
    if (secret.length < 14) {
        throw new Error('Use at least 14 characters. A password manager-generated value is recommended.');
    }
    const salt = (0, crypto_1.randomBytes)(16).toString('hex');
    const hash = (0, crypto_1.scryptSync)(secret, salt, 64).toString('hex');
    return `${SCRYPT_PREFIX}$${salt}$${hash}`;
}
function verifyAdminSecret(candidate, encodedHash) {
    try {
        const [algorithm, salt, expectedHex, ...extra] = String(encodedHash).split('$');
        if (algorithm !== SCRYPT_PREFIX || !/^[0-9a-f]+$/i.test(salt || '') || !/^[0-9a-f]+$/i.test(expectedHex || '') || extra.length > 0 || expectedHex.length % 2 !== 0) {
            return false;
        }
        const expected = Buffer.from(expectedHex, 'hex');
        const actual = (0, crypto_1.scryptSync)(String(candidate || ''), salt, expected.length);
        return actual.length === expected.length && (0, crypto_1.timingSafeEqual)(actual, expected);
    }
    catch {
        return false;
    }
}
function adminSessionSecret() {
    const configured = process.env.ADMIN_PORTAL_SESSION_SECRET || '';
    if (configured.length >= 32)
        return configured;
    if (process.env.NODE_ENV !== 'production') {
        const developmentFallback = process.env.ADMIN_PORTAL_PASSWORD_HASH || '';
        if (developmentFallback)
            return developmentFallback;
    }
    throw new Error('ADMIN_PORTAL_SESSION_SECRET must contain at least 32 characters.');
}
function signEncodedClaims(encodedClaims) {
    return (0, crypto_1.createHmac)('sha256', adminSessionSecret()).update(encodedClaims).digest();
}
function issueAdminSessionToken(adminId, role, ttlSeconds = DEFAULT_SESSION_TTL_SECONDS) {
    const now = Math.floor(Date.now() / 1000);
    const claims = {
        sub: adminId,
        role: role.toLowerCase(),
        aud: ADMIN_SESSION_AUDIENCE,
        iat: now,
        exp: now + ttlSeconds,
        nonce: (0, crypto_1.randomBytes)(16).toString('base64url'),
    };
    const encodedClaims = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
    return `${ADMIN_SESSION_PREFIX}.${encodedClaims}.${signEncodedClaims(encodedClaims).toString('base64url')}`;
}
function verifyAdminSessionToken(token) {
    try {
        const [prefix, encodedClaims, encodedSignature, ...extra] = String(token || '').split('.');
        if (prefix !== ADMIN_SESSION_PREFIX || !encodedClaims || !encodedSignature || extra.length > 0)
            return null;
        const actualSignature = Buffer.from(encodedSignature, 'base64url');
        const expectedSignature = signEncodedClaims(encodedClaims);
        if (actualSignature.length !== expectedSignature.length || !(0, crypto_1.timingSafeEqual)(actualSignature, expectedSignature))
            return null;
        const claims = JSON.parse(Buffer.from(encodedClaims, 'base64url').toString('utf8'));
        const now = Math.floor(Date.now() / 1000);
        if (claims.aud !== ADMIN_SESSION_AUDIENCE || !claims.sub || !claims.role || !claims.nonce)
            return null;
        if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.iat > now + 60 || claims.exp <= now)
            return null;
        return claims;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=admin-credentials.js.map