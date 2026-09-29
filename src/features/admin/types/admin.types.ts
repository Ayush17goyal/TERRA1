export type AdminRole = 'admin' | 'instructor' | 'student' | 'unknown';
export type AdminView = 'overview' | 'students' | 'curriculum' | 'patterns' | 'bareActs' | 'ai' | 'queues' | 'analytics' | 'settings' | 'audit' | 'roles' | 'notifications';
export type HealthState = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface AdminUserAccess {
  userId?: string;
  email?: string;
  roles: AdminRole[];
  allowed: boolean;
  source: 'supabase' | 'session' | 'none';
}

export interface AdminMetric {
  id: string;
  label: string;
  value: number | string;
  trend?: number;
  state?: HealthState;
  unit?: string;
}

export interface ChartPoint {
  label: string;
  value: number;
  secondary?: number;
}

export interface AdminStudent {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: 'active' | 'inactive' | 'archived';
  mastery: number;
  weaknessCount: number;
  lessonsCompleted: number;
  assessmentsCompleted: number;
  aiInteractions: number;
  lastActiveAt?: string;
}

export interface CurriculumAdminModule {
  id: string;
  title: string;
  description: string;
  order: number;
  status: 'draft' | 'published' | 'unpublished';
  lessonCount: number;
  prerequisites: string[];
  masteryCriteria: string[];
}

export interface CurriculumAdminLesson {
  id: string;
  moduleId: string;
  title: string;
  objectives: string[];
  prerequisites: string[];
  status: 'draft' | 'published' | 'locked';
  estimatedMinutes: number;
}

export interface PatternAdminRecord {
  id: string;
  name: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'professional';
  version: number;
  status: 'draft' | 'review' | 'published';
  updatedAt?: string;
  metadata: Record<string, unknown>;
  checklist: string[];
  commonMistakes: string[];
  examples: string[];
}

export interface BareActAdminRecord {
  id: string;
  title: string;
  jurisdiction?: string;
  status: string;
  chunkCount: number;
  embeddingCount: number;
  componentTypes: string[];
  version: number;
  uploadedAt?: string;
}

export interface AiMonitoringRecord {
  id: string;
  kind: 'prompt' | 'validation' | 'safety' | 'usage';
  label: string;
  status: HealthState;
  count: number;
  latencyMs?: number;
  cost?: number;
  tokens?: number;
  updatedAt?: string;
}

export interface QueueRecord {
  id: string;
  name: string;
  depth: number;
  failed: number;
  retrying: number;
  throughput: number;
  state: 'running' | 'paused' | 'degraded' | 'empty';
  lastEventAt?: string;
}

export interface AdminSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  streaming: boolean;
  promptVersion: string;
  embeddingModel: string;
  vectorTopK: number;
  rateLimitPerMinute: number;
  maintenanceMode: boolean;
}

export interface AuditLogRecord {
  id: string;
  actor: string;
  action: string;
  target: string;
  createdAt: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface RoleAssignment {
  id: string;
  email: string;
  role: AdminRole;
  permissions: string[];
  updatedAt?: string;
}

export interface AdminNotification {
  id: string;
  title: string;
  body: string;
  audience: 'all' | 'students' | 'instructors' | 'admins';
  severity: 'info' | 'warning' | 'maintenance';
  published: boolean;
  createdAt: string;
}

export interface AdminDashboardData {
  metrics: AdminMetric[];
  trends: {
    lessons: ChartPoint[];
    mastery: ChartPoint[];
    aiUsage: ChartPoint[];
    costs: ChartPoint[];
    queues: ChartPoint[];
  };
  students: AdminStudent[];
  modules: CurriculumAdminModule[];
  lessons: CurriculumAdminLesson[];
  patterns: PatternAdminRecord[];
  bareActs: BareActAdminRecord[];
  ai: AiMonitoringRecord[];
  queues: QueueRecord[];
  settings: AdminSettings;
  auditLogs: AuditLogRecord[];
  roles: RoleAssignment[];
  notifications: AdminNotification[];
  unavailableSources: string[];
}
