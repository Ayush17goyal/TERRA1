const fs = require('fs');
const path = require('path');

const paths = [
  path.resolve(__dirname, '../legatrixon_db.sqlite'),
  path.resolve(__dirname, '../legatrixon_db_inspect.sqlite'),
  path.resolve(__dirname, '../runtime/legatrixon_db.sqlite'),
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'LEGATRIXON', 'legatrixon_db.sqlite') : null,
].filter(Boolean);

paths.forEach(p => {
  if (fs.existsSync(p)) {
    const stats = fs.statSync(p);
    console.log(`File: ${p}`);
    console.log(`- Size: ${stats.size} bytes`);
    console.log(`- Mtime: ${stats.mtime}`);
  } else {
    console.log(`File: ${p} (does not exist)`);
  }
});
