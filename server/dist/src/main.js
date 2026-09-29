"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const helmet_1 = require("helmet");
const pino_http_1 = require("pino-http");
const compression = require("compression");
const dotenv = require("dotenv");
const app_module_1 = require("./app.module");
const environment_1 = require("./hardening/config/environment");
const logger_1 = require("./hardening/logging/logger");
const correlation_middleware_1 = require("./hardening/security/correlation.middleware");
const rate_limit_middleware_1 = require("./hardening/security/rate-limit.middleware");
const request_security_middleware_1 = require("./hardening/security/request-security.middleware");
const metrics_1 = require("./hardening/observability/metrics");
const telemetry_1 = require("./hardening/observability/telemetry");
const global_exception_filter_1 = require("./hardening/errors/global-exception.filter");
dotenv.config();
async function bootstrap() {
    const env = (0, environment_1.loadEnvironment)();
    const logger = (0, logger_1.createLogger)(env);
    (0, telemetry_1.initializeOpenTelemetry)(env, logger);
    (0, telemetry_1.initializeSentry)(env, logger);
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        rawBody: true,
        bufferLogs: true,
        logger: ['error', 'warn', 'log'],
    });
    app.use(correlation_middleware_1.correlationMiddleware);
    app.use(compression({ threshold: 1024 }));
    app.use(metrics_1.metricsMiddleware);
    app.use((0, pino_http_1.default)({
        logger,
        genReqId: (req) => req.correlationId,
        customProps: (req) => ({ correlationId: req.correlationId, userId: req.user?.id }),
        customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
        customErrorMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
        serializers: {
            req(req) { return { id: req.id, method: req.method, url: req.url, remoteAddress: req.remoteAddress }; },
            res(res) { return { statusCode: res.statusCode }; },
        },
    }));
    app.use((0, helmet_1.default)({
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: {
            reportOnly: env.SECURITY_REPORT_ONLY_CSP,
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
                imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
                fontSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'", 'https:', 'wss:'],
                frameAncestors: ["'none'"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
            },
        },
        hsts: env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }));
    app.use((req, res, next) => {
        req.setTimeout(env.REQUEST_TIMEOUT_MS);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
        const originalJson = res.json;
        res.json = function (body) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return originalJson.call(this, body);
        };
        next();
    });
    app.use((0, request_security_middleware_1.createRequestSecurityMiddleware)(env, logger));
    app.use((0, rate_limit_middleware_1.createRateLimitMiddleware)(env, logger));
    app.setGlobalPrefix('api/v1', {
        exclude: ['api/security/test-email', 'health', 'api/health', 'health/live', 'health/ready', 'metrics'],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new global_exception_filter_1.GlobalExceptionFilter(logger));
    app.enableShutdownHooks();
    const corsOrigins = (0, environment_1.resolveClientOrigins)(env);
    app.enableCors({
        origin: corsOrigins,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
        maxAge: 3600,
    });
    const shutdown = async (signal) => {
        logger.info({ signal }, 'Graceful shutdown started');
        const timer = setTimeout(() => {
            logger.error({ signal }, 'Graceful shutdown timed out');
            process.exit(1);
        }, env.SHUTDOWN_TIMEOUT_MS);
        try {
            await app.close();
            await (0, telemetry_1.shutdownTelemetry)(logger);
            clearTimeout(timer);
            logger.info({ signal }, 'Graceful shutdown completed');
            process.exit(0);
        }
        catch (error) {
            clearTimeout(timer);
            logger.error({ signal, error: (0, logger_1.errorToLog)(error) }, 'Graceful shutdown failed');
            process.exit(1);
        }
    };
    process.once('SIGTERM', () => void shutdown('SIGTERM'));
    process.once('SIGINT', () => void shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => logger.error({ error: (0, logger_1.errorToLog)(reason) }, 'Unhandled promise rejection'));
    process.on('uncaughtException', (error) => {
        logger.fatal({ error: (0, logger_1.errorToLog)(error) }, 'Uncaught exception');
        process.exit(1);
    });
    await app.listen(env.PORT, '0.0.0.0');
    logger.info({ port: env.PORT, environment: env.NODE_ENV, corsOrigins }, 'LEGATRIXON NestJS Engine started');
}
bootstrap().catch((error) => {
    console.error('LEGATRIXON startup failed', (0, logger_1.errorToLog)(error));
    process.exit(1);
});
//# sourceMappingURL=main.js.map