const fs = require('fs');

const filePath = 'c:/Users/goyal/OneDrive/Desktop/LEGATRIXON-3/src/modules/AcademicNavigator.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('examsQuery')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
