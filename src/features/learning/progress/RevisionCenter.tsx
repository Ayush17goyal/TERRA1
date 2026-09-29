import { ArrowRight, CheckCircle2, Clock, RotateCcw } from 'lucide-react';
import type { RevisionTask } from '../types/learning.types';
import { LearningCard } from '../components/LearningCard';

export function RevisionCenter({ revisions }: { revisions: RevisionTask[] }) {
  return <LearningCard title="Revision Center" icon={<RotateCcw size={17} />} action={<a href="/bare-act-drafting">Open Drafting Workspace <ArrowRight size={14} /></a>}><div className="learning-revision-grid">{revisions.map((revision) => <article key={revision.id} className={revision.status}><header>{revision.status === 'completed' ? <CheckCircle2 size={15} /> : <Clock size={15} />}<strong>{revision.title}</strong><span>{revision.component}</span></header><ul>{revision.unresolvedFeedback.map((item) => <li key={item}>{item}</li>)}</ul>{revision.dueAt && <em>Due {new Date(revision.dueAt).toLocaleDateString()}</em>}</article>)}</div></LearningCard>;
}
