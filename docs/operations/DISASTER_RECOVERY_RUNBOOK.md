# Disaster Recovery Runbook

## Recovery objectives

- Student interaction API: restore within 60 minutes.
- Uploaded document metadata and indexed knowledge: restore within 4 hours.
- Historical analytics: restore within 24 hours.

## Backup strategy

### Supabase PostgreSQL

Use Supabase point-in-time recovery for production projects. Keep daily logical exports for 30 days and weekly exports for 12 weeks. The export should include public schema tables, storage metadata, RLS policies, and migration history.

Recommended command from a secured admin workstation:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file="backups/legatrixon-$(date +%F).dump"
```

### Supabase Storage

Mirror private document buckets to encrypted object storage daily. Preserve object paths, metadata, checksums, and document version IDs. Validate backup integrity by comparing recorded checksums with restored bytes.

### Configuration

Keep environment configuration in the deployment secret manager. Export encrypted configuration snapshots after each production change and store them with release artifacts.

## Restore procedure

1. Freeze writes by enabling `MAINTENANCE_MODE=true`.
2. Restore PostgreSQL into a new database instance.
3. Apply migrations newer than the backup timestamp.
4. Restore Supabase Storage objects and verify checksums.
5. Point staging at the restored database and run `/health/ready`.
6. Run smoke tests: login, lesson load, chat stream, draft review, document upload, admin dashboard.
7. Promote restored configuration to production.
8. Disable maintenance mode after readiness and smoke tests pass.

## Rollback procedure

1. Identify the last healthy image tag from GitHub Packages or deployment history.
2. Deploy the previous backend and frontend image tags.
3. Keep database schema forward-compatible. If rollback requires data changes, restore from the pre-deployment snapshot into a replacement database.
4. Confirm `/health/live`, `/health/ready`, and the Grafana API latency panels are healthy.
5. Record the rollback in `audit_logs` with release ID, operator, reason, and affected services.