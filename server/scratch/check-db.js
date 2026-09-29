const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = 'C:\\var\\data\\legatrixon_db.sqlite';
console.log('Opening database at:', dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    return;
  }
  
  db.all("SELECT name FROM sqlite_master WHERE type='table';", [], (err, tables) => {
    if (err) {
      console.error('Error listing tables:', err.message);
      return;
    }
    console.log('Tables in database:', tables.map(t => t.name));
    
    if (tables.some(t => t.name === 'legal_acts')) {
      db.all("SELECT * FROM legal_acts;", [], (err, rows) => {
        if (err) {
          console.error('Error querying legal_acts:', err.message);
          return;
        }
        console.log(`\nFound ${rows.length} rows in legal_acts:`);
        rows.forEach(r => console.log(`- ${r.act_name} (${r.category}) size=${r.file_size_bytes} path=${path.basename(r.file_path)}`));
      });
    } else {
      console.log('Table legal_acts does not exist yet!');
    }
  });
});
