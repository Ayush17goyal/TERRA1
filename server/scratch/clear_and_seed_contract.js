const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// We know the SQLite path is either process.env.SQLITE_DB_PATH or falls back to:
// C:\Users\goyal\AppData\Local\Temp\LEGATRIXON\legatrixon_db.sqlite
const dbPath = process.env.SQLITE_DB_PATH || path.join(process.env.TEMP || process.env.TMP || 'C:\\Users\\goyal\\AppData\\Local\\Temp', 'LEGATRIXON', 'legatrixon_db.sqlite');

console.log('Opening SQLite database at:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.log('Database file does not exist yet. It will be created when backend runs.');
  process.exit(0);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the SQLite database.');
});

db.serialize(() => {
  // Check if contract_configs table exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='contract_configs';", [], (err, row) => {
    if (err) {
      console.error('Error checking table:', err.message);
      db.close();
      process.exit(1);
    }
    
    if (row) {
      console.log('Table contract_configs exists. Clearing rows to trigger re-seed...');
      db.run("DELETE FROM contract_configs;", [], function(err) {
        if (err) {
          console.error('Error deleting rows:', err.message);
        } else {
          console.log(`Successfully deleted ${this.changes} rows from contract_configs.`);
        }
        db.close();
      });
    } else {
      console.log('Table contract_configs does not exist yet. No need to clear.');
      db.close();
    }
  });
});
