import * as Sentry from '@sentry/node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import type { RuntimeEnvironment } from '../config/environment';
import type { AppLogger } from '../logging/logger';

let sdk: NodeSDK | null = null;

export function initializeSentry(env: RuntimeEnvironment, logger: AppLogger) {
  if (!env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });
  logger.info('Sentry initialized');
}

export function initializeOpenTelemetry(env: RuntimeEnvironment, logger: AppLogger) {
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) return;
  sdk = new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME,
    traceExporter: new OTLPTraceExporter({ url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/+$/, '')}/v1/traces` }),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  sdk.start();
  logger.info({ endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT }, 'OpenTelemetry initialized');
}

export async function shutdownTelemetry(logger: AppLogger) {
  if (!sdk) return;
  try { await sdk.shutdown(); logger.info('OpenTelemetry shutdown complete'); }
  catch (error) { logger.warn({ error }, 'OpenTelemetry shutdown failed'); }
}

export function reportError(error: unknown, context?: Record<string, unknown>) {
  Sentry.withScope((scope) => {
    if (context) Object.entries(context).forEach(([key, value]) => scope.setContext(key, value as any));
    Sentry.captureException(error);
  });
}