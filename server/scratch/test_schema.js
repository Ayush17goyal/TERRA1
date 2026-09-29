const axios = require('axios');

const url = 'https://mydrikssmzzudzqeqroe.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZHJpa3NzbXp6dWR6cWVxcm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjYyNjIsImV4cCI6MjA5NjU0MjI2Mn0.Nvqw1uuNa95yunYiBqXLUoJ7tRFkjjUrWoCXeV_8XIc';

async function testSchema() {
  const headers = {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json'
  };

  try {
    // Attempt to select columns from users table
    const res = await axios.get(`${url}/rest/v1/users?select=clerk_user_id,phone_number,university_name,semester_year,role,account_status,joined_date,last_login&limit=1`, { headers });
    console.log('Success! Columns exist. Data:', res.data);
  } catch (error) {
    console.error('Error querying users table:', error.response ? error.response.data : error.message);
  }
}

testSchema();
