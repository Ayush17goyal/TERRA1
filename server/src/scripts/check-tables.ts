import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const getHeaders = () => {
  return {
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
  };
};

const tables = [
  'users',
  'research_history',
  'user_notes',
  'flashcards',
  'analytics',
  'calendar_events',
  'internship_applications',
  'progress_reports'
];

async function check() {
  console.log(`Supabase URL: ${supabaseUrl}`);
  for (const table of tables) {
    try {
      const res = await axios.get(`${supabaseUrl}/rest/v1/${table}?limit=1`, { headers: getHeaders() });
      console.log(`Table "${table}": EXISTS (status ${res.status}, rows: ${res.data.length})`);
    } catch (err: any) {
      if (err.response) {
        console.log(`Table "${table}": ERROR (status ${err.response.status}, message: ${err.response.data?.message || err.message})`);
      } else {
        console.log(`Table "${table}": ERROR (${err.message})`);
      }
    }
  }
}

check();
