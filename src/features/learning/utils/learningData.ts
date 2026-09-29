import type { LearningLesson, LearningModule, LearningPlatformData, RevisionTask } from '../types/learning.types';

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function percent(value: number): string {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

export function minutes(value: number): string {
  return value < 60 ? `${value} min` : `${Math.floor(value / 60)}h ${value % 60}m`;
}

export function makeCurriculum(seed?: any): LearningModule[] {
  const modules: Array<{ title: string; lessons: string[] }> = [
    { title: 'Foundations of Legislative Drafting', lessons: ['What a Bare Act Does', 'Parts of an Act', 'Legislative Sentence Discipline'] },
    { title: 'Statutory Components', lessons: ['Short and Long Titles', 'Extent and Commencement', 'Definitions and Interpretation'] },
    { title: 'Operative Provisions', lessons: ['Rights and Duties', 'Powers and Authorities', 'Procedures and Notices'] },
    { title: 'Enforcement Architecture', lessons: ['Offences and Penalties', 'Appeals and Reviews', 'Investigations and Search'] },
    { title: 'Advanced Drafting Devices', lessons: ['Savings and Repeals', 'Non-obstante Clauses', 'Delegated Legislation'] },
    { title: 'Capstone Bare Act Project', lessons: ['Architecture Plan', 'Full Draft Review', 'Final Quality Assurance'] },
  ];
  return modules.map((module, moduleIndex) => {
    const lessons = module.lessons.map((title, lessonIndex): LearningLesson => ({
      id: `lesson-${moduleIndex + 1}-${lessonIndex + 1}`,
      moduleId: `module-${moduleIndex + 1}`,
      title,
      summary: `Structured drafting lesson for ${title.toLowerCase()}.`,
      status: moduleIndex === 0 && lessonIndex === 0 ? 'in_progress' : moduleIndex === 0 ? 'available' : 'locked',
      estimatedMinutes: 35 + lessonIndex * 10,
      objectives: [`Explain the drafting purpose of ${title.toLowerCase()}.`, 'Apply the relevant legislative pattern in one student-authored provision.'],
      patterns: title.includes('Definitions') ? ['Definitions', 'Interpretation Clauses'] : title.includes('Commencement') ? ['Commencement', 'Extent'] : ['Legislative structure', 'Drafting clarity'],
      prerequisites: lessonIndex === 0 ? [] : [module.lessons[lessonIndex - 1]],
      practiceActivities: ['Analyse one Bare Act component', 'Draft one narrow provision', 'Revise after mentor feedback'],
      reflectionQuestions: ['What legal actor is created or regulated?', 'What ambiguity would a reader face?', 'What revision would make this provision more teachable?'],
      completionCriteria: ['Student submits an attempt', 'Mentor feedback is reviewed', 'Revision addresses at least one drafting issue'],
    }));
    const progress = Number(seed?.modules?.[moduleIndex]?.progress ?? (moduleIndex === 0 ? 38 : 0));
    return { id: `module-${moduleIndex + 1}`, title: module.title, description: `Module ${moduleIndex + 1} in the Bare Act drafting curriculum.`, order: moduleIndex + 1, progress, status: progress >= 100 ? 'completed' : moduleIndex <= 1 ? 'available' : 'locked', prerequisites: moduleIndex === 0 ? [] : [modules[moduleIndex - 1].title], lessons };
  });
}

export function buildLearningData(raw: { progress?: any; mastery?: any; projects?: any; history?: any }): LearningPlatformData {
  const modules = makeCurriculum(raw.progress);
  const selectedLesson = modules[0].lessons[0];
  const masterySkills = ['Definitions', 'Commencement', 'Duty clauses', 'Delegated powers', 'Offences', 'Appeals', 'Savings'].map((label, index) => ({
    id: `skill-${index}`,
    label,
    band: index < 2 ? 'mastered' as const : index < 5 ? 'in_progress' as const : 'needs_reinforcement' as const,
    confidence: Number(raw.mastery?.skills?.[index]?.confidence ?? Math.max(28, 86 - index * 9)),
    trend: index % 3 === 0 ? 'up' as const : index % 3 === 1 ? 'flat' as const : 'down' as const,
    evidence: ['Draft review completed', 'Revision submitted', 'Pattern analysis attempted'].slice(0, 2 + (index % 2)),
  }));
  const assessments = [
    { id: 'assessment-1', title: 'Definitions Clause Assessment', moduleId: 'module-2', lessonId: 'lesson-2-3', instructions: ['Draft a definitions clause from a policy objective.', 'Explain why each defined term is necessary.'], rubric: [{ criterion: 'Precision', weight: 40, description: 'Terms are narrow and consistently used.' }, { criterion: 'Necessity', weight: 30, description: 'No redundant definitions.' }, { criterion: 'Structure', weight: 30, description: 'Clause follows statutory style.' }], status: 'available' as const, integrityNotice: 'The mentor may guide and review, but must not complete the assessment for you.', history: [] },
    { id: 'assessment-2', title: 'Enforcement Architecture Assessment', moduleId: 'module-4', instructions: ['Draft enforcement components and explain sequencing.'], rubric: [{ criterion: 'Coherence', weight: 50, description: 'Offence, penalty and appeal provisions work together.' }, { criterion: 'Fairness', weight: 50, description: 'Procedural safeguards are visible.' }], status: 'locked' as const, integrityNotice: 'Assessment assistance is limited to feedback after submission.', history: [] },
  ];
  const revisions: RevisionTask[] = ['Clarify duty-holder in section 3', 'Define licensing authority', 'Repair commencement trigger'].map((title, index) => ({ id: `revision-${index}`, title, component: ['Duties', 'Definitions', 'Commencement'][index], status: index === 2 ? 'scheduled' as const : 'pending' as const, unresolvedFeedback: ['Mentor flagged ambiguity', 'Revision due after practice task'].slice(0, index === 0 ? 2 : 1), projectId: 'project-active' }));
  const notifications = [
    { id: 'note-1', kind: 'revision' as const, title: 'Revision due', body: 'Your definitions revision is ready for another mentor review.', createdAt: new Date().toISOString(), read: false, actionHref: '/bare-act-drafting' },
    { id: 'note-2', kind: 'unlock' as const, title: 'Lesson unlocked', body: 'Extent and commencement is now available.', createdAt: new Date().toISOString(), read: false },
    { id: 'note-3', kind: 'mentor' as const, title: 'Mentor recommendation', body: 'Review non-obstante clauses only after completing exceptions and provisos.', createdAt: new Date().toISOString(), read: true },
  ];
  return {
    dashboard: {
      studentName: raw.progress?.studentName ?? 'Student',
      currentModule: modules[0],
      currentLesson: selectedLesson,
      streakDays: Number(raw.progress?.streakDays ?? 6),
      overallProgress: Number(raw.progress?.overallProgress ?? 24),
      masteryPercentage: Number(raw.mastery?.percentage ?? 41),
      activeDraftingProject: raw.projects?.active?.title ?? 'Model Public Safety Regulation Act',
      pendingRevisionCount: revisions.filter((item) => item.status !== 'completed').length,
      upcomingAssessments: assessments.filter((item) => item.status === 'available'),
      recentMentorActivity: raw.history?.recent ?? ['Reviewed your definitions clause', 'Suggested revision on commencement trigger', 'Unlocked statutory components module'],
    },
    modules,
    selectedLesson,
    quiz: { id: 'quiz-1', lessonId: selectedLesson.id, title: 'Drafting Foundations Quiz', attemptsAllowed: 3, attemptsUsed: 0, timeLimitSeconds: 600, questions: [{ id: 'q1', prompt: 'What should a duty provision identify first?', options: ['The duty-holder', 'The penalty amount', 'The schedule title'], correctOptionId: 'The duty-holder', explanation: 'A duty is not teachable unless the legal actor is identifiable.' }, { id: 'q2', prompt: 'When should a term be defined?', options: ['When it is legally loaded or repeatedly used', 'Every time it appears', 'Only in schedules'], correctOptionId: 'When it is legally loaded or repeatedly used', explanation: 'Definitions manage precision and consistency.' }] },
    assessments,
    mastery: masterySkills,
    revisions,
    capstone: { id: 'capstone-1', title: 'Complete Bare Act Draft', overview: 'Plan, draft, review, and quality-check a complete educational Bare Act.', completedComponents: ['Title', 'Extent', 'Definitions'], pendingComponents: ['Duties', 'Powers', 'Offences', 'Penalties', 'Appeals', 'Schedules'], architectureProgress: 32, qualityIndicators: [{ label: 'Structure', value: 48 }, { label: 'Definitions', value: 62 }, { label: 'Procedural coherence', value: 35 }, { label: 'Review readiness', value: 28 }], reviewHistory: [{ id: 'cap-review-1', reviewedAt: new Date().toISOString(), summary: 'Architecture is coherent but enforcement sequence needs work.' }], readinessStatus: 'developing' },
    progress: {
      lessonCompletion: modules.map((item) => ({ label: item.title.replace('Legislative ', ''), value: item.progress })),
      moduleCompletion: modules.map((item) => ({ label: `M${item.order}`, value: item.progress })),
      masteryGrowth: [12, 18, 24, 33, 41].map((value, index) => ({ label: `Week ${index + 1}`, value })),
      draftingImprovement: [30, 38, 46, 54, 63].map((value, index) => ({ label: `Draft ${index + 1}`, value })),
      quizPerformance: [60, 72, 78, 84].map((value, index) => ({ label: `Quiz ${index + 1}`, value })),
      assessmentTrends: [0, 52, 64].map((value, index) => ({ label: `A${index + 1}`, value })),
      revisionSuccessRate: [25, 42, 58, 67].map((value, index) => ({ label: `R${index + 1}`, value })),
    },
    notifications,
  };
}

