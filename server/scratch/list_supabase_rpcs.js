const axios = require('axios');
const url = 'https://mydrikssmzzudzqeqroe.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZHJpa3NzbXp6dWR6cWVxcm9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2NjI2MiwiZXhwIjoyMDk2NTQyMjYyfQ.X3y7kLXdA2uh58osCl7mNn9gGFGCmgDLF8GE2PQx5m8';

async function listRpcs() {
  try {
    const res = await axios.get(`${url}/rest/v1/`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    console.log('RPC paths in Supabase:');
    const paths = res.data.paths;
    if (paths) {
      Object.keys(paths).forEach(p => {
        if (p.includes('/rpc/')) {
          console.log(`- ${p}`);
        }
      });
    } else {
      console.log('No paths found.');
    }
  } catch (error) {
    console.error('Error fetching schema:', error.message);
  }
}

listRpcs();
