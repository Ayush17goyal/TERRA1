const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../../src/App.tsx');
console.log('Reading App.tsx from:', filePath);

try {
  const content = fs.readFileSync(filePath, 'utf8');
  console.log('File length:', content.length);
  
  const searchPattern = /AdminPortal/g;
  let match;
  const lines = content.split(/\r?\n/);
  
  console.log('--- Search Results for "AdminPortal" ---');
  lines.forEach((line, idx) => {
    if (line.includes('AdminPortal')) {
      console.log(`${idx + 1}: ${line}`);
    }
  });

  console.log('--- Search Results for "/admin" ---');
  lines.forEach((line, idx) => {
    if (line.includes('/admin')) {
      console.log(`${idx + 1}: ${line}`);
    }
  });

  console.log('--- Search Results for "useUser" ---');
  lines.forEach((line, idx) => {
    if (line.includes('useUser')) {
      console.log(`${idx + 1}: ${line}`);
    }
  });

} catch (err) {
  console.error(err);
}
