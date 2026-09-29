import { describe, expect, it } from 'vitest';
import { QueueRegistry, queueNames } from '../../jobs/queues/QueueRegistry';

describe('Background job queues', () => {
  it('registers every production mentor queue and processes retry state', async () => {
    const registry = new QueueRegistry();
    expect(registry.all()).toHaveLength(queueNames.length);
    const queue = registry.get('EmbeddingQueue') as any;
    const job = await queue.add('generate', { documentId: 'doc-1' });
    expect(await queue.getDepth()).toBe(1);
    const next = await queue.next();
    expect(next?.id).toBe(job.id);
    await queue.fail(job.id);
    await queue.requeue(job.id);
    expect(await queue.getDepth()).toBe(1);
  });
});
