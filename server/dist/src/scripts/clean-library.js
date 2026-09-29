"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
const core_1 = require("@nestjs/core");
const notebook_service_1 = require("../modules/notebook/notebook.service");
const app_module_1 = require("../app.module");
async function run() {
    console.log('⚡ Bootstrapping NestJS CLI...');
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log'],
    });
    const service = app.get(notebook_service_1.NotebookService);
    const targetUserId = 'user_3EwmjaCl5UfguZTH3M8KPZg5AAE';
    console.log(`\n--- Fetching all documents for user: ${targetUserId} ---`);
    const docs = await service.listAll(targetUserId);
    console.log(`Found ${docs.length} documents.`);
    for (const doc of docs) {
        console.log(`Deleting doc: "${doc.name}" (ID: ${doc.id})`);
        const success = await service.delete(doc.id, targetUserId);
        console.log(`Deletion status: ${success ? 'SUCCESS' : 'FAILED'}`);
    }
    console.log('\n--- Cleanup Completed! ---');
    await app.close();
}
run().catch(err => {
    console.error('❌ Cleanup failed with error:', err);
    process.exit(1);
});
//# sourceMappingURL=clean-library.js.map