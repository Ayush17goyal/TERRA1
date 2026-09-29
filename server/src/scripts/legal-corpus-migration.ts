import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// Load server environment before Nest bootstrap.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, IsNull } from 'typeorm';
import { IngestionModule } from '../modules/ingestion/ingestion.module';
import { RetrievalModule } from '../modules/retrieval/retrieval.module';
import { SettingsModule } from '../modules/settings/settings.module';
import { ParsedProvisionEntity } from '../modules/ingestion/entities/parsed-provision.entity';
import { LegalActEntity } from '../modules/ingestion/entities/legal-act.entity';
import { QdrantService } from '../modules/retrieval/qdrant.service';
import { BgeM3Provider } from '../modules/retrieval/bge-m3.provider';
import { LegalRetrievalService } from '../modules/retrieval/legal-retrieval.service';
import { ActRegistry, ActRegistryEntry } from '../modules/retrieval/act-registry';

const EMBEDDING_VERSION = 'bge-m3-v1';
const BATCH_SIZE = 16;
const FAILED_EMBEDDING_VERSION = 'migration_failed';
const MAX_EMBEDDING_TEXT_CHARS = 4000;

interface CorpusAct {
  actName: string;
  category: string;
  actId: string;
  registry: ActRegistryEntry;
  folderPath: string;
  parsedPath: string;
  pdfPath?: string;
  provisionsInJson: number;
}

interface MigrationReport {
  actsScanned: number;
  actsUpdated: number;
  rowsUpdated: number;
  embeddingsGenerated: number;
  embeddingsUploaded: number;
  failedRows: number;
  skippedRows: number;
  failedActs: Array<{ act: string; reason: string }>;
  validation: Array<{ query: string; expectedActId: string; passed: boolean; rows: number; retrievedActIds: string[]; reason?: string }>;
}

const defaultSqlitePath = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || '', 'LEGATRIXON', 'legatrixon_db.sqlite')
  : path.resolve(process.cwd(), 'legatrixon_db.sqlite');
const sqliteDatabasePath = process.env.SQLITE_DB_PATH || defaultSqlitePath;

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: sqliteDatabasePath,
      autoLoadEntities: true,
      synchronize: true,
    }),
    SettingsModule,
    IngestionModule,
    RetrievalModule,
  ],
})
class LegalCorpusMigrationModule {}

function normalizeActName(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function namesEquivalent(a: string, b: string): boolean {
  const na = normalizeActName(a).replace(/\b(18|19|20)\d{2}\b/g, '').trim();
  const nb = normalizeActName(b).replace(/\b(18|19|20)\d{2}\b/g, '').trim();
  return Boolean(na && nb && (na === nb || na.includes(nb) || nb.includes(na)));
}

function computeContentHash(row: ParsedProvisionEntity, actId: string): string {
  return crypto
    .createHash('sha256')
    .update([actId, row.section || '', row.subsection || '', row.clause || '', row.content || ''].join(':'))
    .digest('hex');
}

function findParsedSectionFiles(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) findParsedSectionFiles(fullPath, out);
    else if (item.isFile() && item.name === 'parsed-sections.json') out.push(fullPath);
  }
}

function findPdfInFolder(folderPath: string): string | undefined {
  const pdf = fs.readdirSync(folderPath).find((name) => name.toLowerCase().endsWith('.pdf'));
  return pdf ? path.join(folderPath, pdf) : undefined;
}

function countSections(nodes: any[]): number {
  let count = 0;
  for (const node of nodes || []) {
    if (node?.type === 'section') count++;
    if (Array.isArray(node?.children)) count += countSections(node.children);
  }
  return count;
}

function readCorpusActs(corpusDir: string, report: MigrationReport): CorpusAct[] {
  const parsedFiles: string[] = [];
  findParsedSectionFiles(corpusDir, parsedFiles);

  const acts: CorpusAct[] = [];
  for (const parsedPath of parsedFiles) {
    try {
      const json = JSON.parse(fs.readFileSync(parsedPath, 'utf-8'));
      const folderPath = path.dirname(parsedPath);
      const actName = String(json.actName || path.basename(folderPath));
      const category = String(json.category || path.basename(path.dirname(folderPath)) || 'Unknown');
      const registry = ActRegistry.resolveByName(actName);
      acts.push({
        actName,
        category,
        actId: registry.actId,
        registry,
        folderPath,
        parsedPath,
        pdfPath: findPdfInFolder(folderPath),
        provisionsInJson: countSections(json.structure || []),
      });
    } catch (err: any) {
      report.failedActs.push({ act: parsedPath, reason: 'Could not read parsed-sections.json: ' + err.message });
    }
  }

  const pdfFiles: string[] = [];
  findPdfFiles(corpusDir, pdfFiles);
  const parsedFolders = new Set(acts.map((act) => path.resolve(act.folderPath).toLowerCase()));
  for (const pdfFile of pdfFiles) {
    const folder = path.dirname(pdfFile);
    if (!parsedFolders.has(path.resolve(folder).toLowerCase())) {
      report.failedActs.push({ act: folder, reason: 'Missing parsed-sections.json; migration did not recreate parser output.' });
    }
  }

  return acts;
}

function findPdfFiles(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) findPdfFiles(fullPath, out);
    else if (item.isFile() && item.name.toLowerCase().endsWith('.pdf')) out.push(fullPath);
  }
}

function findCorpusActForRow(row: ParsedProvisionEntity, corpusActs: CorpusAct[]): CorpusAct | null {
  const bySource = corpusActs.find((act) => row.pdfSource && act.pdfPath && path.resolve(row.pdfSource).toLowerCase() === path.resolve(act.pdfPath).toLowerCase());
  if (bySource) return bySource;
  const byName = corpusActs.find((act) => namesEquivalent(row.actName, act.actName) || namesEquivalent(row.actName, act.registry.officialName));
  return byName || null;
}

async function repairLegalActs(dataSource: DataSource, corpusActs: CorpusAct[], report: MigrationReport): Promise<Map<string, CorpusAct>> {
  const repo = dataSource.getRepository(LegalActEntity);
  const changedActs = new Set<string>();
  const byActId = new Map<string, CorpusAct>();
  corpusActs.forEach((act) => byActId.set(act.actId, act));

  for (const corpusAct of corpusActs) {
    const qb = repo.createQueryBuilder('a')
      .where('(a.actId IS NULL OR a.actId = :blank)', { blank: '' })
      .andWhere('(lower(a.actName) LIKE :name OR lower(a.filePath) LIKE :folder)', {
        name: '%' + normalizeActName(corpusAct.actName).replace(/ /g, '%') + '%',
        folder: '%' + path.basename(corpusAct.folderPath).toLowerCase() + '%',
      });
    const acts = await qb.getMany();
    for (const act of acts) {
      act.actId = corpusAct.actId;
      act.actName = corpusAct.registry.officialName;
      act.shortName = corpusAct.registry.shortName;
      act.aliases = corpusAct.registry.aliases;
      act.year = corpusAct.registry.year;
      act.status = corpusAct.registry.status;
      await repo.save(act);
      changedActs.add(corpusAct.actId);
    }
  }

  // Also repair DB acts not represented by parsed JSON, using the centralized registry.
  const missingActRows = await repo.createQueryBuilder('a')
    .where('a.actId IS NULL OR a.actId = :blank', { blank: '' })
    .getMany();
  for (const act of missingActRows) {
    const registry = ActRegistry.resolveByName([act.actName, act.filePath].filter(Boolean).join(' '));
    if (!registry.actId || registry.actId === 'unknown_act') continue;
    act.actId = registry.actId;
    act.actName = registry.officialName;
    act.shortName = registry.shortName;
    act.aliases = registry.aliases;
    act.year = registry.year;
    act.status = registry.status;
    await repo.save(act);
    changedActs.add(registry.actId);
  }

  report.actsUpdated = changedActs.size;
  return byActId;
}

async function repairProvisionActIds(dataSource: DataSource, corpusActs: CorpusAct[], report: MigrationReport): Promise<void> {
  const repo = dataSource.getRepository(ParsedProvisionEntity);
  const rows = await repo.createQueryBuilder('p')
    .where('p.actId IS NULL OR p.actId = :blank', { blank: '' })
    .getMany();

  for (const row of rows) {
    try {
      const corpusAct = findCorpusActForRow(row, corpusActs);
      const registry = corpusAct?.registry ?? ActRegistry.resolveByName([row.actName, row.pdfSource].filter(Boolean).join(' '));
      if (!registry.actId || registry.actId === 'unknown_act') {
        report.failedRows++;
        continue;
      }
      row.actId = registry.actId;
      row.actName = registry.officialName;
      row.contentHash = row.contentHash || computeContentHash(row, registry.actId);
      await repo.save(row);
      report.rowsUpdated++;
    } catch (err) {
      report.failedRows++;
    }
  }
}

async function repairEmbeddings(
  dataSource: DataSource,
  qdrant: QdrantService,
  embeddings: BgeM3Provider,
  report: MigrationReport,
): Promise<void> {
  const repo = dataSource.getRepository(ParsedProvisionEntity);
  await qdrant.initializeLegalCorpusCollection();

  const unresolvedRows = await repo.createQueryBuilder('p')
    .where('(p.embeddingSynced = :falseValue OR p.embeddingSynced IS NULL)', { falseValue: false })
    .andWhere('(p.actId IS NULL OR p.actId = :blank)', { blank: '' })
    .getCount();
  if (unresolvedRows > 0) {
    report.failedRows += unresolvedRows;
    console.warn('Unsynced rows without act_id:', unresolvedRows);
  }

  let batchNo = 0;
  while (true) {
    const candidates = await repo.createQueryBuilder('p')
      .where('(p.embeddingSynced = :falseValue OR p.embeddingSynced IS NULL)', { falseValue: false })
      .andWhere('p.actId IS NOT NULL')
      .andWhere('p.actId <> :blank', { blank: '' })
      .andWhere('(p.embeddingVersion IS NULL OR p.embeddingVersion <> :failedVersion)', { failedVersion: FAILED_EMBEDDING_VERSION })
      .orderBy('p.actName', 'ASC')
      .addOrderBy('p.section', 'ASC')
      .take(BATCH_SIZE)
      .getMany();
    if (candidates.length === 0) break;

    batchNo++;
    console.log('Embedding repair batch', batchNo, 'rows', candidates.length, 'first=', candidates[0].actName + ' Section ' + (candidates[0].section || ''));

    try {
      const texts = candidates.map((row) => [row.title, row.content].filter(Boolean).join('. ').slice(0, MAX_EMBEDDING_TEXT_CHARS));
      const vectors = await embeddings.generateBatchEmbeddings(texts);
      report.embeddingsGenerated += vectors.length;

      const points = candidates.map((row, index) => ({
        id: row.id,
        vector: vectors[index],
        payload: {
          source_id: row.id,
          pdf_source: row.pdfSource,
          document_type: 'act',
          embedding_version: EMBEDDING_VERSION,
          act_id: row.actId,
          act_name: row.actName,
          short_name: ActRegistry.resolveByName(row.actName).shortName,
          category: row.category,
          part: row.part || '',
          chapter: row.chapter || '',
          section: row.section || '',
          subsection: row.subsection || '',
          clause: row.clause || '',
          title: row.title || '',
          text: row.content,
          keywords: row.keywords || [],
          content_hash: row.contentHash || computeContentHash(row, row.actId),
        },
      }));

      await qdrant.getClient().upsert(QdrantService.COLLECTION, { wait: true, points });
      report.embeddingsUploaded += points.length;
      console.log('Uploaded embedding batch', batchNo, 'points', points.length);

      for (const row of candidates) {
        row.embeddingSynced = true;
        row.embeddingVersion = EMBEDDING_VERSION;
        row.contentHash = row.contentHash || computeContentHash(row, row.actId);
      }
      await repo.save(candidates);
    } catch (err: any) {
      report.failedRows += candidates.length;
      console.error('Embedding repair batch failed:', err.message);
      for (const row of candidates) {
        row.embeddingSynced = false;
        row.embeddingVersion = FAILED_EMBEDDING_VERSION;
      }
      await repo.save(candidates);
      continue;
    }
  }
}

async function validateRetrieval(retrieval: LegalRetrievalService, report: MigrationReport): Promise<void> {
  const tests = [
    { query: 'Explain Section 10 of Indian Contract Act', expectedActId: 'indian_contract_act_1872', expectedNumber: '10' },
    { query: 'Explain Section 16 of Companies Act', expectedActId: 'companies_act_2013', expectedNumber: '16' },
    { query: 'Explain Article 21 Constitution', expectedActId: 'constitution_of_india', expectedNumber: '21' },
    { query: 'Explain Section 63 BNS', expectedActId: 'bharatiya_nyaya_sanhita_2023', expectedNumber: '63' },
  ];

  for (const test of tests) {
    const result = await retrieval.retrieveLegalContext(test.query, 5);
    const actIds = [...new Set(result.provisions.map((p) => p.actId).filter(Boolean))];
    const numbers = [...new Set(result.provisions.map((p) => p.section).filter(Boolean))];
    const passed = result.provisions.length > 0 && actIds.length === 1 && actIds[0] === test.expectedActId;
    const numberMismatch = test.expectedNumber && numbers.length > 0 && !numbers.includes(test.expectedNumber);
    report.validation.push({
      query: test.query,
      expectedActId: test.expectedActId,
      passed: passed && !numberMismatch,
      rows: result.provisions.length,
      retrievedActIds: actIds,
      reason: !passed
        ? (result.log.failureReason || 'Expected one Act ' + test.expectedActId + ', got [' + actIds.join(', ') + ']')
        : numberMismatch
          ? 'Retrieved correct Act but did not include requested number ' + test.expectedNumber + '; sections returned: ' + numbers.join(', ')
          : undefined,
    });
  }
}

function printReport(report: MigrationReport): void {
  console.log('\nLEGAL CORPUS MIGRATION REPORT');
  console.log('Acts Scanned:', report.actsScanned);
  console.log('Acts Updated:', report.actsUpdated);
  console.log('Rows Updated:', report.rowsUpdated);
  console.log('Embeddings Generated:', report.embeddingsGenerated);
  console.log('Embeddings Uploaded:', report.embeddingsUploaded);
  console.log('Failed Rows:', report.failedRows);
  console.log('Skipped Rows:', report.skippedRows);

  if (report.failedActs.length) {
    console.log('\nFailed/Skipped Acts:');
    for (const item of report.failedActs) console.log('-', item.act + ': ' + item.reason);
  }

  console.log('\nPost-Migration Retrieval Tests:');
  for (const item of report.validation) {
    console.log('-', item.passed ? 'PASS' : 'FAIL', '|', item.query, '| rows=' + item.rows, '| acts=' + (item.retrievedActIds.join(', ') || '(none)'));
    if (item.reason) console.log('  Reason:', item.reason);
  }
}

async function run() {
  console.log('LEGAL CORPUS MIGRATION');
  console.log('SQLite database:', sqliteDatabasePath);
  console.log('Qdrant collection:', QdrantService.COLLECTION);

  const app = await NestFactory.createApplicationContext(LegalCorpusMigrationModule, { logger: ['error', 'warn', 'log'] });
  const dataSource = app.get(DataSource);
  const qdrant = app.get(QdrantService);
  const embeddings = app.get(BgeM3Provider);
  const retrieval = app.get(LegalRetrievalService);

  const report: MigrationReport = {
    actsScanned: 0,
    actsUpdated: 0,
    rowsUpdated: 0,
    embeddingsGenerated: 0,
    embeddingsUploaded: 0,
    failedRows: 0,
    skippedRows: 0,
    failedActs: [],
    validation: [],
  };

  try {
    const corpusDir = process.env.CORPUS_DIR ? path.resolve(process.env.CORPUS_DIR) : path.resolve(__dirname, '../../../corpus-data');
    console.log('Corpus directory:', corpusDir);
    const corpusActs = readCorpusActs(corpusDir, report);
    report.actsScanned = corpusActs.length;
    console.log('Parsed Acts discovered:', corpusActs.length);

    await repairLegalActs(dataSource, corpusActs, report);
    await repairProvisionActIds(dataSource, corpusActs, report);
    await repairEmbeddings(dataSource, qdrant, embeddings, report);
    await validateRetrieval(retrieval, report);
    printReport(report);

    if (report.validation.some((item) => !item.passed)) process.exitCode = 1;
    if (report.failedRows > 0) process.exitCode = 1;
  } catch (err: any) {
    console.error('Legal corpus migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await app.close();
    process.exit(process.exitCode || 0);
  }
}

run();
