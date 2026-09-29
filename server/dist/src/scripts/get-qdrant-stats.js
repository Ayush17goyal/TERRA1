"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const js_client_rest_1 = require("@qdrant/js-client-rest");
const dotenv = require("dotenv");
const path = require("path");
const axios_1 = require("axios");
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
async function main() {
    const url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;
    if (!url) {
        console.error('QDRANT_URL is not set in env.');
        process.exit(1);
    }
    console.log(`Connecting to Qdrant at ${url}...`);
    const client = new js_client_rest_1.QdrantClient({ url, apiKey });
    try {
        let storageSize = 'Unknown';
        try {
            const telRes = await axios_1.default.get(`${url}/telemetry`, {
                headers: { 'api-key': apiKey },
                timeout: 5000
            });
            if (telRes.data && telRes.data.result) {
                const sys = telRes.data.result.system || {};
                storageSize = sys.disk_usage || 'Dynamic (Cloud)';
            }
        }
        catch (e) {
            storageSize = 'Managed Cloud (Standard Tier)';
        }
        const collectionsRes = await client.getCollections();
        console.log(`TOTAL_COLLECTIONS: ${collectionsRes.collections.length}`);
        console.log(`STORAGE_SIZE: ${storageSize}`);
        console.log('---');
        for (const col of collectionsRes.collections) {
            const name = col.name;
            const info = await client.getCollection(name);
            const scrollRes = await client.scroll(name, {
                limit: 1000,
                with_payload: true,
                with_vector: false
            });
            const uniqueDocs = new Set();
            let hasConstitution = false;
            let hasBNS = false;
            let hasBNSS = false;
            let hasBSA = false;
            let hasSupremeCourt = false;
            let hasHighCourt = false;
            if (scrollRes && scrollRes.points) {
                for (const point of scrollRes.points) {
                    const payload = (point.payload || {});
                    const docId = payload.source_id || payload.documentId || payload.name || payload.title || 'unknown';
                    uniqueDocs.add(String(docId));
                    const docType = String(payload.document_type || payload.doc_category || '').toLowerCase();
                    const actName = String(payload.act_name || payload.title || payload.name || '').toLowerCase();
                    const court = String(payload.court || payload.court_name || '').toLowerCase();
                    const text = String(payload.text || payload.content || '').toLowerCase();
                    if (docType === 'constitution' || actName.includes('constitution') || text.includes('constitution of india')) {
                        hasConstitution = true;
                    }
                    if (docType === 'bns' || actName.includes('bharatiya nyaya') || actName.includes('bns') || text.includes('bharatiya nyaya sanhita')) {
                        hasBNS = true;
                    }
                    if (docType === 'bnss' || actName.includes('nagarik suraksha') || actName.includes('bnss') || text.includes('bharatiya nagarik suraksha')) {
                        hasBNSS = true;
                    }
                    if (docType === 'bsa' || actName.includes('sakshya') || actName.includes('bsa') || text.includes('bharatiya sakshya')) {
                        hasBSA = true;
                    }
                    if (court.includes('supreme') || text.includes('supreme court')) {
                        hasSupremeCourt = true;
                    }
                    if (court.includes('high court') || text.includes('high court')) {
                        hasHighCourt = true;
                    }
                }
            }
            console.log(`COLLECTION: ${name}`);
            console.log(`  VECTORS: ${info.vectors_count || 0}`);
            console.log(`  POINTS: ${info.points_count || 0}`);
            console.log(`  DOCUMENTS: ${uniqueDocs.size}`);
            console.log(`  CONSTITUTION: ${hasConstitution ? 'Yes' : 'No'}`);
            console.log(`  BNS: ${hasBNS ? 'Yes' : 'No'}`);
            console.log(`  BNSS: ${hasBNSS ? 'Yes' : 'No'}`);
            console.log(`  BSA: ${hasBSA ? 'Yes' : 'No'}`);
            console.log(`  SUPREME_COURT: ${hasSupremeCourt ? 'Yes' : 'No'}`);
            console.log(`  HIGH_COURT: ${hasHighCourt ? 'Yes' : 'No'}`);
            console.log('---');
        }
    }
    catch (error) {
        console.error(`Error: ${error.message}`);
    }
}
main().catch(err => console.error(err));
//# sourceMappingURL=get-qdrant-stats.js.map