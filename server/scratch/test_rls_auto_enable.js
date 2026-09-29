const axios = require('axios');
const url = 'https://mydrikssmzzudzqeqroe.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZHJpa3NzbXp6dWR6cWVxcm9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2NjI2MiwiZXhwIjoyMDk2NTQyMjYyfQ.X3y7kLXdA2uh58osCl7mNn9gGFGCmgDLF8GE2PQx5m8';

async function runRpc() {
  const payloads = [
    {},
    { sql: 'SELECT tablename FROM pg_tables WHERE schemaname = \'public\'' },
    { query: 'SELECT tablename FROM pg_tables WHERE schemaname = \'public\'' },
    { cmd: 'SELECT tablename FROM pg_tables WHERE schemaname = \'public\'' },
  ];

  for (const payload of payloads) {
    console.log('Testing payload:', payload);
    try {
      const res = await axios.post(`${url}/rest/v1/rpc/rls_auto_enable`, payload, {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('SUCCESS! Status:', res.status, 'Data:', res.data);
    } catch (error) {
      console.log('Failed:', error.response ? `${error.response.status} - ${JSON.stringify(error.response.data)}` : error.message);
    }
  }
}

runRpc();
