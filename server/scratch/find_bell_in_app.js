const fs = require('fs');

const filePath = 'c:/Users/goyal/OneDrive/Desktop/LEGATRIXON-3/src/App.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const contentLines = content.split('\n');

contentLines.forEach((line, idx) => {
  if (line.includes('Bell')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
