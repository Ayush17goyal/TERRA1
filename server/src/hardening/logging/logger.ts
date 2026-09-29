import pino from 'pino';
import type { RuntimeEnvironment } from '../config/environment';

const redactPaths = [
  'req.headers.authorization', 'req.headers.cookie', 'req.headers.x-supabase-token',
  'req.body.password', 'req.body.token', 'req.body.refresh_token', 'req.body.access_token',
  'req.body.apiKey', 'req.body.openaiApiKey', 'res.headers.set-cookie',
  '*.SUPABASE_SERVICE_ROLE_KEY', '*.OPENAI_API_KEY', '*.CLERK_SECRET_KEY', '*.authorization', '*.cookie',
];

export function createLogger(env: RuntimeEnvironment) {
  return pino({
    name: 'legatrixon-bare-act-mentor',
    level: env.LOG_LEVEL,
    base: { service: env.OTEL_SERVICE_NAME, environment: env.NODE_ENV },
    redact: { paths: redactPaths, censor: '[REDACTED]' },
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: 'message',
    formatters: { level(label) { return { level: label }; } },
  });
}

export type AppLogger = ReturnType<typeof createLogger>;

export function errorToLog(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  return { message: String(error) };
}