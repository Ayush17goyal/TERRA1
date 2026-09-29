"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const ingestion_service_1 = require("../src/modules/ingestion/ingestion.service");
async function testSingleIngest() {
    console.log('⚡ Bootstrapping NestJS...');
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, {
        logger: ['error', 'warn'],
    });
    const ingestionService = app.get(ingestion_service_1.IngestionService);
    const filePath = path.resolve(__dirname, '../corpus-data/supreme-court/1436778398816-Rai Sahib Ram Jawaya Kapur v. The State of Punjab.pdf');
    console.log(`\n📄 Testing ingestion of: ${filePath}`);
    try {
        const result = await ingestionService.ingestDocument('supreme_court_cases', filePath, { court: 'Supreme Court of India', documentType: 'supreme_court_cases' }, { chunkSize: 1200, chunkOverlap: 250 });
        console.log('\n=========================================');
        console.log('Ingestion Result:');
        console.log(JSON.stringify(result, null, 2));
        console.log('=========================================');
    }
    catch (error) {
        console.error('❌ Ingestion failed:', error);
    }
    await app.close();
}
testSingleIngest().catch(console.error);
//# sourceMappingURL=test-sc-ingest-single.js.map