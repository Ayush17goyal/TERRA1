import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

function fail(message) {
  console.error(`[release-hygiene] ${message}`);
  process.exitCode = 1;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

try {
  const status = git(['status', '--porcelain']);
  if (status) fail('Working tree is dirty. Release builds must be created from a clean commit.');
} catch (error) {
  fail(`Unable to inspect git status: ${error.message}`);
}

const requiredFiles = [
  'server/src/app.module.ts',
  'server/src/hardening/config/environment.ts',
  'supabase/migrations/202607100001_bare_act_mentor_performance_indexes.sql',
  'Dockerfile',
  'docker-compose.production.yml',
  'infra/nginx/default.conf',
];
for (const file of requiredFiles) {
  if (!existsSync(file)) fail(`Missing required production artifact: ${file}`);
}

const appModule = readFileSync('server/src/app.module.ts', 'utf8');
if (/synchronize:\s*true/.test(appModule)) fail('TypeORM synchronize:true is forbidden in production application configuration.');
if (!/migrationsRun:\s*isProduction/.test(appModule)) fail('Production database startup must run migrations or fail.');

const envConfig = readFileSync('server/src/hardening/config/environment.ts', 'utf8');
for (const required of ['DATABASE_URL', 'CLIENT_ORIGINS', 'OPENAI_API_KEY', 'CLERK_SECRET_KEY', 'VIRUS_SCAN_MODE']) {
  if (!envConfig.includes(required)) fail(`Environment schema does not validate ${required}.`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log('[release-hygiene] Production release hygiene checks passed.');