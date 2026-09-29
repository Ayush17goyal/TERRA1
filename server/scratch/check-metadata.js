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
    
    if (tables.some(t => t.name === 'parsed_provisions')) {
      db.get("SELECT COUNT(*) as count FROM parsed_provisions;", [], (err, row) => {
        if (err) {
          console.error('Error counting provisions:', err.message);
          return;
        }
        console.log(`\n✅ Total provision metadata records stored: ${row.count}`);
        
        db.all("SELECT * FROM parsed_provisions LIMIT 5;", [], (err, rows) => {
          if (err) {
            console.error('Error querying provisions:', err.message);
            return;
          }
          
          console.log('\n--- Sample Provisions Records Check ---');
          rows.forEach((r, idx) => {
            console.log(`\n[Provision ${idx + 1}] ID: ${r.id}`);
            console.log(`- Act Name: "${r.act_name}" | Category: "${r.category}"`);
            console.log(`- Part: "${r.part || 'N/A'}" | Chapter: "${r.chapter || 'N/A'}"`);
            console.log(`- Section: "${r.section || 'N/A'}" | Subsection: "${r.subsection || 'N/A'}" | Clause: "${r.clause || 'N/A'}"`);
            console.log(`- Title: "${r.title || 'N/A'}"`);
            console.log(`- Keywords: ${r.keywords}`);
            console.log(`- PDF Source: ...\\${path.basename(r.pdf_source)}`);
            console.log(`- Content: "${r.content.substring(0, 150).replace(/\n/g, ' ')}..."`);
          });
        });
      });
    } else {
      console.log('Table parsed_provisions does not exist!');
    }
  });
});
