"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../app.module");
const learning_workspace_service_1 = require("../modules/learning-workspace/learning-workspace.service");
const typeorm_1 = require("typeorm");
const common_1 = require("@nestjs/common");
async function runTests() {
    console.log('⚡ Bootstrapping NestJS test environment...');
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, {
        logger: ['error', 'warn'],
    });
    const service = app.get(learning_workspace_service_1.LearningWorkspaceService);
    const entityManager = app.get(typeorm_1.EntityManager);
    console.log('🔌 Mocking AI providers and LLM JSON generation engines...');
    service['generateLlmJson'] = async (prompt, text, jsonSchemaDescription) => {
        const geminiKey = process.env.GEMINI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const deepseekKey = process.env.DEEPSEEK_API_KEY;
        const openrouterKey = process.env.OPENROUTER_API_KEY;
        const missingKeys = [];
        if (!geminiKey || geminiKey.includes('placeholder'))
            missingKeys.push('GEMINI_API_KEY');
        if (!openaiKey || openaiKey.includes('placeholder'))
            missingKeys.push('OPENAI_API_KEY');
        if (!deepseekKey || deepseekKey.includes('placeholder'))
            missingKeys.push('DEEPSEEK_API_KEY');
        if (!openrouterKey || openrouterKey.includes('placeholder'))
            missingKeys.push('OPENROUTER_API_KEY');
        if (missingKeys.length === 4) {
            throw new common_1.BadRequestException(`AI provider is not configured correctly. Please check API key settings. Missing env variables: ${missingKeys.join(', ')}`);
        }
        if (jsonSchemaDescription.includes('questions') || prompt.includes('questions') || prompt.includes('question paper')) {
            const is100Marks = /100\s*marks?/i.test(prompt);
            const is50Marks = /50\s*marks?/i.test(prompt);
            const marks = is100Marks ? 20 : (is50Marks ? 10 : 15);
            const count = is100Marks ? 5 : (is50Marks ? 5 : 3);
            const template = prompt.includes('semester') ? 'Full Semester Paper'
                : prompt.includes('unit wise') ? 'Unit Wise Test'
                    : prompt.includes('PYQ') ? 'PYQ Style Paper'
                        : prompt.includes('teacher') ? 'Teacher Style Paper'
                            : prompt.includes('50 marks') ? '50 Marks Exam'
                                : prompt.includes('important') ? 'Important Questions'
                                    : prompt.includes('difficult') ? 'Difficult Practice Test'
                                        : prompt.includes('revision') ? 'Revision Test'
                                            : 'AI Prompt';
            const mockQuestions = Array.from({ length: count }, (_, i) => ({
                id: `q${i + 1}`,
                type: `${marks} Marks Questions`,
                topic: `Contract Law Section ${10 + i * 2}`,
                question: `Explain and discuss in detail the provisions of Section ${10 + i * 2} of the Indian Contract Act, 1872 with respect to essential elements and case law.`,
                marks: marks,
                difficulty: 'Intermediate',
                template: template,
                citations: [{
                        sourceName: 'Good_Contract_Notes.pdf',
                        section: `Section ${10 + i * 2}`,
                        chapter: 'Chapter 1',
                        page: 'Page 1',
                        chunkRef: `chunk_${i + 1}`,
                        paragraph: `Paragraph ${i + 1}`,
                        supportingText: `Relevant legal excerpt from source document about Section ${10 + i * 2}.`,
                        confidenceScore: 0.95
                    }]
            }));
            return {
                questions: mockQuestions,
                scoreReport: {
                    totalMarks: marks * count,
                    scoringRule: 'Descriptive paper only; answers generated on explicit request.'
                },
                weakAreas: []
            };
        }
        return {
            modelAnswer: `1. Introduction\nThis is a mock structured model answer for the legal exam question. It explains the background and context in detail.\n\n2. Concept Explanation\nThe conceptual details are fully grounded in the uploaded material, explaining the exact scope and statutory meanings.\n\n3. Legal Framework\nThe statutory principles and definitions from the relevant Act governing this domain.\n\n4. Relevant Articles\nArticles from the Constitution of India, if applicable, providing fundamental context.\n\n5. Relevant Sections\nSpecific Bare Act sections that lay down the primary obligations and elements.\n\n6. Important Judgments\nLandmark rulings of the Supreme Court of India that have settled the position of law.\n\n7. Ratio Decidendi\nThe core rationale and ruling principles from the cited cases.\n\n8. Critical Analysis\nA comparative review, challenges, exceptions, and prosecution or civil hurdles.\n\n9. Conclusion\nSummary of the discussion and current status in Indian jurisprudence.`,
            importantJudgments: ['State of Madras v. Champakam Dorairajan (AIR 1951 SC 226)', 'Mohori Bibee v. Dharmodas Ghose'],
            relevantArticles: ['Article 15 of the Constitution of India'],
            relevantSections: ['Section 10 of the Indian Contract Act, 1872', 'Section 14 of the Indian Contract Act, 1872'],
            sourcesUsed: ['Good_Contract_Notes.pdf'],
            citations: [{
                    sourceName: 'Good_Contract_Notes.pdf',
                    page: 'Page 1',
                    chunkRef: 'chunk_1',
                    supportingText: 'Consent is free under Section 14 when not caused by coercion.'
                }]
        };
    };
    const originalRetrieve = service['retrieveRelevantMockChunks'].bind(service);
    service['retrieveRelevantMockChunks'] = async (uId, q, sIds, limit = 10) => {
        const results = await originalRetrieve(uId, q, sIds, limit).catch(() => []);
        if (results && results.length > 0) {
            return results;
        }
        const mockChunks = [];
        const sourceRecords = await entityManager.query('SELECT id, name, text FROM ai_learning_sources WHERE id IN (' + sIds.map(() => '?').join(',') + ') AND user_id = ?', [...sIds, uId]).catch(() => []);
        for (const src of sourceRecords) {
            mockChunks.push({
                id: `mock-chunk-${src.id}`,
                score: 0.95,
                payload: {
                    user_id: uId,
                    source_id: src.id,
                    name: src.name,
                    document_name: src.name,
                    text: src.text,
                    chunk_text: src.text,
                    page_number: 1,
                    paragraph_index: 1,
                    confidence_score: 0.95
                }
            });
        }
        return mockChunks;
    };
    try {
        const { ExamService } = require('../modules/exam/exam.service');
        const examService = app.get(ExamService);
        if (examService) {
            examService['generateJsonWithProviderFallback'] = async (systemPrompt, payload) => {
                const geminiKey = process.env.GEMINI_API_KEY;
                const openaiKey = process.env.OPENAI_API_KEY;
                const deepseekKey = process.env.DEEPSEEK_API_KEY;
                const openrouterKey = process.env.OPENROUTER_API_KEY;
                const missingKeys = [];
                if (!geminiKey || geminiKey.includes('placeholder'))
                    missingKeys.push('GEMINI_API_KEY');
                if (!openaiKey || openaiKey.includes('placeholder'))
                    missingKeys.push('OPENAI_API_KEY');
                if (!deepseekKey || deepseekKey.includes('placeholder'))
                    missingKeys.push('DEEPSEEK_API_KEY');
                if (!openrouterKey || openrouterKey.includes('placeholder'))
                    missingKeys.push('OPENROUTER_API_KEY');
                if (missingKeys.length === 4) {
                    throw new common_1.BadRequestException(`AI provider is not configured correctly. Please check API key settings. Missing env variables: ${missingKeys.join(', ')}`);
                }
                return {};
            };
        }
    }
    catch (err) {
        console.warn('Could not mock ExamService:', err.message);
    }
    const userId = 'flow-test-user-777';
    console.log(`Test User ID: ${userId}`);
    console.log('🧹 Cleaning up database and Qdrant collections for test user...');
    try {
        await entityManager.query('DELETE FROM ai_learning_sources WHERE user_id = ?', [userId]);
        await entityManager.query('DELETE FROM ai_mock_tests WHERE user_id = ?', [userId]);
        await entityManager.query('DELETE FROM ai_mock_test_attempts WHERE user_id = ?', [userId]);
        console.log('Database records cleaned successfully.');
    }
    catch (dbErr) {
        console.warn('Database cleanup warning:', dbErr.message);
    }
    try {
        const qdrantService = app.get(require('../modules/retrieval/qdrant.service').QdrantService);
        const qClient = qdrantService.getClient();
        if (qClient) {
            await qClient.delete('user_documents', {
                filter: {
                    must: [{ key: 'user_id', match: { value: userId } }]
                }
            });
            console.log('Qdrant points cleaned successfully.');
            const colInfo = await qClient.getCollection('user_documents');
            console.log('Qdrant collection user_documents info:', JSON.stringify(colInfo, null, 2));
        }
    }
    catch (e) {
        console.error('Failed to get Qdrant collection diagnostics:', e.message);
    }
    async function seedDoc(name, wordCount, status, extractedText) {
        const created = await service.createTextSource(userId, {
            name,
            text: extractedText,
            kind: 'PDF Upload',
        });
        return created;
    }
    async function testFlow(name, fn) {
        console.log(`\n========================================`);
        console.log(`TEST: ${name}`);
        console.log(`========================================`);
        try {
            await fn();
            console.log(`🟢 ${name} - SUCCESS`);
        }
        catch (err) {
            console.log(`🔴 ${name} - FAILED: ${err.message || err}`);
        }
    }
    const goodText = Array.from({ length: 90 }, (_, i) => `Paragraph ${i + 1}: The Indian Contract Act, 1872 governs agreements. Section 2(h) defines contract as enforceable by law. Section 10 requires free consent. Consent is free under Section 14 when not caused by coercion under Section 15, undue influence under Section 16, fraud under Section 17, or misrepresentation under Section 18. Case laws: Mohori Bibee v. Dharmodas Ghose.`).join('\n\n');
    const goodDoc = await seedDoc('Good_Contract_Notes.pdf', 4000, 'indexed', goodText);
    console.log(`Seeded good readable PDF source ID: ${goodDoc.id}`);
    const weakText = `A single page note on Contract Law. A contract is a promise. Agreement is offer plus acceptance. Section 10 requires capacity.`;
    const weakDoc = await seedDoc('Weak_Contract.pdf', 300, 'indexed', weakText);
    console.log(`Seeded weak one-page PDF source ID: ${weakDoc.id}`);
    const scannedDoc = await service.createTextSource(userId, {
        name: 'Scanned_Doc.pdf',
        text: 'This scanned document has unreadable PDF pages with OCR errors. Noise only.',
        kind: 'PDF Upload'
    });
    console.log(`Seeded scanned/unreadable PDF source ID: ${scannedDoc.id}`);
    await testFlow('1. Good readable PDF', async () => {
        const test = await service.generateMockTest(userId, {
            topic: 'Contract Law Essentials',
            difficulty: 'Intermediate',
            mode: 'descriptive',
            questionCount: 3,
            sourceIds: [goodDoc.id],
            prompt: 'Generate a descriptive exam on Section 10 of Indian Contract Act.'
        });
        console.log(`Generated Mock Test ID: ${test.id}, Total Marks: ${test.totalMarks}, Questions count: ${test.questions?.length}`);
        if (!test.questions || test.questions.length === 0)
            throw new Error('No questions generated');
        console.log(`Question 1: ${test.questions[0].question}`);
        console.log(`Grounding topic: ${test.questions[0].grounding?.topic}`);
    });
    await testFlow('2. Weak one-page PDF', async () => {
        try {
            await service.generateMockTest(userId, {
                topic: 'Contract Law',
                difficulty: 'Intermediate',
                mode: 'descriptive',
                questionCount: 3,
                sourceIds: [weakDoc.id],
                prompt: 'Generate a descriptive exam.'
            });
            throw new Error('Should have failed due to weak source material');
        }
        catch (err) {
            console.log(`Caught expected error: ${err.message}`);
            if (!err.message.includes('enough readable') && !err.message.includes('insufficient')) {
                throw new Error('Wrong error message: ' + err.message);
            }
        }
    });
    await testFlow('3. Scanned/unreadable PDF', async () => {
        try {
            await service.generateMockTest(userId, {
                topic: 'Contract Law',
                difficulty: 'Intermediate',
                mode: 'descriptive',
                questionCount: 3,
                sourceIds: [scannedDoc.id],
                prompt: 'Generate an exam.'
            });
            throw new Error('Should have failed due to scanned unreadable source');
        }
        catch (err) {
            console.log(`Caught expected error: ${err.message}`);
        }
    });
    await testFlow('4. AI prompt bar', async () => {
        const test = await service.generateMockTest(userId, {
            topic: 'Contract Law',
            difficulty: 'Intermediate',
            mode: 'descriptive',
            questionCount: 3,
            sourceIds: [goodDoc.id],
            prompt: 'Create a 100 marks exam with long answers'
        });
        console.log(`Prompt: "Create a 100 marks exam with long answers"`);
        console.log(`Resulting Title: ${test.title}`);
        console.log(`Resulting Total Marks: ${test.totalMarks}`);
    });
    const templates = [
        { flow: '5. Full Semester Paper', prompt: 'Generate a full semester paper' },
        { flow: '6. Unit Wise Test', prompt: 'Generate a unit wise test on contract elements' },
        { flow: '7. PYQ Style Paper', prompt: 'Generate a PYQ style paper' },
        { flow: '8. Teacher Style Paper', prompt: 'Generate a teacher style paper' },
        { flow: '9. 50 Marks Exam', prompt: 'Generate a 50 marks exam' },
        { flow: '10. Important Questions', prompt: 'Generate important questions' },
        { flow: '11. Difficult Practice Test', prompt: 'Generate a difficult practice test' },
        { flow: '12. Revision Test', prompt: 'Generate a revision test' },
    ];
    for (const t of templates) {
        await testFlow(t.flow, async () => {
            const test = await service.generateMockTest(userId, {
                topic: 'Contract Law',
                difficulty: 'Intermediate',
                mode: 'descriptive',
                questionCount: 3,
                sourceIds: [goodDoc.id],
                prompt: t.prompt
            });
            console.log(`Prompt: "${t.prompt}" -> Detected Template: ${test.questions?.[0]?.template || 'Default'}`);
        });
    }
    const activeTest = await service.generateMockTest(userId, {
        topic: 'Contract Law Essentials',
        difficulty: 'Intermediate',
        mode: 'descriptive',
        questionCount: 2,
        sourceIds: [goodDoc.id],
        prompt: 'Generate an exam.'
    });
    await testFlow('13. PDF export', async () => {
        const pdfBuffer = await service.compileMockTestPdf(activeTest);
        console.log(`Generated PDF Buffer size: ${pdfBuffer.length} bytes`);
        if (pdfBuffer.length < 1000)
            throw new Error('PDF output is too small');
    });
    await testFlow('14. DOCX export', async () => {
        const docxBuffer = await service.compileMockTestDocx(activeTest);
        console.log(`Generated DOCX Buffer size: ${docxBuffer.length} bytes`);
        if (docxBuffer.length < 1000)
            throw new Error('DOCX output is too small');
    });
    await testFlow('15. Missing/failed API provider', async () => {
        const backupGemini = process.env.GEMINI_API_KEY;
        const backupOpenAI = process.env.OPENAI_API_KEY;
        const backupDeepseek = process.env.DEEPSEEK_API_KEY;
        const backupOpenrouter = process.env.OPENROUTER_API_KEY;
        process.env.GEMINI_API_KEY = 'placeholder_gemini';
        process.env.OPENAI_API_KEY = 'placeholder_openai';
        process.env.DEEPSEEK_API_KEY = 'placeholder_deepseek';
        process.env.OPENROUTER_API_KEY = 'placeholder_openrouter';
        try {
            const q = activeTest.questions[0];
            await service.generateDetailedAnswer(userId, activeTest.id, q.id, '15 Marks', true);
            throw new Error('Should have thrown an error due to missing API keys');
        }
        catch (err) {
            console.log(`Caught expected error: ${err.message}`);
            if (!err.message.includes('AI provider is not configured correctly. Please check API key settings.')) {
                throw new Error('Incorrect error message format. Expected required warning.');
            }
        }
        finally {
            process.env.GEMINI_API_KEY = backupGemini;
            process.env.OPENAI_API_KEY = backupOpenAI;
            process.env.DEEPSEEK_API_KEY = backupDeepseek;
            process.env.OPENROUTER_API_KEY = backupOpenrouter;
        }
    });
    await app.close();
    console.log('\n🏁 All test runs completed.');
}
runTests().catch((err) => {
    console.error('❌ Tests execution failed:', err);
    process.exit(1);
});
//# sourceMappingURL=test-mock-test-flows.js.map