const axios = require('axios');
const url = 'https://mydrikssmzzudzqeqroe.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZHJpa3NzbXp6dWR6cWVxcm9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2NjI2MiwiZXhwIjoyMDk2NTQyMjYyfQ.X3y7kLXdA2uh58osCl7mNn9gGFGCmgDLF8GE2PQx5m8';

async function listTables() {
  try {
    const res = await axios.get(`${url}/rest/v1/`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    console.log('Tables/Paths in Supabase schema:');
    const definitions = res.data.definitions;
    if (definitions) {
      Object.keys(definitions).forEach(table => {
        console.log(`- ${table}`);
      });
    } else {
      console.log('No definitions found, keys:', Object.keys(res.data));
    }
  } catch (error) {
    console.error('Error fetching schema:', error.response ? { status: error.response.status, data: error.response.data } : error.message);
  }
}

listTables();
