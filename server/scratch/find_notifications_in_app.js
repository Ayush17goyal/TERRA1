const fs = require('fs');

const filePath = 'c:/Users/goyal/OneDrive/Desktop/LEGATRIXON-3/src/App.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('notificationsQuery') || line.includes('notificationsCount') || line.includes('Notification Center')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
