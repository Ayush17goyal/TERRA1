const axios = require('axios');

const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: 'c:/Users/goyal/OneDrive/Desktop/LEGATRIXON-3/server/.env' });

const url = 'https://knwotyuwjkkuvfwuzseq.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkRpc() {
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  };

  try {
    const res = await axios.get(`${url}/rest/v1/users?limit=1`, { headers });
    console.log('Success with keyRef URL! Users:', res.data);
  } catch (error) {
    console.error('Error fetching with keyRef URL:', error.response ? error.response.data : error.message);
  }
}

checkRpc();
