import { describe, expect, it } from 'vitest';
import { exampleMentorWorkflowExecution, testMentorWorkflowPersistsAndDispatchesEvents } from '../../workflow/WorkflowIntegration.test';

describe('Mentor workflow integration', () => {
  it('executes API to workflow to retrieval to LLM to validator to persistence flow', async () => {
    const result = await exampleMentorWorkflowExecution();
    expect(result.ok).toBe(true);
    expect(result.state).toBe('COMPLETED');
    expect(['learning', 'drafting']).toContain(result.packet?.intent);
    expect(result.metadata?.timings).toBeDefined();
  });

  it('persists interactions and dispatches background events', async () => {
    await expect(testMentorWorkflowPersistsAndDispatchesEvents()).resolves.toBeUndefined();
  });
});
