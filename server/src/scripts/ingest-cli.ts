#!/usr/bin/env ts-node
/**
 * BGE-M3 Document Ingestion CLI
 * ===============================
 * Standalone script that bootstraps a minimal NestJS context (no HTTP server)
 * and runs the ingestion pipeline.
 *
 * Usage:
 *   npx ts-node src/scripts/ingest-cli.ts --type judgment --file ./test-data/sample-judgment.txt
 *   npx ts-node src/scripts/ingest-cli.ts --type act --dir ./test-data/ --metadata '{"act_name":"IPC"}'
 *   npx ts-node src/scripts/ingest-cli.ts --status
 *
 * Options:
 *   --type      Document type: constitution | bns | bnss | act | judgment | paper
 *   --file      Path to a single document file
 *   --dir       Path to a directory of documents
 *   --metadata  JSON string of extra metadata
 *   --chunk-size    Target chunk size in characters (default: 1000)
 *   --chunk-overlap Overlap between chunks in characters (default: 200)
 *   --status    Just check pipeline health and exit
 *   --init      Initialize Qdrant collections and exit
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { IngestionService, DocumentType } from '../modules/ingestion/ingestion.service';
import { IngestionModule } from '../modules/ingestion/ingestion.module';
import { RetrievalModule } from '../modules/retrieval/retrieval.module';
import { AppModule } from '../app.module';

// Minimal module that only boots the ingestion pipeline (no HTTP)
@Module({
  imports: [AppModule],
})
class CliModule {}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(): {
  type?: DocumentType;
  file?: string;
  dir?: string;
  metadata: Record<string, any>;
  chunkSize?: number;
  chunkOverlap?: number;
  status: boolean;
  init: boolean;
} {
  const args = process.argv.slice(2);
  const result: any = { metadata: {}, status: false, init: false };

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
        } catch {
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  if (!opts.status && !opts.init && !opts.type) {
    printUsage();
    process.exit(1);
  }

  console.log('\n⚡ Bootstrapping NestJS context (no HTTP server)...\n');
  const app = await NestFactory.createApplicationContext(CliModule, {
    logger: ['error', 'warn', 'log'],
  });
  const ingestionService = app.get(IngestionService);

  try {
    // --status
    if (opts.status) {
      const status = await ingestionService.getStatus();
      console.log('\n📊 Pipeline Status');
      console.log('─'.repeat(50));
      console.log(`  BGE-M3 Sidecar:  ${status.bgeM3Healthy ? '✅ Healthy' : '❌ Unreachable'}`);
      if (status.bgeM3Model) console.log(`  Model:           ${status.bgeM3Model}`);
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

    // --init
    if (opts.init) {
      console.log('🔧 Initializing Qdrant collections...\n');
      const created = await ingestionService.initializeCollections();
      if (created.length > 0) {
        console.log(`✅ Created: ${created.join(', ')}`);
      } else {
        console.log('✅ All collections already exist.');
      }
      console.log('');
      await app.close();
      process.exit(0);
    }

    // Validate type
    const validTypes: DocumentType[] = ['constitution', 'bns', 'bnss', 'act', 'judgment', 'paper'];
    if (!validTypes.includes(opts.type!)) {
      console.error(`ERROR: --type must be one of: ${validTypes.join(', ')}`);
      await app.close();
      process.exit(1);
    }

    // Ensure collections
    await ingestionService.initializeCollections();

    const chunkerOpts = {
      chunkSize: opts.chunkSize,
      chunkOverlap: opts.chunkOverlap,
    };

    // --file (single document)
    if (opts.file) {
      console.log(`📄 Ingesting file: ${opts.file}`);
      console.log(`   Type: ${opts.type}`);
      console.log('');

      const result = await ingestionService.ingestDocument(
        opts.type!,
        opts.file,
        opts.metadata,
        chunkerOpts,
      );

      printResult(result);

      await app.close();
      process.exit(result.errors.length > 0 ? 1 : 0);
    }

    // --dir (batch)
    if (opts.dir) {
      console.log(`📁 Ingesting directory: ${opts.dir}`);
      console.log(`   Type: ${opts.type}`);
      console.log('');

      const batchResult = await ingestionService.ingestDirectory(
        opts.type!,
        opts.dir,
        opts.metadata,
        chunkerOpts,
      );

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

    // No --file or --dir
    console.error('ERROR: Provide --file or --dir for ingestion.');
    printUsage();
    await app.close();
    process.exit(1);
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}\n`);
    await app.close();
    process.exit(1);
  }
}

function printResult(result: any) {
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
