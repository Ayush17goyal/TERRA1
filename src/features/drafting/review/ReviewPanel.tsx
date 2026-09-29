import { Loader2, Send, Sparkles } from 'lucide-react';
import type { DraftReviewResult } from '../types/drafting.types';

export function ReviewPanel({ reviews, loading, error, onReview }: { reviews: DraftReviewResult[]; loading: boolean; error?: string; onReview(): void }) {
  const latest = reviews[0];
  return (
    <section className="draft-review-panel" aria-label="AI draft review">
      <header><strong><Sparkles size={16} />AI Draft Review</strong><button type="button" onClick={onReview} disabled={loading}>{loading ? <Loader2 size={14} className="spin" /> : <Send size={14} />}Review</button></header>
      {error && <p className="draft-error">{error}</p>}
      {!latest ? <p className="draft-muted">Submit your current component for educational review. The mentor will explain issues and assign revision tasks without rewriting your work.</p> : (
        <div className="draft-review-content">
          {latest.learningObjective && <Card title="Learning objective" items={[latest.learningObjective]} />}
          <Card title="Strengths" items={latest.strengths} />
          <Card title="Drafting issues" items={latest.draftingIssues} />
          <Card title="Legislative principles" items={latest.legislativePrinciples} />
          <Card title="Suggested revision tasks" items={latest.suggestedRevisionTasks} />
          {latest.nextAction && <Card title="Next action" items={[latest.nextAction]} />}
        </div>
      )}
    </section>
  );
}

function Card({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return <article><h4>{title}</h4><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></article>;
}
