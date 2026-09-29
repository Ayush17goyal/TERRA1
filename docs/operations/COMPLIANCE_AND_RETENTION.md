# Compliance and Retention

## PII handling

Student data includes identity, email, learning progress, drafts, uploaded documents, AI interactions, mastery state, and assessment history. Treat all of it as confidential educational data.

## Data minimization

- Logs must not contain raw prompts, full drafts, uploaded document text, bearer tokens, refresh tokens, service keys, or cookies.
- Store only the metadata required for troubleshooting, safety validation, progress tracking, billing, and auditability.
- Use signed URLs for private document access and expire them quickly.

## Retention defaults

- Student records: retain while account is active and for the configured contractual/legal period after deletion request.
- AI interaction metadata: `DATA_RETENTION_DAYS`, default 365 days.
- Audit logs: `AUDIT_RETENTION_DAYS`, default 730 days.
- Application logs: `LOG_RETENTION_DAYS`, default 90 days.
- Backups: daily 30 days, weekly 12 weeks unless a stricter institutional policy applies.

## Access control review

Review admin and instructor roles monthly. Verify Supabase RLS policies whenever schema migrations modify student, draft, document, assessment, audit, or analytics tables.

## Incident response

1. Rotate affected secrets.
2. Enable maintenance mode if student data may be at risk.
3. Export relevant audit logs and security metrics.
4. Identify affected accounts and documents.
5. Patch and deploy using the zero-downtime path.
6. Notify impacted users under the platform's legal obligations.