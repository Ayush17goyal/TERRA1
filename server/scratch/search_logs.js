const fs = require('fs');
const readline = require('readline');

async function searchLogs() {
  const fileStream = fs.createReadStream('C:/Users/goyal/.gemini/antigravity-ide/brain/5a23df57-d654-4e16-87f9-1f83739dcc50/.system_generated/logs/transcript.jsonl');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log('Searching logs for service_role or SUPABASE_SERVICE_ROLE_KEY...');

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (line.includes('SUPABASE_SERVICE_ROLE_KEY') || line.includes('service_role') || line.includes('mydrikssmzzudzqeqroe')) {
      // Find strings that look like service role keys (starts with eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9)
      const matches = line.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g);
      if (matches) {
        for (const jwt of matches) {
          try {
            const parts = jwt.split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            console.log(`Line ${lineCount}: Found JWT. ISS: ${payload.iss}, REF: ${payload.ref}, ROLE: ${payload.role}`);
            console.log('JWT Value:', jwt);
          } catch (e) {
            // Ignore malformed JWT matches
          }
        }
      }
    }
  }
  console.log('Done searching logs.');
}

searchLogs();
