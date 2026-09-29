import { API_BASE_URL } from '../../../lib/api';
import { supabase } from '../../../lib/supabase-client';
import { makeCurriculum } from '../../learning/utils/learningData';
import type { AdminDashboardData, AdminNotification, AdminRole, AdminSettings, AuditLogRecord, BareActAdminRecord, CurriculumAdminLesson, CurriculumAdminModule, PatternAdminRecord, QueueRecord, RoleAssignment } from '../types/admin.types';

const todayIso = new Date().toISOString().slice(0, 10);
const queueNames = ['EmbeddingQueue', 'DocumentIndexQueue', 'MasteryUpdateQueue', 'AnalyticsQueue', 'TelemetryQueue', 'NotificationQueue', 'PromptLogQueue', 'RetryQueue', 'DeadLetterQueue'];

async function safeSelect<T>(table: string, query: string, limit = 1000): Promise<{ rows: T[]; unavailable?: string }> {
  const { data, error } = await supabase.from(table).select(query).limit(limit);
  if (error) return { rows: [], unavailable: `${table}: ${error.message}` };
  return { rows: (data ?? []) as T[] };
}

function countToday(rows: Array<Record<string, any>>, keys = ['created_at', 'createdAt', 'updated_at', 'updatedAt']) {
  return rows.filter((row) => keys.some((key) => String(row[key] ?? '').startsWith(todayIso))).length;
}

function numberAverage(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function splitLines(value?: string) {
  return String(value ?? '').split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

async function audit(action: string, target: string, severity: AuditLogRecord['severity'] = 'info') {
  const access = await adminApi.getAccess();
  await supabase.from('mentor_admin_audit_logs').insert({ actor: access.email ?? access.userId ?? 'unknown-admin', action, target, severity, created_at: new Date().toISOString() });
}

export const adminApi = {
  async getAccess() {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    const rawRoles = [user?.app_metadata?.role, user?.app_metadata?.roles, user?.user_metadata?.role, user?.user_metadata?.roles].flat().filter(Boolean).map(String);
    const roles = rawRoles.map((role) => role.toLowerCase()).filter((role): role is AdminRole => ['admin', 'instructor', 'student'].includes(role));
    return { userId: user?.id, email: user?.email, roles: roles.length ? roles : ['unknown' as const], allowed: roles.includes('admin') || roles.includes('instructor'), source: user ? 'supabase' as const : 'none' as const };
  },

  async getDashboard(): Promise<AdminDashboardData> {
    const unavailableSources: string[] = [];
    const users = await safeSelect<Record<string, any>>('users', '*');
    const profiles = await safeSelect<Record<string, any>>('user_profiles', '*');
    const turns = await safeSelect<Record<string, any>>('lexmentor_turns', '*');
    const sessions = await safeSelect<Record<string, any>>('lexmentor_sessions', '*');
    const analytics = await safeSelect<Record<string, any>>('lexmentor_analytics', '*');
    const knowledge = await safeSelect<Record<string, any>>('mentor_knowledge_chunks', '*', 2000);
    const telemetry = await safeSelect<Record<string, any>>('mentor_telemetry_events', '*');
    const mastery = await safeSelect<Record<string, any>>('mentor_mastery_updates', '*');
    const weakness = await safeSelect<Record<string, any>>('mentor_weakness_updates', '*');
    const revisions = await safeSelect<Record<string, any>>('mentor_revision_schedule', '*');
    const prompts = await safeSelect<Record<string, any>>('mentor_prompt_log_cleanup', '*');
    const dead = await safeSelect<Record<string, any>>('mentor_dead_letter_jobs', '*');
    const notifications = await safeSelect<Record<string, any>>('mentor_notifications', '*');
    const auditRows = await safeSelect<Record<string, any>>('mentor_admin_audit_logs', '*');
    [users, profiles, turns, sessions, analytics, knowledge, telemetry, mastery, weakness, revisions, prompts, dead, notifications, auditRows].forEach((result) => { if (result.unavailable) unavailableSources.push(result.unavailable); });

    const userRows = users.rows.length ? users.rows : profiles.rows;
    const studentRows = userRows.filter((row) => String(row.role ?? row.user_role ?? row.app_role ?? 'student').toLowerCase() !== 'admin');
    const students = studentRows.map((row, index) => {
      const id = String(row.id ?? row.user_id ?? row.userId ?? `student-${index}`);
      const studentTurns = turns.rows.filter((turn) => String(turn.user_id ?? turn.student_id ?? turn.session_id ?? '').includes(id));
      const masteryRows = mastery.rows.filter((item) => JSON.stringify(item).includes(id));
      const weaknessRows = weakness.rows.filter((item) => JSON.stringify(item).includes(id));
      return {
        id,
        name: String(row.full_name ?? row.name ?? row.display_name ?? row.email ?? 'Student'),
        email: String(row.email ?? row.user_email ?? 'unregistered'),
        role: 'student' as AdminRole,
        status: row.archived ? 'archived' as const : countToday([row]) ? 'active' as const : 'inactive' as const,
        mastery: numberAverage(masteryRows.map((item) => Number(item.mastery_score ?? item.score ?? item.payload?.score ?? 0)).filter(Boolean)),
        weaknessCount: weaknessRows.length,
        lessonsCompleted: Number(row.lessons_completed ?? row.completed_lessons ?? 0),
        assessmentsCompleted: Number(row.assessments_completed ?? 0),
        aiInteractions: studentTurns.length,
        lastActiveAt: String(row.last_active_at ?? row.updated_at ?? row.created_at ?? ''),
      };
    });

    const localModules = makeCurriculum();
    const modules: CurriculumAdminModule[] = localModules.map((module) => ({ id: module.id, title: module.title, description: module.description, order: module.order, status: module.status === 'completed' || module.status === 'available' ? 'published' : 'unpublished', lessonCount: module.lessons.length, prerequisites: module.prerequisites, masteryCriteria: module.lessons.flatMap((lesson) => lesson.completionCriteria).slice(0, 4) }));
    const lessons: CurriculumAdminLesson[] = localModules.flatMap((module) => module.lessons.map((lesson) => ({ id: lesson.id, moduleId: module.id, title: lesson.title, objectives: lesson.objectives, prerequisites: lesson.prerequisites, status: lesson.status === 'locked' ? 'locked' : 'published', estimatedMinutes: lesson.estimatedMinutes })));

    const patterns: PatternAdminRecord[] = knowledge.rows.filter((row) => row.kind === 'pattern').map((row, index) => ({ id: String(row.id), name: String(row.title ?? row.metadata?.patternName ?? `Pattern ${index + 1}`), category: String(row.metadata?.componentType ?? row.metadata?.category ?? 'Legislative drafting'), difficulty: (row.metadata?.difficulty ?? 'intermediate') as PatternAdminRecord['difficulty'], version: Number(row.metadata?.version ?? 1), status: (row.metadata?.status ?? 'published') as PatternAdminRecord['status'], updatedAt: String(row.updated_at ?? row.created_at ?? ''), metadata: row.metadata ?? {}, checklist: Array.isArray(row.metadata?.checklist) ? row.metadata.checklist : [], commonMistakes: Array.isArray(row.metadata?.commonMistakes) ? row.metadata.commonMistakes : [], examples: Array.isArray(row.metadata?.examples) ? row.metadata.examples : [] }));

    const bareActs: BareActAdminRecord[] = unique(knowledge.rows.filter((row) => row.kind === 'bare_act_component').map((row) => String(row.metadata?.documentId ?? row.metadata?.title ?? row.title ?? row.id))).map((docId) => {
      const chunks = knowledge.rows.filter((row) => row.kind === 'bare_act_component' && String(row.metadata?.documentId ?? row.metadata?.title ?? row.title ?? row.id) === docId);
      return { id: docId, title: String(chunks[0]?.metadata?.title ?? chunks[0]?.title ?? docId), jurisdiction: String(chunks[0]?.metadata?.jurisdiction ?? ''), status: 'indexed', chunkCount: chunks.length, embeddingCount: chunks.filter((chunk) => Boolean(chunk.embedding)).length, componentTypes: unique(chunks.map((chunk) => String(chunk.metadata?.componentType ?? chunk.metadata?.component_type ?? chunk.kind))), version: Number(chunks[0]?.metadata?.version ?? 1), uploadedAt: String(chunks[0]?.created_at ?? '') };
    });

    const tokenUsage = analytics.rows.reduce((sum, row) => sum + Number(row.tokens ?? row.total_tokens ?? row.input_tokens ?? 0), 0);
    const cost = analytics.rows.reduce((sum, row) => sum + Number(row.cost ?? row.estimated_cost ?? 0), 0);
    const errors = telemetry.rows.filter((row) => /error|failed|blocking/i.test(JSON.stringify(row))).length + dead.rows.length;
    const queueRecords: QueueRecord[] = queueNames.map((name) => {
      const matching = [telemetry.rows, dead.rows, prompts.rows, notifications.rows].flat().filter((row) => JSON.stringify(row).includes(name));
      const failed = matching.filter((row) => /fail|dead/i.test(JSON.stringify(row))).length;
      return { id: name, name, depth: matching.filter((row) => /queued|pending/i.test(JSON.stringify(row))).length, failed, retrying: matching.filter((row) => /retry/i.test(JSON.stringify(row))).length, throughput: countToday(matching), state: failed ? 'degraded' : matching.length ? 'running' : 'empty', lastEventAt: String(matching[0]?.created_at ?? matching[0]?.recorded_at ?? '') };
    });

    const settingsRows = await safeSelect<Record<string, any>>('mentor_system_settings', '*', 1);
    if (settingsRows.unavailable) unavailableSources.push(settingsRows.unavailable);
    const rawSettings = settingsRows.rows[0] ?? {};
    const settings: AdminSettings = { model: String(rawSettings.model ?? 'gpt-4.1'), temperature: Number(rawSettings.temperature ?? 0.3), maxTokens: Number(rawSettings.max_tokens ?? 4096), streaming: rawSettings.streaming !== false, promptVersion: String(rawSettings.prompt_version ?? 'current'), embeddingModel: String(rawSettings.embedding_model ?? 'text-embedding-3-large'), vectorTopK: Number(rawSettings.vector_top_k ?? 8), rateLimitPerMinute: Number(rawSettings.rate_limit_per_minute ?? 60), maintenanceMode: Boolean(rawSettings.maintenance_mode) };

    const roleRows = await safeSelect<Record<string, any>>('mentor_role_assignments', '*');
    if (roleRows.unavailable) unavailableSources.push(roleRows.unavailable);
    const roles: RoleAssignment[] = roleRows.rows.map((row) => ({ id: String(row.id), email: String(row.email), role: String(row.role ?? 'student') as AdminRole, permissions: Array.isArray(row.permissions) ? row.permissions : splitLines(row.permissions), updatedAt: String(row.updated_at ?? row.created_at ?? '') }));

    const notificationRows: AdminNotification[] = notifications.rows.map((row) => ({ id: String(row.id ?? row.job_id), title: String(row.title ?? row.payload?.title ?? 'Notification'), body: String(row.body ?? row.payload?.body ?? row.payload?.message ?? ''), audience: String(row.audience ?? row.payload?.audience ?? 'all') as AdminNotification['audience'], severity: String(row.severity ?? row.payload?.severity ?? 'info') as AdminNotification['severity'], published: Boolean(row.published ?? row.sent_at), createdAt: String(row.created_at ?? row.sent_at ?? new Date().toISOString()) }));

    const auditLogs: AuditLogRecord[] = auditRows.rows.map((row) => ({ id: String(row.id), actor: String(row.actor ?? row.actor_email ?? 'system'), action: String(row.action ?? row.event_type ?? 'recorded'), target: String(row.target ?? row.resource ?? 'platform'), createdAt: String(row.created_at ?? new Date().toISOString()), severity: String(row.severity ?? 'info') as AuditLogRecord['severity'] }));

    return {
      metrics: [
        { id: 'students', label: 'Total students', value: students.length, trend: students.filter((s) => s.status === 'active').length },
        { id: 'active', label: 'Active students today', value: students.filter((s) => s.status === 'active').length },
        { id: 'lessons', label: 'Lessons completed', value: students.reduce((sum, s) => sum + s.lessonsCompleted, 0) },
        { id: 'assessments', label: 'Assessments completed', value: students.reduce((sum, s) => sum + s.assessmentsCompleted, 0) },
        { id: 'conversations', label: 'AI conversations today', value: countToday(turns.rows) },
        { id: 'reviews', label: 'Draft reviews completed', value: countToday(revisions.rows) },
        { id: 'capstones', label: 'Capstone projects', value: revisions.rows.filter((row) => /capstone/i.test(JSON.stringify(row))).length },
        { id: 'mastery', label: 'Average mastery score', value: numberAverage(students.map((s) => s.mastery)), unit: '%' },
        { id: 'revision', label: 'Average revision success rate', value: revisions.rows.length ? Math.round((revisions.rows.filter((r) => /complete|success/i.test(JSON.stringify(r))).length / revisions.rows.length) * 100) : 0, unit: '%' },
        { id: 'tokens', label: 'AI token usage', value: tokenUsage },
        { id: 'cost', label: 'Estimated API cost', value: cost.toFixed(2), unit: 'USD' },
        { id: 'queue', label: 'Queue health', value: queueRecords.some((q) => q.state === 'degraded') ? 'Degraded' : 'Healthy', state: queueRecords.some((q) => q.state === 'degraded') ? 'warning' : 'healthy' },
        { id: 'system', label: 'System health', value: errors ? 'Attention' : 'Healthy', state: errors ? 'warning' : 'healthy' },
        { id: 'errors', label: 'Error rate', value: telemetry.rows.length ? Math.round((errors / telemetry.rows.length) * 100) : 0, unit: '%' },
      ],
      trends: {
        lessons: modules.map((module) => ({ label: `M${module.order}`, value: module.lessonCount })),
        mastery: students.slice(0, 8).map((student) => ({ label: student.name.slice(0, 10), value: student.mastery })),
        aiUsage: ['Sessions', 'Turns', 'Analytics', 'Telemetry'].map((label, index) => ({ label, value: [sessions.rows.length, turns.rows.length, analytics.rows.length, telemetry.rows.length][index] })),
        costs: analytics.rows.slice(0, 12).map((row, index) => ({ label: `Run ${index + 1}`, value: Number(row.cost ?? row.estimated_cost ?? 0) })),
        queues: queueRecords.map((queue) => ({ label: queue.name.replace('Queue', ''), value: queue.depth, secondary: queue.failed })),
      },
      students, modules, lessons, patterns, bareActs, ai: [
        { id: 'prompt-versions', kind: 'prompt', label: 'Prompt versions', status: prompts.rows.length ? 'healthy' : 'unknown', count: prompts.rows.length },
        { id: 'validation', kind: 'validation', label: 'Response validation events', status: telemetry.rows.length ? 'healthy' : 'unknown', count: telemetry.rows.length },
        { id: 'safety', kind: 'safety', label: 'Safety violations / blocks', status: errors ? 'warning' : 'healthy', count: errors },
        { id: 'usage', kind: 'usage', label: 'Token usage', status: tokenUsage ? 'healthy' : 'unknown', count: analytics.rows.length, tokens: tokenUsage, cost },
      ], queues: queueRecords, settings, auditLogs, roles, notifications: notificationRows, unavailableSources: unique(unavailableSources),
    };
  },

  async updateStudent(id: string, action: 'reset' | 'archive') {
    const patch = action === 'archive' ? { archived: true, updated_at: new Date().toISOString() } : { lessons_completed: 0, assessments_completed: 0, updated_at: new Date().toISOString() };
    await supabase.from('users').update(patch).eq('id', id);
    await audit(`student.${action}`, id, action === 'reset' ? 'warning' : 'info');
  },

  async saveModule(input: any) {
    await supabase.from('mentor_curriculum_modules').upsert({ title: input.title, description: input.description, module_order: input.order, status: input.status, prerequisites: splitLines(input.prerequisites), mastery_criteria: splitLines(input.masteryCriteria), updated_at: new Date().toISOString() });
    await audit('curriculum.module.save', input.title);
  },

  async saveLesson(input: any) {
    await supabase.from('mentor_curriculum_lessons').upsert({ module_id: input.moduleId, title: input.title, objectives: splitLines(input.objectives), prerequisites: splitLines(input.prerequisites), estimated_minutes: Number(input.estimatedMinutes), status: input.status, updated_at: new Date().toISOString() });
    await audit('curriculum.lesson.save', input.title);
  },

  async savePattern(input: any) {
    await supabase.from('mentor_knowledge_chunks').upsert({ kind: 'pattern', title: input.name, content: `${input.name}\n${input.checklist}\n${input.commonMistakes}\n${input.examples ?? ''}`, metadata: { category: input.category, difficulty: input.difficulty, status: input.status, checklist: splitLines(input.checklist), commonMistakes: splitLines(input.commonMistakes), examples: splitLines(input.examples), version: 1 }, updated_at: new Date().toISOString() });
    await audit('pattern.save', input.name);
  },

  async saveSettings(input: AdminSettings) {
    await supabase.from('mentor_system_settings').upsert({ id: 'global', model: input.model, temperature: input.temperature, max_tokens: input.maxTokens, streaming: input.streaming, prompt_version: input.promptVersion, embedding_model: input.embeddingModel, vector_top_k: input.vectorTopK, rate_limit_per_minute: input.rateLimitPerMinute, maintenance_mode: input.maintenanceMode, updated_at: new Date().toISOString() });
    await audit('settings.save', 'global', input.maintenanceMode ? 'warning' : 'info');
  },

  async assignRole(input: { email: string; role: AdminRole; permissions: string }) {
    await supabase.from('mentor_role_assignments').upsert({ email: input.email, role: input.role, permissions: splitLines(input.permissions), updated_at: new Date().toISOString() });
    await audit('role.assign', input.email, 'warning');
  },

  async publishNotification(input: any) {
    await supabase.from('mentor_notifications').insert({ title: input.title, body: input.body, audience: input.audience, severity: input.severity, published: input.published, payload: input, sent_at: input.published ? new Date().toISOString() : null });
    await audit('notification.save', input.title);
  },

  async queueAction(queueName: string, action: 'retry' | 'pause' | 'resume' | 'inspect') {
    await supabase.from('mentor_queue_commands').insert({ queue_name: queueName, action, created_at: new Date().toISOString() });
    await audit(`queue.${action}`, queueName, action === 'pause' ? 'warning' : 'info');
  },

  async reindexBareAct(id: string) {
    await fetch(`${API_BASE_URL}/documents/reindex`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: id }) }).catch(() => undefined);
    await supabase.from('mentor_bare_act_index_jobs').insert({ payload: { documentId: id, action: 'reindex' }, indexed_at: new Date().toISOString() });
    await audit('bare_act.reindex', id);
  },
};
