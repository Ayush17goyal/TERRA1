/**
 * corpus-sync.engine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure-logic synchronization engine — no NestJS, no global state.
 * Injected dependencies: TypeORM DataSource, Qdrant client, embed function.
 *
 * Pipeline:
 *   corpus-data/act-folder/parsed-sections.json
 *     → SQLite (legal_acts + parsed_provisions)
 *     → Embeddings
 *     → Qdrant (legal_corpus collection)
 *
 * Change detection: SHA-256 of parsed-sections.json
 * Qdrant point IDs: deterministic UUID-v5(content_hash, QDRANT_NS)
 *   → upserts are fully idempotent
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { LegalActEntity } from './entities/legal-act.entity';
import { ParsedProvisionEntity } from './entities/parsed-provision.entity';
import { ActRegistry } from '../retrieval/act-registry';
import { flattenProvisions } from './indian-legal-parser';

// ── Inline UUID v5 (RFC 4122) — avoids importing the ESM-only `uuid` package ─
// Namespace UUID for LEGATRIXON Qdrant point IDs
const QDRANT_NS_HEX = '1b671a6440d5491e99b0da01ff1f3341';

function uuidv5(name: string): string {
  const nsBytes = Buffer.from(QDRANT_NS_HEX, 'hex');
  const nameBytes = Buffer.from(name, 'utf-8');
  const hash = crypto.createHash('sha1').update(Buffer.concat([nsBytes, nameBytes])).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // variant RFC 4122
  const h = hash.toString('hex');
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20, 32)].join('-');
}

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ParsedSectionsJson {
  actName: string;
  officialName?: string;
  shortName?: string;
  category: string;
  year?: number;
  summary?: Record<string, number>;
  structure: any[];
}

export interface ActManifest {
  actFolder: string;
  category: string;
  folderName: string;
  parsedSectionsPath: string;
  pdfPath: string | null;
  parsedData: ParsedSectionsJson;
  contentHash: string;
  officialName: string;
  shortName: string;
  year?: number;
  actId: string;
  pdfSource: string;
}

export interface SyncReport {
  actsFound: number;
  actsUpdated: number;
  actsSkipped: number;
  actsDeleted: number;
  sectionsAdded: number;
  sectionsUpdated: number;
  embeddingsGenerated: number;
  embeddingsRepaired: number;
  duplicateRowsRemoved: number;
  duplicateEmbeddingsRemoved: number;
  failedActs: string[];
  overallHealthPercent: number;
  details: ActSyncDetail[];
}

export interface ActSyncDetail {
  actName: string;
  status: 'synced' | 'skipped' | 'deleted' | 'failed' | 'empty';
  reason?: string;
  provisionsAdded?: number;
  embeddingsGenerated?: number;
}

export interface ValidationReport {
  totalActs: number;
  actsInDb: number;
  actsMissingFromDb: number;
  totalProvisions: number;
  provisionsMissingActId: number;
  provisionsMissingContent: number;
  provisionsNotEmbedded: number;
  dbCount: number;
  qdrantCount: number;
  countMismatch: boolean;
  duplicateProvisions: number;
  healthy: boolean;
  issues: string[];
}

export interface RepairReport {
  embeddingsRepaired: number;
  actIdRepaired: number;
  duplicatesRemoved: number;
  failedRepairs: string[];
}

export interface SyncEngineOptions {
  corpusDir: string;
  collection: string;
  embeddingVersion: string;
  batchSize?: number;
}

// ── QdrantClient interface (matches @qdrant/js-client-rest) ──────────────────

export interface QdrantClientLike {
  count(collection: string, params?: any): Promise<{ count: number }>;
  upsert(collection: string, params: any): Promise<any>;
  delete(collection: string, params: any): Promise<any>;
  getCollections(): Promise<any>;
  createCollection?(collection: string, params: any): Promise<any>;
  search?(collection: string, params: any): Promise<any[]>;
}

// ── Core Engine ───────────────────────────────────────────────────────────────

export class CorpusSyncEngine {
  private readonly legalActRepo: Repository<LegalActEntity>;
  private readonly provisionRepo: Repository<ParsedProvisionEntity>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly qdrant: QdrantClientLike,
    private readonly embed: (texts: string[]) => Promise<number[][]>,
    private readonly options: SyncEngineOptions,
  ) {
    this.legalActRepo = dataSource.getRepository(LegalActEntity);
    this.provisionRepo = dataSource.getRepository(ParsedProvisionEntity);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async sync(): Promise<SyncReport> {
    const manifest = this.discoverActs();
    const changes = await this.detectChanges(manifest);

    const report: SyncReport = {
      actsFound: manifest.length,
      actsUpdated: 0,
      actsSkipped: changes.unchanged.length,
      actsDeleted: 0,
      sectionsAdded: 0,
      sectionsUpdated: 0,
      embeddingsGenerated: 0,
      embeddingsRepaired: 0,
      duplicateRowsRemoved: 0,
      duplicateEmbeddingsRemoved: 0,
      failedActs: [],
      overallHealthPercent: 0,
      details: [],
    };

    // Sync new and updated acts
    const toSync = [...changes.newActs, ...changes.updated];
    console.log(`  Changes: ${changes.newActs.length} new, ${changes.updated.length} updated, ${changes.unchanged.length} unchanged, ${changes.deleted.length} deleted`);
    for (const act of toSync) {
      process.stdout.write(`  ── ${act.officialName.substring(0, 48).padEnd(48)} `);
      try {
        const result = await this.syncAct(act);
        report.actsUpdated++;
        report.sectionsAdded += result.provisionsAdded;
        report.embeddingsGenerated += result.embeddingsGenerated;
        report.duplicateRowsRemoved += result.duplicatesRemoved;
        console.log(result.provisionsAdded === 0 ? '○ (no provisions)' : `✓ ${result.provisionsAdded}§ ${result.embeddingsGenerated}v`);
        report.details.push({
          actName: act.officialName,
          status: result.provisionsAdded === 0 ? 'empty' : 'synced',
          provisionsAdded: result.provisionsAdded,
          embeddingsGenerated: result.embeddingsGenerated,
          reason: result.provisionsAdded === 0 ? 'No provisions extracted (possibly scanned PDF)' : undefined,
        });
      } catch (err: any) {
        console.log(`✗ ${err.message.substring(0, 40)}`);
        report.failedActs.push(act.officialName);
        report.details.push({ actName: act.officialName, status: 'failed', reason: err.message });
      }
    }

    // Mark skipped acts in details
    for (const act of changes.unchanged) {
      report.details.push({ actName: act.officialName, status: 'skipped' });
    }

    // Mark deleted acts
    for (const filePath of changes.deleted) {
      try {
        await this.deleteAct(filePath);
        report.actsDeleted++;
        report.details.push({ actName: filePath, status: 'deleted' });
      } catch (err: any) {
        report.failedActs.push(filePath);
      }
    }

    // Repair missing embeddings across all acts
    const repaired = await this.repairMissingEmbeddings();
    report.embeddingsRepaired = repaired;

    // Remove duplicate rows
    const dupRows = await this.removeDuplicateProvisions();
    report.duplicateRowsRemoved += dupRows;

    // Compute health
    const validation = await this.validate();
    report.overallHealthPercent = validation.healthy
      ? 100
      : Math.round(
          ((validation.totalProvisions - validation.provisionsNotEmbedded - validation.provisionsMissingActId) /
            Math.max(validation.totalProvisions, 1)) *
            100,
        );

    return report;
  }

  async validate(): Promise<ValidationReport> {
    const manifest = this.discoverActs();
    const issues: string[] = [];

    // DB counts
    const totalProvisions = await this.provisionRepo.count();
    const actsInDb = await this.legalActRepo.count({ where: { status: 'active' } });

    // Missing act_id
    const provisionsMissingActId = await this.provisionRepo
      .createQueryBuilder('p')
      .where("p.act_id IS NULL OR p.act_id = ''")
      .getCount();

    // Missing content
    const provisionsMissingContent = await this.provisionRepo
      .createQueryBuilder('p')
      .where("p.content IS NULL OR p.content = ''")
      .getCount();

    // Not embedded
    const provisionsNotEmbedded = await this.provisionRepo.count({ where: { embeddingSynced: false } });

    // Qdrant count
    let qdrantCount = 0;
    try {
      const info = await this.qdrant.count(this.options.collection, {});
      qdrantCount = info.count;
    } catch {
      issues.push('Could not reach Qdrant to get vector count');
    }

    // Duplicate provisions: same content_hash within same act
    const dupResult: any[] = await this.dataSource.query(
      `SELECT content_hash, COUNT(*) as cnt FROM parsed_provisions GROUP BY content_hash HAVING cnt > 1`,
    );
    const duplicateProvisions = dupResult.reduce((s: number, r: any) => s + (parseInt(r.cnt) - 1), 0);

    // Acts missing from DB
    const dbActFilePaths = new Set(
      (await this.legalActRepo.find({ where: { status: 'active' } })).map((a) => a.filePath),
    );
    const actsMissingFromDb = manifest.filter((m) => !dbActFilePaths.has(m.pdfSource)).length;

    const countMismatch = Math.abs(totalProvisions - qdrantCount) > 5;

    if (actsMissingFromDb > 0) issues.push(`${actsMissingFromDb} act(s) in corpus-data not in SQLite`);
    if (provisionsMissingActId > 0) issues.push(`${provisionsMissingActId} provision(s) missing act_id`);
    if (provisionsMissingContent > 0) issues.push(`${provisionsMissingContent} provision(s) missing content`);
    if (provisionsNotEmbedded > 0) issues.push(`${provisionsNotEmbedded} provision(s) not embedded`);
    if (countMismatch) issues.push(`SQLite has ${totalProvisions} provisions but Qdrant has ${qdrantCount} vectors`);
    if (duplicateProvisions > 0) issues.push(`${duplicateProvisions} duplicate provision row(s) detected`);

    return {
      totalActs: manifest.length,
      actsInDb,
      actsMissingFromDb,
      totalProvisions,
      provisionsMissingActId,
      provisionsMissingContent,
      provisionsNotEmbedded,
      dbCount: totalProvisions,
      qdrantCount,
      countMismatch,
      duplicateProvisions,
      healthy: issues.length === 0,
      issues,
    };
  }

  async repair(): Promise<RepairReport> {
    const report: RepairReport = {
      embeddingsRepaired: 0,
      actIdRepaired: 0,
      duplicatesRemoved: 0,
      failedRepairs: [],
    };

    // 1. Repair missing act_ids
    const noActId = await this.provisionRepo
      .createQueryBuilder('p')
      .where("p.act_id IS NULL OR p.act_id = ''")
      .getMany();

    for (const prov of noActId) {
      const entry = ActRegistry.resolveByName(prov.actName);
      if (entry.actId && entry.actId !== 'unknown_act') {
        await this.provisionRepo.update(prov.id, { actId: entry.actId });
        report.actIdRepaired++;
      }
    }

    // 2. Re-embed unsynced provisions
    report.embeddingsRepaired = await this.repairMissingEmbeddings();

    // 3. Remove duplicate rows
    report.duplicatesRemoved = await this.removeDuplicateProvisions();

    return report;
  }

  // ── Discovery ───────────────────────────────────────────────────────────────

  discoverActs(): ActManifest[] {
    const corpusDir = this.options.corpusDir;
    const manifests: ActManifest[] = [];

    if (!fs.existsSync(corpusDir)) return manifests;

    for (const catEntry of fs.readdirSync(corpusDir, { withFileTypes: true })) {
      const catPath = path.join(corpusDir, catEntry.name);
      if (!fs.statSync(catPath).isDirectory()) continue;

      for (const actEntry of fs.readdirSync(catPath, { withFileTypes: true })) {
        const actFolder = path.join(catPath, actEntry.name);
        if (!fs.statSync(actFolder).isDirectory()) continue;

        const parsedSectionsPath = path.join(actFolder, 'parsed-sections.json');
        if (!fs.existsSync(parsedSectionsPath)) continue;

        try {
          const raw = fs.readFileSync(parsedSectionsPath, 'utf-8');
          const parsedData: ParsedSectionsJson = JSON.parse(raw);
          const contentHash = crypto.createHash('sha256').update(raw).digest('hex');

          // Find PDF in folder
          const files = fs.readdirSync(actFolder);
          const pdfFile = files.find((f) => f.toLowerCase().endsWith('.pdf'));
          const pdfPath = pdfFile ? path.join(actFolder, pdfFile) : null;
          const pdfSource = pdfPath || actFolder;

          const officialName = parsedData.officialName || parsedData.actName;
          const registryEntry = ActRegistry.resolveByName(officialName);

          manifests.push({
            actFolder,
            category: catEntry.name,
            folderName: actEntry.name,
            parsedSectionsPath,
            pdfPath,
            parsedData,
            contentHash,
            officialName,
            shortName: parsedData.shortName || registryEntry.shortName,
            year: parsedData.year || registryEntry.year,
            actId: registryEntry.actId,
            pdfSource,
          });
        } catch {
          // Malformed parsed-sections.json — skip
        }
      }
    }

    return manifests;
  }

  // ── Change Detection ────────────────────────────────────────────────────────

  async detectChanges(manifest: ActManifest[]): Promise<{
    newActs: ActManifest[];
    updated: ActManifest[];
    unchanged: ActManifest[];
    deleted: string[];
  }> {
    const allDbActs = await this.legalActRepo.find({ where: { status: 'active' } });
    const dbByFilePath = new Map(allDbActs.map((a) => [a.filePath, a]));

    const newActs: ActManifest[] = [];
    const updated: ActManifest[] = [];
    const unchanged: ActManifest[] = [];
    const seenFilePaths = new Set<string>();

    for (const act of manifest) {
      seenFilePaths.add(act.pdfSource);
      const existing = dbByFilePath.get(act.pdfSource);

      if (!existing) {
        newActs.push(act);
      } else if (existing.pdfHash !== act.contentHash) {
        updated.push(act);
      } else {
        // Also check if provisions exist and are fully embedded
        const provCount = await this.provisionRepo.count({ where: { pdfSource: act.pdfSource } });
        const unsynced = await this.provisionRepo.count({
          where: { pdfSource: act.pdfSource, embeddingSynced: false },
        });
        if (provCount === 0 || unsynced > 0) {
          updated.push(act);
        } else {
          unchanged.push(act);
        }
      }
    }

    // Deleted = in DB but no longer in corpus
    const deleted = allDbActs
      .filter((a) => !seenFilePaths.has(a.filePath))
      .map((a) => a.filePath);

    return { newActs, updated, unchanged, deleted };
  }

  // ── Act-level Sync ──────────────────────────────────────────────────────────

  async syncAct(act: ActManifest): Promise<{
    provisionsAdded: number;
    embeddingsGenerated: number;
    duplicatesRemoved: number;
  }> {
    // Clear stale provisions from SQLite
    const existingCount = await this.provisionRepo.count({ where: { pdfSource: act.pdfSource } });
    if (existingCount > 0) {
      await this.provisionRepo.delete({ pdfSource: act.pdfSource });
    }

    // Clear stale Qdrant vectors
    try {
      const info = await this.qdrant.count(this.options.collection, {
        filter: { must: [{ key: 'pdf_source', match: { value: act.pdfSource } }] },
      });
      if (info.count > 0) {
        await this.qdrant.delete(this.options.collection, {
          filter: { must: [{ key: 'pdf_source', match: { value: act.pdfSource } }] },
        });
      }
    } catch {
      // Qdrant not available — continue, embeddings will be repaired later
    }

    // Flatten provisions from parsed structure
    const flatProvisions = flattenProvisions(act.parsedData.structure || []);

    if (flatProvisions.length === 0) {
      // Upsert the act record even if there are no provisions (e.g., scanned PDF)
      await this.upsertActRecord(act, 0);
      return { provisionsAdded: 0, embeddingsGenerated: 0, duplicatesRemoved: 0 };
    }

    // Build provision entities
    const seenHashes = new Set<string>();
    const entities: ParsedProvisionEntity[] = [];

    for (const prov of flatProvisions) {
      const sectionKey = prov.section || (prov.article ? 'Article ' + prov.article : '');
      const rawHash = computeContentHash(
        [act.actId, sectionKey, prov.subsection || '', prov.clause || '', prov.content || ''].join(':'),
      );

      if (seenHashes.has(rawHash)) continue; // skip intra-act duplicates
      seenHashes.add(rawHash);

      const entity = new ParsedProvisionEntity();
      entity.actName = act.officialName;
      entity.actId = act.actId;
      entity.category = act.category;
      entity.part = prov.part || '';
      entity.chapter = prov.chapter || '';
      entity.section = sectionKey;
      entity.subsection = prov.subsection || '';
      entity.clause = prov.clause || '';
      entity.title = prov.title || '';
      entity.content = prov.content;
      entity.keywords = extractKeywords(prov.content);
      entity.contentHash = rawHash;
      entity.pdfSource = act.pdfSource;
      entity.embeddingSynced = false;
      entity.embeddingVersion = '';
      entities.push(entity);
    }

    // Save to SQLite in batches
    const saved: ParsedProvisionEntity[] = [];
    const DB_BATCH = 100;
    for (let i = 0; i < entities.length; i += DB_BATCH) {
      const batch = await this.provisionRepo.save(entities.slice(i, i + DB_BATCH));
      saved.push(...batch);
    }

    // Generate embeddings and upsert to Qdrant
    let embeddingsGenerated = 0;
    try {
      embeddingsGenerated = await this.generateAndUpsert(saved, act);
    } catch {
      // Embeddings will be repaired by the post-sync repair pass
    }

    // Upsert act metadata
    await this.upsertActRecord(act, saved.length);

    return { provisionsAdded: saved.length, embeddingsGenerated, duplicatesRemoved: 0 };
  }

  async deleteAct(filePath: string): Promise<void> {
    if (!filePath || typeof filePath !== 'string' || !filePath.trim()) return;
    const existing = await this.legalActRepo.findOne({ where: { filePath } });
    if (existing) {
      existing.status = 'deleted';
      await this.legalActRepo.save(existing);
    }
    await this.provisionRepo.delete({ pdfSource: filePath });
    try {
      await this.qdrant.delete(this.options.collection, {
        filter: { must: [{ key: 'pdf_source', match: { value: filePath } }] },
      });
    } catch {
      // OK if Qdrant is unavailable
    }
  }

  // ── Embedding Generation ────────────────────────────────────────────────────

  async generateAndUpsert(entities: ParsedProvisionEntity[], act: ActManifest): Promise<number> {
    const BATCH = this.options.batchSize ?? 50;
    let totalUpserted = 0;

    for (let i = 0; i < entities.length; i += BATCH) {
      const batchEntities = entities.slice(i, i + BATCH);
      const texts = batchEntities.map((e) => [e.title, e.content].filter(Boolean).join('. '));

      const embeddings = await this.embed(texts);

      const points = batchEntities.map((entity, j) => {
        const isConstitution = /constitution/i.test(entity.actName);
        const docType = isConstitution ? 'Constitution' : 'Bare Act';
        const sectionNum = entity.section?.replace(/^(Article|Section)\s+/i, '').trim() || entity.section || '';

        return {
          id: uuidv5(entity.contentHash),
          vector: embeddings[j],
          payload: {
            source_id: entity.id,
            pdf_source: entity.pdfSource,
            document_type: docType,
            documentType: docType,
            embedding_version: this.options.embeddingVersion,
            act_id: entity.actId,
            act_name: entity.actName,
            actName: entity.actName,
            act_short_name: act.shortName || entity.actName,
            short_name: act.shortName || entity.actName,
            category: entity.category,
            part: entity.part || '',
            chapter: entity.chapter || '',
            section: entity.section || '',
            section_number: sectionNum,
            sectionNumber: sectionNum,
            article_number: isConstitution ? sectionNum : '',
            articleNumber: isConstitution ? sectionNum : '',
            subsection: entity.subsection || '',
            clause: entity.clause || '',
            title: entity.title || '',
            content: entity.content,
            text: entity.content,
            year: act.year || null,
            jurisdiction: 'India',
            keywords: entity.keywords,
            content_hash: entity.contentHash,
          },
        };
      });

      await this.qdrant.upsert(this.options.collection, { wait: true, points });

      // Mark synced in SQLite
      const ids = batchEntities.map((e) => e.id);
      await this.provisionRepo
        .createQueryBuilder()
        .update(ParsedProvisionEntity)
        .set({ embeddingSynced: true, embeddingVersion: this.options.embeddingVersion })
        .whereInIds(ids)
        .execute();

      totalUpserted += batchEntities.length;
    }

    return totalUpserted;
  }

  // ── Repair ──────────────────────────────────────────────────────────────────

  async repairMissingEmbeddings(): Promise<number> {
    const PAGE = 200;
    let offset = 0;
    let repaired = 0;

    while (true) {
      const batch = await this.provisionRepo.find({
        where: { embeddingSynced: false },
        take: PAGE,
        skip: offset,
      });
      if (batch.length === 0) break;

      // Group by act for act metadata lookup
      const byAct = new Map<string, ParsedProvisionEntity[]>();
      for (const p of batch) {
        const list = byAct.get(p.actName) || [];
        list.push(p);
        byAct.set(p.actName, list);
      }

      for (const [actName, provisions] of byAct) {
        try {
          const registryEntry = ActRegistry.resolveByName(actName);
          const dummyManifest = {
            actId: registryEntry.actId,
            shortName: registryEntry.shortName,
            officialName: actName,
            category: provisions[0].category,
            pdfSource: provisions[0].pdfSource,
          } as ActManifest;
          repaired += await this.generateAndUpsert(provisions, dummyManifest);
        } catch {
          // Skip failed acts — they'll show in validation
        }
      }

      offset += PAGE;
    }

    return repaired;
  }

  async removeDuplicateProvisions(): Promise<number> {
    const dupRows: any[] = await this.dataSource.query(
      `SELECT content_hash, MIN(id) as keep_id, COUNT(*) as cnt
       FROM parsed_provisions
       GROUP BY content_hash
       HAVING cnt > 1`,
    );

    let removed = 0;
    for (const row of dupRows) {
      const result = await this.dataSource.query(
        `DELETE FROM parsed_provisions WHERE content_hash = ? AND id != ?`,
        [row.content_hash, row.keep_id],
      );
      removed += result.changes ?? (parseInt(row.cnt) - 1);
    }
    return removed;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async upsertActRecord(act: ActManifest, provisionCount: number): Promise<void> {
    let existing = await this.legalActRepo.findOne({ where: { filePath: act.pdfSource } });
    if (!existing) existing = new LegalActEntity();

    existing.filePath = act.pdfSource;
    existing.actName = act.officialName;
    existing.actId = act.actId;
    existing.shortName = act.shortName;
    existing.aliases = ActRegistry.resolveByName(act.officialName).aliases;
    existing.year = act.year;
    existing.status = 'active';
    existing.category = act.category;
    existing.fileSizeBytes = act.pdfPath ? fs.statSync(act.pdfPath).size : 0;
    existing.lastModifiedDate = new Date(fs.statSync(act.parsedSectionsPath).mtime);
    existing.pdfHash = act.contentHash;

    await this.legalActRepo.save(existing);
  }
}

// ── Pure utility functions (exported for tests) ───────────────────────────────

export function computeContentHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function computeFileHash(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function qdrantPointId(contentHash: string): string {
  return uuidv5(contentHash);
}

export function extractKeywords(text: string): string[] {
  if (!text) return [];
  const stopwords = new Set([
    'about','above','after','again','against','all','am','an','and','any','are','as','at',
    'be','because','been','before','being','below','between','both','but','by',
    'did','do','does','doing','down','during','each','few','for','from','further',
    'had','has','have','having','he','her','here','hers','herself','him','himself','his','how',
    'if','in','into','is','it','its','itself','me','more','most','my','myself',
    'no','nor','not','of','off','on','once','only','other','our','ours','ourselves','out','over','own',
    'same','she','should','so','some','such','than','that','the','their','theirs','them','themselves',
    'then','there','these','they','this','those','through','to','too','under','until','up',
    'very','was','we','were','what','when','where','which','while','who','whom','why',
    'with','would','you','your','yours','yourself','yourselves',
    'shall','herein','thereof','thereto','subject','respect','unless','section','subsection','clause','proviso',
  ]);
  const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).map((w) => w.trim()).filter((w) => w.length > 4 && !stopwords.has(w));
  const freq = new Map<string, number>();
  words.forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
}
