import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_DIRS = ['src', 'server/src', 'api', 'scripts'];
const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.html', '.md', '.json', '.sql', '.txt']);
const MOJIBAKE_MARKERS = /[\u00c3\u00c2\u00e2\ufffd]/;
const REQUIRED_CHARS = ['•', '“', '”', '‘', '’', '—', '…', '§', '©', '®', '™', '₹'];

function collectFiles(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'coverage', 'playwright-report', '.git'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, files);
    else if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

describe('UTF-8 encoding hygiene', () => {
  it('round-trips required legal typography characters as UTF-8', () => {
    const text = REQUIRED_CHARS.join(' Arrangement of Sections ');
    const roundTrip = Buffer.from(text, 'utf8').toString('utf8');
    expect(roundTrip).toBe(text);
  });

  it('does not contain checked-in mojibake markers in source files', () => {
    const offenders = SOURCE_DIRS
      .flatMap((dir) => collectFiles(path.join(ROOT, dir)))
      .filter((file) => MOJIBAKE_MARKERS.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file));

    expect(offenders).toEqual([]);
  });
});
