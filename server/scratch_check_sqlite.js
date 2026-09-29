const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'legatrixon_db.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening SQLite DB:', err.message);
    process.exit(1);
  }
  console.log('Opened SQLite database:', dbPath);
});

db.serialize(() => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
    if (err) {
      console.error('Error listing tables:', err.message);
      db.close();
      return;
    }
    console.log('\n--- SQLite Tables ---');
    console.log(rows.map(r => r.name).join('\n'));

    // Check if any of these tables have chat-related columns
    const tables = rows.map(r => r.name);
    let pending = tables.length;
    if (pending === 0) {
      db.close();
      return;
    }

    tables.forEach(table => {
      db.all(`PRAGMA table_info(${table})`, [], (err, cols) => {
        if (!err) {
          const names = cols.map(c => c.name);
          if (names.some(name => name.includes('conversation') || name.includes('chat') || name.includes('session'))) {
            console.log(`\nTable '${table}' columns:`, names);
            
            // Let's print out count of rows
            db.get(`SELECT count(*) as cnt FROM ${table}`, (err, countRow) => {
              if (!err) {
                console.log(`Table '${table}' has ${countRow.cnt} rows`);
                if (countRow.cnt > 0) {
                  db.all(`SELECT * FROM ${table} LIMIT 2`, (err, dataRows) => {
                    if (!err) {
                      console.log(`Sample from '${table}':`, JSON.stringify(dataRows, null, 2));
                    }
                  });
                }
              }
            });
          }
        }
        pending--;
        if (pending === 0) {
          // Wait a bit for async queries to finish
          setTimeout(() => db.close(), 1000);
        }
      });
    });
  });
});
