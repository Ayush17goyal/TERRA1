"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const bge_m3_provider_1 = require("../src/modules/retrieval/bge-m3.provider");
const qdrant_service_1 = require("../src/modules/retrieval/qdrant.service");
async function runValidationAudit() {
    console.log('⚡ Bootstrapping NestJS...');
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, {
        logger: ['error', 'warn'],
    });
    const bgeM3Provider = app.get(bge_m3_provider_1.BgeM3Provider);
    const qdrantService = app.get(qdrant_service_1.QdrantService);
    const client = qdrantService.getClient();
    const queries = [
        'Article 14',
        'Article 19',
        'Article 21',
        'Basic Structure Doctrine',
        'Kesavananda Bharati',
        'Maneka Gandhi',
        'Section 103 BNS',
        'Section 303 BNS'
    ];
    const lexMentorCollections = [
        { name: 'constitution', label: 'Constitution' },
        { name: 'bare_acts', label: 'Bare Acts' },
        { name: 'supreme_court_cases', label: 'Supreme Court Cases' },
        { name: 'high_court_cases', label: 'High Court Cases' },
        { name: 'research_papers', label: 'Research Papers' },
        { name: 'user_documents', label: 'User Documents' },
        { name: 'acts', label: 'Bare Acts (Legacy)' },
        { name: 'judgments', label: 'Judgments (Legacy)' }
    ];
    const additionalCollections = [
        { name: 'bns_bge', label: 'BNS (BGE)' },
        { name: 'bnss_bge', label: 'BNSS (BGE)' },
        { name: 'acts_bge', label: 'Acts (BGE)' },
        { name: 'judgments_bge', label: 'Judgments (BGE)' }
    ];
    const allSearchableCollections = [...lexMentorCollections, ...additionalCollections];
    console.log('\n========================================================================');
    console.log('                      RETRIEVAL VALIDATION AUDIT                        ');
    console.log('========================================================================');
    const auditReport = [];
    for (const query of queries) {
        console.log(`\n🔍 Querying: "${query}"...`);
        let vector;
        try {
            vector = await bgeM3Provider.generateEmbedding(query);
        }
        catch (err) {
            console.error(`  ❌ Failed to generate embedding: ${err.message}`);
            continue;
        }
        const hitsFound = [];
        await Promise.all(allSearchableCollections.map(async (col) => {
            try {
                const hits = await client.search(col.name, {
                    vector,
                    limit: 3,
                    with_payload: true
                });
                hits.forEach(hit => {
                    hitsFound.push({
                        collection: col.name,
                        label: col.label,
                        score: Number(hit.score || 0),
                        payload: hit.payload || {},
                        id: hit.id
                    });
                });
            }
            catch (err) {
            }
        }));
        hitsFound.sort((a, b) => b.score - a.score);
        const topHits = hitsFound.slice(0, 3);
        console.log(`  Top matches found: ${topHits.length}`);
        topHits.forEach((hit, idx) => {
            const text = hit.payload.text || hit.payload.content || '';
            const source = hit.payload.title || hit.payload.fileName || hit.payload.source || 'Unknown Source';
            console.log(`    [${idx + 1}] Collection: ${hit.collection} | Score: ${hit.score.toFixed(4)}`);
            console.log(`        Source: ${source}`);
            console.log(`        Snippet: ${JSON.stringify(text.substring(0, 150))}...`);
        });
        auditReport.push({
            query,
            collectionsSearched: allSearchableCollections.map(c => c.name).join(', '),
            topHits: topHits.map(h => ({
                collection: h.collection,
                score: h.score,
                source: h.payload.title || h.payload.fileName || h.payload.source || 'Unknown',
                excerpt: h.payload.text || h.payload.content || ''
            }))
        });
    }
    fs.writeFileSync(path.join(__dirname, 'retrieval-validation-results.json'), JSON.stringify(auditReport, null, 2));
    console.log(`\nWritten validation results to: ${path.join(__dirname, 'retrieval-validation-results.json')}`);
    await app.close();
}
runValidationAudit().catch(console.error);
//# sourceMappingURL=run-retrieval-validation.js.map