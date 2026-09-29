const axios = require('axios');
const url = 'https://mydrikssmzzudzqeqroe.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZHJpa3NzbXp6dWR6cWVxcm9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDk2NjI2MiwiZXhwIjoyMDk2NTQyMjYyfQ.X3y7kLXdA2uh58osCl7mNn9gGFGCmgDLF8GE2PQx5m8';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15ZHJpa3NzbXp6dWR6cWVxcm9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NjYyNjIsImV4cCI6MjA5NjU0MjI2Mn0.Nvqw1uuNa95yunYiBqXLUoJ7tRFkjjUrWoCXeV_8XIc';

const tables = [
  'users',
  'user_profiles',
  'user_settings_profiles',
  'user_activity_logs',
  'exams',
  'exam_topics',
  'exam_mock_attempts',
  'exam_forge_assets',
  'support_tickets',
  'bug_reports',
  'feature_requests',
  'ai_feedback',
  'feedback_ratings',
  'notebook_documents',
  'study_library' // bucket name
];

async function checkTables() {
  console.log('=== Checking with Service Role Key (Admin) ===');
  for (const table of tables) {
    try {
      const res = await axios.get(`${url}/rest/v1/${table}?limit=1`, {
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
      });
      console.log(`- ${table}: EXISTS (Status ${res.status}), Rows: ${res.data.length}`);
    } catch (err) {
      console.log(`- ${table}: ERROR: ${err.response ? `${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message}`);
    }
  }

  console.log('\n=== Checking with Anon Key (Anonymous) ===');
  for (const table of tables) {
    try {
      const res = await axios.get(`${url}/rest/v1/${table}?limit=1`, {
        headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
      });
      console.log(`- ${table}: ACCESSIBLE (Status ${res.status}), Rows: ${res.data.length}`);
    } catch (err) {
      console.log(`- ${table}: BLOCKED: ${err.response ? `${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message}`);
    }
  }
}

checkTables();
