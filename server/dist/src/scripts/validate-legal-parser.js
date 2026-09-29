"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const indian_legal_parser_1 = require("../modules/ingestion/indian-legal-parser");
const targets = [
    { label: 'Constitution of India', dir: 'Constitution law/Constitution of India' },
    { label: 'Bharatiya Nyaya Sanhita (BNS)', dir: 'Criminal laws/BNS' },
    { label: 'Bharatiya Nagarik Suraksha Sanhita (BNSS)', dir: 'Criminal laws/BNSS' },
    { label: 'Bharatiya Sakshya Adhiniyam (BSA)', dir: 'Criminal laws/bsa' },
    { label: 'Companies Act', dir: 'Contract & Commercial/Companies Act' },
    { label: 'Code of Civil Procedure', dir: 'Civil laws/the_code_of_civil_procedure,_1908' },
    { label: 'Code of Criminal Procedure', dir: 'Criminal laws/the_code_of_criminal_procedure,_1973' },
    { label: 'Indian Contract Act', dir: 'Contract & Commercial/Indian Contract Act' },
];
function corpusRoot() {
    return path.resolve(process.cwd(), 'corpus-data');
}
function getPdfPath(dir) {
    const fullDir = path.join(corpusRoot(), dir);
    if (!fs.existsSync(fullDir))
        return null;
    const pdf = fs.readdirSync(fullDir).find((file) => file.toLowerCase().endsWith('.pdf'));
    return pdf ? path.join(fullDir, pdf) : null;
}
async function readTargetText(dir) {
    const extractedPath = path.join(corpusRoot(), dir, 'extracted-text.json');
    if (fs.existsSync(extractedPath)) {
        const parsed = JSON.parse(fs.readFileSync(extractedPath, 'utf8'));
        return (parsed.pages || []).map((page) => page.text || '').join('\n');
    }
    const pdfPath = getPdfPath(dir);
    if (!pdfPath)
        throw new Error(`No PDF found for ${dir}`);
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(fs.readFileSync(pdfPath));
    return data.text || '';
}
function toLines(text) {
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}
async function main() {
    console.log('LEGATRIXON legal parser validation');
    console.log(`Corpus: ${corpusRoot()}`);
    console.log('');
    for (const target of targets) {
        try {
            const text = await readTargetText(target.dir);
            const structure = (0, indian_legal_parser_1.parseLegalStructure)(toLines(text));
            const provisions = (0, indian_legal_parser_1.flattenProvisions)(structure);
            const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
            const missingProvisionCount = provisions.length === 0 ? 1 : 0;
            console.log(target.label);
            console.log(`  Total Parts: ${validation.totalParts}`);
            console.log(`  Total Chapters: ${validation.totalChapters}`);
            console.log(`  Total Articles: ${validation.totalArticles}`);
            console.log(`  Total Sections: ${validation.totalSections}`);
            console.log(`  Total Schedules: ${validation.totalSchedules}`);
            console.log(`  Total Explanations: ${validation.totalExplanations}`);
            console.log(`  Total Illustrations: ${validation.totalIllustrations}`);
            console.log(`  Logical Provisions: ${provisions.length}`);
            console.log(`  Duplicate Provisions: ${validation.duplicateProvisions.length}`);
            console.log(`  Orphan Clauses: ${validation.orphanClauses}`);
            console.log(`  Orphan Explanations: ${validation.orphanExplanations}`);
            console.log(`  Broken Hierarchy: ${validation.brokenHierarchy.length}`);
            console.log(`  Missing Provision Parse: ${missingProvisionCount}`);
            if (validation.duplicateProvisions.length) {
                console.log(`  Manual Review Duplicates: ${validation.duplicateProvisions.slice(0, 10).join(', ')}`);
            }
            console.log('');
        }
        catch (error) {
            console.log(target.label);
            console.log(`  ERROR: ${error.message}`);
            console.log('');
        }
    }
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=validate-legal-parser.js.map