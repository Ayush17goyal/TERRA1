#!/usr/bin/env ts-node
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
dotenv.config();
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const ingestion_service_1 = require("../modules/ingestion/ingestion.service");
const app_module_1 = require("../app.module");
let CliModule = class CliModule {
};
CliModule = __decorate([
    (0, common_1.Module)({
        imports: [app_module_1.AppModule],
    })
], CliModule);
function parseArgs() {
    const args = process.argv.slice(2);
    const result = { metadata: {}, status: false, init: false };
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--type':
                result.type = args[++i];
                break;
            case '--file':
                result.file = args[++i];
                break;
            case '--dir':
                result.dir = args[++i];
                break;
            case '--metadata':
                try {
                    result.metadata = JSON.parse(args[++i]);
                }
                catch {
                    console.error('ERROR: --metadata must be valid JSON');
                    process.exit(1);
                }
                break;
            case '--chunk-size':
                result.chunkSize = parseInt(args[++i], 10);
                break;
            case '--chunk-overlap':
                result.chunkOverlap = parseInt(args[++i], 10);
                break;
            case '--status':
                result.status = true;
                break;
            case '--init':
                result.init = true;
                break;
            default:
                console.error(`Unknown argument: ${args[i]}`);
                printUsage();
                process.exit(1);
        }
    }
    return result;
}
function printUsage() {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║         LEGATRIXON — BGE-M3 Ingestion CLI            ║
╚═══════════════════════════════════════════════════════╝

Usage:
  npx ts-node src/scripts/ingest-cli.ts [options]

Options:
  --type <constitution|bns|bnss|act|judgment|paper>   Document type (required for ingestion)
  --file <path>                 Single file to ingest
  --dir  <path>                 Directory of files to ingest
  --metadata '<json>'           Extra metadata as JSON string
  --chunk-size <number>         Target chunk size in chars (default: 1000)
  --chunk-overlap <number>      Chunk overlap in chars (default: 200)
  --status                      Check pipeline health and exit
  --init                        Initialize Qdrant collections and exit

Examples:
  npx ts-node src/scripts/ingest-cli.ts --status
  npx ts-node src/scripts/ingest-cli.ts --init
  npx ts-node src/scripts/ingest-cli.ts --type judgment --file ./data/case.txt
  npx ts-node src/scripts/ingest-cli.ts --type act --dir ./data/acts/ --metadata '{"act_name":"IPC"}'
`);
}
async function main() {
    const opts = parseArgs();
    if (!opts.status && !opts.init && !opts.type) {
        printUsage();
        process.exit(1);
    }
    console.log('\n⚡ Bootstrapping NestJS context (no HTTP server)...\n');
    const app = await core_1.NestFactory.createApplicationContext(CliModule, {
        logger: ['error', 'warn', 'log'],
    });
    const ingestionService = app.get(ingestion_service_1.IngestionService);
    try {
        if (opts.status) {
            const status = await ingestionService.getStatus();
            console.log('\n📊 Pipeline Status');
            console.log('─'.repeat(50));
            console.log(`  BGE-M3 Sidecar:  ${status.bgeM3Healthy ? '✅ Healthy' : '❌ Unreachable'}`);
            if (status.bgeM3Model)
                console.log(`  Model:           ${status.bgeM3Model}`);
            console.log(`  Qdrant:          ${status.qdrantConnected ? '✅ Connected' : '❌ Unreachable'}`);
            if (status.collections.length > 0) {
                console.log('\n  Collections:');
                for (const col of status.collections) {
                    const icon = col.status === 'green' ? '🟢' : col.status === 'not_created' ? '⚪' : '🟡';
                    console.log(`    ${icon} ${col.name} — ${col.pointCount} points (${col.status})`);
                }
            }
            console.log('');
            await app.close();
            process.exit(0);
        }
        if (opts.init) {
            console.log('🔧 Initializing Qdrant collections...\n');
            const created = await ingestionService.initializeCollections();
            if (created.length > 0) {
                console.log(`✅ Created: ${created.join(', ')}`);
            }
            else {
                console.log('✅ All collections already exist.');
            }
            console.log('');
            await app.close();
            process.exit(0);
        }
        const validTypes = ['constitution', 'bns', 'bnss', 'act', 'judgment', 'paper'];
        if (!validTypes.includes(opts.type)) {
            console.error(`ERROR: --type must be one of: ${validTypes.join(', ')}`);
            await app.close();
            process.exit(1);
        }
        await ingestionService.initializeCollections();
        const chunkerOpts = {
            chunkSize: opts.chunkSize,
            chunkOverlap: opts.chunkOverlap,
        };
        if (opts.file) {
            console.log(`📄 Ingesting file: ${opts.file}`);
            console.log(`   Type: ${opts.type}`);
            console.log('');
            const result = await ingestionService.ingestDocument(opts.type, opts.file, opts.metadata, chunkerOpts);
            printResult(result);
            await app.close();
            process.exit(result.errors.length > 0 ? 1 : 0);
        }
        if (opts.dir) {
            console.log(`📁 Ingesting directory: ${opts.dir}`);
            console.log(`   Type: ${opts.type}`);
            console.log('');
            const batchResult = await ingestionService.ingestDirectory(opts.type, opts.dir, opts.metadata, chunkerOpts);
            console.log('\n📊 Batch Results');
            console.log('─'.repeat(50));
            console.log(`  Total:      ${batchResult.totalDocuments} files`);
            console.log(`  Succeeded:  ${batchResult.successful}`);
            console.log(`  Failed:     ${batchResult.failed}`);
            console.log(`  Duration:   ${batchResult.totalDurationMs}ms`);
            console.log('');
            for (const result of batchResult.results) {
                printResult(result);
            }
            await app.close();
            process.exit(batchResult.failed > 0 ? 1 : 0);
        }
        console.error('ERROR: Provide --file or --dir for ingestion.');
        printUsage();
        await app.close();
        process.exit(1);
    }
    catch (error) {
        console.error(`\n❌ Fatal error: ${error.message}\n`);
        await app.close();
        process.exit(1);
    }
}
function printResult(result) {
    const status = result.errors.length === 0 ? '✅' : '⚠️';
    console.log(`${status} ${result.fileName}`);
    console.log(`   ID:        ${result.documentId}`);
    console.log(`   Chunks:    ${result.chunksGenerated}`);
    console.log(`   Upserted:  ${result.pointsUpserted}`);
    console.log(`   Duration:  ${result.durationMs}ms`);
    if (result.errors.length > 0) {
        for (const err of result.errors) {
            console.log(`   ❌ Error: ${err}`);
        }
    }
    console.log('');
}
main();
//# sourceMappingURL=ingest-cli.js.map