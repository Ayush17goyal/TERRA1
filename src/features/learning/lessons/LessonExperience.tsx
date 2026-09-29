import { CheckCircle2, MessageSquare, PenLine, PlayCircle } from 'lucide-react';
import type { LearningLesson } from '../types/learning.types';
import { LearningCard } from '../components/LearningCard';

export function LessonExperience({ lesson, completing, onComplete }: { lesson: LearningLesson; completing: boolean; onComplete(): void }) {
  return (
    <div className="learning-view-grid lesson">
      <section className="learning-lesson-hero"><span>{lesson.status.replace(/_/g, ' ')}</span><h1>{lesson.title}</h1><p>{lesson.summary}</p><div><a href="/bare-act-mentor"><MessageSquare size={15} /> Ask Mentor</a><a href="/bare-act-drafting"><PenLine size={15} /> Practice in Workspace</a><button type="button" onClick={onComplete} disabled={completing}><CheckCircle2 size={15} /> Mark complete</button></div></section>
      <LearningCard title="Lesson Objectives"><ul>{lesson.objectives.map((item) => <li key={item}>{item}</li>)}</ul></LearningCard>
      <LearningCard title="Concept Explanation"><p>This lesson focuses on why Parliament uses this drafting pattern, where it appears in an Act, and how a student should reason before drafting it.</p></LearningCard>
      <LearningCard title="Legislative Drafting Patterns"><div className="learning-chip-row">{lesson.patterns.map((pattern) => <span key={pattern}>{pattern}</span>)}</div></LearningCard>
      <LearningCard title="Interactive Examples" icon={<PlayCircle size={17} />}><p>Analyse a real Bare Act component, identify its drafting function, then compare its structure with your own provision.</p></LearningCard>
      <LearningCard title="Practice Activities"><ul>{lesson.practiceActivities.map((item) => <li key={item}>{item}</li>)}</ul></LearningCard>
      <LearningCard title="Reflection Questions"><ul>{lesson.reflectionQuestions.map((item) => <li key={item}>{item}</li>)}</ul></LearningCard>
      <LearningCard title="Completion Criteria"><ul>{lesson.completionCriteria.map((item) => <li key={item}>{item}</li>)}</ul></LearningCard>
    </div>
  );
}
