"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSentry = initializeSentry;
exports.initializeOpenTelemetry = initializeOpenTelemetry;
exports.shutdownTelemetry = shutdownTelemetry;
exports.reportError = reportError;
const Sentry = require("@sentry/node");
const sdk_node_1 = require("@opentelemetry/sdk-node");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
let sdk = null;
function initializeSentry(env, logger) {
    if (!env.SENTRY_DSN)
        return;
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
function initializeOpenTelemetry(env, logger) {
    if (!env.OTEL_EXPORTER_OTLP_ENDPOINT)
        return;
    sdk = new sdk_node_1.NodeSDK({
        serviceName: env.OTEL_SERVICE_NAME,
        traceExporter: new exporter_trace_otlp_http_1.OTLPTraceExporter({ url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/+$/, '')}/v1/traces` }),
        instrumentations: [(0, auto_instrumentations_node_1.getNodeAutoInstrumentations)()],
    });
    sdk.start();
    logger.info({ endpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT }, 'OpenTelemetry initialized');
}
async function shutdownTelemetry(logger) {
    if (!sdk)
        return;
    try {
        await sdk.shutdown();
        logger.info('OpenTelemetry shutdown complete');
    }
    catch (error) {
        logger.warn({ error }, 'OpenTelemetry shutdown failed');
    }
}
function reportError(error, context) {
    Sentry.withScope((scope) => {
        if (context)
            Object.entries(context).forEach(([key, value]) => scope.setContext(key, value));
        Sentry.captureException(error);
    });
}
//# sourceMappingURL=telemetry.js.map