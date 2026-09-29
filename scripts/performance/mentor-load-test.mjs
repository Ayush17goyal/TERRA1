#!/usr/bin/env node
import { performance } from 'node:perf_hooks';

const baseUrl = process.env.LOAD_TEST_BASE_URL || 'http://localhost:3000';
const token = process.env.LOAD_TEST_AUTH_TOKEN || '';
const scenario = process.argv[2] || 'smoke';

const scenarios = {
  smoke: { users: 10, durationMs: 15_000, mix: ['health', 'chat'] },
  students100: { users: 100, durationMs: 60_000, mix: ['chat', 'lesson', 'draftReview'] },
  students500: { users: 500, durationMs: 120_000, mix: ['chat', 'lesson', 'draftReview', 'progress'] },
  students1000: { users: 1000, durationMs: 180_000, mix: ['chat', 'lesson', 'draftReview', 'progress'] },
  uploads: { users: 100, durationMs: 90_000, mix: ['upload'] },
  indexing: { users: 50, durationMs: 120_000, mix: ['upload', 'bareActAnalysis'] },
  capstone: { users: 100, durationMs: 90_000, mix: ['capstone'] },
  streaming: { users: 300, durationMs: 90_000, mix: ['streamingChat'] },
};

const selected = scenarios[scenario];
if (!selected) {
  console.error(`Unknown scenario "${scenario}". Available: ${Object.keys(scenarios).join(', ')}`);
  process.exit(1);
}

const metrics = [];
const failures = [];

function headers(extra = {}) {
  return {
    'content-type': 'application/json',
    'x-correlation-id': `load-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function call(name, method, path, body, extraHeaders) {
  const start = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: headers(extraHeaders), body: body ? JSON.stringify(body) : undefined });
    await response.arrayBuffer();
    const latency = performance.now() - start;
    metrics.push({ name, status: response.status, latency });
    if (response.status >= 500) failures.push({ name, status: response.status, latency });
  } catch (error) {
    const latency = performance.now() - start;
    metrics.push({ name, status: 0, latency });
    failures.push({ name, status: 0, latency, error: error.message });
  }
}


async function callRaw(name, method, path, rawBody, extraHeaders) {
  const start = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: headers(extraHeaders), body: rawBody });
    await response.arrayBuffer();
    const latency = performance.now() - start;
    metrics.push({ name, status: response.status, latency });
    if (response.status >= 500) failures.push({ name, status: response.status, latency });
  } catch (error) {
    const latency = performance.now() - start;
    metrics.push({ name, status: 0, latency });
    failures.push({ name, status: 0, latency, error: error.message });
  }
}
const actions = {
  health: () => call('health', 'GET', '/health/ready'),
  chat: (id) => call('chat', 'POST', '/api/v1/chat', { message: `Explain commencement clauses for learner ${id}`, conversationId: `load-${id}` }),
  streamingChat: (id) => call('streamingChat', 'POST', '/api/v1/chat/stream', { message: `Give me a hint about definitions for learner ${id}`, conversationId: `stream-${id}` }),
  draftReview: (id) => call('draftReview', 'POST', '/api/v1/draft/review', { draftId: `load-draft-${id}`, text: '1. Short title. This Act may be called the Student Practice Act.' }),
  lesson: (id) => call('lesson', 'POST', '/api/v1/lesson/start', { lessonId: `lesson-${(id % 10) + 1}` }),
  progress: () => call('progress', 'GET', '/api/v1/student/progress'),
  bareActAnalysis: () => call('bareActAnalysis', 'POST', '/api/v1/bare-act/analyse', { documentId: 'load-bare-act', focus: 'structure' }),
  capstone: (id) => call('capstone', 'POST', '/api/v1/capstone/review', { projectId: `capstone-${id}`, reviewDepth: 'qa' }),
  upload: async (id) => {
    const boundary = `----legatrixon${Date.now()}${id}`;
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="load-${id}.txt"\r\nContent-Type: text/plain\r\n\r\nAn Act to test upload performance. Section 1. Short title.\r\n--${boundary}--\r\n`;
    await call('upload', 'POST', '/api/v1/documents/upload', null, { 'content-type': `multipart/form-data; boundary=${boundary}` });
  },
};

async function worker(id, deadline) {
  let index = 0;
  while (performance.now() < deadline) {
    const action = selected.mix[index % selected.mix.length];
    await actions[action](id);
    index += 1;
  }
}

const start = performance.now();
const deadline = start + selected.durationMs;
await Promise.all(Array.from({ length: selected.users }, (_, id) => worker(id + 1, deadline)));

const total = metrics.length;
const sorted = metrics.map((item) => item.latency).sort((a, b) => a - b);
const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0;
const byStatus = metrics.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {});
const elapsedSeconds = (performance.now() - start) / 1000;

console.log(JSON.stringify({
  scenario,
  baseUrl,
  users: selected.users,
  totalRequests: total,
  throughputRps: Number((total / elapsedSeconds).toFixed(2)),
  failureRate: Number((failures.length / Math.max(1, total)).toFixed(4)),
  latencyMs: { p50: Math.round(percentile(0.5)), p95: Math.round(percentile(0.95)), p99: Math.round(percentile(0.99)), max: Math.round(sorted.at(-1) || 0) },
  statuses: byStatus,
  failures: failures.slice(0, 20),
}, null, 2));

if (failures.length / Math.max(1, total) > Number(process.env.LOAD_TEST_MAX_FAILURE_RATE || 0.05)) process.exit(1);