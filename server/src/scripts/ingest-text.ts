#!/usr/bin/env ts-node
/**
 * BGE-M3 Raw Text Ingestion CLI
 * ===============================
 * Ingest text directly into the vector pipeline — from stdin or inline argument.
 *
 * Usage:
 *   # Inline text
 *   npx ts-node src/scripts/ingest-text.ts --type judgment --text "The court held that..."
 *
 *   # Pipe from stdin
 *   cat judgment.txt | npx ts-node src/scripts/ingest-text.ts --type judgment
 *
 *   # With metadata
 *   npx ts-node src/scripts/ingest-text.ts --type act --text "Section 302..." --metadata '{"act_name":"IPC"}'
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { IngestionService, DocumentType } from '../modules/ingestion/ingestion.service';
import { IngestionModule } from '../modules/ingestion/ingestion.module';
import { RetrievalModule } from '../modules/retrieval/retrieval.module';

@Module({
  imports: [RetrievalModule, IngestionModule],
})
class CliModule {}

// ---------------------------------------------------------------------------
// Read from stdin if available
// ---------------------------------------------------------------------------

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    // If stdin is a TTY (no piped input), resolve empty immediately
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data.trim()));

    // Timeout after 5 seconds of no input
    setTimeout(() => resolve(data.trim()), 5000);
  });
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(): {
  type?: DocumentType;
  text?: string;
  metadata: Record<string, any>;
  chunkSize?: number;
  chunkOverlap?: number;
} {
  const args = process.argv.slice(2);
  const result: any = { metadata: {} };

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
      default:
        console.error(`Unknown argument: ${args[i]}`);
        process.exit(1);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  if (!opts.type) {
    console.error('ERROR: --type is required (constitution | bns | bnss | act | judgment | paper)');
    process.exit(1);
  }

  // Get text from --text flag or stdin
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
  const app = await NestFactory.createApplicationContext(CliModule, {
    logger: ['error', 'warn', 'log'],
  });
  const ingestionService = app.get(IngestionService);

  try {
    // Ensure collections
    await ingestionService.initializeCollections();

    console.log(`📄 Ingesting ${opts.type} text (${text.length} chars)`);
    console.log('');

    const result = await ingestionService.ingestText(
      opts.type,
      text,
      opts.metadata,
      {
        chunkSize: opts.chunkSize,
        chunkOverlap: opts.chunkOverlap,
      },
    );

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
  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}\n`);
    await app.close();
    process.exit(1);
  }
}

main();
