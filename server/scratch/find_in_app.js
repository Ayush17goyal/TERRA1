const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/goyal/OneDrive/Desktop/LEGATRIXON-3/src/App.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const searchTerms = ['notification', 'bell', 'unread', 'mark as read', 'readall', 'markall'];

searchTerms.forEach(term => {
  console.log(`=== Matches for "${term}" ===`);
  let count = 0;
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes(term)) {
      count++;
      if (count <= 25) {
        console.log(`${idx + 1}: ${line.trim()}`);
      }
    }
  });
  console.log(`Total matches for "${term}": ${count}\n`);
});
