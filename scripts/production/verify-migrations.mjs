import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationDir = 'supabase/migrations';
const files = readdirSync(migrationDir).filter((file) => file.endsWith('.sql')).sort();
if (!files.length) {
  console.error('[migration-validation] No Supabase migrations found.');
  process.exit(1);
}

const duplicateIds = files.map((file) => file.split('_')[0]).filter((id, index, ids) => ids.indexOf(id) !== index);
if (duplicateIds.length) {
  console.error(`[migration-validation] Duplicate migration ids: ${Array.from(new Set(duplicateIds)).join(', ')}`);
  process.exit(1);
}

const forbiddenPatterns = [
  /enable all actions for all users/i,
  /disable row level security/i,
];
const allowlist = new Set([
  '202606150003_enable_academic_navigator_rls.sql',
  '202606120002_user_profiles_system.sql',
  '202606120003_user_data_sync_system.sql',
  '202606120004_analytics_and_exports_system.sql',
  '202606120005_feedback_support_system.sql',
  '202606150002_academic_navigator_direct_sync_policies.sql',
  '202606150001_export_center_upgrade.sql',
  '202607010001_razorpay_payments.sql',
]);

for (const file of files) {
  const content = readFileSync(join(migrationDir, file), 'utf8');
  if (!allowlist.has(file)) {
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        console.error(`[migration-validation] Forbidden policy pattern in ${file}: ${pattern}`);
        process.exit(1);
      }
    }
  }
}

const performanceMigration = readFileSync(join(migrationDir, '202607100001_bare_act_mentor_performance_indexes.sql'), 'utf8');
for (const required of ['idx_mentor_interactions_student_created', 'idx_knowledge_chunks_embedding_hnsw', 'idx_document_chunks_embedding_hnsw']) {
  if (!performanceMigration.includes(required)) {
    console.error(`[migration-validation] Missing required production index: ${required}`);
    process.exit(1);
  }
}

console.log(`[migration-validation] ${files.length} migrations validated.`);