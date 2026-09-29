import { Lock, Search, Unlock, CheckCircle2, Clock } from 'lucide-react';
import type { LearningModule } from '../types/learning.types';
import { minutes } from '../utils/learningData';
import { ProgressBar } from '../components/LearningCard';

export function CurriculumExplorer({ modules, query, statusFilter, onQuery, onStatus, onLesson }: { modules: LearningModule[]; query: string; statusFilter: string; onQuery(value: string): void; onStatus(value: 'all' | 'available' | 'locked' | 'completed'): void; onLesson(id: string): void }) {
  return (
    <section className="learning-curriculum" aria-label="Curriculum explorer">
      <header className="learning-section-head"><div><h1>Curriculum Roadmap</h1><p>Move from drafting foundations to capstone-level Bare Act architecture.</p></div><label><Search size={15} /><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search modules and lessons" /></label><select value={statusFilter} onChange={(event) => onStatus(event.target.value as any)} aria-label="Filter lessons by status"><option value="all">All</option><option value="available">Unlocked</option><option value="locked">Locked</option><option value="completed">Completed</option></select></header>
      <div className="learning-roadmap">{modules.map((module) => <article key={module.id} className={`learning-module ${module.status}`}><header><span>Module {module.order}</span><h2>{module.title}</h2><ProgressBar value={module.progress} label={`${module.title} progress`} /></header><p>{module.description}</p><div className="learning-prereq">Prerequisites: {module.prerequisites.length ? module.prerequisites.join(', ') : 'None'}</div><div className="learning-lessons-list">{module.lessons.map((lesson) => <button key={lesson.id} type="button" onClick={() => onLesson(lesson.id)} disabled={lesson.status === 'locked'}><span>{lesson.status === 'locked' ? <Lock size={14} /> : lesson.status === 'completed' ? <CheckCircle2 size={14} /> : <Unlock size={14} />}{lesson.title}</span><em><Clock size={13} />{minutes(lesson.estimatedMinutes)}</em></button>)}</div></article>)}</div>
    </section>
  );
}
