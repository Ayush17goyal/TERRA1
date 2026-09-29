import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env before anything else
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotebookModule } from '../modules/notebook/notebook.module';
import { NotebookService } from '../modules/notebook/notebook.service';

import { AppModule } from '../app.module';

async function run() {
  console.log('⚡ Bootstrapping NestJS CLI...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const service = app.get(NotebookService);
  const targetUserId = 'user_3EwmjaCl5UfguZTH3M8KPZg5AAE';

  console.log(`\n--- Fetching all documents for user: ${targetUserId} ---`);
  const docs = await service.listAll(targetUserId);
  console.log(`Found ${docs.length} documents.`);

  for (const doc of docs) {
    console.log(`Deleting doc: "${doc.name}" (ID: ${doc.id})`);
    const success = await service.delete(doc.id, targetUserId);
    console.log(`Deletion status: ${success ? 'SUCCESS' : 'FAILED'}`);
  }

  console.log('\n--- Cleanup Completed! ---');
  await app.close();
}

run().catch(err => {
  console.error('❌ Cleanup failed with error:', err);
  process.exit(1);
});
