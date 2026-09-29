const { Client } = require('pg');

const host = 'db.mydrikssmzzudzqeqroe.supabase.co';
const port = 6543;
const password = 'legatrixon2026';

const sslOptions = [
  { name: 'rejectUnauthorized: false', ssl: { rejectUnauthorized: false } },
  { name: 'ssl: true', ssl: true },
  { name: 'ssl: false (no ssl)', ssl: false },
  { name: 'no ssl config', ssl: undefined }
];

async function testSsl() {
  for (const option of sslOptions) {
    console.log(`Testing SSL Option: ${option.name}`);
    const config = {
      host,
      port,
      database: 'postgres',
      user: 'postgres',
      password,
    };
    if (option.ssl !== undefined) {
      config.ssl = option.ssl;
    }

    const client = new Client(config);
    try {
      await client.connect();
      console.log(`SUCCESS! Connected with SSL Option: ${option.name}`);
      const res = await client.query('SELECT version()');
      console.log('Version:', res.rows[0]);
      await client.end();
      return;
    } catch (err) {
      console.log(`Failed for ${option.name}: ${err.message}`);
    }
  }
}

testSsl();
