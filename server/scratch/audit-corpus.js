const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

let dbPath = process.env.SQLITE_DB_PATH || '';
if (process.platform === 'win32' && dbPath.startsWith('/')) {
  // Try resolving relative to C drive or local workspace
  const relativeCandidate = path.resolve(dbPath);
  const absoluteCandidate = 'C:' + dbPath;
  if (fs.existsSync(absoluteCandidate)) {
    dbPath = absoluteCandidate;
  } else if (fs.existsSync(relativeCandidate)) {
    dbPath = relativeCandidate;
  } else {
    dbPath = absoluteCandidate;
  }
}

console.log(`Database Path resolved: ${dbPath}\n`);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  // Check if table exists
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='parsed_provisions'", (err, table) => {
    if (err) {
      console.error('Error checking table:', err.message);
      db.close();
      return;
    }
    if (!table) {
      console.error('Table "parsed_provisions" does not exist in database.');
      // Print tables so we can troubleshoot
      db.all("SELECT name FROM sqlite_master WHERE type='table'", (err2, rows) => {
        console.log('Available tables:');
        rows.forEach(r => console.log(` - ${r.name}`));
        db.close();
      });
      return;
    }

    // 1. Total number of Acts indexed
    db.get("SELECT COUNT(DISTINCT act_name) as cnt FROM parsed_provisions", (err, row) => {
      console.log(`1. Total number of Acts indexed: ${row ? row.cnt : 0}`);
    });

    // 2. Total number of provisions indexed
    db.get("SELECT COUNT(*) as cnt FROM parsed_provisions", (err, row) => {
      console.log(`2. Total number of provisions indexed: ${row ? row.cnt : 0}\n`);
    });

    // 3. List every Act with the number of sections stored
    db.all("SELECT act_name, COUNT(DISTINCT section) as sections, COUNT(*) as total_rows FROM parsed_provisions GROUP BY act_name", (err, rows) => {
      console.log('3. Acts with sections and provisions count:');
      if (rows) {
        rows.forEach(r => {
          console.log(`   - ${r.act_name}: ${r.sections} distinct sections (${r.total_rows} total provisions)`);
        });
      }
      console.log('');
    });

    // 4. Verify whether Bharatiya Nyaya Sanhita exists
    db.get("SELECT COUNT(*) as cnt FROM parsed_provisions WHERE act_name LIKE '%Bharatiya Nyaya%' OR act_name LIKE '%BNS%'", (err, row) => {
      const bnsCount = row ? row.cnt : 0;
      console.log(`4. Bharatiya Nyaya Sanhita entries found: ${bnsCount > 0 ? 'YES' : 'NO'} (${bnsCount} provisions)`);
    });

    // 5. If BNS exists, verify that Section 63 exists
    db.all("SELECT * FROM parsed_provisions WHERE (act_name LIKE '%Bharatiya Nyaya%' OR act_name LIKE '%BNS%') AND section = '63'", (err, rows) => {
      if (err) {
        console.error('Error finding BNS Sec 63:', err.message);
        return;
      }
      console.log(`5. Section 63 in BNS: ${rows && rows.length > 0 ? 'FOUND' : 'MISSING'}`);
      if (rows && rows.length > 0) {
        rows.forEach(r => {
          console.log(`   - ID: ${r.id} | Title: "${r.title}" | Section: "${r.section}" | Content Snippet: "${r.content.substring(0, 150).replace(/\n/g, ' ')}..."`);
        });
      }
    });

    // 6. Print sample rows from database
    db.all("SELECT id, act_name, section, title, content FROM parsed_provisions LIMIT 3", (err, rows) => {
      console.log('\n7. Sample rows from parsed_provisions:');
      if (rows) {
        rows.forEach((r, idx) => {
          console.log(`\n[Sample ${idx + 1}] ID: ${r.id}`);
          console.log(`- Act: ${r.act_name} | Section: ${r.section} | Title: "${r.title}"`);
          console.log(`- Content: "${r.content.substring(0, 200).replace(/\n/g, ' ')}..."`);
        });
      }
      db.close();
    });
  });
});
