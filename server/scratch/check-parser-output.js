const fs = require('fs');
const path = require('path');

const corpusDir = path.resolve(__dirname, '../corpus-data');
console.log('Scanning corpus directory:', corpusDir);

function findParsedFiles(dir, fileList = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      findParsedFiles(fullPath, fileList);
    } else if (item.isFile() && item.name === 'parsed-sections.json') {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const parsedFiles = findParsedFiles(corpusDir);
console.log(`\nFound ${parsedFiles.length} parsed-sections.json files.`);
console.log('\nList of structured parsed files:');
parsedFiles.forEach((file, index) => {
  const relPath = path.relative(corpusDir, file);
  const stats = fs.statSync(file);
  console.log(`[${index + 1}] ${relPath} (${stats.size} bytes)`);
  
  if (index === 0) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      console.log('\n    --> Sample Structure Parse Check (Limitation Act):');
      console.log(`        Act Name: "${data.actName}"`);
      console.log(`        Category: "${data.category}"`);
      console.log(`        Root Elements Count: ${data.structure.length}`);
      
      const firstSectionNode = data.structure.find(s => s.type === 'part')?.children?.find(ch => ch.type === 'section') || 
                               data.structure.find(s => s.type === 'section');
                               
      if (firstSectionNode) {
        console.log(`        First Discovered Section:`, {
          type: firstSectionNode.type,
          number: firstSectionNode.number,
          title: firstSectionNode.title,
          contentSample: firstSectionNode.content ? firstSectionNode.content.slice(0, 150) + '...' : '',
          childrenCount: firstSectionNode.children ? firstSectionNode.children.length : 0
        });
      }
    } catch (e) {
      console.error('    --> Failed to parse JSON:', e.message);
    }
  }
});
