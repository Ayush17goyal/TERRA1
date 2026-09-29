"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const lexmentor_ai_service_1 = require("../src/modules/chat/lexmentor-ai.service");
const bge_m3_provider_1 = require("../src/modules/retrieval/bge-m3.provider");
async function runVerification() {
    console.log('⚡ Bootstrapping NestJS Context for LexMentor Registry Verification...');
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, {
        logger: ['error', 'warn'],
    });
    const lexMentor = app.get(lexmentor_ai_service_1.LexMentorAiService);
    const bgeProvider = app.get(bge_m3_provider_1.BgeM3Provider);
    console.log('⏳ Awaiting BGE-M3 sidecar initialization and health check...');
    try {
        await bgeProvider.checkHealth();
        console.log(`✅ BGE-M3 provider availability verified: ${bgeProvider.isAvailable()}`);
    }
    catch (err) {
        console.warn(`⚠️ BGE-M3 health check failed: ${err.message}. Retrying in 1.5 seconds...`);
        await new Promise(r => setTimeout(r, 1500));
        try {
            await bgeProvider.checkHealth();
            console.log(`✅ BGE-M3 provider availability verified on retry: ${bgeProvider.isAvailable()}`);
        }
        catch (err2) {
            console.error(`❌ BGE-M3 still unavailable: ${err2.message}`);
        }
    }
    const testQueries = [
        { key: 'Article 21', query: 'Article 21 Right to Life and Personal Liberty' },
        { key: 'Section 103 BNS', query: 'Section 103 BNS Punishment for Murder' },
        { key: 'BNSS procedural queries', query: 'BNSS arrest procedure and magistrate production' }
    ];
    console.log('\n========================================================================');
    console.log('                 LEXMENTOR REGISTRY RETRIEVAL VERIFICATION              ');
    console.log('========================================================================');
    const auditReport = [];
    for (const item of testQueries) {
        console.log(`\n🔍 Querying: "${item.query}"...`);
        try {
            const retrieval = await lexMentor.retrieveLegalContext(item.query);
            console.log(`   Citations found: ${retrieval.citations?.length || 0}`);
            if (retrieval.citations && retrieval.citations.length > 0) {
                retrieval.citations.forEach((citation, idx) => {
                    console.log(`    [${idx + 1}] Collection: ${citation.collection} | Score: ${citation.score?.toFixed(4)}`);
                    console.log(`        Source: ${citation.source}`);
                    console.log(`        Excerpt: ${JSON.stringify(citation.excerpt.substring(0, 120))}...`);
                });
                auditReport.push({
                    queryKey: item.key,
                    queryText: item.query,
                    citationsCount: retrieval.citations.length,
                    matchedCollections: Array.from(new Set(retrieval.citations.map((c) => c.collection))),
                    topCitations: retrieval.citations.map((c) => ({
                        collection: c.collection,
                        score: c.score,
                        source: c.source,
                        excerpt: c.excerpt
                    }))
                });
            }
            else {
                console.log('    ⚠️ No citations found.');
                auditReport.push({
                    queryKey: item.key,
                    queryText: item.query,
                    citationsCount: 0,
                    matchedCollections: [],
                    topCitations: []
                });
            }
        }
        catch (err) {
            console.error(`  ❌ Failed to query LexMentor context: ${err.message}`);
        }
    }
    const outputPath = path.join(__dirname, 'lexmentor-registry-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(auditReport, null, 2));
    console.log(`\nWritten verification results to: ${outputPath}`);
    await app.close();
    console.log('Done.');
}
runVerification().catch(console.error);
//# sourceMappingURL=verify-lexmentor-retrieval.js.map