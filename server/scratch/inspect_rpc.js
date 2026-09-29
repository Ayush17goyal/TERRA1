const axios = require('axios');
const url = 'https://mydrikssmzzudzqeqroe.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZHJpa3NzbXp6dWR6cWVxcm9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2NjI2MiwiZXhwIjoyMDk2NTQyMjYyfQ.X3y7kLXdA2uh58osCl7mNn9gGFGCmgDLF8GE2PQx5m8';

async function inspectRpc() {
  try {
    const res = await axios.get(`${url}/rest/v1/`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });
    const paths = res.data.paths;
    if (paths && paths['/rpc/rls_auto_enable']) {
      console.log('Definition of /rpc/rls_auto_enable:');
      console.log(JSON.stringify(paths['/rpc/rls_auto_enable'], null, 2));
    } else {
      console.log('RPC /rpc/rls_auto_enable not found in paths.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

inspectRpc();
