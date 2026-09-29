import type { LearningPlatformData } from '../types/learning.types';
import { LearningAreaChart, LearningBarChart, LearningLineChart } from '../components/LearningCharts';
import { LearningCard } from '../components/LearningCard';

export function ProgressAnalytics({ progress }: { progress: LearningPlatformData['progress'] }) {
  return (
    <div className="learning-view-grid analytics">
      <LearningCard title="Lesson Completion"><LearningBarChart data={progress.lessonCompletion} /></LearningCard>
      <LearningCard title="Module Completion"><LearningBarChart data={progress.moduleCompletion} /></LearningCard>
      <LearningCard title="Mastery Growth"><LearningAreaChart data={progress.masteryGrowth} /></LearningCard>
      <LearningCard title="Drafting Improvement"><LearningLineChart data={progress.draftingImprovement} /></LearningCard>
      <LearningCard title="Quiz Performance"><LearningLineChart data={progress.quizPerformance} /></LearningCard>
      <LearningCard title="Assessment Trends"><LearningAreaChart data={progress.assessmentTrends} /></LearningCard>
      <LearningCard title="Revision Success Rate"><LearningBarChart data={progress.revisionSuccessRate} /></LearningCard>
    </div>
  );
}
