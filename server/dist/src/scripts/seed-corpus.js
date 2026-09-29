"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../app.module");
const ingestion_service_1 = require("../modules/ingestion/ingestion.service");
const path = require("path");
async function runSeeding() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const ingestion = app.get(ingestion_service_1.IngestionService);
    const corpusConfig = [
        { type: 'constitution', dirName: 'Constitution', metadata: { title: 'Constitution of India', documentType: 'constitution' } },
        { type: 'bns', dirName: 'bns', metadata: { title: 'Bharatiya Nyaya Sanhita', documentType: 'bns' } },
        { type: 'bnss', dirName: 'bnss', metadata: { title: 'Bharatiya Nagarik Suraksha Sanhita', documentType: 'bnss' } },
        { type: 'bare_acts', dirName: 'bsa', metadata: { act_name: 'Bharatiya Sakshya Adhiniyam', documentType: 'bare_acts' } },
        { type: 'supreme_court_cases', dirName: 'supreme-court', metadata: { court: 'Supreme Court of India', documentType: 'supreme_court_cases' } },
        { type: 'high_court_cases', dirName: 'high-court', metadata: { documentType: 'high_court_cases' } },
        { type: 'research_papers', dirName: 'research-papers', metadata: { documentType: 'research_papers' } },
        { type: 'research_papers', dirName: 'law-commission', metadata: { source: 'Law Commission of India', documentType: 'research_papers' } }
    ];
    console.log('🏁 Initializing Qdrant Collections...');
    await ingestion.initializeCollections();
    for (const config of corpusConfig) {
        const fullDirPath = path.join(__dirname, '../../corpus-data', config.dirName);
        console.log(`\n📦 Seeding: [${config.type}] from directory: ${fullDirPath}`);
        try {
            const res = await ingestion.ingestDirectory(config.type, fullDirPath, config.metadata, {
                chunkSize: 1200,
                chunkOverlap: 250
            });
            console.log(`✅ Completed: ${res.successful} docs successfully processed, ${res.failed} failures.`);
        }
        catch (err) {
            console.error(`❌ Failed seeding directory: ${config.dirName}. Error: ${err.message}`);
        }
    }
    console.log('\n🎉 Legal Corpus Seeding Complete!');
    await app.close();
}
runSeeding().catch(err => {
    console.error('Fatal error during seeding:', err);
    process.exit(1);
});
//# sourceMappingURL=seed-corpus.js.map