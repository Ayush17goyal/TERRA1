const fs = require('fs');
const path = require('path');

const corpusDir = path.resolve(__dirname, '../corpus-data');
console.log('Scanning corpus directory:', corpusDir);

function findJsonFiles(dir, fileList = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      findJsonFiles(fullPath, fileList);
    } else if (item.isFile() && item.name === 'extracted-text.json') {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const jsonFiles = findJsonFiles(corpusDir);
console.log(`\nFound ${jsonFiles.length} extracted-text.json files.`);
console.log('\nList of generated json files:');
jsonFiles.forEach((file, index) => {
  const relPath = path.relative(corpusDir, file);
  const stats = fs.statSync(file);
  console.log(`[${index + 1}] ${relPath} (${stats.size} bytes)`);
  
  // Print a small sample check of first act
  if (index === 0) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      console.log('    --> Sample Data Check:', {
        actName: data.actName,
        category: data.category,
        totalPages: data.totalPages,
        firstPageChars: data.pages[0]?.text.slice(0, 150)
      });
    } catch (e) {
      console.error('    --> Failed to parse JSON:', e.message);
    }
  }
});
