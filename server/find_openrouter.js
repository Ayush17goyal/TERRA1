const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('OPENROUTER_API_KEY') || content.includes('openrouter')) {
        results.push(filePath);
      }
    }
  });
  return results;
}

const matches = walk('c:\\Users\\goyal\\OneDrive\\Desktop\\LEGATRIXON-3\\server\\src');
console.log('Matches:', matches);
