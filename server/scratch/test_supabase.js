const axios = require('axios');

const url = 'https://mydrikssmzzudzqeqroe.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZHJpa3NzbXp6dWR6cWVxcm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjYyNjIsImV4cCI6MjA5NjU0MjI2Mn0.Nvqw1uuNa95yunYiBqXLUoJ7tRFkjjUrWoCXeV_8XIc';

async function testInsert() {
  const headers = {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const notification = {
    user_id: 'a0000000-0000-0000-0000-000000000000', // A valid UUID format
    title: 'Test Notification Insertion',
    message: 'This is a test notification from the backend script.',
    type: 'alert'
  };

  try {
    const res = await axios.post(`${url}/rest/v1/notifications`, notification, { headers });
    console.log('Success! Notification inserted:', res.data);
  } catch (error) {
    console.error('Error inserting notification:', error.response ? error.response.data : error.message);
  }
}

testInsert();
