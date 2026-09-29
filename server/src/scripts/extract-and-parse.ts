/**
 * extract-and-parse.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone ingestion script for legal corpus acts that are missing their
 * extracted-text.json and/or parsed-sections.json files.
 *
 * Usage (from server/):
 *   npx ts-node src/scripts/extract-and-parse.ts
 *   npx ts-node src/scripts/extract-and-parse.ts --force   # re-parse all acts
 *   npx ts-node src/scripts/extract-and-parse.ts --validate-only  # no writes
 *
 * Does NOT depend on NestJS, Qdrant, SQLite, or any external service.
 * Only requires: pdf-parse (already in package.json).
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  parseLegalDocument,
  validateLegalStructure,
  parseLegalStructure,
  LegalDocumentMeta,
  ParserValidationResult,
} from '../modules/ingestion/indian-legal-parser';

// ─── CLI flags ────────────────────────────────────────────────────────────────

const FORCE = process.argv.includes('--force');
const VALIDATE_ONLY = process.argv.includes('--validate-only');

// ─── Canonical name map ───────────────────────────────────────────────────────
// Maps substrings found in the first-page text → [officialName, year, shortName]

const CANONICAL: Array<[string, string, number | undefined, string]> = [
  ['BHARATIYA NYAYA SANHITA',           'Bharatiya Nyaya Sanhita, 2023',                 2023, 'BNS'],
  ['BHARATIYA NAGARIK SURAKSHA',        'Bharatiya Nagarik Suraksha Sanhita, 2023',      2023, 'BNSS'],
  ['BHARATIYA SAKSHYA',                 'Bharatiya Sakshya Adhiniyam, 2023',             2023, 'BSA'],
  ['CONSTITUTION OF INDIA',             'Constitution of India',                          1950, 'Constitution'],
  ['CODE OF CRIMINAL PROCEDURE',        'Code of Criminal Procedure, 1973',              1973, 'CrPC'],
  ['CRIMINAL PROCEDURE CODE',           'Code of Criminal Procedure, 1973',              1973, 'CrPC'],
  ['CODE OF CIVIL PROCEDURE',           'Code of Civil Procedure, 1908',                 1908, 'CPC'],
  ['CIVIL PROCEDURE CODE',              'Code of Civil Procedure, 1908',                 1908, 'CPC'],
  ['INDIAN PENAL CODE',                 'Indian Penal Code, 1860',                       1860, 'IPC'],
  ['INDIAN EVIDENCE ACT',               'Indian Evidence Act, 1872',                     1872, 'IEA'],
  ['LIMITATION ACT',                    'Limitation Act, 1963',                          1963, 'LA'],
  ['SPECIAL MARRIAGE ACT',              'Special Marriage Act, 1954',                    1954, 'SMA'],
  ['SPECIFIC RELIEF ACT',               'Specific Relief Act, 1963',                     1963, 'SRA'],
  ['TRANSFER OF PROPERTY ACT',          'Transfer of Property Act, 1882',                1882, 'TPA'],
  ['INDIAN CONTRACT ACT',               'Indian Contract Act, 1872',                     1872, 'ICA'],
  ['COMPANIES ACT',                     'Companies Act, 2013',                           2013, 'CA'],
  ['ARBITRATION AND CONCILIATION',      'Arbitration and Conciliation Act, 1996',        1996, 'ACA'],
  ['INFORMATION TECHNOLOGY ACT',        'Information Technology Act, 2000',              2000, 'ITA'],
  ['CONSUMER PROTECTION ACT',           'Consumer Protection Act, 2019',                 2019, 'CPA'],
  ['TRADE MARKS ACT',                   'Trade Marks Act, 1999',                         1999, 'TMA'],
  ['TRADEMARK',                         'Trade Marks Act, 1999',                         1999, 'TMA'],
  ['COPYRIGHT ACT',                     'Copyright Act, 1957',                           1957, 'CopyA'],
  ['PATENT',                            'Patents Act, 1970',                             1970, 'PatA'],
  ['NEGOTIABLE INSTRUMENTS',            'Negotiable Instruments Act, 1881',              1881, 'NIA'],
  ['DIGITAL PERSONAL DATA',             'Digital Personal Data Protection Act, 2023',   2023, 'DPDPA'],
  ['HINDU SUCCESSION',                  'Hindu Succession Act, 1956',                   1956, 'HSA'],
  ['HINDU MARRIAGE',                    'Hindu Marriage Act, 1955',                     1955, 'HMA'],
  ['SALE OF GOODS',                     'Sale of Goods Act, 1930',                      1930, 'SOGA'],
  ['PARTNERSHIP ACT',                   'Indian Partnership Act, 1932',                 1932, 'IPA'],
  ['CODE ON WAGES',                     'Code on Wages, 2019',                          2019, 'COW'],
];

function resolveOfficialName(
  firstPageText: string,
  folderName: string,
): { officialName: string; year: number | undefined; shortName: string } {
  const upper = firstPageText.toUpperCase();
  for (const [keyword, officialName, year, shortName] of CANONICAL) {
    if (upper.includes(keyword)) return { officialName, year, shortName };
  }
  // Fallback: humanise folder name
  const humanised = folderName
    .replace(/_/g, ' ')
    .replace(/,\s*\d{4}.*$/, '')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .trim();
  const yearMatch = folderName.match(/\b(18|19|20)\d{2}\b/);
  return {
    officialName: humanised,
    year: yearMatch ? parseInt(yearMatch[0], 10) : undefined,
    shortName: humanised.split(' ').filter(w => /^[A-Z]/.test(w) && w.length > 2).map(w => w[0]).join('') || humanised.slice(0, 6),
  };
}

// ─── PDF text extraction ──────────────────────────────────────────────────────

interface PageInfo {
  pageNumber: number;
  text: string;
}

async function extractPdfPages(pdfPath: string): Promise<PageInfo[]> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require('pdf-parse');
  const buffer = fs.readFileSync(pdfPath);
  const pages: PageInfo[] = [];

  const customPageRender = (pageData: any) => {
    return pageData.getTextContent().then((textContent: any) => {
      let lastY: number | undefined;
      let text = '';
      for (const item of textContent.items) {
        if (lastY === item.transform[5] || lastY === undefined) {
          text += item.str;
        } else {
          text += '\n' + item.str;
        }
        lastY = item.transform[5];
      }
      pages.push({ pageNumber: pageData.pageIndex + 1, text });
      return text;
    });
  };

  await pdfParse(buffer, { pagerender: customPageRender });
  pages.sort((a, b) => a.pageNumber - b.pageNumber);
  return pages;
}

function cleanHeadersAndFooters(pages: PageInfo[]): PageInfo[] {
  if (pages.length === 0) return pages;

  const headerCounts = new Map<string, number>();
  const footerCounts = new Map<string, number>();
  const pageLines = pages.map((p) => p.text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0));

  pages.forEach((_, idx) => {
    const lines = pageLines[idx];
    if (!lines.length) return;
    lines.slice(0, 2).forEach((h) => { if (h.length > 3) headerCounts.set(h, (headerCounts.get(h) || 0) + 1); });
    lines.slice(-2).forEach((f) => { if (f.length > 3) footerCounts.set(f, (footerCounts.get(f) || 0) + 1); });
  });

  const threshold = Math.max(3, Math.floor(pages.length * 0.05));
  const repeatedHeaders = new Set<string>([...headerCounts.entries()].filter(([, c]) => c >= threshold).map(([t]) => t));
  const repeatedFooters = new Set<string>([...footerCounts.entries()].filter(([, c]) => c >= threshold).map(([t]) => t));

  return pages.map((page, idx) => {
    const lines = pageLines[idx];
    const cleanLines = lines.filter((line, li) => {
      if (/^\d+$/.test(line)) return false;
      if (/^page\s*\d+/i.test(line)) return false;
      if (/^\s*-\s*\d+\s*-\s*$/.test(line)) return false;
      if (li < 3 && repeatedHeaders.has(line)) return false;
      if (li >= lines.length - 3 && repeatedFooters.has(line)) return false;
      return true;
    });
    return { pageNumber: page.pageNumber, text: cleanLines.join('\n') };
  });
}

// ─── Act discovery ────────────────────────────────────────────────────────────

interface ActEntry {
  category: string;
  folder: string;
  actDir: string;
  pdfPath: string;
  extractedPath: string;
  parsedPath: string;
  missingExtracted: boolean;
  missingParsed: boolean;
}

function discoverActs(corpusDir: string): ActEntry[] {
  const entries: ActEntry[] = [];
  for (const cat of fs.readdirSync(corpusDir, { withFileTypes: true })) {
    const catFullPath = path.join(corpusDir, cat.name);
    if (!fs.statSync(catFullPath).isDirectory()) continue;
    const catDir = catFullPath;
    for (const act of fs.readdirSync(catDir, { withFileTypes: true })) {
      const actFullPath = path.join(catDir, act.name);
      if (!fs.statSync(actFullPath).isDirectory()) continue;
      const actDir = actFullPath;
      const files = fs.readdirSync(actDir);
      const pdfFile = files.find((f) => f.toLowerCase().endsWith('.pdf'));
      if (!pdfFile) continue;
      const extractedPath = path.join(actDir, 'extracted-text.json');
      const parsedPath = path.join(actDir, 'parsed-sections.json');
      entries.push({
        category: cat.name,
        folder: act.name,
        actDir,
        pdfPath: path.join(actDir, pdfFile),
        extractedPath,
        parsedPath,
        missingExtracted: !fs.existsSync(extractedPath),
        missingParsed: !fs.existsSync(parsedPath),
      });
    }
  }
  return entries;
}

// ─── Validation result printer ────────────────────────────────────────────────

function printValidation(label: string, meta: LegalDocumentMeta, val: ParserValidationResult): void {
  const ok = (n: number) => n === 0 ? '✓' : `✗ ${n}`;
  console.log(`\n  ╔══ ${label}`);
  console.log(`  ║  Official Name  : ${meta.officialName || meta.actName}`);
  console.log(`  ║  Year           : ${meta.year ?? 'UNKNOWN'}`);
  console.log(`  ║  Total Parts    : ${val.totalParts}`);
  console.log(`  ║  Total Titles   : ${val.totalTitles}`);
  console.log(`  ║  Total Chapters : ${val.totalChapters}`);
  console.log(`  ║  Total Articles : ${val.totalArticles}`);
  console.log(`  ║  Total Sections : ${val.totalSections}`);
  console.log(`  ║  Total Schedules: ${val.totalSchedules}`);
  console.log(`  ║  Total Expls.   : ${val.totalExplanations}`);
  console.log(`  ║  Total Illus.   : ${val.totalIllustrations}`);
  console.log(`  ║  Schedule Items : ${val.totalScheduleItems} (excluded from section count)`);
  console.log(`  ║  Duplicates     : ${ok(val.duplicateProvisions.length)}`);
  console.log(`  ║  Orphan Clauses : ${ok(val.orphanClauses)}`);
  console.log(`  ║  Orphan Expls.  : ${ok(val.orphanExplanations)}`);
  console.log(`  ║  Broken Hier.   : ${ok(val.brokenHierarchy.length)}`);
  if (val.duplicateProvisions.length > 0) {
    console.log(`  ║  ⚠ Duplicates   : ${val.duplicateProvisions.slice(0, 10).join(', ')}`);
  }
  if (val.brokenHierarchy.length > 0) {
    console.log(`  ║  ⚠ Hierarchy    : ${val.brokenHierarchy.slice(0, 5).join(', ')}`);
  }
  console.log(`  ╚${'═'.repeat(60)}`);
}

// ─── Per-act processing ───────────────────────────────────────────────────────

async function processAct(entry: ActEntry): Promise<{
  meta: LegalDocumentMeta;
  val: ParserValidationResult;
  skipped: boolean;
  error?: string;
}> {
  const needsWork = FORCE || entry.missingExtracted || entry.missingParsed;
  if (!needsWork && !VALIDATE_ONLY) {
    // Both JSON files exist and not forcing — validate from existing parsed JSON
    const parsed = JSON.parse(fs.readFileSync(entry.parsedPath, 'utf-8'));
    const structure = Array.isArray(parsed.structure) ? parsed.structure : [];
    const val = validateLegalStructure(structure);
    const yearMatch = (parsed.actName || '').match(/\b(18|19|20)\d{2}\b/);
    const meta: LegalDocumentMeta = {
      actName: parsed.actName || entry.folder,
      category: parsed.category || entry.category,
      officialName: parsed.officialName || parsed.actName,
      year: parsed.year || (yearMatch ? parseInt(yearMatch[0], 10) : undefined),
      totalParts: val.totalParts,
      totalTitles: val.totalTitles,
      totalChapters: val.totalChapters,
      totalArticles: val.totalArticles,
      totalSections: val.totalSections,
      totalSchedules: val.totalSchedules,
      totalExplanations: val.totalExplanations,
      totalIllustrations: val.totalIllustrations,
      duplicates: val.duplicateProvisions.length,
      orphanClauses: val.orphanClauses,
      orphanExplanations: val.orphanExplanations,
      brokenHierarchy: val.brokenHierarchy.length,
    };
    return { meta, val, skipped: true };
  }

  try {
    // ── Extract PDF text ────────────────────────────────────────────────────
    let pages: PageInfo[];
    if (!FORCE && !entry.missingExtracted) {
      const existing = JSON.parse(fs.readFileSync(entry.extractedPath, 'utf-8'));
      pages = existing.pages || [];
      console.log(`  [SKIP extract] Using existing extracted-text.json (${pages.length} pages)`);
    } else {
      console.log(`  [1/3] Extracting PDF: ${path.basename(entry.pdfPath)}`);
      pages = await extractPdfPages(entry.pdfPath);
      pages = cleanHeadersAndFooters(pages);
      console.log(`        → ${pages.length} pages extracted`);
    }

    const firstPageText = pages[0]?.text || '';
    const { officialName, year, shortName } = resolveOfficialName(firstPageText, entry.folder);

    // ── Write extracted-text.json ───────────────────────────────────────────
    if (!VALIDATE_ONLY && (FORCE || entry.missingExtracted)) {
      fs.writeFileSync(entry.extractedPath, JSON.stringify({
        actName: officialName,
        category: entry.category,
        totalPages: pages.length,
        pages,
      }, null, 2), 'utf-8');
      console.log(`  [2/3] Wrote extracted-text.json`);
    }

    // ── Parse legal structure ───────────────────────────────────────────────
    console.log(`  [3/3] Parsing legal structure...`);
    const lines: string[] = [];
    for (const p of pages) {
      for (const l of p.text.split('\n')) {
        const trimmed = l.trim();
        if (trimmed) lines.push(trimmed);
      }
    }

    const docResult = parseLegalDocument(lines, officialName, entry.category, officialName);
    const { meta, structure, validation: val } = docResult;
    meta.officialName = officialName;

    // ── Write parsed-sections.json ──────────────────────────────────────────
    if (!VALIDATE_ONLY && (FORCE || entry.missingParsed)) {
      fs.writeFileSync(entry.parsedPath, JSON.stringify({
        actName: officialName,
        officialName,
        shortName,
        category: entry.category,
        year,
        summary: {
          totalParts: val.totalParts,
          totalTitles: val.totalTitles,
          totalChapters: val.totalChapters,
          totalArticles: val.totalArticles,
          totalSections: val.totalSections,
          totalSchedules: val.totalSchedules,
          totalExplanations: val.totalExplanations,
          totalIllustrations: val.totalIllustrations,
        },
        structure,
      }, null, 2), 'utf-8');
      console.log(`        → Wrote parsed-sections.json`);
    }

    return { meta, val, skipped: false };
  } catch (err: any) {
    return {
      meta: {
        actName: entry.folder,
        category: entry.category,
        totalParts: 0, totalTitles: 0, totalChapters: 0,
        totalArticles: 0, totalSections: 0, totalSchedules: 0,
        totalExplanations: 0, totalIllustrations: 0,
        duplicates: 0, orphanClauses: 0, orphanExplanations: 0, brokenHierarchy: 0,
      },
      val: {
        totalParts: 0, totalTitles: 0, totalChapters: 0,
        totalArticles: 0, totalSections: 0, totalSchedules: 0,
        totalExplanations: 0, totalIllustrations: 0, totalScheduleItems: 0,
        duplicateProvisions: [], orphanClauses: 0, orphanExplanations: 0, brokenHierarchy: [],
      },
      skipped: false,
      error: err.message,
    };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const corpusDir = process.env.CORPUS_DIR
    ? path.resolve(process.env.CORPUS_DIR)
    : path.resolve(__dirname, '../../../corpus-data');

  console.log('═'.repeat(64));
  console.log('  LEGATRIXON — Legal Corpus Extract & Parse');
  console.log(`  Corpus : ${corpusDir}`);
  console.log(`  Mode   : ${VALIDATE_ONLY ? 'VALIDATE ONLY (no writes)' : FORCE ? 'FORCE RE-PARSE' : 'INCREMENTAL (missing only)'}`);
  console.log('═'.repeat(64));

  if (!fs.existsSync(corpusDir)) {
    console.error(`ERROR: Corpus directory not found: ${corpusDir}`);
    process.exit(1);
  }

  const acts = discoverActs(corpusDir);
  console.log(`\nDiscovered ${acts.length} acts across ${new Set(acts.map(a => a.category)).size} categories.\n`);

  const toProcess = FORCE ? acts : acts.filter((a) => a.missingExtracted || a.missingParsed || VALIDATE_ONLY);
  const alreadyComplete = acts.filter((a) => !a.missingExtracted && !a.missingParsed);

  if (!FORCE && !VALIDATE_ONLY) {
    console.log(`${alreadyComplete.length} acts already have both JSON files — skipping.`);
    console.log(`${toProcess.length} acts need processing.\n`);
  }

  // Validation targets (always printed)
  const VALIDATION_TARGETS = [
    'Constitution of India',
    'BNS', 'BNSS', 'bsa',
    'Companies Act',
    'the_code_of_civil_procedure,_1908',
    'the_code_of_criminal_procedure,_1973',
    'Indian Contract Act',
  ];

  const allResults: Array<{ entry: ActEntry; meta: LegalDocumentMeta; val: ParserValidationResult; skipped: boolean; error?: string }> = [];

  // Process acts that need work
  for (const entry of (VALIDATE_ONLY ? acts : toProcess)) {
    const label = `${entry.category} / ${entry.folder}`;
    if (!entry.missingExtracted && !entry.missingParsed && !FORCE) {
      // Skip silently unless it's a validation target or VALIDATE_ONLY
      const isTarget = VALIDATION_TARGETS.some((t) => entry.folder.toLowerCase().includes(t.toLowerCase()));
      if (!VALIDATE_ONLY && !isTarget) {
        // Just validate from file quietly
        const result = await processAct(entry);
        allResults.push({ entry, ...result });
        continue;
      }
    }

    console.log(`\n── ${label}`);
    if (entry.missingExtracted) console.log(`   ⚠ extracted-text.json missing`);
    if (entry.missingParsed)    console.log(`   ⚠ parsed-sections.json missing`);

    const result = await processAct(entry);
    allResults.push({ entry, ...result });

    if (result.error) {
      console.log(`   ✗ ERROR: ${result.error}`);
    } else {
      printValidation(label, result.meta, result.val);
    }
  }

  // ── Final summary ────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(64));
  console.log('  CORPUS HEALTH SUMMARY');
  console.log('═'.repeat(64));

  const processed = allResults.filter((r) => !r.skipped && !r.error);
  const errors    = allResults.filter((r) => r.error);
  let totalSecs = 0, totalArts = 0, totalChaps = 0, totalScheds = 0, totalExpls = 0, totalIllus = 0;
  let totalDups = 0, totalOrphans = 0;

  for (const r of allResults.filter((r) => !r.error)) {
    totalSecs   += r.val.totalSections;
    totalArts   += r.val.totalArticles;
    totalChaps  += r.val.totalChapters;
    totalScheds += r.val.totalSchedules;
    totalExpls  += r.val.totalExplanations;
    totalIllus  += r.val.totalIllustrations;
    totalDups   += r.val.duplicateProvisions.length;
    totalOrphans += r.val.orphanClauses + r.val.orphanExplanations;
  }

  console.log(`\n  Acts discovered       : ${acts.length}`);
  console.log(`  Acts processed        : ${processed.length}`);
  console.log(`  Acts with errors      : ${errors.length}`);
  console.log(`\n  Corpus-wide totals (main body only, schedule items excluded):`);
  console.log(`  ── Total Chapters     : ${totalChaps}`);
  console.log(`  ── Total Articles     : ${totalArts}`);
  console.log(`  ── Total Sections     : ${totalSecs}`);
  console.log(`  ── Total Schedules    : ${totalScheds}`);
  console.log(`  ── Total Explanations : ${totalExpls}`);
  console.log(`  ── Total Illustrations: ${totalIllus}`);
  console.log(`\n  Quality:`);
  console.log(`  ── Duplicate provisions  : ${totalDups   === 0 ? '✓ none' : '✗ ' + totalDups}`);
  console.log(`  ── Orphan clauses/expls  : ${totalOrphans === 0 ? '✓ none' : '✗ ' + totalOrphans}`);

  if (errors.length > 0) {
    console.log('\n  Errors:');
    for (const r of errors) {
      console.log(`  ✗ ${r.entry.folder}: ${r.error}`);
    }
  }

  // Per-act table for validation targets
  console.log('\n  Per-Act Validation (key acts):');
  console.log('  ' + '─'.repeat(90));
  console.log(
    '  ' +
    'Act'.padEnd(42) +
    'Parts'.padStart(6) + 'Chaps'.padStart(6) + 'Arts'.padStart(6) +
    'Secs'.padStart(6) + 'Scheds'.padStart(7) + 'Expls'.padStart(6) + 'Illus'.padStart(6) +
    'Dups'.padStart(6)
  );
  console.log('  ' + '─'.repeat(90));

  for (const r of allResults.filter((r) => !r.error)) {
    const name = (r.meta.officialName || r.meta.actName).slice(0, 40).padEnd(42);
    const v = r.val;
    console.log(
      '  ' + name +
      String(v.totalParts).padStart(6) +
      String(v.totalChapters).padStart(6) +
      String(v.totalArticles).padStart(6) +
      String(v.totalSections).padStart(6) +
      String(v.totalSchedules).padStart(7) +
      String(v.totalExplanations).padStart(6) +
      String(v.totalIllustrations).padStart(6) +
      String(v.duplicateProvisions.length).padStart(6)
    );
  }
  console.log('  ' + '─'.repeat(90));
  console.log('');

  if (errors.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
