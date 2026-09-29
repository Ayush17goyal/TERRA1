import { CheckCircle2, CircleDashed, Loader2, XCircle } from 'lucide-react';
import type { WorkflowStage } from '../types/chat.types';
import { workflowLabel } from '../utils/formatting';

const stages: WorkflowStage[] = ['RUNNING', 'WAITING_FOR_LLM', 'VALIDATING', 'UPDATING_PROGRESS', 'COMPLETED'];

export function WorkflowStatus({ state }: { state?: WorkflowStage }) {
  return (
    <div className="mentor-workflow" aria-live="polite">
      <div className="mentor-workflow-current">
        {state === 'FAILED' ? <XCircle size={16} /> : state === 'COMPLETED' ? <CheckCircle2 size={16} /> : <Loader2 size={16} className="spin" />}
        <span>{workflowLabel(state)}</span>
      </div>
      <div className="mentor-workflow-steps" aria-label="Workflow stages">
        {stages.map((stage) => {
          const activeIndex = state ? stages.indexOf(state) : -1;
          const index = stages.indexOf(stage);
          const done = activeIndex >= index || state === 'COMPLETED';
          return <span key={stage} className={done ? 'done' : ''}>{done ? <CheckCircle2 size={12} /> : <CircleDashed size={12} />}{stage.replace(/_/g, ' ').toLowerCase()}</span>;
        })}
      </div>
    </div>
  );
}

