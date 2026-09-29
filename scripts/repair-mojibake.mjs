import fs from 'node:fs';
import path from 'node:path';

const cp1252EncodeMap = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

const decoder = new TextDecoder('utf-8', { fatal: false });
const suspicious = /(?:\u00c3|\u00c2|\u00e2|\ufffd|\u00e2\u20ac|\u00e2\u20ac\u0153|\u00e2\u20ac\u009d|\u00e2\u20ac\u2122|\u00e2\u20ac\u00a2|\u00e2\u20ac\u00a6|\u00e2\u20ac\u201d|\u00e2\u20ac\u201c|\u00e2\u201a\u00b9)/g;

function score(text) {
  const markerCount = (text.match(suspicious) || []).length;
  const replacementCount = (text.match(/\ufffd/g) || []).length;
  return markerCount * 20 + replacementCount * 30;
}

function cp1252Bytes(text) {
  const bytes = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code <= 0xff) bytes.push(code);
    else if (cp1252EncodeMap.has(code)) bytes.push(cp1252EncodeMap.get(code));
    else return null;
  }
  return Uint8Array.from(bytes);
}

function repairSegment(input) {
  let current = String(input ?? '');
  let currentScore = score(current);
  if (currentScore === 0) return current;

  for (let i = 0; i < 6; i += 1) {
    const bytes = cp1252Bytes(current);
    if (!bytes) break;
    const candidate = decoder.decode(bytes);
    const candidateScore = score(candidate);
    if (candidateScore >= currentScore) break;
    current = candidate;
    currentScore = candidateScore;
    if (currentScore === 0) break;
  }
  return current;
}

export function repairMojibakeText(input) {
  const text = String(input ?? '');
  const whole = repairSegment(text);
  if (whole !== text || score(text) === 0) return whole;
  return text
    .split(/(\r?\n)/)
    .map((segment) => segment.includes('\n') || segment.includes('\r') ? segment : repairSegment(segment))
    .join('');
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage' || entry.name === '.git' || entry.name === 'playwright-report') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

const editableExt = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.md', '.json', '.sql', '.txt', '.mjs']);

function runCli() {
  const root = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : process.cwd();
  const write = process.argv.includes('--write');
  let changed = 0;

  for (const file of walk(root)) {
    if (!editableExt.has(path.extname(file).toLowerCase())) continue;
    const before = fs.readFileSync(file, 'utf8');
    if (score(before) === 0) continue;
    const after = repairMojibakeText(before);
    if (after !== before && score(after) < score(before)) {
      changed += 1;
      console.log(`${write ? 'repaired' : 'would repair'} ${path.relative(root, file)} (${score(before)} -> ${score(after)})`);
      if (write) fs.writeFileSync(file, after, 'utf8');
    }
  }

  console.log(`${write ? 'Repaired' : 'Would repair'} ${changed} file(s).`);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/repair-mojibake.mjs')) {
  runCli();
}


