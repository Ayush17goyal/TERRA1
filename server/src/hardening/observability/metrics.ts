import * as client from 'prom-client';
import type { NextFunction, Request, Response } from 'express';

client.collectDefaultMetrics({ prefix: 'legatrixon_' });
export const httpRequestDuration = new client.Histogram({ name: 'legatrixon_http_request_duration_seconds', help: 'HTTP request latency by method, route, and status.', labelNames: ['method', 'route', 'status'] as const, buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30] });
export const workflowLatency = new client.Histogram({ name: 'legatrixon_workflow_latency_seconds', help: 'Mentor workflow latency.', labelNames: ['stage'] as const, buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 15, 30, 60] });
export const llmLatency = new client.Histogram({ name: 'legatrixon_llm_latency_seconds', help: 'LLM call latency.', labelNames: ['model', 'intent'] as const, buckets: [0.25, 0.5, 1, 2, 5, 10, 30, 60] });
export const retrievalLatency = new client.Histogram({ name: 'legatrixon_retrieval_latency_seconds', help: 'Knowledge retrieval latency.', labelNames: ['intent'] as const, buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5] });
export const validationLatency = new client.Histogram({ name: 'legatrixon_validation_latency_seconds', help: 'Educational response validation latency.', labelNames: ['decision'] as const, buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1] });
export const queueDepth = new client.Gauge({ name: 'legatrixon_queue_depth', help: 'Queue depth by queue name.', labelNames: ['queue'] as const });
export const queueFailures = new client.Counter({ name: 'legatrixon_queue_failures_total', help: 'Queue failures by queue name.', labelNames: ['queue'] as const });
export const cacheHitRate = new client.Counter({ name: 'legatrixon_cache_events_total', help: 'Cache hit/miss events.', labelNames: ['cache', 'result'] as const });
export const documentIndexing = new client.Counter({ name: 'legatrixon_document_indexing_total', help: 'Document indexing events.', labelNames: ['document_type', 'status'] as const });
export const embeddingGeneration = new client.Histogram({ name: 'legatrixon_embedding_generation_seconds', help: 'Embedding generation latency.', labelNames: ['model'] as const, buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10] });
export const studentInteractions = new client.Counter({ name: 'legatrixon_student_interactions_total', help: 'Student interaction events.', labelNames: ['intent', 'mode'] as const });
export const masteryUpdates = new client.Counter({ name: 'legatrixon_mastery_updates_total', help: 'Mastery update events.', labelNames: ['skill', 'direction'] as const });
export const securityEvents = new client.Counter({ name: 'legatrixon_security_events_total', help: 'Security events by type and severity.', labelNames: ['type', 'severity'] as const });
export const promptAssemblyLatency = new client.Histogram({ name: 'legatrixon_prompt_assembly_latency_seconds', help: 'Prompt assembly latency.', labelNames: ['intent', 'strategy'] as const, buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1] });
export const llmTokenUsage = new client.Histogram({ name: 'legatrixon_llm_token_usage_total', help: 'LLM token usage by category.', labelNames: ['model', 'category'] as const, buckets: [100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000] });
export const llmEstimatedCost = new client.Counter({ name: 'legatrixon_llm_estimated_cost_usd_total', help: 'Estimated LLM cost in USD.', labelNames: ['model', 'intent'] as const });
export const slowOperations = new client.Counter({ name: 'legatrixon_slow_operations_total', help: 'Operations exceeding configured latency budgets.', labelNames: ['operation', 'budget'] as const });

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    const route = (req.route?.path && typeof req.route.path === 'string') ? req.route.path : req.path.replace(/[0-9a-f-]{24,}/gi, ':id');
    httpRequestDuration.labels(req.method, route, String(res.statusCode)).observe(seconds);
  });
  next();
}
export async function renderMetrics() { return client.register.metrics(); }
export function metricsContentType() { return client.register.contentType; }