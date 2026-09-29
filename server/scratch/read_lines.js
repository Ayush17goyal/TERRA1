const fs = require('fs');

const filePath = 'c:/Users/goyal/OneDrive/Desktop/LEGATRIXON-3/src/App.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const startLine = 13050;
const endLine = 13200;

for (let i = startLine - 1; i < endLine; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
