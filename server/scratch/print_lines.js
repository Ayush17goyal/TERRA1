const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../../src/App.tsx');
try {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const start = 2350;
  const end = 2475;
  for (let i = start - 1; i < end; i++) {
    if (i < lines.length) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  }
} catch (err) {
  console.error(err);
}
