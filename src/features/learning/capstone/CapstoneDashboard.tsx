import { Flag, Sparkles } from 'lucide-react';
import type { CapstoneState } from '../types/learning.types';
import { LearningCard, ProgressBar } from '../components/LearningCard';

export function CapstoneDashboard({ capstone, reviewing, onReview }: { capstone: CapstoneState; reviewing: boolean; onReview(): void }) {
  return (
    <div className="learning-view-grid capstone">
      <section className="learning-capstone-hero"><span>{capstone.readinessStatus.replace(/_/g, ' ')}</span><h1>{capstone.title}</h1><p>{capstone.overview}</p><ProgressBar value={capstone.architectureProgress} label="Capstone architecture progress" /><button type="button" onClick={onReview} disabled={reviewing}><Sparkles size={15} /> Request AI capstone review</button></section>
      <LearningCard title="Completed Components" icon={<Flag size={17} />}><div className="learning-chip-row">{capstone.completedComponents.map((item) => <span key={item}>{item}</span>)}</div></LearningCard>
      <LearningCard title="Pending Components"><div className="learning-chip-row muted">{capstone.pendingComponents.map((item) => <span key={item}>{item}</span>)}</div></LearningCard>
      <LearningCard title="Quality Indicators"><div className="learning-quality-list">{capstone.qualityIndicators.map((item) => <article key={item.label}><strong>{item.label}</strong><ProgressBar value={item.value} /></article>)}</div></LearningCard>
      <LearningCard title="AI Review History"><div className="learning-list">{capstone.reviewHistory.map((item) => <article key={item.id}><strong>{new Date(item.reviewedAt).toLocaleDateString()}</strong><span>{item.summary}</span></article>)}</div></LearningCard>
    </div>
  );
}
