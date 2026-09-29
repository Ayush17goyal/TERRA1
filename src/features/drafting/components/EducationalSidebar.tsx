import { AlertTriangle, CheckSquare, HelpCircle, Target, TrendingUp } from 'lucide-react';
import type { EducationalSidebarData } from '../types/drafting.types';

export function EducationalSidebar({ data, loading }: { data?: EducationalSidebarData; loading: boolean }) {
  const resolved = data ?? {
    lessonObjective: 'Loading lesson objective...',
    checklist: [],
    commonMistakes: [],
    relevantPattern: 'Loading pattern...',
    reflectionQuestions: [],
    weaknessReminders: [],
    masteryProgress: 0,
  };
  return (
    <aside className="draft-education-sidebar" aria-label="Educational drafting guidance">
      <section><h3><Target size={15} />Lesson Objective</h3><p>{resolved.lessonObjective}</p></section>
      <section><h3><CheckSquare size={15} />Drafting Checklist</h3>{loading ? <SkeletonList /> : <List items={resolved.checklist} />}</section>
      <section><h3><AlertTriangle size={15} />Common Mistakes</h3><List items={resolved.commonMistakes} /></section>
      <section><h3><HelpCircle size={15} />Reflection Questions</h3><List items={resolved.reflectionQuestions} /></section>
      <section><h3><TrendingUp size={15} />Mastery Progress</h3><div className="draft-progress"><i style={{ width: `${Math.min(100, resolved.masteryProgress)}%` }} /></div><p>{resolved.relevantPattern}</p></section>
      <section><h3><AlertTriangle size={15} />Weakness Reminders</h3><List items={resolved.weaknessReminders} /></section>
    </aside>
  );
}

function List({ items }: { items: string[] }) {
  return <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

function SkeletonList() {
  return <div className="draft-skeleton"><span /><span /><span /></div>;
}
