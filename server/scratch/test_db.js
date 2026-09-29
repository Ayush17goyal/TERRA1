const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.SQLITE_DB_PATH || path.join(process.env.TEMP || process.env.TMP || 'C:\\Users\\goyal\\AppData\\Local\\Temp', 'LEGATRIXON', 'legatrixon_db.sqlite');
console.log('Opening SQLite database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.all("SELECT * FROM contract_configs;", [], (err, rows) => {
    if (err) {
      console.error('Error querying contract_configs:', err.message);
    } else {
      console.log('CONTRACT CONFIGS ROWS:', rows);
    }
  });

  db.all("SELECT * FROM contract_acceptances;", [], (err, rows) => {
    if (err) {
      console.error('Error querying contract_acceptances:', err.message);
    } else {
      console.log('CONTRACT ACCEPTANCES ROWS:', rows);
    }
    db.close();
  });
});
