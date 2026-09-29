import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import * as compression from 'compression';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';
import { loadEnvironment, resolveClientOrigins } from './hardening/config/environment';
import { createLogger, errorToLog } from './hardening/logging/logger';
import { correlationMiddleware } from './hardening/security/correlation.middleware';
import { createRateLimitMiddleware } from './hardening/security/rate-limit.middleware';
import { createRequestSecurityMiddleware } from './hardening/security/request-security.middleware';
import { metricsMiddleware } from './hardening/observability/metrics';
import { initializeOpenTelemetry, initializeSentry, shutdownTelemetry } from './hardening/observability/telemetry';
import { GlobalExceptionFilter } from './hardening/errors/global-exception.filter';

dotenv.config();

async function bootstrap() {
  const env = loadEnvironment();
  const logger = createLogger(env);
  initializeOpenTelemetry(env, logger);
  initializeSentry(env, logger);

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bufferLogs: true,
    logger: ['error', 'warn', 'log'],
  });

  app.use(correlationMiddleware);
  app.use(compression({ threshold: 1024 }));
  app.use(metricsMiddleware);
  app.use(pinoHttp({
    logger,
    genReqId: (req: any) => req.correlationId,
    customProps: (req: any) => ({ correlationId: req.correlationId, userId: req.user?.id }),
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    serializers: {
      req(req) { return { id: req.id, method: req.method, url: req.url, remoteAddress: req.remoteAddress }; },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }));

  app.use(helmet({
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
    res.json = function (body: any) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return originalJson.call(this, body);
    };
    next();
  });

  app.use(createRequestSecurityMiddleware(env, logger));
  app.use(createRateLimitMiddleware(env, logger));

  app.setGlobalPrefix('api/v1', {
    exclude: ['api/security/test-email', 'health', 'api/health', 'health/live', 'health/ready', 'metrics'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.enableShutdownHooks();

  const corsOrigins = resolveClientOrigins(env);
  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    maxAge: 3600,
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Graceful shutdown started');
    const timer = setTimeout(() => {
      logger.error({ signal }, 'Graceful shutdown timed out');
      process.exit(1);
    }, env.SHUTDOWN_TIMEOUT_MS);
    try {
      await app.close();
      await shutdownTelemetry(logger);
      clearTimeout(timer);
      logger.info({ signal }, 'Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      clearTimeout(timer);
      logger.error({ signal, error: errorToLog(error) }, 'Graceful shutdown failed');
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ error: errorToLog(reason) }, 'Unhandled promise rejection'));
  process.on('uncaughtException', (error) => {
    logger.fatal({ error: errorToLog(error) }, 'Uncaught exception');
    process.exit(1);
  });

  await app.listen(env.PORT, '0.0.0.0');
  logger.info({ port: env.PORT, environment: env.NODE_ENV, corsOrigins }, 'LEGATRIXON NestJS Engine started');
}

bootstrap().catch((error) => {
  console.error('LEGATRIXON startup failed', errorToLog(error));
  process.exit(1);
});