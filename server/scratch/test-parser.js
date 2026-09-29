const fs = require('fs');
const path = require('path');

const actPath = path.resolve(__dirname, '../corpus-data/Civil laws/Limitation Act/extracted-text.json');
console.log('Testing structure parser on:', actPath);

if (!fs.existsSync(actPath)) {
  console.error('File does not exist! Run scanner first.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(actPath, 'utf-8'));
const allLines = [];

data.pages.forEach(p => {
  const lines = p.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  allLines.push(...lines);
});

console.log(`Total lines to parse: ${allLines.length}`);

function parseStructure(lines) {
  let root = [];
  
  let currentPart = null;
  let currentChapter = null;
  let currentSection = null;
  let currentSubsection = null;
  let currentClause = null;
  let currentAttachment = null;
  let currentSchedule = null;

  let inActualAct = false;

  // Regex patterns
  const partRegex = /^\s*PART\s+([IVXLCDM\d]+)(?:\s+—\s*(.*))?$/i;
  const chapterRegex = /^\s*CHAPTER\s+([IVXLCDM\d]+)(?:\s+—\s*(.*))?$/i;
  const scheduleRegex = /^\s*(?:THE\s+)?([IVXLCDM\d]+)?\s*SCHEDULE(?:\s+—\s*(.*))?$/i;
  const sectionRegex = /^\s*(\d+[A-Z]*)\.\s*(.*)$/;
  const subsectionRegex = /^\s*\((\d+)\)\s*(.*)$/;
  const clauseRegex = /^\s*\(([a-z]{1,2})\)\s*(.*)$/;
  const provisoRegex = /^\s*Provided\s+(?:further\s+)?that\s*(.*)$/i;
  const explanationRegex = /^\s*(Explanation\s*\d*)\s*(?:.—|.—|\.-|\.|\s+—)\s*(.*)$/i;
  const illustrationRegex = /^\s*(Illustration[s]?\s*\d*)\s*(?:.—|.—|\.-|\.|\s+—)?\s*(.*)$/i;

  const enactingFormulaRegex = /be\s+it\s+enacted|enacted\s+by\s+parliament|enacted\s+as\s+follows|it\s+is\s+enacted/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect if we have entered the actual act and should clear the Table of Contents
    if (!inActualAct) {
      const isEnacting = enactingFormulaRegex.test(line);
      const isSectionBody = line.match(sectionRegex) && (line.includes('—') || line.includes('--'));
      
      if (isEnacting || isSectionBody) {
        console.log(`[TOC BYPASS] Act start detected at line ${i}: "${line.slice(0, 60)}"`);
        inActualAct = true;
        root = []; // Clear TOC
        currentPart = null;
        currentChapter = null;
        currentSection = null;
        currentSubsection = null;
        currentClause = null;
        currentAttachment = null;
        currentSchedule = null;
        if (isEnacting) {
          root.push({ type: 'body', content: line });
          continue;
        }
      }
    }

    // 1. Part check
    let match = line.match(partRegex);
    if (match) {
      currentPart = {
        type: 'part',
        number: match[1],
        title: match[2] || '',
        children: []
      };
      
      // Look ahead for title if empty
      if (!currentPart.title && i + 1 < lines.length && !lines[i + 1].match(/^(?:PART|CHAPTER|SECTION|\d+\.)/i)) {
        currentPart.title = lines[i + 1];
        i++;
      }

      root.push(currentPart);
      // Close lower contexts
      currentChapter = null;
      currentSection = null;
      currentSubsection = null;
      currentClause = null;
      currentAttachment = null;
      currentSchedule = null;
      continue;
    }

    // 2. Chapter check
    match = line.match(chapterRegex);
    if (match) {
      currentChapter = {
        type: 'chapter',
        number: match[1],
        title: match[2] || '',
        children: []
      };

      // Look ahead for title if empty
      if (!currentChapter.title && i + 1 < lines.length && !lines[i + 1].match(/^(?:PART|CHAPTER|SECTION|\d+\.)/i)) {
        currentChapter.title = lines[i + 1];
        i++;
      }

      if (currentPart) {
        currentPart.children.push(currentChapter);
      } else {
        root.push(currentChapter);
      }

      currentSection = null;
      currentSubsection = null;
      currentClause = null;
      currentAttachment = null;
      currentSchedule = null;
      continue;
    }

    // 3. Schedule check
    match = line.match(scheduleRegex);
    if (match) {
      currentSchedule = {
        type: 'schedule',
        number: match[1] || '',
        title: match[2] || '',
        children: []
      };

      root.push(currentSchedule);

      currentPart = null;
      currentChapter = null;
      currentSection = null;
      currentSubsection = null;
      currentClause = null;
      currentAttachment = null;
      continue;
    }

    // 4. Section check
    match = line.match(sectionRegex);
    if (match) {
      currentSection = {
        type: 'section',
        number: match[1],
        title: '',
        content: match[2] || '',
        children: []
      };

      // Split first sentence or text before em-dash as section title
      const content = currentSection.content;
      const emDashIdx = content.indexOf('—');
      const regularDashIdx = content.indexOf('.—');
      
      let titleEndIdx = -1;
      if (regularDashIdx > 0 && regularDashIdx < 150) {
        titleEndIdx = regularDashIdx;
        currentSection.title = content.substring(0, titleEndIdx).trim();
        currentSection.content = content.substring(titleEndIdx + 2).trim();
      } else if (emDashIdx > 0 && emDashIdx < 150) {
        titleEndIdx = emDashIdx;
        currentSection.title = content.substring(0, titleEndIdx).trim();
        currentSection.content = content.substring(titleEndIdx + 1).trim();
      } else {
        const dotIdx = content.indexOf('.');
        if (dotIdx > 0 && dotIdx < 100) {
          currentSection.title = content.substring(0, dotIdx).trim();
          currentSection.content = content.substring(dotIdx + 1).trim();
        }
      }

      if (currentSchedule) {
        currentSchedule.children.push(currentSection);
      } else if (currentChapter) {
        currentChapter.children.push(currentSection);
      } else if (currentPart) {
        currentPart.children.push(currentSection);
      } else {
        root.push(currentSection);
      }

      currentSubsection = null;
      currentClause = null;
      currentAttachment = null;
      continue;
    }

    // 5. Subsection check
    match = line.match(subsectionRegex);
    if (match && currentSection) {
      currentSubsection = {
        type: 'subsection',
        number: match[1],
        content: match[2] || '',
        children: []
      };

      currentSection.children.push(currentSubsection);
      currentClause = null;
      currentAttachment = null;
      continue;
    }

    // 6. Clause check
    match = line.match(clauseRegex);
    if (match && (currentSubsection || currentSection)) {
      currentClause = {
        type: 'clause',
        number: match[1],
        content: match[2] || ''
      };

      if (currentSubsection) {
        currentSubsection.children.push(currentClause);
      } else {
        currentSection.children.push(currentClause);
      }
      currentAttachment = null;
      continue;
    }

    // 7. Proviso check
    match = line.match(provisoRegex);
    if (match && currentSection) {
      currentAttachment = {
        type: 'proviso',
        content: line
      };

      if (currentClause) {
        if (!currentClause.children) currentClause.children = [];
        currentClause.children.push(currentAttachment);
      } else if (currentSubsection) {
        currentSubsection.children.push(currentAttachment);
      } else {
        currentSection.children.push(currentAttachment);
      }
      continue;
    }

    // 8. Explanation check
    match = line.match(explanationRegex);
    if (match && currentSection) {
      currentAttachment = {
        type: 'explanation',
        number: match[1],
        content: match[2] || ''
      };

      if (currentClause) {
        if (!currentClause.children) currentClause.children = [];
        currentClause.children.push(currentAttachment);
      } else if (currentSubsection) {
        currentSubsection.children.push(currentAttachment);
      } else {
        currentSection.children.push(currentAttachment);
      }
      continue;
    }

    // 9. Illustration check
    match = line.match(illustrationRegex);
    if (match && currentSection) {
      currentAttachment = {
        type: 'illustration',
        number: match[1],
        content: match[2] || ''
      };

      if (currentClause) {
        if (!currentClause.children) currentClause.children = [];
        currentClause.children.push(currentAttachment);
      } else if (currentSubsection) {
        currentSubsection.children.push(currentAttachment);
      } else {
        currentSection.children.push(currentAttachment);
      }
      continue;
    }

    // 10. Body line append to current active node
    if (currentAttachment) {
      currentAttachment.content += '\n' + line;
    } else if (currentClause) {
      currentClause.content += '\n' + line;
    } else if (currentSubsection) {
      currentSubsection.content += '\n' + line;
    } else if (currentSection) {
      if (!currentSection.content) {
        currentSection.content = line;
      } else {
        currentSection.content += '\n' + line;
      }
    } else if (currentSchedule) {
      if (!currentSchedule.content) {
        currentSchedule.content = line;
      } else {
        currentSchedule.content += '\n' + line;
      }
    } else if (currentChapter) {
      if (!currentChapter.content) {
        currentChapter.content = line;
      } else {
        currentChapter.content += '\n' + line;
      }
    } else if (currentPart) {
      if (!currentPart.content) {
        currentPart.content = line;
      } else {
        currentPart.content += '\n' + line;
      }
    } else {
      // General root body line
      root.push({
        type: 'body',
        content: line
      });
    }
  }

  return root;
}

const result = parseStructure(allLines);
console.log('\nParsed root structure count:', result.length);
console.log('\n--- First 5 Parsed Items ---');
console.log(JSON.stringify(result.slice(0, 5), null, 2));
