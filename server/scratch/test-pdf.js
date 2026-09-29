const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const pdfPath = path.resolve(__dirname, '../corpus-data/Criminal laws/BNS/BNS2023.pdf');
console.log('Testing PDF parse on:', pdfPath);

if (!fs.existsSync(pdfPath)) {
  console.error('File does not exist!');
  process.exit(1);
}

const buffer = fs.readFileSync(pdfPath);
const pages = [];

function customPageRender(pageData) {
  return pageData.getTextContent()
    .then(function(textContent) {
      let lastY, text = '';
      for (let item of textContent.items) {
        if (lastY == item.transform[5] || !lastY){
          text += item.str;
        } else {
          text += '\n' + item.str;
        }
        lastY = item.transform[5];
      }
      
      const pageNum = pageData.pageIndex + 1;
      pages.push({
        pageNumber: pageNum,
        text: text
      });
      
      return text;
    });
}

pdfParse(buffer, { pagerender: customPageRender })
  .then(() => {
    // Sort pages to ensure they are in order (they should be, but it's safe)
    pages.sort((a, b) => a.pageNumber - b.pageNumber);
    console.log(`Successfully parsed ${pages.length} pages.`);
    console.log('\n--- Page 1 Preview ---');
    console.log(pages[0]?.text.slice(0, 500));
    console.log('\n--- Page 2 Preview ---');
    console.log(pages[1]?.text.slice(0, 500));
  })
  .catch(err => {
    console.error('PDF parsing error:', err);
  });
