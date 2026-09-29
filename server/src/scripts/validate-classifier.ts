import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { LegalDomainClassifierService } from '../modules/legal-domain/legal-domain-classifier.service';

async function runClassifierValidation() {
  console.log('⚡ Bootstrapping NestJS environment for Classifier Validation...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const classifier = app.get(LegalDomainClassifierService);

  const mustAnswer = [
    'Tell me about laws',
    'What is law?',
    'Explain Indian legal system.',
    'Tell me about Constitution.',
    'My husband beats me. What are my legal options?',
    'My employer is not paying salary.',
    'My landlord is threatening eviction.',
    'Someone hacked my bank account.',
    'What rights do tenants have?',
    'Can police arrest without warrant?',
    'Explain fundamental rights.',
    'Explain criminal law.',
    'Explain civil law.',
    'Difference between FIR and Complaint.',
    'What happens after arrest?',
    'What should I do after receiving a legal notice?'
  ];

  const mustReject = [
    'Write Python code',
    'Solve calculus problems',
    'Create a logo',
    'Tell me a joke',
    'Explain quantum physics',
    'Write a marketing email'
  ];

  console.log('\n========================================================================');
  console.log('                 LEXMENTOR AI LEGAL CLASSIFIER VALIDATION                ');
  console.log('========================================================================\n');

  let passedTests = 0;
  let totalTests = mustAnswer.length + mustReject.length;

  console.log('--- TESTING POSITIVE CASES (EXPECT ACCEPT / isLegal: true) ---');
  for (const query of mustAnswer) {
    const classification = await classifier.classifySemantic(query);
    const success = classification.isLegal === true;
    if (success) passedTests++;

    console.log(`Query: "${query}"`);
    console.log(`Classifier Result: ${classification.isLegal}`);
    console.log(`Reason: "${classification.reason}"`);
    console.log(`Pipeline Decision: ${classification.isLegal ? 'ACCEPT' : 'REJECT'}`);
    console.log(`Status: ${success ? '✅ PASS' : '❌ FAIL'}`);
    console.log('------------------------------------------------------------------------');
  }

  console.log('\n--- TESTING NEGATIVE CASES (EXPECT REJECT / isLegal: false) ---');
  for (const query of mustReject) {
    const classification = await classifier.classifySemantic(query);
    const success = classification.isLegal === false;
    if (success) passedTests++;

    console.log(`Query: "${query}"`);
    console.log(`Classifier Result: ${classification.isLegal}`);
    console.log(`Reason: "${classification.reason}"`);
    console.log(`Pipeline Decision: ${classification.isLegal ? 'ACCEPT' : 'REJECT'}`);
    console.log(`Status: ${success ? '✅ PASS' : '❌ FAIL'}`);
    console.log('------------------------------------------------------------------------');
  }

  console.log(`\nValidation Complete: ${passedTests}/${totalTests} Tests Passed.`);
  console.log('========================================================================\n');

  await app.close();
}

runClassifierValidation().catch((err) => {
  console.error('❌ Validation crashed:', err);
  process.exit(1);
});
