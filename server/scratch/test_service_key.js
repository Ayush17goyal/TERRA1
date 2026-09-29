const axios = require('axios');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:/Users/goyal/OneDrive/Desktop/LEGATRIXON-3/server/.env' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing with URL:', url);
console.log('Key prefix:', key ? key.substring(0, 20) : 'none');

async function testServiceKey() {
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  };

  try {
    const res = await axios.get(`${url}/rest/v1/users?limit=1`, { headers });
    console.log('Success! Users returned:', res.data);
  } catch (error) {
    console.error('Error with service key:', error.response ? error.response.data : error.message);
  }
}

testServiceKey();
