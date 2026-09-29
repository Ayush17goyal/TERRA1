"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slowOperations = exports.llmEstimatedCost = exports.llmTokenUsage = exports.promptAssemblyLatency = exports.securityEvents = exports.masteryUpdates = exports.studentInteractions = exports.embeddingGeneration = exports.documentIndexing = exports.cacheHitRate = exports.queueFailures = exports.queueDepth = exports.validationLatency = exports.retrievalLatency = exports.llmLatency = exports.workflowLatency = exports.httpRequestDuration = void 0;
exports.metricsMiddleware = metricsMiddleware;
exports.renderMetrics = renderMetrics;
exports.metricsContentType = metricsContentType;
const client = require("prom-client");
client.collectDefaultMetrics({ prefix: 'legatrixon_' });
exports.httpRequestDuration = new client.Histogram({ name: 'legatrixon_http_request_duration_seconds', help: 'HTTP request latency by method, route, and status.', labelNames: ['method', 'route', 'status'], buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30] });
exports.workflowLatency = new client.Histogram({ name: 'legatrixon_workflow_latency_seconds', help: 'Mentor workflow latency.', labelNames: ['stage'], buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 15, 30, 60] });
exports.llmLatency = new client.Histogram({ name: 'legatrixon_llm_latency_seconds', help: 'LLM call latency.', labelNames: ['model', 'intent'], buckets: [0.25, 0.5, 1, 2, 5, 10, 30, 60] });
exports.retrievalLatency = new client.Histogram({ name: 'legatrixon_retrieval_latency_seconds', help: 'Knowledge retrieval latency.', labelNames: ['intent'], buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5] });
exports.validationLatency = new client.Histogram({ name: 'legatrixon_validation_latency_seconds', help: 'Educational response validation latency.', labelNames: ['decision'], buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1] });
exports.queueDepth = new client.Gauge({ name: 'legatrixon_queue_depth', help: 'Queue depth by queue name.', labelNames: ['queue'] });
exports.queueFailures = new client.Counter({ name: 'legatrixon_queue_failures_total', help: 'Queue failures by queue name.', labelNames: ['queue'] });
exports.cacheHitRate = new client.Counter({ name: 'legatrixon_cache_events_total', help: 'Cache hit/miss events.', labelNames: ['cache', 'result'] });
exports.documentIndexing = new client.Counter({ name: 'legatrixon_document_indexing_total', help: 'Document indexing events.', labelNames: ['document_type', 'status'] });
exports.embeddingGeneration = new client.Histogram({ name: 'legatrixon_embedding_generation_seconds', help: 'Embedding generation latency.', labelNames: ['model'], buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10] });
exports.studentInteractions = new client.Counter({ name: 'legatrixon_student_interactions_total', help: 'Student interaction events.', labelNames: ['intent', 'mode'] });
exports.masteryUpdates = new client.Counter({ name: 'legatrixon_mastery_updates_total', help: 'Mastery update events.', labelNames: ['skill', 'direction'] });
exports.securityEvents = new client.Counter({ name: 'legatrixon_security_events_total', help: 'Security events by type and severity.', labelNames: ['type', 'severity'] });
exports.promptAssemblyLatency = new client.Histogram({ name: 'legatrixon_prompt_assembly_latency_seconds', help: 'Prompt assembly latency.', labelNames: ['intent', 'strategy'], buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1] });
exports.llmTokenUsage = new client.Histogram({ name: 'legatrixon_llm_token_usage_total', help: 'LLM token usage by category.', labelNames: ['model', 'category'], buckets: [100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000] });
exports.llmEstimatedCost = new client.Counter({ name: 'legatrixon_llm_estimated_cost_usd_total', help: 'Estimated LLM cost in USD.', labelNames: ['model', 'intent'] });
exports.slowOperations = new client.Counter({ name: 'legatrixon_slow_operations_total', help: 'Operations exceeding configured latency budgets.', labelNames: ['operation', 'budget'] });
function metricsMiddleware(req, res, next) {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
        const seconds = Number(process.hrtime.bigint() - start) / 1e9;
        const route = (req.route?.path && typeof req.route.path === 'string') ? req.route.path : req.path.replace(/[0-9a-f-]{24,}/gi, ':id');
        exports.httpRequestDuration.labels(req.method, route, String(res.statusCode)).observe(seconds);
    });
    next();
}
async function renderMetrics() { return client.register.metrics(); }
function metricsContentType() { return client.register.contentType; }
//# sourceMappingURL=metrics.js.map