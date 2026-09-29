"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const typeorm_1 = require("typeorm");
const js_client_rest_1 = require("@qdrant/js-client-rest");
const legal_act_entity_1 = require("../modules/ingestion/entities/legal-act.entity");
const parsed_provision_entity_1 = require("../modules/ingestion/entities/parsed-provision.entity");
const corpus_sync_engine_1 = require("../modules/ingestion/corpus-sync.engine");
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const MODE = process.argv.includes('--validate-only') || process.argv.includes('validate')
    ? 'validate'
    : process.argv.includes('--repair-only') || process.argv.includes('repair')
        ? 'repair'
        : 'sync';
const FORCE = process.argv.includes('--force');
const CORPUS_DIR = process.env.CORPUS_DIR || path.resolve(process.cwd(), 'corpus-data');
const COLLECTION = 'legal_corpus';
const EMBEDDING_VERSION = 'bge-m3-v1';
function resolveSqlitePath() {
    const envPath = process.env.SQLITE_DB_PATH;
    if (envPath && !envPath.startsWith('/var/data') && fs.existsSync(envPath))
        return envPath;
    const localDb = path.resolve(process.cwd(), 'legatrixon_db.sqlite');
    if (fs.existsSync(localDb))
        return localDb;
    const runtimeDb = path.resolve(process.cwd(), 'runtime', 'legatrixon_db.sqlite');
    if (fs.existsSync(runtimeDb))
        return runtimeDb;
    return localDb;
}
function fetchWithTimeout(url, opts, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}
async function createEmbedFn() {
    const bgeSidecar = process.env.BGE_M3_SERVICE_URL;
    if (bgeSidecar) {
        try {
            const res = await fetchWithTimeout(`${bgeSidecar}/health`, {}, 3000);
            if (res.ok) {
                console.log(`  Embedder: BGE-M3 sidecar at ${bgeSidecar}`);
                return async (texts) => {
                    const r = await fetchWithTimeout(`${bgeSidecar}/embed-batch`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ texts }),
                    }, 120_000);
                    if (!r.ok)
                        throw new Error(`BGE sidecar error: ${r.status}`);
                    const data = await r.json();
                    return data.embeddings;
                };
            }
        }
        catch {
            console.log('  BGE-M3 sidecar unreachable — falling back to OpenAI.');
        }
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
        throw new Error('No embedding provider available. Set OPENAI_API_KEY or BGE_M3_SERVICE_URL.');
    console.log('  Embedder: OpenAI text-embedding-3-small (1024-dim)');
    return async (texts) => {
        const CHUNK = 500;
        const all = [];
        for (let i = 0; i < texts.length; i += CHUNK) {
            const res = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'text-embedding-3-small', input: texts.slice(i, i + CHUNK), dimensions: 1024 }),
            });
            if (!res.ok) {
                const err = await res.text();
                throw new Error(`OpenAI embeddings error ${res.status}: ${err.slice(0, 200)}`);
            }
            const data = await res.json();
            all.push(...data.data.map((d) => d.embedding));
        }
        return all;
    };
}
function printSyncReport(r) {
    const line = '═'.repeat(60);
    const healthIcon = r.overallHealthPercent === 100 ? '✓' : r.overallHealthPercent >= 80 ? '⚠' : '✗';
    console.log(`\n╔${line}╗`);
    console.log(`║  LEGATRIXON — CORPUS SYNC REPORT`);
    console.log(`╠${line}╣`);
    console.log(`║  Acts Found              : ${String(r.actsFound).padStart(6)}`);
    console.log(`║  Acts Updated            : ${String(r.actsUpdated).padStart(6)}`);
    console.log(`║  Acts Skipped            : ${String(r.actsSkipped).padStart(6)}`);
    console.log(`║  Acts Deleted            : ${String(r.actsDeleted).padStart(6)}`);
    console.log(`║  Sections Added          : ${String(r.sectionsAdded).padStart(6)}`);
    console.log(`║  Sections Updated        : ${String(r.sectionsUpdated).padStart(6)}`);
    console.log(`║  Embeddings Generated    : ${String(r.embeddingsGenerated).padStart(6)}`);
    console.log(`║  Embeddings Repaired     : ${String(r.embeddingsRepaired).padStart(6)}`);
    console.log(`║  Duplicate Rows Removed  : ${String(r.duplicateRowsRemoved).padStart(6)}`);
    console.log(`║  Duplicate Vectors Removed: ${String(r.duplicateEmbeddingsRemoved).padStart(5)}`);
    console.log(`║  Failed Acts             : ${String(r.failedActs.length).padStart(6)}`);
    console.log(`╠${line}╣`);
    console.log(`║  Overall Corpus Health   : ${healthIcon} ${r.overallHealthPercent}%`);
    console.log(`╠${line}╣`);
    console.log(`║  Act breakdown:`);
    for (const d of r.details) {
        const icon = d.status === 'synced' ? '✓' : d.status === 'skipped' ? '─' : d.status === 'deleted' ? 'D' : d.status === 'empty' ? '○' : '✗';
        const name = d.actName.substring(0, 42).padEnd(42);
        const info = d.status === 'synced' ? `${d.provisionsAdded}§ | ${d.embeddingsGenerated}v`
            : d.status === 'failed' ? (d.reason || '').substring(0, 20)
                : d.status === 'empty' ? 'no provisions (scan?)'
                    : d.status;
        console.log(`║  ${icon} ${name}  ${info}`);
    }
    if (r.failedActs.length) {
        console.log(`╠${line}╣`);
        console.log(`║  Failed: ${r.failedActs.join(', ')}`);
    }
    console.log(`╚${line}╝\n`);
}
function printValidationReport(r) {
    const line = '═'.repeat(60);
    const icon = (ok) => ok ? '✓' : '✗';
    console.log(`\n╔${line}╗`);
    console.log(`║  LEGATRIXON — CORPUS VALIDATION REPORT`);
    console.log(`╠${line}╣`);
    console.log(`║  Acts in corpus-data     : ${String(r.totalActs).padStart(6)}`);
    console.log(`║  Acts in SQLite (active) : ${String(r.actsInDb).padStart(6)}  ${icon(r.actsMissingFromDb === 0)}`);
    console.log(`║  Acts missing from DB    : ${String(r.actsMissingFromDb).padStart(6)}`);
    console.log(`╠${line}╣`);
    console.log(`║  Total provisions (DB)   : ${String(r.dbCount).padStart(6)}`);
    console.log(`║  Total vectors (Qdrant)  : ${String(r.qdrantCount).padStart(6)}  ${icon(!r.countMismatch)}`);
    console.log(`║  Missing act_id          : ${String(r.provisionsMissingActId).padStart(6)}  ${icon(r.provisionsMissingActId === 0)}`);
    console.log(`║  Missing content         : ${String(r.provisionsMissingContent).padStart(6)}  ${icon(r.provisionsMissingContent === 0)}`);
    console.log(`║  Not embedded            : ${String(r.provisionsNotEmbedded).padStart(6)}  ${icon(r.provisionsNotEmbedded === 0)}`);
    console.log(`║  Duplicate provisions    : ${String(r.duplicateProvisions).padStart(6)}  ${icon(r.duplicateProvisions === 0)}`);
    console.log(`╠${line}╣`);
    if (r.healthy) {
        console.log(`║  Overall: ✓ HEALTHY — all checks passed`);
    }
    else {
        console.log(`║  Overall: ✗ ISSUES FOUND`);
        for (const issue of r.issues) {
            console.log(`║    • ${issue}`);
        }
    }
    console.log(`╚${line}╝\n`);
}
function printRepairReport(r) {
    const line = '═'.repeat(60);
    console.log(`\n╔${line}╗`);
    console.log(`║  LEGATRIXON — CORPUS REPAIR REPORT`);
    console.log(`╠${line}╣`);
    console.log(`║  Embeddings Repaired     : ${String(r.embeddingsRepaired).padStart(6)}`);
    console.log(`║  act_id Fields Repaired  : ${String(r.actIdRepaired).padStart(6)}`);
    console.log(`║  Duplicate Rows Removed  : ${String(r.duplicatesRemoved).padStart(6)}`);
    if (r.failedRepairs.length) {
        console.log(`║  Failed                  : ${r.failedRepairs.join(', ')}`);
    }
    console.log(`╚${line}╝\n`);
}
async function main() {
    console.log('════════════════════════════════════════════════════════════');
    console.log('  LEGATRIXON — Legal Corpus Synchronization (Phase 3)');
    console.log(`  Corpus : ${CORPUS_DIR}`);
    console.log(`  Mode   : ${MODE.toUpperCase()}${FORCE ? ' (FORCE)' : ''}`);
    console.log('════════════════════════════════════════════════════════════\n');
    const sqlitePath = resolveSqlitePath();
    console.log(`  Database: ${sqlitePath}`);
    const dbDir = path.dirname(sqlitePath);
    if (!fs.existsSync(dbDir))
        fs.mkdirSync(dbDir, { recursive: true });
    const dataSource = new typeorm_1.DataSource({
        type: 'sqlite',
        database: sqlitePath,
        entities: [legal_act_entity_1.LegalActEntity, parsed_provision_entity_1.ParsedProvisionEntity],
        synchronize: true,
        logging: false,
    });
    await dataSource.initialize();
    console.log('  SQLite: connected\n');
    const qdrantUrl = process.env.QDRANT_URL;
    const qdrantKey = process.env.QDRANT_API_KEY;
    if (!qdrantUrl)
        throw new Error('QDRANT_URL not set in .env');
    const qdrantClient = new js_client_rest_1.QdrantClient({ url: qdrantUrl, apiKey: qdrantKey });
    try {
        await qdrantClient.getCollections();
        console.log(`  Qdrant: connected (${qdrantUrl.slice(0, 40)}...)\n`);
    }
    catch (e) {
        throw new Error(`Cannot reach Qdrant: ${e.message}`);
    }
    const embed = MODE === 'validate' ? async (texts) => [] : await createEmbedFn();
    const engine = new corpus_sync_engine_1.CorpusSyncEngine(dataSource, qdrantClient, embed, {
        corpusDir: CORPUS_DIR,
        collection: COLLECTION,
        embeddingVersion: EMBEDDING_VERSION,
        batchSize: 50,
    });
    if (FORCE && MODE === 'sync') {
        await dataSource.getRepository(legal_act_entity_1.LegalActEntity).update({}, { pdfHash: '' });
        console.log('  Force mode: cleared all stored hashes — will rebuild every act.\n');
    }
    if (MODE === 'validate') {
        const report = await engine.validate();
        printValidationReport(report);
        process.exit(report.healthy ? 0 : 1);
    }
    else if (MODE === 'repair') {
        const report = await engine.repair();
        printRepairReport(report);
        process.exit(report.failedRepairs.length > 0 ? 1 : 0);
    }
    else {
        const report = await engine.sync();
        printSyncReport(report);
        process.exit(report.failedActs.length > 0 ? 1 : 0);
    }
}
main().catch((err) => {
    console.error('\n✗ Sync failed:', err.message);
    process.exit(1);
});
//# sourceMappingURL=legal-corpus-sync.js.map