"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestionCliModule = void 0;
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
let IngestionCliModule = class IngestionCliModule {
};
exports.IngestionCliModule = IngestionCliModule;
exports.IngestionCliModule = IngestionCliModule = __decorate([
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
], IngestionCliModule);
async function runIngestion() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  LEGATRIXON — Production Legal Corpus Ingestion');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  SQLite database : ${sqliteDatabasePath}`);
    console.log(`  Qdrant URL      : ${process.env.QDRANT_URL || 'http://localhost:6333'}`);
    console.log(`  Qdrant collection: legal_corpus`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    const app = await core_1.NestFactory.createApplicationContext(IngestionCliModule, {
        logger: ['error', 'warn', 'log'],
    });
    const scanner = app.get(corpus_scanner_service_1.CorpusScannerService);
    try {
        const corpusDir = process.env.CORPUS_DIR
            ? path.resolve(process.env.CORPUS_DIR)
            : path.resolve(__dirname, '../../../corpus-data');
        console.log(`  Corpus directory : ${corpusDir}\n`);
        const report = await scanner.scanCorpus(corpusDir);
        if (report.errors > 0) {
            process.exitCode = 1;
        }
    }
    catch (err) {
        console.error('❌ Ingestion run failed with unhandled error:', err.message);
        process.exitCode = 1;
    }
    finally {
        await app.close();
    }
}
runIngestion();
//# sourceMappingURL=run-ingestion.js.map