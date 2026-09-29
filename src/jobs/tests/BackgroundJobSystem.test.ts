import { BackgroundJobSystem } from '../services/BackgroundJobSystem';
import type { SupabaseJobStore } from '../types';

class MockStore implements SupabaseJobStore {
  readonly records: Array<{ table: string; record: Record<string, unknown> }> = [];
  async insert(table: string, record: Record<string, unknown>): Promise<void> {
    this.records.push({ table, record });
  }
}

export async function testEventDispatchesToQueues(): Promise<void> {
  const system = new BackgroundJobSystem();
  await system.eventBus.emit({
    name: 'DocumentUploaded',
    payload: { documentId: 'doc-1' },
    studentId: 'student-1',
  });
  const depth = await system.registry.get('DocumentIndexQueue').getDepth();
  assert(depth === 1, 'Expected document upload to enqueue indexing job.');
}

export async function testWorkerPersistsMasteryUpdate(): Promise<void> {
  const store = new MockStore();
  const system = new BackgroundJobSystem({ store, processorServices: { store } });
  await system.eventBus.emit({
    name: 'LessonCompleted',
    payload: { lessonId: 'lesson-1' },
    studentId: 'student-1',
  });
  await system.start();
  assert(store.records.some((entry) => entry.table === 'mentor_mastery_updates'), 'Expected mastery update persistence.');
}

export async function testSchedulerEnqueuesRegisteredJob(): Promise<void> {
  const system = new BackgroundJobSystem();
  await system.scheduler.enqueueNow('daily-mastery-recalculation');
  const depth = await system.registry.get('MasteryUpdateQueue').getDepth();
  assert(depth === 1, 'Expected scheduled mastery job to be enqueued.');
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}
