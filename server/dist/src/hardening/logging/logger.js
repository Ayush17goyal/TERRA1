"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
exports.errorToLog = errorToLog;
const pino_1 = require("pino");
const redactPaths = [
    'req.headers.authorization', 'req.headers.cookie', 'req.headers.x-supabase-token',
    'req.body.password', 'req.body.token', 'req.body.refresh_token', 'req.body.access_token',
    'req.body.apiKey', 'req.body.openaiApiKey', 'res.headers.set-cookie',
    '*.SUPABASE_SERVICE_ROLE_KEY', '*.OPENAI_API_KEY', '*.CLERK_SECRET_KEY', '*.authorization', '*.cookie',
];
function createLogger(env) {
    return (0, pino_1.default)({
        name: 'legatrixon-bare-act-mentor',
        level: env.LOG_LEVEL,
        base: { service: env.OTEL_SERVICE_NAME, environment: env.NODE_ENV },
        redact: { paths: redactPaths, censor: '[REDACTED]' },
        timestamp: pino_1.default.stdTimeFunctions.isoTime,
        messageKey: 'message',
        formatters: { level(label) { return { level: label }; } },
    });
}
function errorToLog(error) {
    if (error instanceof Error)
        return { name: error.name, message: error.message, stack: error.stack };
    return { message: String(error) };
}
//# sourceMappingURL=logger.js.map