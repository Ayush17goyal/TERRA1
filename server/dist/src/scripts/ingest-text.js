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
const ingestion_module_1 = require("../modules/ingestion/ingestion.module");
const retrieval_module_1 = require("../modules/retrieval/retrieval.module");
let CliModule = class CliModule {
};
CliModule = __decorate([
    (0, common_1.Module)({
        imports: [retrieval_module_1.RetrievalModule, ingestion_module_1.IngestionModule],
    })
], CliModule);
function readStdin() {
    return new Promise((resolve) => {
        if (process.stdin.isTTY) {
            resolve('');
            return;
        }
        let data = '';
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', (chunk) => (data += chunk));
        process.stdin.on('end', () => resolve(data.trim()));
        setTimeout(() => resolve(data.trim()), 5000);
    });
}
function parseArgs() {
    const args = process.argv.slice(2);
    const result = { metadata: {} };
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--type':
                result.type = args[++i];
                break;
            case '--text':
                result.text = args[++i];
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
            default:
                console.error(`Unknown argument: ${args[i]}`);
                process.exit(1);
        }
    }
    return result;
}
async function main() {
    const opts = parseArgs();
    if (!opts.type) {
        console.error('ERROR: --type is required (constitution | bns | bnss | act | judgment | paper)');
        process.exit(1);
    }
    let text = opts.text || '';
    if (!text) {
        console.log('📝 Reading text from stdin...');
        text = await readStdin();
    }
    if (!text || text.trim().length === 0) {
        console.error('ERROR: No text provided. Use --text or pipe to stdin.');
        process.exit(1);
    }
    console.log(`\n⚡ Bootstrapping NestJS context...\n`);
    const app = await core_1.NestFactory.createApplicationContext(CliModule, {
        logger: ['error', 'warn', 'log'],
    });
    const ingestionService = app.get(ingestion_service_1.IngestionService);
    try {
        await ingestionService.initializeCollections();
        console.log(`📄 Ingesting ${opts.type} text (${text.length} chars)`);
        console.log('');
        const result = await ingestionService.ingestText(opts.type, text, opts.metadata, {
            chunkSize: opts.chunkSize,
            chunkOverlap: opts.chunkOverlap,
        });
        const status = result.errors.length === 0 ? '✅' : '⚠️';
        console.log(`\n${status} Ingestion ${result.errors.length === 0 ? 'Complete' : 'Completed with Errors'}`);
        console.log('─'.repeat(50));
        console.log(`  Document ID:  ${result.documentId}`);
        console.log(`  Type:         ${result.documentType}`);
        console.log(`  Chunks:       ${result.chunksGenerated}`);
        console.log(`  Upserted:     ${result.pointsUpserted}`);
        console.log(`  Duration:     ${result.durationMs}ms`);
        if (result.errors.length > 0) {
            console.log('  Errors:');
            for (const err of result.errors) {
                console.log(`    ❌ ${err}`);
            }
        }
        console.log('');
        await app.close();
        process.exit(result.errors.length > 0 ? 1 : 0);
    }
    catch (error) {
        console.error(`\n❌ Fatal error: ${error.message}\n`);
        await app.close();
        process.exit(1);
    }
}
main();
//# sourceMappingURL=ingest-text.js.map