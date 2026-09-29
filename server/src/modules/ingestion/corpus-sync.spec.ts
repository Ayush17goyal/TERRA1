/**
 * corpus-sync.spec.ts
 * Tests for CorpusSyncEngine — all external deps (TypeORM, Qdrant, embed) mocked.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as nodeCrypto from 'crypto';
import { DataSource } from 'typeorm';
import {
  CorpusSyncEngine,
  computeContentHash,
  qdrantPointId,
  extractKeywords,
  ParsedSectionsJson,
  QdrantClientLike,
} from './corpus-sync.engine';
import { LegalActEntity } from './entities/legal-act.entity';
import { ParsedProvisionEntity } from './entities/parsed-provision.entity';

// ── Helpers ───────────────────────────────────────────────────────────────────

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-sync-test-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeParsedSections(actName: string, sections: number = 3): ParsedSectionsJson {
  const structure: any[] = [];
  for (let i = 1; i <= sections; i++) {
    structure.push({
      type: 'section',
      number: String(i),
      title: `Section ${i} Title`,
      content: `Content of section ${i} which is sufficiently long to be a real provision.`,
      children: [],
    });
  }
  return {
    actName,
    officialName: actName,
    shortName: actName.split(' ')[0],
    category: 'Test',
    year: 2023,
    structure,
  };
}

function writeActFolder(
  dir: string,
  category: string,
  folderName: string,
  parsedData: ParsedSectionsJson,
): { actFolder: string; parsedSectionsPath: string } {
  const catDir = path.join(dir, category);
  const actFolder = path.join(catDir, folderName);
  fs.mkdirSync(actFolder, { recursive: true });

  // Create a dummy PDF
  const pdfPath = path.join(actFolder, `${folderName}.pdf`);
  fs.writeFileSync(pdfPath, 'PDF stub');

  const parsedSectionsPath = path.join(actFolder, 'parsed-sections.json');
  fs.writeFileSync(parsedSectionsPath, JSON.stringify(parsedData, null, 2), 'utf-8');

  return { actFolder, parsedSectionsPath };
}

function makeDataSource(): DataSource {
  return new DataSource({
    type: 'sqlite',
    database: path.join(tmpDir, `test-${Date.now()}.sqlite`),
    entities: [LegalActEntity, ParsedProvisionEntity],
    synchronize: true,
    logging: false,
  });
}

function makeQdrant(): jest.Mocked<QdrantClientLike> {
  return {
    count: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    getCollections: jest.fn().mockResolvedValue({ collections: [] }),
  } as jest.Mocked<QdrantClientLike>;
}

const dummyEmbed = jest.fn(async (texts: string[]) =>
  texts.map(() => Array(1024).fill(0.01)),
);

async function makeEngine(corpusDir: string, ds: DataSource, qdrant?: jest.Mocked<QdrantClientLike>): Promise<CorpusSyncEngine> {
  return new CorpusSyncEngine(ds, qdrant || makeQdrant(), dummyEmbed, {
    corpusDir,
    collection: 'legal_corpus',
    embeddingVersion: 'test-v1',
    batchSize: 10,
  });
}

// ── Suite 1: Pure utility functions ──────────────────────────────────────────

describe('Utility functions', () => {
  it('computeContentHash returns a 64-char hex string', () => {
    const h = computeContentHash('hello world');
    expect(h).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(h)).toBe(true);
  });

  it('same input always produces same hash', () => {
    expect(computeContentHash('abc')).toBe(computeContentHash('abc'));
  });

  it('different inputs produce different hashes', () => {
    expect(computeContentHash('abc')).not.toBe(computeContentHash('def'));
  });

  it('qdrantPointId returns a valid UUID string', () => {
    const id = qdrantPointId('somehash');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('qdrantPointId is deterministic for same input', () => {
    expect(qdrantPointId('abc')).toBe(qdrantPointId('abc'));
  });

  it('qdrantPointId differs for different content hashes', () => {
    expect(qdrantPointId('hash1')).not.toBe(qdrantPointId('hash2'));
  });

  it('extractKeywords returns array of strings', () => {
    const kw = extractKeywords('The court shall impose a penalty on persons who commit fraud.');
    expect(Array.isArray(kw)).toBe(true);
    expect(kw.length).toBeLessThanOrEqual(8);
  });

  it('extractKeywords returns empty array for empty input', () => {
    expect(extractKeywords('')).toEqual([]);
  });
});

// ── Suite 2: Act discovery ────────────────────────────────────────────────────

describe('discoverActs', () => {
  let corpusDir: string;
  let ds: DataSource;

  beforeAll(async () => {
    corpusDir = path.join(tmpDir, 'corpus-discovery');
    ds = makeDataSource();
    await ds.initialize();
  });

  afterAll(async () => { await ds.destroy(); });

  it('discovers acts with parsed-sections.json', async () => {
    writeActFolder(corpusDir, 'Criminal laws', 'BNS', makeParsedSections('Bharatiya Nyaya Sanhita, 2023', 5));
    const engine = await makeEngine(corpusDir, ds);
    const manifest = engine.discoverActs();
    expect(manifest.length).toBeGreaterThanOrEqual(1);
    expect(manifest.some((m) => m.officialName.includes('Bharatiya Nyaya Sanhita'))).toBe(true);
  });

  it('ignores folders without parsed-sections.json', async () => {
    const emptyFolder = path.join(corpusDir, 'Civil laws', 'EmptyAct');
    fs.mkdirSync(emptyFolder, { recursive: true });
    const engine = await makeEngine(corpusDir, ds);
    const manifest = engine.discoverActs();
    expect(manifest.every((m) => m.folderName !== 'EmptyAct')).toBe(true);
  });

  it('computes a content hash for each act', async () => {
    const engine = await makeEngine(corpusDir, ds);
    const manifest = engine.discoverActs();
    for (const m of manifest) {
      expect(m.contentHash).toHaveLength(64);
    }
  });

  it('returns empty array when corpus dir does not exist', async () => {
    const engine = await makeEngine('/nonexistent/path', ds);
    expect(engine.discoverActs()).toEqual([]);
  });
});

// ── Suite 3: Change detection ─────────────────────────────────────────────────

describe('detectChanges', () => {
  let corpusDir: string;
  let ds: DataSource;

  beforeAll(async () => {
    corpusDir = path.join(tmpDir, 'corpus-changes');
    ds = makeDataSource();
    await ds.initialize();
  });

  afterAll(async () => { await ds.destroy(); });

  it('classifies an act not in DB as NEW', async () => {
    writeActFolder(corpusDir, 'Laws', 'NewAct', makeParsedSections('New Act, 2023', 3));
    const engine = await makeEngine(corpusDir, ds);
    const manifest = engine.discoverActs();
    const changes = await engine.detectChanges(manifest);
    expect(changes.newActs.length).toBeGreaterThanOrEqual(1);
    expect(changes.newActs.some((a) => a.folderName === 'NewAct')).toBe(true);
  });

  it('classifies an act with changed hash as UPDATED', async () => {
    // Write act and sync it to DB first
    const data = makeParsedSections('Old Act, 2020', 2);
    writeActFolder(corpusDir, 'Laws', 'OldAct', data);
    const engine = await makeEngine(corpusDir, ds);
    const manifest = engine.discoverActs();
    const act = manifest.find((m) => m.folderName === 'OldAct')!;

    // Insert into DB with a different hash
    const actRepo = ds.getRepository(LegalActEntity);
    const entity = new LegalActEntity();
    entity.filePath = act.pdfSource;
    entity.actName = act.officialName;
    entity.actId = act.actId;
    entity.shortName = act.shortName;
    entity.aliases = [];
    entity.category = act.category;
    entity.fileSizeBytes = 100;
    entity.lastModifiedDate = new Date();
    entity.pdfHash = 'old-different-hash';
    entity.status = 'active';
    await actRepo.save(entity);

    const changes = await engine.detectChanges(manifest);
    const updated = changes.updated.find((a) => a.folderName === 'OldAct');
    expect(updated).toBeDefined();
  });

  it('classifies an act with matching hash and provisions as UNCHANGED', async () => {
    const data = makeParsedSections('Stable Act, 2015', 2);
    const { parsedSectionsPath } = writeActFolder(corpusDir, 'Laws', 'StableAct', data);
    const rawHash = nodeCrypto.createHash('sha256').update(fs.readFileSync(parsedSectionsPath, 'utf-8')).digest('hex');

    const engine = await makeEngine(corpusDir, ds);
    const manifest = engine.discoverActs();
    const act = manifest.find((m) => m.folderName === 'StableAct')!;

    // Insert act with correct hash
    const actRepo = ds.getRepository(LegalActEntity);
    const entity = new LegalActEntity();
    entity.filePath = act.pdfSource;
    entity.actName = act.officialName;
    entity.actId = act.actId;
    entity.shortName = act.shortName;
    entity.aliases = [];
    entity.category = act.category;
    entity.fileSizeBytes = 100;
    entity.lastModifiedDate = new Date();
    entity.pdfHash = rawHash;
    entity.status = 'active';
    await actRepo.save(entity);

    // Insert provisions for this act (fully synced)
    const provRepo = ds.getRepository(ParsedProvisionEntity);
    const prov = new ParsedProvisionEntity();
    prov.actName = act.officialName;
    prov.actId = act.actId;
    prov.category = act.category;
    prov.content = 'Some content';
    prov.contentHash = computeContentHash('stable-content');
    prov.pdfSource = act.pdfSource;
    prov.embeddingSynced = true;
    prov.embeddingVersion = 'test-v1';
    prov.keywords = [];
    await provRepo.save(prov);

    const changes = await engine.detectChanges(manifest);
    expect(changes.unchanged.some((a) => a.folderName === 'StableAct')).toBe(true);
  });

  it('classifies DB acts whose folder is gone as DELETED', async () => {
    const actRepo = ds.getRepository(LegalActEntity);
    const ghost = new LegalActEntity();
    ghost.filePath = '/nonexistent/GhostAct/Ghost.pdf';
    ghost.actName = 'Ghost Act';
    ghost.actId = 'ghost_act';
    ghost.shortName = 'Ghost';
    ghost.aliases = [];
    ghost.category = 'Lost';
    ghost.fileSizeBytes = 0;
    ghost.lastModifiedDate = new Date();
    ghost.pdfHash = 'abc123';
    ghost.status = 'active';
    await actRepo.save(ghost);

    const engine = await makeEngine(corpusDir, ds);
    const manifest = engine.discoverActs();
    const changes = await engine.detectChanges(manifest);
    expect(changes.deleted).toContain('/nonexistent/GhostAct/Ghost.pdf');
  });
});

// ── Suite 4: syncAct ──────────────────────────────────────────────────────────

describe('syncAct', () => {
  let corpusDir: string;
  let ds: DataSource;
  let qdrant: jest.Mocked<QdrantClientLike>;

  beforeAll(async () => {
    corpusDir = path.join(tmpDir, 'corpus-sync-act');
    ds = makeDataSource();
    await ds.initialize();
    qdrant = makeQdrant();
  });

  afterAll(async () => { await ds.destroy(); });

  it('inserts provisions and generates embeddings for a new act', async () => {
    const data = makeParsedSections('Test Companies Act, 2013', 5);
    writeActFolder(corpusDir, 'Contract', 'CompaniesAct', data);

    const engine = await makeEngine(corpusDir, ds, qdrant);
    const manifest = engine.discoverActs();
    const act = manifest.find((m) => m.folderName === 'CompaniesAct')!;
    const result = await engine.syncAct(act);

    expect(result.provisionsAdded).toBe(5);
    expect(result.embeddingsGenerated).toBe(5);
    expect(qdrant.upsert).toHaveBeenCalled();

    // Verify SQLite rows
    const provRepo = ds.getRepository(ParsedProvisionEntity);
    const dbCount = await provRepo.count({ where: { actName: act.officialName } });
    expect(dbCount).toBe(5);
  });

  it('does not create duplicate provisions on re-sync of same act', async () => {
    const data = makeParsedSections('Idempotent Act, 2020', 3);
    writeActFolder(corpusDir, 'Test', 'IdempotentAct', data);

    const engine = await makeEngine(corpusDir, ds, qdrant);
    const manifest = engine.discoverActs();
    const act = manifest.find((m) => m.folderName === 'IdempotentAct')!;

    await engine.syncAct(act);
    await engine.syncAct(act); // sync again

    const provRepo = ds.getRepository(ParsedProvisionEntity);
    const dbCount = await provRepo.count({ where: { actName: act.officialName } });
    expect(dbCount).toBe(3); // must not double up
  });

  it('marks provisions as embedding_synced=true after sync', async () => {
    const data = makeParsedSections('Synced Act, 2022', 2);
    writeActFolder(corpusDir, 'Test', 'SyncedAct', data);

    const engine = await makeEngine(corpusDir, ds, qdrant);
    const manifest = engine.discoverActs();
    const act = manifest.find((m) => m.folderName === 'SyncedAct')!;
    await engine.syncAct(act);

    const provRepo = ds.getRepository(ParsedProvisionEntity);
    const unsynced = await provRepo.count({ where: { actName: act.officialName, embeddingSynced: false } });
    expect(unsynced).toBe(0);
  });

  it('each provision has a non-empty act_id after sync', async () => {
    const data = makeParsedSections('ActId Test Act, 2021', 4);
    writeActFolder(corpusDir, 'Test', 'ActIdAct', data);

    const engine = await makeEngine(corpusDir, ds, qdrant);
    const manifest = engine.discoverActs();
    const act = manifest.find((m) => m.folderName === 'ActIdAct')!;
    await engine.syncAct(act);

    const provRepo = ds.getRepository(ParsedProvisionEntity);
    const missingActId = await provRepo
      .createQueryBuilder('p')
      .where("p.act_name = :name AND (p.act_id IS NULL OR p.act_id = '')", { name: act.officialName })
      .getCount();
    expect(missingActId).toBe(0);
  });

  it('handles an act with 0 provisions (scanned PDF) without error', async () => {
    const emptyData: ParsedSectionsJson = { actName: 'Scanned Act', category: 'Test', structure: [] };
    writeActFolder(corpusDir, 'Test', 'ScannedAct', emptyData);

    const engine = await makeEngine(corpusDir, ds, qdrant);
    const manifest = engine.discoverActs();
    const act = manifest.find((m) => m.folderName === 'ScannedAct')!;
    const result = await engine.syncAct(act);

    expect(result.provisionsAdded).toBe(0);
    expect(result.embeddingsGenerated).toBe(0);
    // Act record should still be upserted
    const actRepo = ds.getRepository(LegalActEntity);
    const dbAct = await actRepo.findOne({ where: { filePath: act.pdfSource } });
    expect(dbAct).toBeTruthy();
  });
});

// ── Suite 5: deleteAct ────────────────────────────────────────────────────────

describe('deleteAct', () => {
  let ds: DataSource;
  let qdrant: jest.Mocked<QdrantClientLike>;

  beforeAll(async () => {
    ds = makeDataSource();
    await ds.initialize();
    qdrant = makeQdrant();
  });

  afterAll(async () => { await ds.destroy(); });

  it('marks the act as deleted and removes its provisions', async () => {
    const actRepo = ds.getRepository(LegalActEntity);
    const provRepo = ds.getRepository(ParsedProvisionEntity);

    const act = new LegalActEntity();
    act.filePath = '/fake/DeleteMe.pdf';
    act.actName = 'Delete Me Act';
    act.actId = 'delete_me_act';
    act.shortName = 'DM';
    act.aliases = [];
    act.category = 'Test';
    act.fileSizeBytes = 0;
    act.lastModifiedDate = new Date();
    act.pdfHash = 'abc';
    act.status = 'active';
    await actRepo.save(act);

    const prov = new ParsedProvisionEntity();
    prov.actName = 'Delete Me Act';
    prov.actId = 'delete_me_act';
    prov.category = 'Test';
    prov.content = 'Some content';
    prov.contentHash = computeContentHash('dm-content');
    prov.pdfSource = '/fake/DeleteMe.pdf';
    prov.embeddingSynced = true;
    prov.embeddingVersion = 'test-v1';
    prov.keywords = [];
    await provRepo.save(prov);

    const engine = new CorpusSyncEngine(ds, qdrant, dummyEmbed, {
      corpusDir: tmpDir, collection: 'legal_corpus', embeddingVersion: 'test-v1',
    });
    await engine.deleteAct('/fake/DeleteMe.pdf');

    const deleted = await actRepo.findOne({ where: { filePath: '/fake/DeleteMe.pdf' } });
    expect(deleted?.status).toBe('deleted');

    const remaining = await provRepo.count({ where: { pdfSource: '/fake/DeleteMe.pdf' } });
    expect(remaining).toBe(0);

    expect(qdrant.delete).toHaveBeenCalled();
  });
});

// ── Suite 6: validate ─────────────────────────────────────────────────────────

describe('validate', () => {
  let corpusDir: string;
  let ds: DataSource;
  let qdrant: jest.Mocked<QdrantClientLike>;

  beforeAll(async () => {
    corpusDir = path.join(tmpDir, 'corpus-validate');
    ds = makeDataSource();
    await ds.initialize();
    qdrant = makeQdrant();
  });

  afterAll(async () => { await ds.destroy(); });

  it('reports healthy when DB matches corpus and all provisions embedded', async () => {
    const data = makeParsedSections('Healthy Act, 2023', 2);
    writeActFolder(corpusDir, 'Test', 'HealthyAct', data);

    const engine = await makeEngine(corpusDir, ds, qdrant);
    const manifest = engine.discoverActs();
    const act = manifest.find((m) => m.folderName === 'HealthyAct')!;
    await engine.syncAct(act);

    // Mock Qdrant count to match DB count
    const provRepo = ds.getRepository(ParsedProvisionEntity);
    const totalProv = await provRepo.count();
    qdrant.count.mockResolvedValue({ count: totalProv });

    const report = await engine.validate();
    expect(report.provisionsNotEmbedded).toBe(0);
    expect(report.duplicateProvisions).toBe(0);
    expect(report.provisionsMissingActId).toBe(0);
  });

  it('detects unembedded provisions', async () => {
    const provRepo = ds.getRepository(ParsedProvisionEntity);

    const prov = new ParsedProvisionEntity();
    prov.actName = 'Broken Act';
    prov.actId = 'broken_act';
    prov.category = 'Test';
    prov.content = 'Missing embedding content.';
    prov.contentHash = computeContentHash('broken-embed-' + Date.now());
    prov.pdfSource = '/fake/broken.pdf';
    prov.embeddingSynced = false;  // not embedded
    prov.embeddingVersion = '';
    prov.keywords = [];
    await provRepo.save(prov);

    qdrant.count.mockResolvedValue({ count: 0 });

    const engine = await makeEngine(corpusDir, ds, qdrant);
    const report = await engine.validate();
    expect(report.provisionsNotEmbedded).toBeGreaterThan(0);
    expect(report.healthy).toBe(false);
  });
});

// ── Suite 7: Qdrant point ID determinism ─────────────────────────────────────

describe('Qdrant point ID stability', () => {
  it('same provision always maps to same Qdrant point ID', () => {
    const hash = computeContentHash(['ipc', '302', '', '', 'Whoever commits murder'].join(':'));
    const id1 = qdrantPointId(hash);
    const id2 = qdrantPointId(hash);
    expect(id1).toBe(id2);
  });

  it('different provisions map to different Qdrant point IDs', () => {
    const h1 = computeContentHash(['ipc', '302', '', '', 'murder content'].join(':'));
    const h2 = computeContentHash(['ipc', '303', '', '', 'different content'].join(':'));
    expect(qdrantPointId(h1)).not.toBe(qdrantPointId(h2));
  });
});
