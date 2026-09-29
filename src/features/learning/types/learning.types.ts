export type LearningView = 'dashboard' | 'curriculum' | 'lesson' | 'quiz' | 'assessment' | 'mastery' | 'revisions' | 'capstone' | 'progress' | 'notifications' | 'settings';
export type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed';
export type MasteryBand = 'needs_reinforcement' | 'in_progress' | 'mastered';
export type NotificationKind = 'revision' | 'unlock' | 'assessment' | 'mentor' | 'system';

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  order: number;
  progress: number;
  status: LessonStatus;
  prerequisites: string[];
  lessons: LearningLesson[];
}

export interface LearningLesson {
  id: string;
  moduleId: string;
  title: string;
  summary: string;
  status: LessonStatus;
  estimatedMinutes: number;
  objectives: string[];
  patterns: string[];
  prerequisites: string[];
  practiceActivities: string[];
  reflectionQuestions: string[];
  completionCriteria: string[];
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctOptionId?: string;
  explanation?: string;
}

export interface QuizState {
  id: string;
  lessonId: string;
  title: string;
  timeLimitSeconds?: number;
  attemptsAllowed: number;
  attemptsUsed: number;
  questions: QuizQuestion[];
}

export interface AssessmentItem {
  id: string;
  title: string;
  moduleId?: string;
  lessonId?: string;
  instructions: string[];
  rubric: Array<{ criterion: string; weight: number; description: string }>;
  status: 'available' | 'submitted' | 'reviewed' | 'locked';
  integrityNotice: string;
  history: Array<{ id: string; submittedAt: string; score?: number; feedback: string }>;
}

export interface MasterySkill {
  id: string;
  label: string;
  band: MasteryBand;
  confidence: number;
  trend: 'up' | 'flat' | 'down';
  evidence: string[];
}

export interface RevisionTask {
  id: string;
  title: string;
  component: string;
  dueAt?: string;
  status: 'pending' | 'scheduled' | 'completed';
  unresolvedFeedback: string[];
  projectId?: string;
}

export interface CapstoneState {
  id: string;
  title: string;
  overview: string;
  completedComponents: string[];
  pendingComponents: string[];
  architectureProgress: number;
  qualityIndicators: Array<{ label: string; value: number }>;
  reviewHistory: Array<{ id: string; reviewedAt: string; summary: string }>;
  readinessStatus: 'not_ready' | 'developing' | 'ready_for_review' | 'complete';
}

export interface ProgressMetricPoint {
  label: string;
  value: number;
  secondary?: number;
}

export interface LearningNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  actionHref?: string;
}

export interface LearningDashboardData {
  studentName: string;
  currentModule?: LearningModule;
  currentLesson?: LearningLesson;
  streakDays: number;
  overallProgress: number;
  masteryPercentage: number;
  activeDraftingProject?: string;
  pendingRevisionCount: number;
  upcomingAssessments: AssessmentItem[];
  recentMentorActivity: string[];
}

export interface LearningPlatformData {
  dashboard: LearningDashboardData;
  modules: LearningModule[];
  selectedLesson: LearningLesson;
  quiz: QuizState;
  assessments: AssessmentItem[];
  mastery: MasterySkill[];
  revisions: RevisionTask[];
  capstone: CapstoneState;
  progress: {
    lessonCompletion: ProgressMetricPoint[];
    moduleCompletion: ProgressMetricPoint[];
    masteryGrowth: ProgressMetricPoint[];
    draftingImprovement: ProgressMetricPoint[];
    quizPerformance: ProgressMetricPoint[];
    assessmentTrends: ProgressMetricPoint[];
    revisionSuccessRate: ProgressMetricPoint[];
  };
  notifications: LearningNotification[];
}
