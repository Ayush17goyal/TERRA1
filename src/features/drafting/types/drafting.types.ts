export type DraftComponentType =
  | 'title'
  | 'preamble'
  | 'definitions'
  | 'commencement'
  | 'extent'
  | 'application'
  | 'duties'
  | 'powers'
  | 'procedures'
  | 'offences'
  | 'penalties'
  | 'appeals'
  | 'rule_making_powers'
  | 'schedules'
  | 'repeals'
  | 'savings'
  | 'transitional_provisions';

export type DraftStatus = 'not_started' | 'drafting' | 'reviewed' | 'revising' | 'complete';
export type ReviewStatus = 'idle' | 'pending' | 'complete' | 'failed';
export type MasteryStatus = 'low' | 'developing' | 'functional' | 'strong' | 'mastery';
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'offline' | 'conflict' | 'error';
export type FeedbackSeverity = 'info' | 'warning' | 'error';

export interface DraftComponent {
  id: string;
  type: DraftComponentType;
  label: string;
  status: DraftStatus;
  completed: boolean;
  order: number;
  text: string;
}

export interface DraftVersion {
  id: string;
  projectId: string;
  componentId: string;
  label: string;
  text: string;
  notes?: string;
  createdAt: string;
  wordCount: number;
  characterCount: number;
}

export interface InlineFeedbackMarker {
  id: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  severity: FeedbackSeverity;
  title: string;
  explanation: string;
  resolved: boolean;
  principle?: string;
}

export interface DraftReviewResult {
  id: string;
  projectId: string;
  componentId: string;
  createdAt: string;
  learningObjective?: string;
  strengths: string[];
  draftingIssues: string[];
  educationalExplanations: string[];
  legislativePrinciples: string[];
  suggestedRevisionTasks: string[];
  nextAction?: string;
  markers: InlineFeedbackMarker[];
  rawText: string;
}

export interface RevisionRecord {
  id: string;
  projectId: string;
  componentId: string;
  fromVersionId?: string;
  toVersionId: string;
  notes: string;
  resolvedFeedbackIds: string[];
  unresolvedFeedbackIds: string[];
  createdAt: string;
}

export interface DraftingProject {
  id: string;
  title: string;
  project?: string;
  lesson?: string;
  moduleId?: string;
  lessonId?: string;
  currentComponentId: string;
  status: DraftStatus;
  reviewStatus: ReviewStatus;
  masteryStatus: MasteryStatus;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  components: DraftComponent[];
  versions: DraftVersion[];
  reviews: DraftReviewResult[];
  revisions: RevisionRecord[];
}

export interface DraftingWorkspaceState {
  projects: DraftingProject[];
  activeProjectId: string;
  fullscreen: boolean;
  printMode: boolean;
  activeMarkerId?: string;
  compareVersionId?: string;
  saveStatus: SaveStatus;
  lastSavedAt?: string;
}

export interface EducationalSidebarData {
  lessonObjective: string;
  checklist: string[];
  commonMistakes: string[];
  relevantPattern: string;
  reflectionQuestions: string[];
  weaknessReminders: string[];
  masteryProgress: number;
}

export interface DraftReviewRequest {
  draftText: string;
  draftObjective?: string;
  componentType?: string;
  moduleId?: string;
  lessonId?: string;
  studentLevel?: string;
}

export interface DraftRevisionRequest extends DraftReviewRequest {
  previousFeedback?: string;
  draftId?: string;
}
