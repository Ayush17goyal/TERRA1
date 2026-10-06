"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentSchema = void 0;
exports.loadEnvironment = loadEnvironment;
exports.resolveClientOrigins = resolveClientOrigins;
const zod_1 = require("zod");
const booleanString = zod_1.z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true');
const optionalUrl = zod_1.z.string().url().optional().or(zod_1.z.literal('').transform(() => undefined));
const csv = zod_1.z.string().optional().transform((value) => (value || '').split(',').map((item) => item.trim()).filter(Boolean));
exports.EnvironmentSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'staging', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().positive().max(65535).default(3000),
    CLIENT_ORIGIN: zod_1.z.string().optional(),
    CLIENT_ORIGINS: csv,
    DATABASE_URL: zod_1.z.string().optional(),
    POSTGRES_URL: zod_1.z.string().optional(),
    POSTGRES_SSL: booleanString,
    SQLITE_DB_PATH: zod_1.z.string().optional(),
    SUPABASE_URL: optionalUrl,
    NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
    VITE_SUPABASE_URL: optionalUrl,
    SUPABASE_ANON_KEY: zod_1.z.string().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: zod_1.z.string().optional(),
    VITE_SUPABASE_ANON_KEY: zod_1.z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: zod_1.z.string().optional(),
    SUPABASE_DISABLED: booleanString,
    DISABLE_SUPABASE: booleanString,
    OPENAI_API_KEY: zod_1.z.string().optional(),
    OPENAI_MODEL: zod_1.z.string().default('gpt-4.1-mini'),
    OPENAI_EMBEDDING_MODEL: zod_1.z.string().default('text-embedding-3-small'),
    OPENROUTER_API_KEY: zod_1.z.string().optional(),
    QDRANT_URL: optionalUrl,
    REDIS_URL: zod_1.z.string().optional(),
    CLERK_SECRET_KEY: zod_1.z.string().optional(),
    ADMIN_EMAILS: csv,
    FOUNDER_EMAILS: csv,
    ADMIN_PORTAL_ID: zod_1.z.string().optional(),
    ADMIN_PORTAL_PASSWORD_HASH: zod_1.z.string().regex(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/i).optional(),
    DEMO_LIMIT_PER_FEATURE_PER_DAY: zod_1.z.coerce.number().int().min(1).max(100).default(4),
    ALLOW_DEV_AUTH_BYPASS: booleanString,
    LOG_LEVEL: zod_1.z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    SENTRY_DSN: optionalUrl,
    SENTRY_TRACES_SAMPLE_RATE: zod_1.z.coerce.number().min(0).max(1).default(0.1),
    OTEL_SERVICE_NAME: zod_1.z.string().default('legatrixon-bare-act-mentor'),
    OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
    PROMETHEUS_ENABLED: booleanString,
    API_RATE_LIMIT_WINDOW_MS: zod_1.z.coerce.number().int().positive().default(60000),
    API_RATE_LIMIT_MAX: zod_1.z.coerce.number().int().positive().default(120),
    AUTH_RATE_LIMIT_MAX: zod_1.z.coerce.number().int().positive().default(20),
    LLM_RATE_LIMIT_MAX: zod_1.z.coerce.number().int().positive().default(30),
    MAX_UPLOAD_BYTES: zod_1.z.coerce.number().int().positive().default(25 * 1024 * 1024),
    REQUEST_TIMEOUT_MS: zod_1.z.coerce.number().int().positive().default(30000),
    SHUTDOWN_TIMEOUT_MS: zod_1.z.coerce.number().int().positive().default(15000),
    SECURITY_REPORT_ONLY_CSP: booleanString,
    VIRUS_SCAN_MODE: zod_1.z.enum(['off', 'optional', 'required']).default('optional'),
    VIRUS_SCAN_COMMAND: zod_1.z.string().optional(),
    MAINTENANCE_MODE: booleanString,
    DATA_RETENTION_DAYS: zod_1.z.coerce.number().int().positive().default(365),
    AUDIT_RETENTION_DAYS: zod_1.z.coerce.number().int().positive().default(730),
    LOG_RETENTION_DAYS: zod_1.z.coerce.number().int().positive().default(90),
}).superRefine((env, ctx) => {
    const production = env.NODE_ENV === 'production';
    const hasPostgres = Boolean(env.DATABASE_URL || env.POSTGRES_URL);
    const origins = [...env.CLIENT_ORIGINS, ...(env.CLIENT_ORIGIN ? [env.CLIENT_ORIGIN] : [])];
    if (production && origins.length === 0)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['CLIENT_ORIGINS'], message: 'Production requires CLIENT_ORIGINS or CLIENT_ORIGIN.' });
    if (production && !hasPostgres)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['DATABASE_URL'], message: 'Production requires PostgreSQL via DATABASE_URL or POSTGRES_URL.' });
    if (production && !env.CLERK_SECRET_KEY)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['CLERK_SECRET_KEY'], message: 'Production requires CLERK_SECRET_KEY.' });
    if (production && !env.OPENAI_API_KEY && !env.OPENROUTER_API_KEY)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['OPENAI_API_KEY'], message: 'Production requires an LLM provider key.' });
    if (production && !env.ADMIN_PORTAL_ID)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['ADMIN_PORTAL_ID'], message: 'Production requires ADMIN_PORTAL_ID.' });
    if (production && !env.ADMIN_PORTAL_PASSWORD_HASH)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['ADMIN_PORTAL_PASSWORD_HASH'], message: 'Production requires a scrypt ADMIN_PORTAL_PASSWORD_HASH.' });
    if (production && env.ALLOW_DEV_AUTH_BYPASS)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['ALLOW_DEV_AUTH_BYPASS'], message: 'Dev auth bypass cannot be enabled in production.' });
    if (production && env.VIRUS_SCAN_MODE !== 'required')
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['VIRUS_SCAN_MODE'], message: 'Production requires VIRUS_SCAN_MODE=required.' });
    if (env.VIRUS_SCAN_MODE === 'required' && !env.VIRUS_SCAN_COMMAND)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ['VIRUS_SCAN_COMMAND'], message: 'Required virus scanning needs VIRUS_SCAN_COMMAND.' });
});
function loadEnvironment(source = process.env) {
    const parsed = exports.EnvironmentSchema.safeParse(source);
    if (!parsed.success) {
        const details = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`).join('; ');
        throw new Error(`Invalid LEGATRIXON runtime configuration: ${details}`);
    }
    return Object.freeze(parsed.data);
}
function resolveClientOrigins(env) {
    const configured = [...env.CLIENT_ORIGINS, ...(env.CLIENT_ORIGIN ? [env.CLIENT_ORIGIN] : [])]
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean);
    if (env.NODE_ENV === 'production' || env.NODE_ENV === 'staging')
        return Array.from(new Set(configured));
    return Array.from(new Set([...configured, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174']));
}
//# sourceMappingURL=environment.js.map