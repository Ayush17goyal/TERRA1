import { describe, expect, it } from 'vitest';
import { SupabaseRlsVerifier, type RlsClient } from '../../security/SupabaseRlsVerifier';

function client(rowsByTable: Record<string, Record<string, unknown>[]>, storageByBucket: Record<string, Record<string, unknown>[]> = {}): RlsClient {
  return {
    from<T = unknown>(table: string) {
      return {
        select() { return this; },
        async eq(column: string, value: string) {
          const rows = (rowsByTable[table] ?? []).filter((row) => row[column] === value);
          return { data: rows as T[], error: null };
        },
      };
    },
    storage: {
      from(bucket: string) {
        return {
          async list(path?: string) {
            const rows = (storageByBucket[bucket] ?? []).filter((row) => String(row.path ?? '').startsWith(String(path ?? '')));
            return { data: rows, error: null };
          },
        };
      },
    },
  };
}

describe('Supabase RLS verification contract', () => {
  it('passes when student, teacher, admin, and storage isolation probes respect policy', async () => {
    const verifier = new SupabaseRlsVerifier({
      studentA: client({ mentor_interactions: [{ student_id: 'student-a' }] }, { mentor_documents: [{ path: 'student-a/doc.pdf' }] }),
      studentB: client({ mentor_interactions: [{ student_id: 'student-b' }] }),
      teacher: client({ mentor_interactions: [] }),
      admin: client({ mentor_interactions: [] }),
    }, {
      studentATestUserId: 'student-a',
      studentBTestUserId: 'student-b',
      studentOwnedTables: ['mentor_interactions'],
      teacherReadableTables: ['mentor_interactions'],
      adminReadableTables: ['mentor_interactions'],
      storageBuckets: ['mentor_documents'],
    });

    const results = await verifier.verify();
    expect(results.every((result) => result.passed)).toBe(true);
    expect(() => verifier.assertPassed(results)).not.toThrow();
  });

  it('fails when a student can read another student row or storage prefix', async () => {
    const verifier = new SupabaseRlsVerifier({
      studentA: client({ mentor_interactions: [{ student_id: 'student-b' }] }, { mentor_documents: [{ path: 'student-b/doc.pdf' }] }),
      studentB: client({}),
      teacher: client({}),
      admin: client({}),
    }, {
      studentATestUserId: 'student-a',
      studentBTestUserId: 'student-b',
      studentOwnedTables: ['mentor_interactions'],
      teacherReadableTables: [],
      adminReadableTables: [],
      storageBuckets: ['mentor_documents'],
    });

    const results = await verifier.verify();
    expect(results.some((result) => !result.passed)).toBe(true);
    expect(() => verifier.assertPassed(results)).toThrow(/RLS verification failed/);
  });
});