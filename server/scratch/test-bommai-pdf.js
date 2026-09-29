const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

async function testPdf() {
  const filepath = path.resolve(__dirname, '../corpus-data/supreme-court/S.R. Bommai v. Union of India.pdf');
  console.log('Reading file:', filepath);
  try {
    const buffer = fs.readFileSync(filepath);
    console.log('File size in bytes:', buffer.length);
    const data = await pdfParse(buffer);
    console.log('Parsed successfully!');
    console.log('Number of pages:', data.numpages);
    console.log('Info:', JSON.stringify(data.info, null, 2));
    console.log('Metadata:', JSON.stringify(data.metadata, null, 2));
    console.log('Text length:', data.text ? data.text.length : 0);
    console.log('Text preview:', data.text ? JSON.stringify(data.text.substring(0, 500)) : 'None');
  } catch (err) {
    console.error('Error during pdf-parse:', err);
  }
}

testPdf();
