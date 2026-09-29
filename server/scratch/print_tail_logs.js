const fs = require('fs');
const path = require('path');

const logPath = path.resolve(__dirname, '../../lexmentor-backend.out.log');
console.log('Reading log file from:', logPath);

try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split(/\n/);
  const tail = lines.slice(-100);
  console.log('--- Log Tail ---');
  console.log(tail.join('\n'));
} catch (err) {
  console.error(err);
}
