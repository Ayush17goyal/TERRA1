"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestCliModule = void 0;
const dotenv = require("dotenv");
const path = require("path");
dotenv.config();
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const ingestion_module_1 = require("../modules/ingestion/ingestion.module");
const corpus_scanner_service_1 = require("../modules/ingestion/corpus-scanner.service");
const settings_module_1 = require("../modules/settings/settings.module");
const defaultSqlitePath = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'LEGATRIXON', 'legatrixon_db.sqlite')
    : path.resolve(process.cwd(), 'legatrixon_db.sqlite');
const sqliteDatabasePath = process.env.SQLITE_DB_PATH || defaultSqlitePath;
let TestCliModule = class TestCliModule {
};
exports.TestCliModule = TestCliModule;
exports.TestCliModule = TestCliModule = __decorate([
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
        ],
    })
], TestCliModule);
async function runScan() {
    console.log('⚡ Bootstrapping NestJS test context...');
    const app = await core_1.NestFactory.createApplicationContext(TestCliModule, {
        logger: ['error', 'warn', 'log'],
    });
    const scanner = app.get(corpus_scanner_service_1.CorpusScannerService);
    console.log('\n--- Starting Legal PDF Ingestion Directory Scan ---');
    try {
        const report = await scanner.scanCorpus();
        console.log(`\n✅ Scan completed!`);
        console.log(`   Acts discovered: ${report.actsDiscovered}`);
        console.log(`   Acts parsed:     ${report.actsParsed}`);
        console.log(`   Acts skipped:    ${report.actsSkipped}`);
        console.log(`   Sections stored: ${report.sectionsStored}`);
        console.log(`   Embeddings:      ${report.embeddingsGenerated}`);
        console.log(`   Errors:          ${report.errors}`);
    }
    catch (err) {
        console.error('❌ Scan failed:', err);
    }
    finally {
        await app.close();
    }
}
runScan();
//# sourceMappingURL=test-corpus-scan.js.map