import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LegalActEntity } from './entities/legal-act.entity';
import { ParsedProvisionEntity } from './entities/parsed-provision.entity';
import { QdrantService } from '../retrieval/qdrant.service';
import { BgeM3Provider } from '../retrieval/bge-m3.provider';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ActRegistry } from '../retrieval/act-registry';
import {
  flattenProvisions as flattenLegalProvisions,
  parseLegalStructure as parseIndianLegalStructure,
  validateLegalStructure as validateIndianLegalStructure,
} from './indian-legal-parser';

interface PageInfo {
  pageNumber: number;
  text: string;
}

interface ExtractedTextJson {
  actName: string;
  category: string;
  totalPages: number;
  pages: PageInfo[];
}

interface LegalNode {
  type: 'part' | 'chapter' | 'section' | 'subsection' | 'clause' | 'proviso' | 'explanation' | 'illustration' | 'schedule' | 'body';
  number?: string;
  title?: string;
  content?: string;
  children?: LegalNode[];
}

interface ProvisionMetadata {
  part?: string;
  chapter?: string;
  section?: string;
  subsection?: string;
  clause?: string;
  title?: string;
  content: string;
}

export interface IngestionReport {
  actsDiscovered: number;
  actsParsed: number;
  actsSkipped: number;
  sectionsStored: number;
  embeddingsGenerated: number;
  missingEmbeddings: number;
  errors: number;
  details: Array<{ act: string; sections: number; embeddings: number; skipped: boolean; error?: string }>;
}

/** The single embedding model version tag stored alongside every vector */
const EMBEDDING_VERSION = 'bge-m3-v1';

@Injectable()
export class CorpusScannerService {
  private readonly logger = new Logger(CorpusScannerService.name);

  constructor(
    @InjectRepository(LegalActEntity)
    private readonly legalActRepository: Repository<LegalActEntity>,
    @InjectRepository(ParsedProvisionEntity)
    private readonly parsedProvisionRepository: Repository<ParsedProvisionEntity>,
    private readonly qdrantService: QdrantService,
    private readonly bgeM3Provider: BgeM3Provider,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC ENTRY POINT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Full automatic corpus synchronization.
   *
   * Workflow per Act:
   *   PDF → Extract text → Parse structure → Store provisions (SQLite) →
   *   Generate embeddings → Upload vectors (Qdrant `legal_corpus`)
   *
   * Before processing each Act:
   *   - Compute PDF hash
   *   - Compare against stored hash in SQLite
   *   - If hash unchanged AND SQLite count == Qdrant count: skip
   *   - If hash changed OR any mismatch: clear & rebuild
   *
   * After all Acts:
   *   - Audit SQLite vs Qdrant totals
   *   - Auto-repair any missing embeddings
   *   - Print full ingestion report
   */
  async scanCorpus(corpusDir?: string): Promise<IngestionReport> {
    const targetDir = corpusDir || path.resolve(process.cwd(), 'corpus-data');
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`LEGATRIXON Legal Ingestion Pipeline`);
    this.logger.log(`Target corpus: ${targetDir}`);
    this.logger.log(`Qdrant collection: ${QdrantService.COLLECTION}`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    if (!fs.existsSync(targetDir)) {
      this.logger.error(`Corpus directory not found: ${targetDir}`);
      return this.emptyReport();
    }

    // Ensure unified collection exists before any Act is processed
    await this.qdrantService.initializeLegalCorpusCollection();

    const discoveredFiles: string[] = [];
    this.findPdfFiles(targetDir, discoveredFiles);
    this.logger.log(`Discovered ${discoveredFiles.length} PDF files in corpus.`);

    const report: IngestionReport = {
      actsDiscovered: discoveredFiles.length,
      actsParsed: 0,
      actsSkipped: 0,
      sectionsStored: 0,
      embeddingsGenerated: 0,
      missingEmbeddings: 0,
      errors: 0,
      details: [],
    };

    const qdrantClient = this.qdrantService.getClient();
    const collection = QdrantService.COLLECTION;

    for (const filePath of discoveredFiles) {
      const actDetail: IngestionReport['details'][0] = {
        act: filePath,
        sections: 0,
        embeddings: 0,
        skipped: false,
      };

      try {
        const stats = fs.statSync(filePath);
        const pdfHash = this.computeFileHash(filePath);

        // Derive folder names for category / act
        const relativePath = path.relative(targetDir, filePath);
        const normalizedRelPath = relativePath.replace(/\\/g, '/');
        const parts = normalizedRelPath.split('/');
        let category = 'Unknown';
        let folderName = 'Unknown';
        if (parts.length >= 3) {
          category = parts[0];
          folderName = parts[1];
        } else if (parts.length === 2) {
          category = parts[0];
          folderName = path.basename(parts[1], '.pdf');
        } else {
          folderName = path.basename(parts[0], '.pdf');
        }

        // ── Pre-ingestion audit ───────────────────────────────────────────────
        const existingAct = await this.legalActRepository.findOne({ where: { filePath } });
        const dbCount = await this.parsedProvisionRepository.count({ where: { pdfSource: filePath } });

        let qdrantCount = 0;
        let qdrantActIdCount = 0;
        try {
          const info = await qdrantClient.count(collection, {
            filter: {
              must: [{ key: 'pdf_source', match: { value: filePath } }],
            },
          });
          qdrantCount = info.count;
          const registryForExisting = ActRegistry.resolveByName(existingAct?.actName || folderName);
          const actIdInfo = await qdrantClient.count(collection, {
            filter: {
              must: [
                { key: 'pdf_source', match: { value: filePath } },
                { key: 'act_id', match: { value: registryForExisting.actId } },
              ],
            },
          });
          qdrantActIdCount = actIdInfo.count;
        } catch (_) { /* Qdrant not reachable yet — will handle below */ }

        const missingActIdCount = await this.parsedProvisionRepository
          .createQueryBuilder('p')
          .where('p.pdfSource = :filePath', { filePath })
          .andWhere("(p.actId IS NULL OR p.actId = '')")
          .getCount();
        const hashUnchanged = existingAct?.pdfHash === pdfHash;
        const countsMatch = dbCount > 0 && dbCount === qdrantCount;
        const metadataComplete = Boolean(existingAct?.actId && existingAct?.pdfHash) && missingActIdCount === 0 && qdrantCount === qdrantActIdCount;

        if (hashUnchanged && countsMatch && metadataComplete) {
          this.logger.log(`✓ SKIP  "${existingAct?.actName || folderName}" — hash unchanged, ${dbCount} sections & ${qdrantCount} vectors in sync.`);
          actDetail.act = existingAct?.actName || folderName;
          actDetail.sections = dbCount;
          actDetail.embeddings = qdrantCount;
          actDetail.skipped = true;
          report.actsSkipped++;
          report.sectionsStored += dbCount;
          report.embeddingsGenerated += qdrantCount;
          report.details.push(actDetail);
          continue;
        }

        // ── Detect mismatch / rebuild reason ─────────────────────────────────
        if (!hashUnchanged) {
          this.logger.log(`↺ REBUILD "${folderName}" — PDF hash changed.`);
        } else if (dbCount !== qdrantCount) {
          this.logger.log(`↺ REPAIR "${folderName}" — DB has ${dbCount} provisions, Qdrant has ${qdrantCount} vectors.`);
        } else {
          this.logger.log(`↺ NEW    "${folderName}" — first-time ingestion.`);
        }

        // ── Clear stale data if any ───────────────────────────────────────────
        if (dbCount > 0) {
          await this.parsedProvisionRepository.delete({ pdfSource: filePath });
          this.logger.log(`  Cleared ${dbCount} stale provisions from SQLite.`);
        }
        if (qdrantCount > 0) {
          try {
            await qdrantClient.delete(collection, {
              filter: {
                must: [{ key: 'pdf_source', match: { value: filePath } }],
              },
            });
            this.logger.log(`  Cleared ${qdrantCount} stale vectors from Qdrant.`);
          } catch (e: any) {
            this.logger.warn(`  Could not clear Qdrant vectors: ${e.message}`);
          }
        }

        // ── Step 1: Extract text ──────────────────────────────────────────────
        const actFolder = path.dirname(filePath);
        const outputJsonPath = path.join(actFolder, 'extracted-text.json');
        const parsedJsonPath = path.join(actFolder, 'parsed-sections.json');

        this.logger.log(`  [1/4] Extracting PDF text...`);
        const rawPages = await this.extractPdfPages(filePath);
        const cleanPages = this.cleanHeadersAndFooters(rawPages);

        // ── Step 2: Resolve official title ────────────────────────────────────
        const firstPageText = cleanPages[0]?.text || '';
        const { fullName, shortName } = this.extractOfficialTitle(firstPageText, folderName);
        const registryEntry = ActRegistry.resolveByName(fullName);
        const actId = registryEntry.actId;
        actDetail.act = fullName;
        this.logger.log(`  [2/4] Official title resolved: "${fullName}" (${shortName})`);

        // Save extracted text JSON
        const extractedResult: ExtractedTextJson = {
          actName: fullName,
          category,
          totalPages: cleanPages.length,
          pages: cleanPages,
        };
        fs.writeFileSync(outputJsonPath, JSON.stringify(extractedResult, null, 2), 'utf-8');

        // ── Step 3: Parse legal structure ─────────────────────────────────────
        this.logger.log(`  [3/4] Parsing legal structure...`);
        const lines: string[] = [];
        cleanPages.forEach(p => {
          p.text.split('\n').map(l => l.trim()).filter(l => l.length > 0).forEach(l => lines.push(l));
        });
        const structure = parseIndianLegalStructure(lines);
        const structureValidation = validateIndianLegalStructure(structure);
        const yearMatch = fullName.match(/\b(18|19|20)\d{2}\b/);
        fs.writeFileSync(parsedJsonPath, JSON.stringify({
          actName: fullName,
          officialName: registryEntry.officialName || fullName,
          shortName: registryEntry.shortName || shortName,
          category,
          year: yearMatch ? parseInt(yearMatch[0], 10) : (registryEntry.year || undefined),
          summary: {
            totalParts: structureValidation.totalParts,
            totalTitles: structureValidation.totalTitles,
            totalChapters: structureValidation.totalChapters,
            totalArticles: structureValidation.totalArticles,
            totalSections: structureValidation.totalSections,
            totalSchedules: structureValidation.totalSchedules,
            totalExplanations: structureValidation.totalExplanations,
            totalIllustrations: structureValidation.totalIllustrations,
          },
          structure,
        }, null, 2), 'utf-8');

        // ── Step 4: Flatten to provisions and save to SQLite ──────────────────
        this.logger.log(`  [4/4] Storing provisions and generating embeddings...`);
        const flatProvisions = flattenLegalProvisions(structure);

        const entitiesToSave: ParsedProvisionEntity[] = flatProvisions.map(prov => {
          const entity = new ParsedProvisionEntity();
          entity.actName = fullName;
          entity.actId = actId;
          entity.category = category;
          entity.part = prov.part || '';
          entity.chapter = prov.chapter || '';
          entity.section = prov.section || (prov.article ? 'Article ' + prov.article : '');
          entity.subsection = prov.subsection || '';
          entity.clause = prov.clause || '';
          entity.title = prov.title || '';
          entity.content = prov.content;
          entity.keywords = this.extractKeywords(prov.content);
          entity.contentHash = this.computeContentHash([actId, prov.section || prov.article || '', prov.subsection || '', prov.clause || '', prov.content || ''].join(':'));
          entity.pdfSource = filePath;
          entity.embeddingSynced = false;
          entity.embeddingVersion = '';
          return entity;
        });

        const savedEntities: ParsedProvisionEntity[] = [];
        const DB_BATCH = 100;
        for (let i = 0; i < entitiesToSave.length; i += DB_BATCH) {
          const batch = await this.parsedProvisionRepository.save(entitiesToSave.slice(i, i + DB_BATCH));
          savedEntities.push(...batch);
        }
        this.logger.log(`      Stored ${savedEntities.length} provisions in SQLite.`);
        actDetail.sections = savedEntities.length;

        // ── Step 5: Generate embeddings and upsert to Qdrant ──────────────────
        const embeddedCount = await this.generateAndUpsertEmbeddings(
          savedEntities, fullName, actId, category, filePath, collection, shortName
        );
        actDetail.embeddings = embeddedCount;

        // ── Step 6: Update Act metadata in SQLite ─────────────────────────────
        const act = existingAct || new LegalActEntity();
        act.filePath = filePath;
        act.actName = fullName;
        act.actId = actId;
        act.shortName = registryEntry.shortName || shortName;
        act.aliases = registryEntry.aliases;
        act.year = registryEntry.year;
        act.status = registryEntry.status;
        act.category = category;
        act.fileSizeBytes = stats.size;
        act.lastModifiedDate = stats.mtime;
        act.pdfHash = pdfHash;
        await this.legalActRepository.save(act);

        report.actsParsed++;
        report.sectionsStored += savedEntities.length;
        report.embeddingsGenerated += embeddedCount;
        report.details.push(actDetail);

      } catch (err: any) {
        report.errors++;
        actDetail.error = err.message;
        report.details.push(actDetail);
        this.logger.error(`  ✗ FAILED "${actDetail.act}": ${err.message}`);
      }
    }

    // ── Post-ingestion audit and auto-repair ──────────────────────────────────
    await this.auditAndRepair(report, collection);

    // ── Print report ──────────────────────────────────────────────────────────
    this.printReport(report);

    return report;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EMBEDDING GENERATION
  // ─────────────────────────────────────────────────────────────────────────────

  private async generateAndUpsertEmbeddings(
    entities: ParsedProvisionEntity[],
    actName: string,
    actId: string,
    category: string,
    pdfSource: string,
    collection: string,
    shortName: string,
  ): Promise<number> {
    const qdrantClient = this.qdrantService.getClient();
    const BATCH = 50;
    let totalUpserted = 0;

    for (let i = 0; i < entities.length; i += BATCH) {
      const batchEntities = entities.slice(i, i + BATCH);
      const texts = batchEntities.map(e =>
        [e.title, e.content].filter(Boolean).join('. ')
      );

      this.logger.log(
        `      Embeddings batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(entities.length / BATCH)} ` +
        `(${i + 1}–${Math.min(i + BATCH, entities.length)} of ${entities.length})`
      );

      const embeddings = await this.bgeM3Provider.generateBatchEmbeddings(texts);

      const points = batchEntities.map((entity, j) => ({
        id: entity.id,
        vector: embeddings[j],
        payload: {
          // Identity
          source_id: entity.id,
          pdf_source: pdfSource,
          document_type: 'act',
          embedding_version: EMBEDDING_VERSION,
          // Act metadata
          act_id: actId,
          act_name: actName,
          short_name: shortName,
          category,
          // Legal structure
          part: entity.part || '',
          chapter: entity.chapter || '',
          section: entity.section || '',
          subsection: entity.subsection || '',
          clause: entity.clause || '',
          title: entity.title || '',
          // Content for display
          text: entity.content,
          keywords: entity.keywords,
          content_hash: entity.contentHash,
        },
      }));

      await qdrantClient.upsert(collection, { wait: true, points });

      // Mark as synced in SQLite
      const ids = batchEntities.map(e => e.id);
      await this.parsedProvisionRepository
        .createQueryBuilder()
        .update(ParsedProvisionEntity)
        .set({ embeddingSynced: true, embeddingVersion: EMBEDDING_VERSION })
        .whereInIds(ids)
        .execute();

      totalUpserted += batchEntities.length;
    }

    this.logger.log(`      ✓ ${totalUpserted} embeddings upserted to Qdrant.`);
    return totalUpserted;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST-INGESTION AUDIT & AUTO-REPAIR
  // ─────────────────────────────────────────────────────────────────────────────

  private async auditAndRepair(report: IngestionReport, collection: string): Promise<void> {
    this.logger.log(`\n── Post-ingestion audit ──────────────────────────────────────────`);

    const totalInDb = await this.parsedProvisionRepository.count();
    const unsyncedInDb = await this.parsedProvisionRepository.count({ where: { embeddingSynced: false } });

    let totalInQdrant = 0;
    try {
      const qdrantClient = this.qdrantService.getClient();
      const info = await qdrantClient.count(collection, {});
      totalInQdrant = info.count;
    } catch (e: any) {
      this.logger.warn(`Could not query Qdrant count: ${e.message}`);
    }

    this.logger.log(`  SQLite total: ${totalInDb} provisions`);
    this.logger.log(`  Qdrant total: ${totalInQdrant} vectors`);
    this.logger.log(`  Unsynced:     ${unsyncedInDb} provisions missing embeddings`);

    report.missingEmbeddings = unsyncedInDb;

    if (unsyncedInDb > 0) {
      this.logger.log(`  AUTO-REPAIR: Generating ${unsyncedInDb} missing embeddings...`);
      await this.repairMissingEmbeddings(collection, report);
    } else {
      this.logger.log(`  ✓ All provisions have embeddings. No repair needed.`);
    }
  }

  private async repairMissingEmbeddings(collection: string, report: IngestionReport): Promise<void> {
    // Fetch all unsynced provisions in batches
    const PAGE = 200;
    let offset = 0;
    let repaired = 0;

    while (true) {
      const batch = await this.parsedProvisionRepository.find({
        where: { embeddingSynced: false },
        take: PAGE,
        skip: offset,
      });

      if (batch.length === 0) break;

      // Group by Act for logging
      const actGroups = new Map<string, ParsedProvisionEntity[]>();
      batch.forEach(p => {
        const list = actGroups.get(p.actName) || [];
        list.push(p);
        actGroups.set(p.actName, list);
      });

      for (const [actName, provisions] of actGroups) {
        try {
          const upserted = await this.generateAndUpsertEmbeddings(
            provisions,
            actName,
            ActRegistry.resolveByName(actName).actId,
            provisions[0].category,
            provisions[0].pdfSource,
            collection,
            '',
          );
          repaired += upserted;
          report.embeddingsGenerated += upserted;
        } catch (e: any) {
          this.logger.error(`  Repair failed for "${actName}": ${e.message}`);
          report.errors++;
        }
      }

      offset += PAGE;
    }

    report.missingEmbeddings = Math.max(0, report.missingEmbeddings - repaired);
    this.logger.log(`  Auto-repair complete: ${repaired} embeddings generated.`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REPORT PRINTER
  // ─────────────────────────────────────────────────────────────────────────────

  private printReport(report: IngestionReport): void {
    const line = '═'.repeat(58);
    console.log(`\n╔${line}╗`);
    console.log(`║  LEGATRIXON — LEGAL CORPUS INGESTION REPORT`);
    console.log(`╠${line}╣`);
    console.log(`║  Acts discovered:     ${String(report.actsDiscovered).padStart(6)}`);
    console.log(`║  Acts parsed:         ${String(report.actsParsed).padStart(6)}`);
    console.log(`║  Acts skipped:        ${String(report.actsSkipped).padStart(6)}`);
    console.log(`║  Sections stored:     ${String(report.sectionsStored).padStart(6)}`);
    console.log(`║  Embeddings created:  ${String(report.embeddingsGenerated).padStart(6)}`);
    console.log(`║  Missing embeddings:  ${String(report.missingEmbeddings).padStart(6)}`);
    console.log(`║  Errors:              ${String(report.errors).padStart(6)}`);
    console.log(`╠${line}╣`);
    console.log(`║  Act-level breakdown:`);

    for (const d of report.details) {
      const status = d.skipped ? 'SKIP' : d.error ? 'FAIL' : 'DONE';
      const icon = d.skipped ? '─' : d.error ? '✗' : '✓';
      const name = d.act.substring(0, 40).padEnd(40);
      const msg = d.error
        ? d.error.substring(0, 20)
        : `${d.sections}§ | ${d.embeddings}v`;
      console.log(`║  ${icon} [${status}] ${name}  ${msg}`);
    }

    console.log(`╚${line}╝\n`);
  }

  private emptyReport(): IngestionReport {
    return {
      actsDiscovered: 0,
      actsParsed: 0,
      actsSkipped: 0,
      sectionsStored: 0,
      embeddingsGenerated: 0,
      missingEmbeddings: 0,
      errors: 0,
      details: [],
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TITLE RESOLUTION
  // ─────────────────────────────────────────────────────────────────────────────

  private extractOfficialTitle(firstPageText: string, folderName: string): { fullName: string; shortName: string } {
    const lines = firstPageText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let fullName = '';

    for (const line of lines) {
      const cleanLine = line.replace(/[^A-Za-z0-9\s,._\-()]/g, '').trim();
      if (
        cleanLine.toUpperCase().includes('ARRANGEMENT') ||
        cleanLine.toUpperCase().includes('CHAPTER') ||
        cleanLine.toUpperCase().startsWith('SECTION')
      ) break;

      if (
        cleanLine.length > 3 &&
        (cleanLine.toUpperCase().startsWith('THE ') ||
          cleanLine.toUpperCase().endsWith(' ACT') ||
          /ACT,\s*\d{4}/i.test(cleanLine) ||
          cleanLine.toUpperCase().includes('SANHITA') ||
          cleanLine.toUpperCase().includes('ADHINIYAM') ||
          cleanLine.toUpperCase().includes('CONSTITUTION'))
      ) {
        fullName = cleanLine;
        break;
      }
    }

    if (!fullName) {
      fullName = folderName
        .replace(/_/g, ' ')
        .replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
    }

    if (fullName.toUpperCase().startsWith('THE ')) {
      fullName = fullName.substring(4);
    }

    // Canonical overrides
    const upper = fullName.toUpperCase();
    const map: Array<[string, string, string]> = [
      ['BHARATIYA NYAYA SANHITA', 'Bharatiya Nyaya Sanhita, 2023', 'BNS'],
      ['BHARATIYA NAGARIK SURAKSHA', 'Bharatiya Nagarik Suraksha Sanhita, 2023', 'BNSS'],
      ['BHARATIYA SAKSHYA', 'Bharatiya Sakshya Adhiniyam, 2023', 'BSA'],
      ['CONSTITUTION OF INDIA', 'Constitution of India', 'Constitution'],
      ['INDIAN PENAL CODE', 'Indian Penal Code, 1860', 'IPC'],
      ['CODE OF CIVIL PROCEDURE', 'Code of Civil Procedure, 1908', 'CPC'],
      ['CIVIL PROCEDURE CODE', 'Code of Civil Procedure, 1908', 'CPC'],
      ['CODE OF CRIMINAL PROCEDURE', 'Code of Criminal Procedure, 1973', 'CrPC'],
      ['CRIMINAL PROCEDURE CODE', 'Code of Criminal Procedure, 1973', 'CrPC'],
      ['INDIAN EVIDENCE ACT', 'Indian Evidence Act, 1872', 'IEA'],
      ['LIMITATION ACT', 'Limitation Act, 1963', 'LA'],
      ['SPECIAL MARRIAGE ACT', 'Special Marriage Act, 1954', 'SMA'],
      ['SPECIFIC RELIEF ACT', 'Specific Relief Act, 1963', 'SRA'],
      ['TRANSFER OF PROPERTY ACT', 'Transfer of Property Act, 1882', 'TPA'],
      ['INDIAN CONTRACT ACT', 'Indian Contract Act, 1872', 'ICA'],
      ['COMPANIES ACT', 'Companies Act, 2013', 'CA'],
      ['ARBITRATION AND CONCILIATION', 'Arbitration and Conciliation Act, 1996', 'ACA'],
      ['INFORMATION TECHNOLOGY ACT', 'Information Technology Act, 2000', 'ITA'],
      ['CONSUMER PROTECTION ACT', 'Consumer Protection Act, 2019', 'CPA'],
      ['TRADEMARK', 'Trade Marks Act, 1999', 'TMA'],
      ['COPYRIGHT ACT', 'Copyright Act, 1957', 'CopyA'],
      ['PATENT', 'Patents Act, 1970', 'PatA'],
      ['NEGOTIABLE INSTRUMENTS', 'Negotiable Instruments Act, 1881', 'NIA'],
      ['DIGITAL PERSONAL DATA', 'Digital Personal Data Protection Act, 2023', 'DPDPA'],
      ['HINDU SUCCESSION', 'Hindu Succession Act, 1956', 'HSA'],
      ['HINDU MARRIAGE', 'Hindu Marriage Act, 1955', 'HMA'],
      ['SALE OF GOODS', 'Sale of Goods Act, 1930', 'SOGA'],
      ['PARTNERSHIP', 'Indian Partnership Act, 1932', 'IPA'],
      ['CODE ON WAGES', 'Code on Wages, 2019', 'COW'],
    ];

    for (const [match, name, short] of map) {
      if (upper.includes(match)) {
        return { fullName: name, shortName: short };
      }
    }

    // Fallback short name: initials of capital words
    const words = fullName.replace(/,\s*\d{4}/g, '').split(/\s+/).filter(w => w[0] === w[0]?.toUpperCase() && w.length > 1);
    const shortName = words.map(w => w[0]).join('') || fullName.substring(0, 8);
    return { fullName, shortName };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PDF EXTRACTION
  // ─────────────────────────────────────────────────────────────────────────────

  private async extractPdfPages(filePath: string): Promise<PageInfo[]> {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const pages: PageInfo[] = [];

    const customPageRender = (pageData: any) => {
      return pageData.getTextContent().then((textContent: any) => {
        let lastY: number | undefined;
        let text = '';
        for (const item of textContent.items) {
          if (lastY === item.transform[5] || lastY === undefined) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }
        pages.push({ pageNumber: pageData.pageIndex + 1, text });
        return text;
      });
    };

    await pdfParse(buffer, { pagerender: customPageRender });
    pages.sort((a, b) => a.pageNumber - b.pageNumber);
    return pages;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HEADER / FOOTER CLEANING
  // ─────────────────────────────────────────────────────────────────────────────

  private cleanHeadersAndFooters(pages: PageInfo[]): PageInfo[] {
    if (pages.length === 0) return pages;

    const headerCounts = new Map<string, number>();
    const footerCounts = new Map<string, number>();
    const pageLines = pages.map(p => p.text.split('\n').map(l => l.trim()).filter(l => l.length > 0));

    pages.forEach((_, idx) => {
      const lines = pageLines[idx];
      if (!lines.length) return;
      lines.slice(0, 2).forEach(h => { if (h.length > 3) headerCounts.set(h, (headerCounts.get(h) || 0) + 1); });
      lines.slice(-2).forEach(f => { if (f.length > 3) footerCounts.set(f, (footerCounts.get(f) || 0) + 1); });
    });

    const threshold = Math.max(3, Math.floor(pages.length * 0.05));
    const repeatedHeaders = new Set<string>([...headerCounts.entries()].filter(([, c]) => c >= threshold).map(([t]) => t));
    const repeatedFooters = new Set<string>([...footerCounts.entries()].filter(([, c]) => c >= threshold).map(([t]) => t));

    return pages.map((page, idx) => {
      const lines = pageLines[idx];
      const cleanLines = lines.filter((line, li) => {
        if (/^\d+$/.test(line)) return false;
        if (/^page\s*\d+/i.test(line)) return false;
        if (/^\s*-\s*\d+\s*-\s*$/.test(line)) return false;
        if (li < 3 && repeatedHeaders.has(line)) return false;
        if (li >= lines.length - 3 && repeatedFooters.has(line)) return false;
        return true;
      });
      return { pageNumber: page.pageNumber, text: cleanLines.join('\n') };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LEGAL STRUCTURE PARSER
  // ─────────────────────────────────────────────────────────────────────────────

  private parseLegalStructure(lines: string[]): LegalNode[] {
    let root: LegalNode[] = [];
    let currentPart: LegalNode | null = null;
    let currentChapter: LegalNode | null = null;
    let currentSection: LegalNode | null = null;
    let currentSubsection: LegalNode | null = null;
    let currentClause: LegalNode | null = null;
    let currentAttachment: LegalNode | null = null;
    let currentSchedule: LegalNode | null = null;
    let inActualAct = false;

    const partRegex = /^\s*PART\s+([IVXLCDM\d]+)(?:\s+—\s*(.*))?$/i;
    const chapterRegex = /^\s*CHAPTER\s+([IVXLCDM\d]+)(?:\s+—\s*(.*))?$/i;
    const scheduleRegex = /^\s*(?:THE\s+)?([IVXLCDM\d]+)?\s*SCHEDULE(?:\s+—\s*(.*))?$/i;
    const sectionRegex = /^\s*(\d+[A-Z]*)\.?\s*(.*)$/;
    const subsectionRegex = /^\s*\((\d+)\)\s*(.*)$/;
    const clauseRegex = /^\s*\(([a-z]{1,2})\)\s*(.*)$/;
    const provisoRegex = /^\s*Provided\s+(?:further\s+)?that\s*(.*)$/i;
    const explanationRegex = /^\s*(Explanation\s*\d*)\s*(?:.—|.—|\.-|\.|.  —)\s*(.*)$/i;
    const illustrationRegex = /^\s*(Illustrations?\s*\d*)\s*(?:.—|.—|\.-|\.|.  —)?\s*(.*)$/i;
    const enactingFormulaRegex = /be\s+it\s+enacted|enacted\s+by\s+parliament|enacted\s+as\s+follows|it\s+is\s+enacted/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!inActualAct) {
        const isEnacting = enactingFormulaRegex.test(line);
        const isSectionBody = !!(line.match(sectionRegex) && (line.includes('—') || line.includes('--') || line.includes('–')));
        if (isEnacting || isSectionBody) {
          inActualAct = true;
          root = [];
          currentPart = currentChapter = currentSection = currentSubsection = currentClause = currentAttachment = currentSchedule = null;
          if (isEnacting) { root.push({ type: 'body', content: line }); continue; }
        }
      }

      let match = line.match(partRegex);
      if (match) {
        currentPart = { type: 'part', number: match[1], title: match[2] || '', children: [] };
        if (!currentPart.title && i + 1 < lines.length && !lines[i + 1].match(/^(?:PART|CHAPTER|\d+\.)/i)) {
          currentPart.title = lines[++i];
        }
        root.push(currentPart);
        currentChapter = currentSection = currentSubsection = currentClause = currentAttachment = currentSchedule = null;
        continue;
      }

      match = line.match(chapterRegex);
      if (match) {
        currentChapter = { type: 'chapter', number: match[1], title: match[2] || '', children: [] };
        if (!currentChapter.title && i + 1 < lines.length && !lines[i + 1].match(/^(?:PART|CHAPTER|\d+\.)/i)) {
          currentChapter.title = lines[++i];
        }
        (currentPart ? currentPart.children! : root).push(currentChapter);
        currentSection = currentSubsection = currentClause = currentAttachment = currentSchedule = null;
        continue;
      }

      match = line.match(scheduleRegex);
      if (match) {
        currentSchedule = { type: 'schedule', number: match[1] || '', title: match[2] || '', children: [] };
        root.push(currentSchedule);
        currentPart = currentChapter = currentSection = currentSubsection = currentClause = currentAttachment = null;
        continue;
      }

      match = line.match(sectionRegex);
      if (match) {
        currentSection = { type: 'section', number: match[1], title: '', content: match[2] || '', children: [] };
        const raw = currentSection.content || '';
        const dashMatch = raw.match(/^(.*?)(?:\.—|.—|\.-|\. -|—|–)\s*(.*)$/);
        if (dashMatch) {
          currentSection.title = dashMatch[1].trim();
          currentSection.content = dashMatch[2].trim();
        } else {
          const dotIdx = raw.indexOf('.');
          if (dotIdx > 0 && dotIdx < 100) {
            currentSection.title = raw.substring(0, dotIdx).trim();
            currentSection.content = raw.substring(dotIdx + 1).trim();
          }
        }
        const parent = currentSchedule || currentChapter || currentPart;
        (parent ? parent.children! : root).push(currentSection);
        currentSubsection = currentClause = currentAttachment = null;
        continue;
      }

      match = line.match(subsectionRegex);
      if (match && currentSection) {
        currentSubsection = { type: 'subsection', number: match[1], content: match[2] || '', children: [] };
        currentSection.children!.push(currentSubsection);
        currentClause = currentAttachment = null;
        continue;
      }

      match = line.match(clauseRegex);
      if (match && (currentSubsection || currentSection)) {
        currentClause = { type: 'clause', number: match[1], content: match[2] || '' };
        (currentSubsection ? currentSubsection.children! : currentSection!.children!).push(currentClause);
        currentAttachment = null;
        continue;
      }

      match = line.match(provisoRegex);
      if (match && currentSection) {
        currentAttachment = { type: 'proviso', content: line };
        const parent = currentClause || currentSubsection || currentSection;
        if (!parent.children) parent.children = [];
        parent.children.push(currentAttachment);
        continue;
      }

      match = line.match(explanationRegex);
      if (match && currentSection) {
        currentAttachment = { type: 'explanation', number: match[1], content: match[2] || '' };
        const parent = currentClause || currentSubsection || currentSection;
        if (!parent.children) parent.children = [];
        parent.children.push(currentAttachment);
        continue;
      }

      match = line.match(illustrationRegex);
      if (match && currentSection) {
        currentAttachment = { type: 'illustration', number: match[1], content: match[2] || '' };
        const parent = currentClause || currentSubsection || currentSection;
        if (!parent.children) parent.children = [];
        parent.children.push(currentAttachment);
        continue;
      }

      // Append continuation lines
      const target = currentAttachment || currentClause || currentSubsection || currentSection || currentSchedule || currentChapter || currentPart;
      if (target) {
        target.content = target.content ? target.content + '\n' + line : line;
      } else {
        root.push({ type: 'body', content: line });
      }
    }

    return root;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PROVISION FLATTENER
  // ─────────────────────────────────────────────────────────────────────────────

  private flattenProvisions(nodes: LegalNode[], context: ProvisionMetadata = { content: '' }): ProvisionMetadata[] {
    const provisions: ProvisionMetadata[] = [];
    for (const node of nodes) {
      if (node.type === 'part') {
        provisions.push(...this.flattenProvisions(node.children || [], { ...context, part: node.number }));
      } else if (node.type === 'chapter') {
        provisions.push(...this.flattenProvisions(node.children || [], { ...context, chapter: node.number }));
      } else if (node.type === 'schedule') {
        provisions.push(...this.flattenProvisions(node.children || [], { ...context, part: 'SCHEDULE ' + node.number }));
      } else if (node.type === 'section') {
        const ctx = { ...context, section: node.number, title: node.title || '' };
        if (!node.children?.length) {
          provisions.push({ ...ctx, content: node.content || '' });
        } else {
          if (node.content?.trim()) provisions.push({ ...ctx, content: node.content });
          provisions.push(...this.flattenProvisions(node.children, ctx));
        }
      } else if (node.type === 'subsection') {
        const ctx = { ...context, subsection: node.number };
        if (!node.children?.length) {
          provisions.push({ ...ctx, content: node.content || '' });
        } else {
          if (node.content?.trim()) provisions.push({ ...ctx, content: node.content });
          provisions.push(...this.flattenProvisions(node.children, ctx));
        }
      } else if (node.type === 'clause') {
        provisions.push({ ...context, clause: node.number, content: node.content || '' });
      } else if (['proviso', 'explanation', 'illustration'].includes(node.type)) {
        provisions.push({ ...context, content: `[${node.type.toUpperCase()}] ${node.content || ''}` });
      }
    }
    return provisions;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────────

  private computeFileHash(filePath: string): string {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  }

  private computeContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private extractKeywords(text: string): string[] {
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
    const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).map(w => w.trim()).filter(w => w.length > 4 && !stopwords.has(w));
    const freq = new Map<string, number>();
    words.forEach(w => freq.set(w, (freq.get(w) || 0) + 1));
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
  }

  private findPdfFiles(dir: string, fileList: string[]): void {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        this.findPdfFiles(fullPath, fileList);
      } else if (item.isFile() && item.name.toLowerCase().endsWith('.pdf')) {
        fileList.push(fullPath);
      }
    }
  }
}


