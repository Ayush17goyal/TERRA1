"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../app.module");
const lexmentor_ai_service_1 = require("../modules/chat/lexmentor-ai.service");
async function runValidation() {
    console.log('⚡ Bootstrapping NestJS validation environment...');
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, {
        logger: ['error', 'warn'],
    });
    const service = app.get(lexmentor_ai_service_1.LexMentorAiService);
    const terms = [
        'Petitioner',
        'Respondent',
        'Mens Rea',
        'Article 21',
        'Judicial Review',
        'Basic Structure Doctrine',
    ];
    console.log('\n========================================================================');
    console.log('                   LEXMENTOR AI OPENROUTER VALIDATION                   ');
    console.log('========================================================================\n');
    const results = [];
    for (const term of terms) {
        console.log(`Running validation for term: "${term}"...`);
        const started = Date.now();
        try {
            const response = await service.generateResponse({
                query: `Explain the concept of ${term}`,
                depth: 'Intermediate',
            });
            const latency = Date.now() - started;
            results.push({
                term,
                provider: response.provider || 'N/A',
                model: response.model || 'N/A',
                latency,
                status: 'Pass',
                error: '',
            });
            console.log(`✅ Passed. Provider: ${response.provider}, Model: ${response.model}, Latency: ${latency}ms`);
        }
        catch (error) {
            const latency = Date.now() - started;
            results.push({
                term,
                provider: 'N/A',
                model: 'N/A',
                latency,
                status: 'Fail',
                error: error.message || String(error),
            });
            console.error(`❌ Failed. Latency: ${latency}ms, Reason: ${error.message || error}`);
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
    console.log('\n========================================================================');
    console.log('                           VALIDATION REPORT                            ');
    console.log('========================================================================');
    console.table(results.map((r) => ({
        Term: r.term,
        Provider: r.provider,
        Model: r.model,
        'Latency (ms)': r.latency,
        Status: r.status,
        Error: r.error || '-',
    })));
    console.log('========================================================================\n');
    await app.close();
}
runValidation().catch((err) => {
    console.error('❌ Validation crashed:', err);
    process.exit(1);
});
//# sourceMappingURL=validate-lexmentor.js.map