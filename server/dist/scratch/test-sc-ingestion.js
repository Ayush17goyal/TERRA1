"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const legal_chunker_1 = require("../src/modules/ingestion/legal-chunker");
async function runAudit() {
    const dirPath = path.resolve(__dirname, '../corpus-data/supreme-court');
    console.log(`Auditing Supreme Court PDFs in: ${dirPath}`);
    if (!fs.existsSync(dirPath)) {
        console.error(`Error: Directory does not exist: ${dirPath}`);
        process.exit(1);
    }
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.pdf'));
    console.log(`Found ${files.length} PDF files.`);
    const pdfParse = require('pdf-parse');
    const report = [];
    for (let i = 0; i < files.length; i++) {
        const filename = files[i];
        const filepath = path.join(dirPath, filename);
        const sizeBytes = fs.statSync(filepath).size;
        const started = Date.now();
        console.log(`[${i + 1}/${files.length}] Processing: ${filename} (${(sizeBytes / 1024).toFixed(2)} KB)...`);
        try {
            const buffer = fs.readFileSync(filepath);
            const data = await pdfParse(buffer);
            const text = data.text;
            const parseDuration = Date.now() - started;
            if (!text || text.trim().length === 0) {
                throw new Error('PDF parsed to empty text');
            }
            const chunkStarted = Date.now();
            const chunks = (0, legal_chunker_1.chunkJudgment)(text, { chunkSize: 1200, chunkOverlap: 250 });
            const chunkDuration = Date.now() - chunkStarted;
            report.push({
                filename,
                sizeKB: (sizeBytes / 1024).toFixed(2),
                status: 'Pass',
                pages: data.numpages,
                chars: text.length,
                chunks: chunks.length,
                parseTimeMs: parseDuration,
                chunkTimeMs: chunkDuration,
                error: '-'
            });
            console.log(`  ✅ Success: ${data.numpages} pages, ${text.length} chars, ${chunks.length} chunks generated`);
        }
        catch (error) {
            console.error(`  ❌ Failed: ${error.message}`);
            report.push({
                filename,
                sizeKB: (sizeBytes / 1024).toFixed(2),
                status: 'Fail',
                pages: 0,
                chars: 0,
                chunks: 0,
                parseTimeMs: 0,
                chunkTimeMs: 0,
                error: error.message || String(error)
            });
        }
    }
    console.log('\n========================================================================');
    console.log('                        INGESTION AUDIT REPORT                          ');
    console.log('========================================================================');
    console.table(report.map(r => ({
        File: r.filename,
        'Size (KB)': r.sizeKB,
        Pages: r.pages,
        Chunks: r.chunks,
        Status: r.status,
        Error: r.error
    })));
    fs.writeFileSync(path.join(__dirname, 'audit-results.json'), JSON.stringify(report, null, 2));
    console.log(`\nWritten raw results to: ${path.join(__dirname, 'audit-results.json')}`);
}
runAudit().catch(err => console.error('Audit script failed:', err));
//# sourceMappingURL=test-sc-ingestion.js.map