import { ArrowRight, Bell, BookOpenCheck, Clock, Flame, GraduationCap, PenLine, Target } from 'lucide-react';
import type { LearningDashboardData } from '../types/learning.types';
import { LearningCard, MetricTile, ProgressBar } from '../components/LearningCard';

export function LearningDashboard({ data, onOpenLesson, onOpenRevisions }: { data: LearningDashboardData; onOpenLesson(): void; onOpenRevisions(): void }) {
  return (
    <div className="learning-view-grid dashboard">
      <section className="learning-welcome"><div><span>LEGATRIXON Bare Act Drafting Mentor</span><h1>Welcome back, {data.studentName}</h1><p>Continue building professional legislative drafting judgment through structured lessons, revision cycles, and mentor-guided practice.</p></div><button type="button" onClick={onOpenLesson}>Resume lesson <ArrowRight size={16} /></button></section>
      <div className="learning-metric-row"><MetricTile label="Learning streak" value={`${data.streakDays} days`} detail="Keep revision momentum" /><MetricTile label="Overall progress" value={`${data.overallProgress}%`} detail="Curriculum completion" /><MetricTile label="Mastery" value={`${data.masteryPercentage}%`} detail="Skill confidence" /><MetricTile label="Pending revisions" value={data.pendingRevisionCount} detail="Needs attention" /></div>
      <LearningCard title="Current Lesson" icon={<BookOpenCheck size={17} />} action={<button type="button" onClick={onOpenLesson}>Open</button>}><h2>{data.currentLesson?.title}</h2><p>{data.currentModule?.title}</p><ProgressBar value={data.currentModule?.progress ?? 0} label="Current module progress" /></LearningCard>
      <LearningCard title="Active Drafting Project" icon={<PenLine size={17} />} action={<a href="/bare-act-drafting">Workspace</a>}><h2>{data.activeDraftingProject}</h2><p>Continue drafting and submit revisions from the drafting workspace.</p></LearningCard>
      <LearningCard title="Upcoming Assessments" icon={<Target size={17} />}><div className="learning-list">{data.upcomingAssessments.map((assessment) => <article key={assessment.id}><strong>{assessment.title}</strong><span>{assessment.status}</span></article>)}</div></LearningCard>
      <LearningCard title="Recent Mentor Activity" icon={<GraduationCap size={17} />}><ul>{data.recentMentorActivity.map((item) => <li key={item}>{item}</li>)}</ul></LearningCard>
      <LearningCard title="Revision Reminder" icon={<Bell size={17} />} action={<button type="button" onClick={onOpenRevisions}>Review</button>}><p>{data.pendingRevisionCount} revision tasks are waiting for another pass.</p></LearningCard>
      <LearningCard title="Study Rhythm" icon={<Flame size={17} />}><p>Best next step: complete one lesson objective, revise one provision, then ask the mentor for review.</p><span className="learning-soft"><Clock size={14} /> 35 minute focused session</span></LearningCard>
    </div>
  );
}
