const { QdrantClient } = require('@qdrant/js-client-rest');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const qdrantUrl = process.env.QDRANT_URL;
const qdrantApiKey = process.env.QDRANT_API_KEY;

if (!qdrantUrl) {
  console.error('QDRANT_URL is not set in .env');
  process.exit(1);
}

const client = new QdrantClient({
  url: qdrantUrl,
  apiKey: qdrantApiKey,
});

async function auditQdrant() {
  console.log(`Qdrant URL: ${qdrantUrl}\n`);
  
  const collections = ['acts_bge', 'bns_bge', 'bnss_bge', 'bare_acts', 'constitution'];

  for (const coll of collections) {
    try {
      const info = await client.getCollection(coll);
      console.log(`======================================================`);
      console.log(`📦 Collection: "${coll}"`);
      console.log(`======================================================`);
      console.log(`- Status: ${info.status}`);
      console.log(`- Total Vector Count: ${info.vectors_count}`);
      console.log(`- Total Point Count:  ${info.points_count}`);
      
      // Scroll to sample points and aggregate counts by act_name in JS
      let offset = null;
      const actCounts = {};
      let totalFetched = 0;
      const bnsPoints = [];
      
      // Let's scroll up to 2000 points to get a good sampling of acts
      while (totalFetched < 2000) {
        const scrollRes = await client.scroll(coll, {
          limit: 100,
          with_payload: true,
          offset: offset
        });
        
        if (!scrollRes.points || scrollRes.points.length === 0) {
          break;
        }
        
        scrollRes.points.forEach(p => {
          const payload = p.payload || {};
          const act = payload.act_name || payload.actName || payload.document_type || 'Unknown';
          actCounts[act] = (actCounts[act] || 0) + 1;
          
          const actStr = String(act).toLowerCase();
          if (actStr.includes('nyaya') || actStr.includes('bns')) {
            bnsPoints.push(p);
          }
        });
        
        totalFetched += scrollRes.points.length;
        offset = scrollRes.next_page_offset;
        
        if (!offset) {
          break;
        }
      }
      
      console.log(`- Sampled Acts distribution (first ${totalFetched} points):`);
      Object.keys(actCounts).forEach(act => {
        console.log(`   * ${act}: ${actCounts[act]} vectors`);
      });
      
      if (bnsPoints.length > 0) {
        console.log(`\n- BNS vectors found: YES (${bnsPoints.length} found in sample)`);
        console.log(`- Payload of one BNS vector:`);
        console.log(JSON.stringify(bnsPoints[0].payload, null, 2));
        
        // Check if Section 63 has an embedding in the sample
        const sec63Match = bnsPoints.find(p => p.payload.section === '63' || p.payload.section_number === '63');
        console.log(`- Section 63 has embedding in sample: ${sec63Match ? 'YES' : 'NO'}`);
        if (sec63Match) {
          console.log(`  * Section 63 Payload details:`, JSON.stringify(sec63Match.payload, null, 2));
        }
      } else {
        console.log(`\n- BNS vectors found in sample: NO`);
      }
      
      console.log('');
    } catch (err) {
      console.log(`Collection "${coll}" does not exist or failed to load: ${err.message}\n`);
    }
  }
}

auditQdrant().catch(console.error);
