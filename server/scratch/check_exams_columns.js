const axios = require('axios');

const url = 'https://mydrikssmzzudzqeqroe.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZHJpa3NzbXp6dWR6cWVxcm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjYyNjIsImV4cCI6MjA5NjU0MjI2Mn0.Nvqw1uuNa95yunYiBqXLUoJ7tRFkjjUrWoCXeV_8XIc';

async function checkColumns() {
  const headers = {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json'
  };

  try {
    // Query explicitly selecting the new columns
    const res = await axios.get(`${url}/rest/v1/exams?select=clerk_user_id,full_name,email,subject_name,exam_time,reminder_type,reminder_enabled,reminder_trigger_at,reminder_sent_at,timezone&limit=1`, { headers });
    console.log('Exams columns query succeeded! Data:', res.data);
    
    const res2 = await axios.get(`${url}/rest/v1/notifications?select=exam_id,clerk_user_id,email_subject,email_body,delivered_at,failed_at,delivery_error&limit=1`, { headers });
    console.log('Notifications columns query succeeded! Data:', res2.data);
  } catch (error) {
    console.error('Error querying columns:', error.response ? error.response.data : error.message);
  }
}

checkColumns();
