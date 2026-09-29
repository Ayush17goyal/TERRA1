"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
const ingestion_module_1 = require("../modules/ingestion/ingestion.module");
const retrieval_module_1 = require("../modules/retrieval/retrieval.module");
const legal_intelligence_module_1 = require("../modules/legal-intelligence/legal-intelligence.module");
const settings_module_1 = require("../modules/settings/settings.module");
const chat_module_1 = require("../modules/chat/chat.module");
const legal_intelligence_service_1 = require("../modules/legal-intelligence/legal-intelligence.service");
const defaultSqlitePath = process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || '', 'LEGATRIXON', 'legatrixon_db.sqlite')
    : path.resolve(process.cwd(), 'legatrixon_db.sqlite');
const sqliteDatabasePath = process.env.SQLITE_DB_PATH || defaultSqlitePath;
let TestBareActAiModule = class TestBareActAiModule {
};
TestBareActAiModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRoot({
                type: 'sqlite',
                database: sqliteDatabasePath,
                autoLoadEntities: true,
                synchronize: true,
            }),
            settings_module_1.SettingsModule,
            ingestion_module_1.IngestionModule,
            retrieval_module_1.RetrievalModule,
            legal_intelligence_module_1.LegalIntelligenceModule,
            chat_module_1.ChatModule,
        ],
    })
], TestBareActAiModule);
async function testBareActAi() {
    console.log('⚡ Bootstrapping NestJS test context for Bare Act AI...');
    let app;
    try {
        app = await core_1.NestFactory.createApplicationContext(TestBareActAiModule, { logger: false });
        console.log('NestJS context initialized successfully.');
    }
    catch (err) {
        console.error('❌ Failed to bootstrap context:', err.message);
        process.exit(1);
    }
    const bareActAiService = app.get(legal_intelligence_service_1.LegalIntelligenceService);
    const testQueries = [
        { userInput: 'what is the explanation of Limitation Act Section 5?' },
        { userInput: 'Can you write a Python script to scrape a website?' },
        { userInput: 'What does Special Marriage Act Section 4 say?' }
    ];
    for (const q of testQueries) {
        console.log(`\n======================================================`);
        console.log(`🔍 USER INPUT: "${q.userInput}"`);
        console.log(`======================================================`);
        try {
            const response = await bareActAiService.professorChat('mock_user_123', q);
            console.log('📌 BARE ACT AI RESPONSE:\n');
            console.log(response.response);
            console.log('\n--- Metadata ---');
            console.log(`- Act Detected: ${response.act}`);
            console.log(`- Source:       ${response.source}`);
            console.log(`- Low Confidence (Missing Context): ${response.lowConfidence}`);
        }
        catch (err) {
            console.error(`❌ Error querying Bare Act AI:`, err);
        }
    }
    await app.close();
    process.exit(0);
}
testBareActAi();
//# sourceMappingURL=test-bare-act-ai.js.map