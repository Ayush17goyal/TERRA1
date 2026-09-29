import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env before anything else
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ExamService } from '../modules/exam/exam.service';
import { NotebookService } from '../modules/notebook/notebook.service';
import { EntityManager } from 'typeorm';
import { NotebookDocument } from '../modules/notebook/notebook.entity';
import { DocumentChunk } from '../modules/notebook/chunk.entity';

async function testGroundedMockTest() {
  console.log('⚡ Bootstrapping NestJS test environment...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const examService = app.get(ExamService);
  const notebookService = app.get(NotebookService);
  const entityManager = app.get(EntityManager);

  const testUserId = 'test-user-exam-intel-999';
  console.log(`Test User ID: ${testUserId}`);

  // 1. Clean up existing test documents for this test user
  const docRepo = entityManager.getRepository(NotebookDocument);
  const chunkRepo = entityManager.getRepository(DocumentChunk);

  const existingDocs = await docRepo.find({ where: { userId: testUserId } });
  for (const doc of existingDocs) {
    await chunkRepo.delete({ documentId: doc.id });
    await docRepo.delete(doc.id);
  }
  console.log(`Cleaned up ${existingDocs.length} old test documents.`);

  // 2. Seed high-quality, long study materials
  console.log('Seeding study materials on Indian Contract Act, 1872...');
  
  const doc = new NotebookDocument();
  doc.name = 'Indian_Contract_Act_Notes.pdf';
  doc.type = 'pdf';
  doc.size = '1.2 MB';
  doc.status = 'Indexed';
  doc.userId = testUserId;
  doc.documentType = 'Teacher Notes';
  doc.tags = ['Ingested', 'Contract', 'Notes'];
  doc.extractedText = 'Indian Contract Act, 1872 syllabus notes...';
  doc.wordCount = 4500;
  const savedDoc = await docRepo.save(doc);

  // Generate around 4000 words of legal text to avoid insufficiency checks
  const paragraph = `
    The Indian Contract Act, 1872 governs the law relating to contracts in India. 
    Section 2(h) of the Act defines a contract as "an agreement enforceable by law." 
    An agreement, according to Section 2(e), is "every promise and every set of promises, forming the consideration for each other."
    For an agreement to become a contract, it must satisfy the essential elements of a valid contract laid down in Section 10:
    1. Offer and Acceptance: There must be a lawful offer by one party and a lawful acceptance of that offer by another.
    2. Intention to Create Legal Relations: The parties must intend to enter into a legally binding relationship (e.g. Balfour v. Balfour).
    3. Lawful Consideration: Section 2(d) defines consideration. Consideration must be real, lawful, and can be past, present or future.
    4. Capacity of Parties: Section 11 states that parties must be of sound mind, major, and not disqualified by law (Mohori Bibee v. Dharmodas Ghose).
    5. Free Consent: Section 13 defines consent as consensus ad idem (meeting of minds). Consent is free if not caused by Coercion (Sec 15), Undue Influence (Sec 16), Fraud (Sec 17), Misrepresentation (Sec 18), or Mistake (Sec 20, 21, 22).
    6. Lawful Object and Consideration: Section 23 specifies which objects/considerations are unlawful (forbidden by law, fraudulent, immoral, or against public policy).
    7. Agreement Not Expressly Declared Void: Sections 24 to 30 list void agreements (e.g. agreement in restraint of marriage (Sec 26), restraint of trade (Sec 27), restraint of legal proceedings (Sec 28), uncertain agreements (Sec 29), wagering agreements (Sec 30)).
  `;

  // Create 10 chunks to make sure we have plenty of text and chunk overlap
  for (let i = 0; i < 10; i++) {
    const chunk = new DocumentChunk();
    chunk.documentId = savedDoc.id;
    chunk.documentName = savedDoc.name;
    chunk.chunkIndex = i;
    chunk.pageNumber = i + 1;
    chunk.text = `[Section ${i + 1} Analysis] ${paragraph} Detailed analysis portion ${i + 1}: The doctrine of privity of contract states that a stranger to a contract cannot sue, subject to exceptions like trust, family settlement, and marriage arrangement. (Landmark case: Dunlop Pneumatic Tyre Co Ltd v Selfridge & Co Ltd). Agreement vs Contract: All contracts are agreements but all agreements are not contracts. Free consent is the cornerstone of contract validity under Section 10 of the Indian Contract Act. Under Section 16, undue influence involves dominated will and unfair advantage. Under Section 17, fraud involves active concealment or false suggestion. Under Section 18, misrepresentation is an innocent false statement. Under Section 19, agreements caused by coercion, fraud, or misrepresentation are voidable.`;
    await chunkRepo.save(chunk);
  }
  console.log('Seeded 10 document chunks successfully.');

  // 3. Generate Mock Test
  console.log('\n--- Running generateGroundedMockTest ---');
  const result = await examService.generateGroundedMockTest(
    testUserId,
    'Generate a 10 Marks and 20 Marks descriptive paper on the essential elements of a valid contract and free consent under the Indian Contract Act, 1872.',
    savedDoc.id,
    {
      answerDepth: 'detailed',
      insufficientMaterialMessage: 'Seeded test material is insufficient.'
    }
  );

  console.log('Mock Test Generation Result:');
  console.log(`Success: ${result.success}`);
  console.log(`Title: ${result.title}`);
  console.log(`Subject: ${result.subject}`);
  console.log(`Difficulty: ${result.difficulty}`);
  console.log(`Total Marks: ${result.totalMarks}`);
  console.log(`Time (minutes): ${result.timeMinutes}`);
  console.log(`Questions Generated: ${result.questions?.length}`);

  if (result.success && result.questions && result.questions.length > 0) {
    for (let idx = 0; idx < result.questions.length; idx++) {
      const q = result.questions[idx];
      console.log(`\n[Question ${idx + 1}] ID: ${q.id} | Section: ${q.section} | Marks: ${q.marks}`);
      console.log(`Question Text: ${q.question}`);
      console.log(`Answer Depth: ${q.answerDepth}`);
      console.log(`Answer Word Count: ${q.wordCount || q.answerWordCount}`);
      console.log(`Citations Count: ${q.grounding?.sourceChunks?.length || q.sourceChunks?.length}`);
      
      console.log('--- Model Answer snippet (first 300 chars) ---');
      console.log(q.modelAnswer?.substring(0, 300) + '...');
      
      console.log(`Citations Used:`, q.grounding?.sourceChunks?.map((c: any) => `${c.documentName} p.${c.pageNumber}`));
      console.log(`Important Judgments extracted:`, q.importantJudgments);
      console.log(`Relevant Articles:`, q.relevantArticles);
      console.log(`Relevant Sections:`, q.relevantSections);
    }
  } else {
    console.log('❌ Mock test generation failed! Message:', result.message);
  }

  await app.close();
}

testGroundedMockTest().catch((err) => {
  console.error('❌ Script execution failed:', err);
  process.exit(1);
});
