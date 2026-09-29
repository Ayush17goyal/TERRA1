export interface RlsQueryResult<T = unknown> {
  data: T[] | null;
  error: { message: string; code?: string } | null;
}

export interface RlsTableQuery<T = unknown> {
  select(columns?: string): RlsTableQuery<T>;
  eq(column: string, value: string): Promise<RlsQueryResult<T>>;
}

export interface RlsStorageQuery {
  list(path?: string): Promise<{ data: unknown[] | null; error: { message: string; code?: string } | null }>;
}

export interface RlsClient {
  from<T = unknown>(table: string): RlsTableQuery<T>;
  storage: { from(bucket: string): RlsStorageQuery };
}

export interface RlsVerifierClients {
  studentA: RlsClient;
  studentB: RlsClient;
  teacher: RlsClient;
  admin: RlsClient;
}

export interface RlsVerifierOptions {
  studentATestUserId: string;
  studentBTestUserId: string;
  studentOwnedTables: string[];
  teacherReadableTables: string[];
  adminReadableTables: string[];
  storageBuckets: string[];
}

export interface RlsCheckResult {
  name: string;
  passed: boolean;
  details?: string;
}

export class SupabaseRlsVerifier {
  private readonly clients: RlsVerifierClients;
  private readonly options: RlsVerifierOptions;

  constructor(clients: RlsVerifierClients, options: RlsVerifierOptions) {
    this.clients = clients;
    this.options = options;
  }

  async verify(): Promise<RlsCheckResult[]> {
    const results: RlsCheckResult[] = [];
    for (const table of this.options.studentOwnedTables) {
      results.push(await this.studentCannotReadOtherStudent(table));
      results.push(await this.studentCanReadOwnRows(table));
    }
    for (const table of this.options.teacherReadableTables) {
      results.push(await this.roleCanRead(this.clients.teacher, table, 'teacher'));
    }
    for (const table of this.options.adminReadableTables) {
      results.push(await this.roleCanRead(this.clients.admin, table, 'admin'));
    }
    for (const bucket of this.options.storageBuckets) {
      results.push(await this.studentCannotListOtherStorage(bucket));
    }
    return results;
  }

  assertPassed(results: RlsCheckResult[]): void {
    const failures = results.filter((result) => !result.passed);
    if (failures.length) {
      throw new Error(`Supabase RLS verification failed: ${failures.map((failure) => `${failure.name}${failure.details ? ` (${failure.details})` : ''}`).join('; ')}`);
    }
  }

  private async studentCannotReadOtherStudent(table: string): Promise<RlsCheckResult> {
    const result = await this.clients.studentA.from(table).select('*').eq('student_id', this.options.studentBTestUserId);
    const leakedRows = result.data?.length ?? 0;
    return {
      name: `${table}: student isolation`,
      passed: leakedRows === 0,
      details: leakedRows ? `student A read ${leakedRows} rows for student B` : undefined,
    };
  }

  private async studentCanReadOwnRows(table: string): Promise<RlsCheckResult> {
    const result = await this.clients.studentA.from(table).select('*').eq('student_id', this.options.studentATestUserId);
    return {
      name: `${table}: student own-row access`,
      passed: !result.error,
      details: result.error?.message,
    };
  }

  private async roleCanRead(client: RlsClient, table: string, role: string): Promise<RlsCheckResult> {
    const result = await client.from(table).select('*').eq('role_probe', role);
    return {
      name: `${table}: ${role} access`,
      passed: !result.error,
      details: result.error?.message,
    };
  }

  private async studentCannotListOtherStorage(bucket: string): Promise<RlsCheckResult> {
    const result = await this.clients.studentA.storage.from(bucket).list(this.options.studentBTestUserId);
    const leakedObjects = result.data?.length ?? 0;
    return {
      name: `${bucket}: storage isolation`,
      passed: leakedObjects === 0,
      details: leakedObjects ? `student A listed ${leakedObjects} objects in student B prefix` : result.error?.message,
    };
  }
}