"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const legal_chunker_1 = require("../src/modules/ingestion/legal-chunker");
async function auditBsa() {
    const filepath = path.resolve(__dirname, '../corpus-data/bsa/Bharatiya Sakshya Adhiniyam, 2023.pdf');
    console.log('Reading file:', filepath);
    if (!fs.existsSync(filepath)) {
        console.error(`Error: File does not exist at ${filepath}`);
        process.exit(1);
    }
    const sizeBytes = fs.statSync(filepath).size;
    console.log(`File size: ${(sizeBytes / (1024 * 1024)).toFixed(2)} MB (${sizeBytes} bytes)`);
    const pdfParse = require('pdf-parse');
    const started = Date.now();
    console.log('Starting PDF extraction...');
    try {
        const buffer = fs.readFileSync(filepath);
        const data = await pdfParse(buffer);
        const parseDuration = Date.now() - started;
        console.log(`✅ Extraction Completed in ${parseDuration}ms`);
        console.log(`Pages: ${data.numpages}`);
        console.log(`Raw Text Length: ${data.text ? data.text.length : 0} characters`);
        const preview = data.text ? data.text.trim().substring(0, 1000) : '';
        console.log('\n--- Text Preview (First 1000 Chars) ---');
        console.log(preview);
        console.log('---------------------------------------\n');
        if (!data.text || data.text.trim().length === 0) {
            console.warn('⚠️ Warning: Extracted text is empty!');
            return;
        }
        const chunkStarted = Date.now();
        const chunks = (0, legal_chunker_1.chunkBareAct)(data.text, 'Bharatiya Sakshya Adhiniyam', { chunkSize: 1200, chunkOverlap: 250 });
        const chunkDuration = Date.now() - chunkStarted;
        console.log(`\n✅ Chunking Completed in ${chunkDuration}ms`);
        console.log(`Total Chunks: ${chunks.length}`);
        let maxChunkLen = 0;
        let minChunkLen = Infinity;
        let totalLen = 0;
        chunks.forEach(c => {
            const len = c.text.length;
            if (len > maxChunkLen)
                maxChunkLen = len;
            if (len < minChunkLen)
                minChunkLen = len;
            totalLen += len;
        });
        console.log(`Average Chunk Size: ${(totalLen / chunks.length).toFixed(2)} chars`);
        console.log(`Maximum Chunk Size: ${maxChunkLen} chars`);
        console.log(`Minimum Chunk Size: ${minChunkLen} chars`);
        console.log('\n--- First 5 Chunks ---');
        chunks.slice(0, 5).forEach((c, idx) => {
            console.log(`[Chunk ${idx}] Section ID: ${c.section}, Length: ${c.text.length} chars`);
            console.log(`Content: ${JSON.stringify(c.text.substring(0, 300))}...\n`);
        });
    }
    catch (error) {
        console.error('❌ Failed parsing BSA:', error);
    }
}
auditBsa().catch(err => console.error(err));
//# sourceMappingURL=test-bsa-ingestion.js.map