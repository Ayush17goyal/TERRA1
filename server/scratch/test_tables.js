const axios = require('axios');

const url = 'https://mydrikssmzzudzqeqroe.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZHJpa3NzbXp6dWR6cWVxcm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjYyNjIsImV4cCI6MjA5NjU0MjI2Mn0.Nvqw1uuNa95yunYiBqXLUoJ7tRFkjjUrWoCXeV_8XIc';

async function testInsertUser() {
  const headers = {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const testUser = {
    id: 'b0000000-0000-0000-0000-000000000000',
    email: 'anon_test_' + Date.now() + '@legatrixon.com',
    full_name: 'Anon Test User',
    avatar_url: 'https://example.com/avatar.jpg'
  };

  try {
    const res = await axios.post(`${url}/rest/v1/users`, testUser, { headers });
    console.log('Success! User inserted:', res.data);
    
    // Clean up
    console.log('Cleaning up user...');
    const delRes = await axios.delete(`${url}/rest/v1/users?id=eq.${testUser.id}`, { headers });
    console.log('Clean up status:', delRes.status);
  } catch (error) {
    console.error('Error inserting user:', error.response ? error.response.data : error.message);
  }
}

testInsertUser();
