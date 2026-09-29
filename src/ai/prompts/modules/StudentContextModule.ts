import type { PromptModule } from '../interfaces';
import type { PromptAssemblyRequest, PromptModuleFragment } from '../types';

export class StudentContextModule implements PromptModule {
  readonly name = 'student_context' as const;

  shouldInclude(request: PromptAssemblyRequest): boolean {
    return Boolean(
      request.student &&
      ['review', 'revision', 'drafting', 'assessment', 'capstone', 'mixed'].includes(request.intent)
    );
  }

  build(request: PromptAssemblyRequest): PromptModuleFragment {
    const student = request.student;

    return {
      moduleName: this.name,
      priority: 'high',
      tokenBudget: { target: 380, max: 560 },
      includedReason: 'Personalizes assistance based on progress, weaknesses, and project state.',
      instructions: [
        student?.level ? `Student level: ${student.level}.` : '',
        student?.confidenceEstimate ? `Confidence estimate: ${student.confidenceEstimate}.` : '',
        student?.masteredSkills?.length ? `Mastered skills: ${student.masteredSkills.join('; ')}.` : '',
        student?.knownWeaknesses?.length ? `Known weaknesses: ${student.knownWeaknesses.join('; ')}.` : '',
        student?.currentProject ? `Current drafting project: ${student.currentProject}.` : '',
        student?.previousFeedbackSummary ? `Previous feedback summary: ${student.previousFeedbackSummary}.` : '',
        student?.revisionNeeded ? 'Revision is currently needed before progression.' : '',
        'Adapt to the student instead of teaching everything. If weaknesses are known, choose the one weakness most relevant to the present request.',
        'If the student is advanced, ask for justification of legal effect. If the student is beginner, ask for one concrete drafting choice.',
      ].filter(Boolean).join('\n'),
      contextVariables: { student },
    };
  }
}