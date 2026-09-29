"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const js_client_rest_1 = require("@qdrant/js-client-rest");
async function checkNewActs() {
    const url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;
    if (!url) {
        console.error('QDRANT_URL is not set');
        process.exit(1);
    }
    const client = new js_client_rest_1.QdrantClient({ url, apiKey });
    try {
        for (const col of ['bns_bge', 'bnss_bge']) {
            const scrollRes = await client.scroll(col, {
                limit: 5,
                with_payload: true,
                with_vector: false
            });
            console.log(`\n=== Collection: ${col} (Points: ${scrollRes.points.length}) ===`);
            scrollRes.points.forEach((p, idx) => {
                console.log(`Point ${idx + 1}:`);
                console.log(`  File: ${p.payload?.fileName || p.payload?.name}`);
                console.log(`  Text preview: ${JSON.stringify(p.payload?.text?.substring(0, 200))}...`);
            });
        }
    }
    catch (error) {
        console.error('Failed checking new acts collections:', error);
    }
}
checkNewActs().catch(console.error);
//# sourceMappingURL=get-new-acts-chunks.js.map