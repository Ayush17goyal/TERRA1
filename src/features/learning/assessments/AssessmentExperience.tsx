import { useForm } from 'react-hook-form';
import { AlertTriangle, ClipboardCheck, Send } from 'lucide-react';
import type { AssessmentItem } from '../types/learning.types';
import { LearningCard } from '../components/LearningCard';

type AssessmentForm = { submission: string };

export function AssessmentExperience({ assessments, submitting, onSubmit }: { assessments: AssessmentItem[]; submitting: boolean; onSubmit(input: { assessmentId: string; submission: string }): void }) {
  const { register, handleSubmit, formState } = useForm<AssessmentForm>({ defaultValues: { submission: '' } });
  const active = assessments[0];
  if (!active) return <LearningCard title="Assessments"><p>No assessments are currently assigned.</p></LearningCard>;
  return (
    <div className="learning-view-grid assessment">
      <LearningCard title={active.title} icon={<ClipboardCheck size={17} />}><div className="learning-integrity"><AlertTriangle size={16} /><p>{active.integrityNotice}</p></div><h4>Instructions</h4><ul>{active.instructions.map((item) => <li key={item}>{item}</li>)}</ul></LearningCard>
      <LearningCard title="Rubric"><div className="learning-rubric">{active.rubric.map((item) => <article key={item.criterion}><strong>{item.criterion}</strong><span>{item.weight}%</span><p>{item.description}</p></article>)}</div></LearningCard>
      <LearningCard title="Submission"><form className="learning-assessment-form" onSubmit={handleSubmit((values) => onSubmit({ assessmentId: active.id, submission: values.submission }))}><textarea {...register('submission', { minLength: 20, required: true })} placeholder="Submit your own assessment response. The mentor will review after submission." /><div><span>{formState.errors.submission ? 'Submission must be at least 20 characters.' : 'Student authorship required.'}</span><button type="submit" disabled={submitting}><Send size={14} />Submit assessment</button></div></form></LearningCard>
      <LearningCard title="Assessment History"><div className="learning-list">{active.history.length ? active.history.map((item) => <article key={item.id}><strong>{item.score ?? 'Pending'}%</strong><span>{item.feedback}</span></article>) : <p>No previous submissions for this assessment.</p>}</div></LearningCard>
    </div>
  );
}
