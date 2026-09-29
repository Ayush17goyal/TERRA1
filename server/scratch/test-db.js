const sqlite3 = require('sqlite3').verbose();
const path = process.env.SQLITE_DB_PATH || 'C:/Users/goyal/AppData/Local/LEGATRIXON/legatrixon_db.sqlite';
console.log('Opening DB:', path);

const db = new sqlite3.Database(path, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Failed to open:', err.message);
    process.exit(1);
  }
  console.log('DB opened successfully');
  
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) {
      console.error('Query error:', err.message);
    } else {
      console.log('Tables:', rows.map(r => r.name));
    }
    
    db.all("SELECT COUNT(*) as cnt FROM admin_account_locks", (err, rows) => {
      if (err) {
        console.error('Lock table error:', err.message);
      } else {
        console.log('Lock count:', rows[0].cnt);
      }
      db.close();
    });
  });
});
