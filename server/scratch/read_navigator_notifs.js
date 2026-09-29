const fs = require('fs');

const filePath = 'c:/Users/goyal/OneDrive/Desktop/LEGATRIXON-3/src/modules/AcademicNavigator.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const startLine = 2650;
const endLine = 2750;

for (let i = startLine - 1; i < endLine; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
