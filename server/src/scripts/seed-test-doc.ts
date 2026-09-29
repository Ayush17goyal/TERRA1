import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { NotebookService } from '../modules/notebook/notebook.service';
import { NotebookDocument } from '../modules/notebook/notebook.entity';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const notebookService = app.get(NotebookService);
  const dataSource = app.get(DataSource);
  
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  
  // List all tables in sqlite
  const tables = await queryRunner.query("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('Available database tables:', tables.map(t => t.name).join(', '));
  
  let userId = 'mock_clerk_id_123'; // Default fallback
  
  // Try querying user_profiles if it exists
  const hasProfiles = tables.some(t => t.name === 'user_profiles');
  if (hasProfiles) {
    const profiles = await queryRunner.query('SELECT userId FROM user_profiles LIMIT 1');
    if (profiles.length > 0) {
      userId = profiles[0].userId;
      console.log(`Found user ID in user_profiles: ${userId}`);
    }
  } else {
    // Try querying notebook_documents
    const hasDocs = tables.some(t => t.name === 'notebook_documents');
    if (hasDocs) {
      const docs = await queryRunner.query('SELECT user_id FROM notebook_documents LIMIT 1');
      if (docs.length > 0) {
        userId = docs[0].user_id;
        console.log(`Found user ID in notebook_documents: ${userId}`);
      }
    }
  }
  
  console.log(`Using user ID for seeding: ${userId}`);
  
  const filePath = 'C:\\Users\\goyal\\.gemini\\antigravity-ide\\brain\\1de7c605-d143-4ffb-b222-a6a67ceee181\\scratch\\test_bare_act.txt';
  if (!fs.existsSync(filePath)) {
    throw new Error(`Test file not found at ${filePath}`);
  }
  
  const buffer = fs.readFileSync(filePath);
  console.log('Seeding test_bare_act.txt into Study Library...');
  
  const doc = await notebookService.startIngestion(
    userId,
    {
      originalname: 'test_bare_act.txt',
      buffer,
      size: buffer.length,
      mimetype: 'text/plain',
    },
    'Bare Act',
  );
  
  console.log(`Document Ingestion Triggered Successfully!`);
  console.log(`Document ID: ${doc.id}`);
  console.log(`Document Type: ${doc.documentType}`);
  console.log(`Initial Status: ${doc.status}`);
  
  // Wait a few seconds for background indexing to complete
  console.log('Waiting for indexing to complete (polling document status)...');
  const docRepo = dataSource.getRepository(NotebookDocument);
  for (let i = 0; i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const currentDoc = await docRepo.findOne({ where: { id: doc.id } });
    if (currentDoc) {
      console.log(`Current status: ${currentDoc.status} | Embeddings: ${currentDoc.embeddingsStatus}`);
      if (currentDoc.status === 'Indexed' || currentDoc.status === 'Ready') {
        console.log('Indexing completed successfully!');
        break;
      }
    }
  }
  
  await queryRunner.release();
  await app.close();
}

bootstrap().catch(err => {
  console.error('Seeding script failed:', err);
  process.exit(1);
});
