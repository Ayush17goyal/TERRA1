import { Award, TrendingDown, TrendingUp } from 'lucide-react';
import type { MasterySkill } from '../types/learning.types';
import { LearningCard, ProgressBar } from '../components/LearningCard';

export function MasteryDashboard({ skills }: { skills: MasterySkill[] }) {
  const groups = { mastered: skills.filter((skill) => skill.band === 'mastered'), in_progress: skills.filter((skill) => skill.band === 'in_progress'), needs_reinforcement: skills.filter((skill) => skill.band === 'needs_reinforcement') };
  return (
    <div className="learning-view-grid mastery">
      {Object.entries(groups).map(([label, items]) => <LearningCard key={label} title={label.replace(/_/g, ' ')} icon={<Award size={17} />}><div className="learning-skill-list">{items.map((skill) => <article key={skill.id}><header><strong>{skill.label}</strong>{skill.trend === 'up' ? <TrendingUp size={14} /> : skill.trend === 'down' ? <TrendingDown size={14} /> : <span>flat</span>}</header><ProgressBar value={skill.confidence} label={`${skill.label} confidence`} /><ul>{skill.evidence.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div></LearningCard>)}
      <LearningCard title="Recommendations"><ul><li>Revise one weak component before unlocking the next advanced task.</li><li>Use the drafting workspace to compare your latest revision with the prior version.</li><li>Ask the mentor for hints before model feedback.</li></ul></LearningCard>
    </div>
  );
}
