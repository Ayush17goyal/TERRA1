import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SCRYPT_PREFIX = 'scrypt';
const ADMIN_SESSION_PREFIX = 'aps1';
const ADMIN_SESSION_AUDIENCE = 'legatrixon-admin-portal';
const DEFAULT_SESSION_TTL_SECONDS = 30 * 60;

export type AdminSessionClaims = {
  sub: string;
  role: string;
  aud: typeof ADMIN_SESSION_AUDIENCE;
  iat: number;
  exp: number;
  nonce: string;
};

export function hashAdminSecret(secret: string): string {
  if (secret.length < 14) {
    throw new Error('Use at least 14 characters. A password manager-generated value is recommended.');
  }
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(secret, salt, 64).toString('hex');
  return `${SCRYPT_PREFIX}$${salt}$${hash}`;
}

export function verifyAdminSecret(candidate: string, encodedHash: string): boolean {
  try {
    const [algorithm, salt, expectedHex, ...extra] = String(encodedHash).split('$');
    if (algorithm !== SCRYPT_PREFIX || !/^[0-9a-f]+$/i.test(salt || '') || !/^[0-9a-f]+$/i.test(expectedHex || '') || extra.length > 0 || expectedHex.length % 2 !== 0) {
      return false;
    }
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = scryptSync(String(candidate || ''), salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function adminSessionSecret(): string {
  const configured = process.env.ADMIN_PORTAL_SESSION_SECRET || '';
  if (configured.length >= 32) return configured;

  // Local development can derive an ephemeral signing key from the already
  // private password hash. Production must use an independent signing secret.
  if (process.env.NODE_ENV !== 'production') {
    const developmentFallback = process.env.ADMIN_PORTAL_PASSWORD_HASH || '';
    if (developmentFallback) return developmentFallback;
  }

  throw new Error('ADMIN_PORTAL_SESSION_SECRET must contain at least 32 characters.');
}

function signEncodedClaims(encodedClaims: string): Buffer {
  return createHmac('sha256', adminSessionSecret()).update(encodedClaims).digest();
}

export function issueAdminSessionToken(adminId: string, role: string, ttlSeconds = DEFAULT_SESSION_TTL_SECONDS): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: AdminSessionClaims = {
    sub: adminId,
    role: role.toLowerCase(),
    aud: ADMIN_SESSION_AUDIENCE,
    iat: now,
    exp: now + ttlSeconds,
    nonce: randomBytes(16).toString('base64url'),
  };
  const encodedClaims = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return `${ADMIN_SESSION_PREFIX}.${encodedClaims}.${signEncodedClaims(encodedClaims).toString('base64url')}`;
}

export function verifyAdminSessionToken(token: string): AdminSessionClaims | null {
  try {
    const [prefix, encodedClaims, encodedSignature, ...extra] = String(token || '').split('.');
    if (prefix !== ADMIN_SESSION_PREFIX || !encodedClaims || !encodedSignature || extra.length > 0) return null;

    const actualSignature = Buffer.from(encodedSignature, 'base64url');
    const expectedSignature = signEncodedClaims(encodedClaims);
    if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null;

    const claims = JSON.parse(Buffer.from(encodedClaims, 'base64url').toString('utf8')) as AdminSessionClaims;
    const now = Math.floor(Date.now() / 1000);
    if (claims.aud !== ADMIN_SESSION_AUDIENCE || !claims.sub || !claims.role || !claims.nonce) return null;
    if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.iat > now + 60 || claims.exp <= now) return null;
    return claims;
  } catch {
    return null;
  }
}
