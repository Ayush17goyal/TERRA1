const { Client } = require('pg');

const host = 'db.mydrikssmzzudzqeqroe.supabase.co';
const passwords = ['postgres', 'LGTX2026', 'legatrixon', 'legatrixon2026', 'zqth uhom yxsu ofpm'];

async function tryConnect() {
  const ports = [5432, 6543];
  for (const port of ports) {
    for (const password of passwords) {
      console.log(`Trying port: ${port}, password: ${password}`);
      const client = new Client({
        host,
        port: port,
        database: 'postgres',
        user: 'postgres',
        password: password,
        ssl: { rejectUnauthorized: false }
      });

      try {
        await client.connect();
        console.log(`SUCCESS! Connected to port ${port} with password: ${password}`);
        
        // Let's run a test query
        const res = await client.query('SELECT tablename FROM pg_tables WHERE schemaname = \'public\'');
        console.log('Tables:', res.rows.map(r => r.tablename));
        
        await client.end();
        return;
      } catch (err) {
        console.log(`Failed (port ${port}, password ${password}): ${err.message}`);
      }
    }
  }
}

tryConnect();
