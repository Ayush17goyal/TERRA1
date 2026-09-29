const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const pdfPath = path.resolve(__dirname, '../corpus-data/Criminal laws/IPC/IPC.pdf');
console.log('Testing PDF cleanup algorithm on:', pdfPath);

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

function cleanHeadersAndFooters(pages) {
  if (pages.length === 0) return pages;

  const headerCounts = new Map();
  const footerCounts = new Map();

  const pageLines = pages.map(p => {
    return p.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  });

  pages.forEach((page, pageIdx) => {
    const lines = pageLines[pageIdx];
    if (lines.length === 0) return;

    // Header candidates: first 2 non-empty lines
    const headers = lines.slice(0, 2);
    headers.forEach(h => {
      if (h.length > 3) {
        headerCounts.set(h, (headerCounts.get(h) || 0) + 1);
      }
    });

    // Footer candidates: last 2 non-empty lines
    const footers = lines.slice(-2);
    footers.forEach(f => {
      if (f.length > 3) {
        footerCounts.set(f, (footerCounts.get(f) || 0) + 1);
      }
    });
  });

  const threshold = Math.max(3, Math.floor(pages.length * 0.05)); // Use 5% threshold
  const repeatedHeaders = new Set();
  const repeatedFooters = new Set();

  console.log(`Threshold for repeated items: ${threshold}`);

  headerCounts.forEach((count, text) => {
    if (count >= 3) {
      console.log(`Header candidate [count=${count}]: "${text}"`);
    }
    if (count >= threshold) {
      repeatedHeaders.add(text);
      console.log(`--> Flagged repeated header: "${text}"`);
    }
  });

  footerCounts.forEach((count, text) => {
    if (count >= 3) {
      console.log(`Footer candidate [count=${count}]: "${text}"`);
    }
    if (count >= threshold) {
      repeatedFooters.add(text);
      console.log(`--> Flagged repeated footer: "${text}"`);
    }
  });

  return pages.map((page, pageIdx) => {
    const lines = pageLines[pageIdx];
    const cleanLines = lines.filter((line, lineIdx) => {
      // 1. Remove pure page number lines
      if (/^\d+$/.test(line)) return false;
      if (/^page\s*\d+/i.test(line)) return false;
      if (/^\s*-\s*\d+\s*-\s*$/.test(line)) return false;

      // 2. Remove repeated headers (if in first 3 lines of page)
      if (lineIdx < 3 && repeatedHeaders.has(line)) return false;

      // 3. Remove repeated footers (if in last 3 lines of page)
      if (lineIdx >= lines.length - 3 && repeatedFooters.has(line)) return false;

      return true;
    });

    return {
      pageNumber: page.pageNumber,
      text: cleanLines.join('\n')
    };
  });
}

pdfParse(buffer, { pagerender: customPageRender })
  .then(() => {
    pages.sort((a, b) => a.pageNumber - b.pageNumber);
    console.log(`Successfully parsed ${pages.length} pages. Running cleanup...`);
    const cleanPages = cleanHeadersAndFooters(pages);
    
    console.log('\n--- Cleaned Page 2 Preview ---');
    console.log(cleanPages[1].text.slice(0, 500));
  })
  .catch(err => {
    console.error('PDF parsing error:', err);
  });
