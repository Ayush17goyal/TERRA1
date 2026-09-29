const fs = require('fs');

const filePath = 'c:/Users/goyal/OneDrive/Desktop/LEGATRIXON-3/src/modules/AcademicNavigator.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const startLine = 1120;
const endLine = 1160;

for (let i = startLine - 1; i < endLine; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
