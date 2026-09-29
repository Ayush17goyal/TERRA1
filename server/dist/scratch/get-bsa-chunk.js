"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const js_client_rest_1 = require("@qdrant/js-client-rest");
async function getBsaChunk() {
    const url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;
    if (!url) {
        console.error('QDRANT_URL is not set');
        process.exit(1);
    }
    const client = new js_client_rest_1.QdrantClient({ url, apiKey });
    try {
        const scrollRes = await client.scroll('bare_acts', {
            limit: 10,
            with_payload: true,
            with_vector: false
        });
        console.log('Scroll Result Points Count:', scrollRes.points.length);
        if (scrollRes.points.length > 0) {
            console.log('Point 1 Payload:');
            console.log(JSON.stringify(scrollRes.points[0].payload, null, 2));
        }
        else {
            console.log('No points found in bare_acts collection!');
        }
    }
    catch (error) {
        console.error('Failed scrolling bare_acts:', error);
    }
}
getBsaChunk().catch(console.error);
//# sourceMappingURL=get-bsa-chunk.js.map