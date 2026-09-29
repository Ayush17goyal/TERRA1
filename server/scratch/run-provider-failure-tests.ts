import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Force AI provider keys to fail
process.env.OPENROUTER_API_KEY = 'placeholder';
process.env.OPENAI_API_KEY = 'placeholder';
process.env.GEMINI_API_KEY = 'placeholder';
process.env.DEEPSEEK_API_KEY = 'placeholder';

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { OpenRouterAiProviderService } from '../src/modules/chat/openrouter-ai-provider.service';
import { ResearchService } from '../src/modules/research/research.service';
import { JudgmentService } from '../src/modules/judgment/judgment.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotebookDocument } from '../src/modules/notebook/notebook.entity';
import { JudgmentAnalysis } from '../src/modules/judgment/judgment-analysis.entity';
import {
  ResearchUser,
  ResearchReport,
  ResearchQuery,
  ResearchSource,
  ResearchNote,
  ResearchAsset
} from '../src/modules/research/research.entities';
import { ServiceUnavailableException } from '@nestjs/common';
import { LexMentorAiService as LexMentorService } from '../src/modules/chat/lexmentor-ai.service';

async function runTests() {
  console.log('⚡ Bootstrapping NestJS Context under Simulated Complete AI Provider Failure...');
  let app: any;
  const results: any = {
    timestamp: new Date().toISOString(),
    aiProviderFailureMocked: false,
    lexMentorResilience: { status: 'Failed', error: '', outputSnippet: '' },
    legalResearchResilience: { status: 'Failed', error: '', outputSnippet: '' },
    memorialArchitectResilience: { status: 'Failed', error: '', outputSnippet: '' },
    securityChecksPassed: false,
  };

  let testUser: any = null;
  let tempDoc: any = null;
  let tempAnalysis: any = null;

  try {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'],
    });

    const aiProvider = app.get(OpenRouterAiProviderService);
    const lexMentor = app.get(LexMentorService);
    const researchService = app.get(ResearchService);
    const judgmentService = app.get(JudgmentService);

    const docRepo = app.get(getRepositoryToken(NotebookDocument));
    const analysisRepo = app.get(getRepositoryToken(JudgmentAnalysis));
    const userRepo = app.get(getRepositoryToken(ResearchUser));
    const reportRepo = app.get(getRepositoryToken(ResearchReport));
    const queryRepo = app.get(getRepositoryToken(ResearchQuery));
    const sourceRepo = app.get(getRepositoryToken(ResearchSource));
    const noteRepo = app.get(getRepositoryToken(ResearchNote));
    const assetRepo = app.get(getRepositoryToken(ResearchAsset));

    // 1. Verify AI Provider fails as expected
    console.log('\n--- 1. Testing AI Provider Failure Mock ---');
    try {
      await aiProvider.complete({
        messages: [{ role: 'user', content: 'Test prompt' }],
        module: 'lexmentor'
      });
      console.error('❌ Error: AI Provider completed instead of failing!');
    } catch (err: any) {
      if (err instanceof ServiceUnavailableException) {
        console.log('✅ Success: AI Provider correctly throws ServiceUnavailableException.');
        results.aiProviderFailureMocked = true;
      } else {
        console.error(`❌ Unexpected error type: ${err.message}`);
      }
    }

    // Resolve a test user
    console.log('\nResolving test user in DB...');
    testUser = await researchService.resolveUser({
      id: 'test-failure-user-id',
      email: 'test-failure@legatrixon.com',
      fullName: 'Failure Test User'
    });
    console.log(`Resolved test user: ${testUser.id}`);

    // 2. Test LexMentor
    console.log('\n--- 2. Testing LexMentor Fallback (Offline Retrieval / Friendly Notice) ---');
    try {
      const response = await lexMentor.generateResponse({
        query: 'Article 21 Right to Privacy in India',
        depth: 'Expert',
        userId: testUser.id
      });

      console.log(`LexMentor Response Provider: ${response.provider}`);
      console.log(`LexMentor Response Model: ${response.model}`);
      console.log(`Citations Count: ${response.citations?.length || 0}`);
      console.log('Snippet:\n' + response.content.substring(0, 400) + '\n...');

      results.lexMentorResilience = {
        status: 'Passed',
        provider: response.provider,
        model: response.model,
        citationsCount: response.citations?.length || 0,
        outputSnippet: response.content.substring(0, 500)
      };
    } catch (err: any) {
      console.error(`❌ LexMentor execution failed: ${err.stack}`);
      results.lexMentorResilience = { status: 'Failed', error: err.message || String(err) };
    }

    // 3. Test Legal Research
    console.log('\n--- 3. Testing Legal Research Local Fallback Report ---');
    try {
      const report = await researchService.generateReport(testUser.id, {
        topic: 'Constitutional validity of reservation policy',
        researchMode: 'Academic',
        sources: ['constitution', 'supreme_court_cases'],
        depth: 'standard',
        provider: 'deepseek'
      });

      console.log(`Research Report Title: ${report.title}`);
      console.log(`Outline Issues: ${report.researchOutline?.issues?.join(', ')}`);
      console.log(`Integrity Score: ${report.researchOutline?.topicMatchScore}%`);
      console.log(`Confidence Score: ${report.researchOutline?.confidenceScore}%`);
      console.log(`Word Count: ${report.researchOutline?.wordCount}`);
      console.log('Report Preview:\n' + report.summary.substring(0, 400) + '\n...');

      results.legalResearchResilience = {
        status: 'Passed',
        title: report.title,
        wordCount: report.researchOutline?.wordCount,
        topicMatchScore: report.researchOutline?.topicMatchScore,
        confidenceScore: report.researchOutline?.confidenceScore,
        hasXmlTags: report.summary.includes('# Cover Page') || report.summary.includes('## 1. Cover Page'),
        outputSnippet: report.summary.substring(0, 500)
      };
    } catch (err: any) {
      console.error(`❌ Legal Research execution failed: ${err.stack}`);
      results.legalResearchResilience = { status: 'Failed', error: err.message || String(err) };
    }

    // 4. Test Memorial Architect / Moot Court (Judgment Service fallbacks)
    console.log('\n--- 4. Testing Memorial Architect & Moot Court Fallbacks ---');
    try {
      // Create a temporary document and judgment analysis in SQLite
      tempDoc = docRepo.create({
        id: 'test-temp-doc-id',
        userId: testUser.id,
        name: 'test_judgment.pdf',
        docCategory: 'judgment',
        content: 'This is a sample judgment text for Kesavananda Bharati v. State of Kerala, AIR 1973 SC 1461. The petition challenge basic structure limits.',
        status: 'Ready',
        type: 'pdf',
        size: '15.5 KB', // Fixed: supplied NOT NULL string field
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await docRepo.save(tempDoc);

      tempAnalysis = analysisRepo.create({
        id: 'test-temp-analysis-id',
        documentId: tempDoc.id,
        userId: testUser.id,
        title: 'Kesavananda Bharati v. State of Kerala',
        citation: 'AIR 1973 SC 1461',
        court: 'Supreme Court of India',
        bench: '13-Judge Bench',
        dateOfJudgment: '1973-04-24',
        judges: ['Sikri, C.J.', 'Shelat, J.', 'Grover, J.'],
        facts: 'The case concerned the constitutional validity of the 24th, 25th, and 29th Amendments.',
        issues: ['Scope of Article 368 amending power'],
        argumentsPetitioner: ['Parliament cannot alter fundamental features of the Constitution.'],
        argumentsRespondent: ['Amending power under Article 368 is unlimited.'],
        statutes: ['Article 368', 'Article 13'],
        precedents: ['Sankari Prasad v. Union of India', 'Sajjan Singh v. State of Rajasthan'],
        ratioDecidendi: 'Parliament cannot alter the basic structure of the Constitution.',
        obiterDicta: 'Judicial review is a core constitutional guard.',
        holding: 'Basic structure is unamendable.',
        finalVerdict: 'Amendments partially upheld.',
        timeline: [{ year: '1973', event: 'Judgment delivered' }],
        citationNetwork: [],
        examRelevanceScore: 98,
        landmarkImpactScore: 100,
        sourceChunkRefs: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await analysisRepo.save(tempAnalysis);

      console.log('Evaluating explainLike for moot prep mode...');
      const mootPrepResponse = await judgmentService.explainLike(tempDoc.id, 'moot_prep');
      console.log('moot_prep response preview:\n' + mootPrepResponse.content.substring(0, 300) + '\n...');

      console.log('Evaluating generateMootCourtKit...');
      const mootKitResponse = await judgmentService.generateMootCourtKit(tempDoc.id);
      console.log('mootKit response preview:\n' + mootKitResponse.content.substring(0, 300) + '\n...');

      results.memorialArchitectResilience = {
        status: 'Passed',
        mootPrepModeSnippet: mootPrepResponse.content.substring(0, 300),
        mootKitSnippet: mootKitResponse.content.substring(0, 300)
      };
    } catch (err: any) {
      console.error(`❌ Memorial Architect execution failed: ${err.stack}`);
      results.memorialArchitectResilience = { status: 'Failed', error: err.message || String(err) };
    }

    // 5. Cleanup database safely
    console.log('\nCleaning up database...');
    try {
      if (tempAnalysis) {
        await analysisRepo.delete(tempAnalysis.id);
        console.log('Deleted temporary judgment analysis.');
      }
      if (tempDoc) {
        await docRepo.delete(tempDoc.id);
        console.log('Deleted temporary notebook document.');
      }
      if (testUser) {
        // Delete child research assets, sources, notes, reports, and queries first
        const userReports = await reportRepo.find({ where: { userId: testUser.id } });
        for (const rep of userReports) {
          await assetRepo.delete({ reportId: rep.id });
          await sourceRepo.delete({ reportId: rep.id });
          await noteRepo.delete({ reportId: rep.id });
        }
        await reportRepo.delete({ userId: testUser.id });
        await queryRepo.delete({ userId: testUser.id });
        await userRepo.delete(testUser.id);
        console.log('Safely cleaned up all user-related research records.');
      }
    } catch (cleanupErr: any) {
      console.warn(`⚠️ Warning: Database cleanup failed: ${cleanupErr.message}`);
    }
  } catch (globalErr: any) {
    console.error(`Global script error: ${globalErr.stack}`);
  } finally {
    // 6. Verify security checks (users never see HTTP 402, rate limits, or provider errors)
    console.log('\n--- 6. Security Check: Error Masking Verification ---');
    const allOutputs = [
      results.lexMentorResilience?.outputSnippet || '',
      results.lexMentorResilience?.error || '',
      results.legalResearchResilience?.outputSnippet || '',
      results.legalResearchResilience?.error || '',
      results.memorialArchitectResilience?.mootPrepModeSnippet || '',
      results.memorialArchitectResilience?.mootKitSnippet || '',
      results.memorialArchitectResilience?.error || '',
    ].join(' ').toLowerCase();

    const containsForbiddenErrors =
      allOutputs.includes('http 402') ||
      allOutputs.includes('payment required') ||
      allOutputs.includes('rate limit') ||
      allOutputs.includes('429') ||
      allOutputs.includes('openrouter') ||
      allOutputs.includes('deepseek') ||
      allOutputs.includes('gemini') ||
      allOutputs.includes('serviceunavailableexception') ||
      allOutputs.includes('ai provider failed') ||
      allOutputs.includes('api key');

    if (containsForbiddenErrors) {
      console.error('❌ Security check failed! Forbidden raw error messages or provider names leaked to the user.');
      results.securityChecksPassed = false;
    } else {
      console.log('✅ Security check passed! No raw provider errors, HTTP 402, or rate limit notices leaked to response contents.');
      results.securityChecksPassed = true;
    }

    // Save report
    const reportPath = path.join(__dirname, 'provider-failure-test-results.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify(results, null, 2)
    );
    console.log(`\nWritten test results to: ${reportPath}`);

    if (app) {
      try {
        console.log('Closing NestJS context...');
        await app.close();
      } catch (err) {
        // Silent
      }
    }
    console.log('Test completed. Exiting process.');
    process.exit(results.securityChecksPassed ? 0 : 1);
  }
}

runTests().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
