import type { NextFunction, Request, Response } from 'express';
import type { RuntimeEnvironment } from '../config/environment';
import type { AppLogger } from '../logging/logger';
import { securityEvents } from '../observability/metrics';

const promptInjectionPatterns = [/ignore\s+(all\s+)?previous\s+instructions/i, /disregard\s+(the\s+)?system\s+prompt/i, /reveal\s+(your\s+)?(system|developer)\s+(prompt|instructions)/i, /print\s+(the\s+)?hidden\s+prompt/i, /you\s+are\s+now\s+(?:dan|developer|system)/i];
const dangerousUploadNames = [/\.exe$/i, /\.bat$/i, /\.cmd$/i, /\.ps1$/i, /\.sh$/i, /\.js$/i, /\.mjs$/i, /\.vbs$/i, /\.scr$/i];
const allowedUploadMime = new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown', 'application/octet-stream']);

export function createRequestSecurityMiddleware(env: RuntimeEnvironment, logger: AppLogger) {
  return (req: Request & { correlationId?: string }, res: Response, next: NextFunction) => {
    if (env.MAINTENANCE_MODE && !req.path.startsWith('/health')) {
      res.status(503).json({ error: 'MAINTENANCE_MODE', message: 'LEGATRIXON is temporarily in maintenance mode.', correlationId: req.correlationId });
      return;
    }

    const contentLength = Number(req.header('content-length') || 0);
    if (contentLength > env.MAX_UPLOAD_BYTES && /upload|documents|ingestion/i.test(req.path)) {
      securityEvents.labels('upload_size', 'warning').inc();
      logger.warn({ correlationId: req.correlationId, path: req.path, contentLength }, 'Upload rejected because content length exceeds configured maximum');
      res.status(413).json({ error: 'UPLOAD_TOO_LARGE', message: 'The uploaded file is larger than the allowed limit.', correlationId: req.correlationId });
      return;
    }

    if (/upload|documents|ingestion/i.test(req.path) && req.method !== 'GET' && req.method !== 'HEAD') {
      const contentType = String(req.header('content-type') || '').split(';')[0].toLowerCase();
      const originalName = String(req.header('x-file-name') || req.query.filename || '');
      if (originalName && dangerousUploadNames.some((pattern) => pattern.test(originalName))) {
        securityEvents.labels('unsafe_upload_name', 'error').inc();
        logger.warn({ correlationId: req.correlationId, originalName }, 'Dangerous upload filename rejected');
        res.status(400).json({ error: 'UNSAFE_UPLOAD_NAME', message: 'This file type is not accepted for legal document processing.', correlationId: req.correlationId });
        return;
      }
      if (contentType && contentType !== 'multipart/form-data' && !allowedUploadMime.has(contentType)) {
        securityEvents.labels('unsafe_upload_mime', 'error').inc();
        logger.warn({ correlationId: req.correlationId, contentType }, 'Upload rejected because MIME type is not allowed');
        res.status(415).json({ error: 'UNSUPPORTED_UPLOAD_TYPE', message: 'Only PDF, DOCX, TXT, and Markdown files are accepted.', correlationId: req.correlationId });
        return;
      }
      if (env.VIRUS_SCAN_MODE === 'required' && !env.VIRUS_SCAN_COMMAND) {
        securityEvents.labels('virus_scan_unavailable', 'error').inc();
        res.status(503).json({ error: 'VIRUS_SCAN_UNAVAILABLE', message: 'Document scanning is temporarily unavailable.', correlationId: req.correlationId });
        return;
      }
    }

    const serializedBody = typeof req.body === 'string' ? req.body : req.body ? JSON.stringify(req.body).slice(0, 12000) : '';
    if (serializedBody && promptInjectionPatterns.some((pattern) => pattern.test(serializedBody))) {
      securityEvents.labels('prompt_injection_signal', 'warning').inc();
      logger.warn({ correlationId: req.correlationId, path: req.path }, 'Prompt injection pattern detected');
      res.setHeader('x-legatrixon-prompt-injection-check', 'flagged');
    }
    next();
  };
}