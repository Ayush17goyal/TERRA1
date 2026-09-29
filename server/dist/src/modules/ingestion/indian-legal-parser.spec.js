"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const indian_legal_parser_1 = require("./indian-legal-parser");
function parseFixture(lines) {
    return (0, indian_legal_parser_1.parseLegalStructure)([
        'THE TEST ACT, 2026',
        'Be it enacted by Parliament as follows:',
        ...lines,
    ]);
}
function constitutionFixture(lines) {
    return (0, indian_legal_parser_1.parseLegalStructure)([
        'THE CONSTITUTION OF INDIA',
        'WE, THE PEOPLE OF INDIA, having solemnly resolved to constitute India',
        ...lines,
    ]);
}
describe('Indian legal parser — core provision integrity', () => {
    it('one statutory section = one logical provision with all children attached', () => {
        const structure = parseFixture([
            'CHAPTER II',
            'OFFENCES',
            '63. Punishment for test offence.- Whoever does the act shall be punished.',
            '(1) The offence contains a first ingredient.',
            '(a) the first clause remains attached;',
            '(i) the first sub-clause remains attached;',
            'Provided that the court may record reasons.',
            'Explanation.- For this section, court means competent court.',
            'Illustration A. A does the prohibited act.',
        ]);
        const provisions = (0, indian_legal_parser_1.flattenProvisions)(structure);
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
        expect(provisions).toHaveLength(1);
        expect(provisions[0].section).toBe('63');
        expect(provisions[0].content).toContain('(1)');
        expect(provisions[0].content).toContain('(a)');
        expect(provisions[0].content).toContain('Explanation');
        expect(provisions[0].content).toContain('Illustration');
        expect(validation.duplicateProvisions).toEqual([]);
        expect(validation.orphanClauses).toBe(0);
        expect(validation.orphanExplanations).toBe(0);
    });
    it('merges duplicate provision headings into one logical object', () => {
        const structure = parseFixture([
            '1. Short title.- This Act may be called the Test Act.',
            '1. Duplicate heading.- This repeated source line should not create a competing record.',
        ]);
        const provisions = (0, indian_legal_parser_1.flattenProvisions)(structure);
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
        expect(provisions).toHaveLength(1);
        expect(validation.duplicateProvisions).toEqual([]);
    });
    it('does not create orphan clauses when a provision exists', () => {
        const structure = parseFixture([
            '10. Definitions.- In this Act,',
            '(a) "person" means a natural person;',
            '(b) "court" means any court of law;',
        ]);
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
        expect(validation.orphanClauses).toBe(0);
        expect(validation.brokenHierarchy).toHaveLength(0);
    });
    it('handles [Omitted] provisions without creating orphan children', () => {
        const structure = parseFixture([
            '13. [Omitted by Act 5 of 1994.]',
            '14. Subsequent valid section.- This Act applies.',
        ]);
        const provisions = (0, indian_legal_parser_1.flattenProvisions)(structure);
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
        expect(validation.totalSections).toBe(2);
        expect(validation.duplicateProvisions).toEqual([]);
        expect(validation.orphanClauses).toBe(0);
        expect(provisions.some((p) => p.section === '14')).toBe(true);
    });
});
describe('Indian legal parser — Constitution of India', () => {
    it('parses articles under Parts without treating children as separate records', () => {
        const structure = constitutionFixture([
            'PART III',
            'FUNDAMENTAL RIGHTS',
            'Article 21. Protection of life and personal liberty',
            'No person shall be deprived of his life or personal liberty except according to procedure established by law.',
            'Article 22. Protection against arrest and detention in certain cases',
            '(1) No person who is arrested shall be detained in custody without being informed.',
        ]);
        const provisions = (0, indian_legal_parser_1.flattenProvisions)(structure);
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
        expect(validation.totalParts).toBe(1);
        expect(validation.totalArticles).toBe(2);
        expect(validation.totalSections).toBe(0);
        expect(provisions.map((p) => p.article)).toEqual(['21', '22']);
        expect(provisions).toHaveLength(2);
        expect(validation.duplicateProvisions).toEqual([]);
    });
    it('parses numeric-only article lines as articles when Constitution text is detected', () => {
        const structure = constitutionFixture([
            'PART I',
            'THE UNION AND ITS TERRITORY',
            '1. Name and territory of the Union.- India, that is Bharat, shall be a Union of States.',
            '2. Admission or establishment of new States.',
        ]);
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
        expect(validation.totalArticles).toBe(2);
        expect(validation.totalSections).toBe(0);
    });
});
describe('Indian legal parser — structural hierarchy', () => {
    it('supports Titles, Chapters, Parts all in the same document', () => {
        const structure = parseFixture([
            'TITLE I',
            'GENERAL PRINCIPLES',
            'CHAPTER I',
            'PRELIMINARY',
            '2. Definitions.- In this Act, unless the context otherwise requires,',
            '(a) company means a company incorporated under this Act;',
            'Exception.- This clause shall not apply to exempted bodies.',
            '1. Subs. by Act 10 of 2020, s. 2.',
            '[Omitted by Act 11 of 2021.]',
            'Table',
            'Column 1 Column 2',
            'THE FIRST SCHEDULE',
            'Forms',
        ]);
        const provisions = (0, indian_legal_parser_1.flattenProvisions)(structure);
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
        expect(validation.totalTitles).toBe(1);
        expect(validation.totalChapters).toBe(1);
        expect(validation.totalSchedules).toBe(1);
        expect(provisions.some((p) => p.section === '2')).toBe(true);
        expect(provisions.some((p) => /SCHEDULE/i.test(p.part || ''))).toBe(true);
        expect(validation.orphanClauses).toBe(0);
    });
    it('supports Parts without Chapters — sections attach directly to Part', () => {
        const structure = parseFixture([
            'PART I',
            'PRELIMINARY',
            '1. Short title.- This Act may be called the Test Act, 2026.',
            '2. Definitions.',
            'PART II',
            'MAIN PROVISIONS',
            '3. General rule.',
        ]);
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
        expect(validation.totalParts).toBe(2);
        expect(validation.totalSections).toBe(3);
        expect(validation.orphanClauses).toBe(0);
    });
    it('correctly counts schedules without inflating totalSections', () => {
        const structure = parseFixture([
            '1. Short title.- This Act.',
            '2. Application.- Applies throughout India.',
            'THE FIRST SCHEDULE',
            '1. Rule about something.',
            '2. Another rule.',
            '3. Final rule.',
            'THE SECOND SCHEDULE',
            'Forms and procedures.',
        ]);
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
        expect(validation.totalSections).toBe(2);
        expect(validation.totalSchedules).toBe(2);
        expect(validation.totalScheduleItems).toBeGreaterThanOrEqual(3);
    });
});
describe('Indian legal parser — provisos and explanations', () => {
    it('attaches "Provided that" provisos to the nearest provision parent', () => {
        const structure = parseFixture([
            '20. Liability.- Every person shall be liable.',
            '(1) The primary liability is absolute.',
            'Provided that the court may grant relief.',
            'Provided further that no relief shall be granted after one year.',
            'Provided also that the government may extend the period.',
        ]);
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
        expect(validation.totalSections).toBe(1);
        expect(validation.orphanClauses).toBe(0);
        const provisions = (0, indian_legal_parser_1.flattenProvisions)(structure);
        const text = provisions[0].content;
        expect(text).toContain('Provided that');
        expect(text).toContain('Provided further that');
        expect(text).toContain('Provided also that');
    });
    it('attaches numbered Explanations as children of the section', () => {
        const structure = parseFixture([
            '302. Punishment for murder.- Whoever commits murder shall be punished with death.',
            'Explanation 1.- A person is said to commit murder if...',
            'Explanation 2.- For the purposes of this section, child means...',
        ]);
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
        expect(validation.totalExplanations).toBe(2);
        expect(validation.orphanExplanations).toBe(0);
    });
    it('attaches Illustrations as children of the section', () => {
        const structure = parseFixture([
            '415. Cheating.- Whoever by deceiving any person.',
            '(a) fraudulently or dishonestly induces the person so deceived.',
            'Illustration A. A, by falsely pretending to be in Government service.',
            'Illustration B. A intentionally deceives Z.',
        ]);
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
        expect(validation.totalIllustrations).toBe(2);
        expect(validation.totalSections).toBe(1);
    });
});
describe('Indian legal parser — TOC and pre-body filtering', () => {
    it('ignores table-of-contents lines before the enacting formula', () => {
        const structure = (0, indian_legal_parser_1.parseLegalStructure)([
            'THE BHARATIYA NYAYA SANHITA, 2023',
            'ARRANGEMENT OF SECTIONS',
            'CHAPTER I',
            'PRELIMINARY',
            '1. Short title, commencement and application.',
            '2. Definitions.',
            '63. Punishment for murder.',
            'BE IT ENACTED by Parliament in the Seventy-fourth Year of the Republic of India as follows:—',
            'CHAPTER I',
            'PRELIMINARY',
            '1. Short title, commencement and application.— (1) This Act may be called the Bharatiya Nyaya Sanhita, 2023.',
            '2. Definitions.- In this Act, unless the context otherwise requires,',
        ]);
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
        expect(validation.totalSections).toBe(2);
        expect(validation.totalChapters).toBe(1);
        expect(validation.duplicateProvisions).toEqual([]);
    });
    it('handles acts starting with "BE IT ENACTED" without prior TOC', () => {
        const structure = (0, indian_legal_parser_1.parseLegalStructure)([
            'DIGITAL PERSONAL DATA PROTECTION ACT, 2023',
            'BE IT ENACTED by Parliament in the Seventy-fourth Year of the Republic of India as follows:—',
            'CHAPTER I',
            'PRELIMINARY',
            '1. Short title and commencement.- (1) This Act may be called the Digital Personal Data Protection Act, 2023.',
        ]);
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
        expect(validation.totalSections).toBe(1);
        expect(validation.totalChapters).toBe(1);
    });
});
describe('Indian legal parser — validation accuracy', () => {
    it('reports no duplicates in a clean sequential structure', () => {
        const structure = parseFixture([
            'CHAPTER I',
            'PRELIMINARY',
            '1. Short title.- This Act.',
            '2. Definitions.- In this Act.',
            '3. Application.- Applies to all persons.',
            'CHAPTER II',
            'OFFENCES',
            '4. General offence.- Whoever does this.',
            '5. Aggravated offence.- Whoever does that.',
        ]);
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
        expect(validation.duplicateProvisions).toEqual([]);
        expect(validation.totalSections).toBe(5);
        expect(validation.totalChapters).toBe(2);
        expect(validation.orphanClauses).toBe(0);
        expect(validation.brokenHierarchy).toHaveLength(0);
    });
    it('detects duplicate provision keys when two section nodes share the same number', () => {
        const dupStructure = [
            { type: 'section', number: '10', title: 'First', content: 'First content.', children: [] },
            { type: 'section', number: '11', title: 'Second', content: 'Second content.', children: [] },
            { type: 'section', number: '10', title: 'Duplicate', content: 'Duplicate content.', children: [] },
        ];
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(dupStructure);
        expect(validation.duplicateProvisions).toContain('section:10');
        expect(validation.duplicateProvisions).not.toContain('section:11');
    });
});
describe('parseLegalDocument — metadata extraction', () => {
    it('extracts year from act name', () => {
        const lines = [
            'THE COMPANIES ACT, 2013',
            'Be it enacted by Parliament as follows:',
            'CHAPTER I',
            'PRELIMINARY',
            '1. Short title.- This Act may be called the Companies Act, 2013.',
        ];
        const result = (0, indian_legal_parser_1.parseLegalDocument)(lines, 'Companies Act, 2013', 'Contract & Commercial', 'Companies Act, 2013');
        expect(result.meta.year).toBe(2013);
        expect(result.meta.actName).toBe('Companies Act, 2013');
        expect(result.meta.totalSections).toBe(1);
        expect(result.meta.totalChapters).toBe(1);
        expect(result.validation.duplicateProvisions).toEqual([]);
    });
    it('returns zero counts for an empty/unrecognized document', () => {
        const result = (0, indian_legal_parser_1.parseLegalDocument)(['Random document without any legal structure.'], 'Unknown Act', 'Unknown');
        expect(result.meta.totalSections).toBe(0);
        expect(result.meta.totalArticles).toBe(0);
        expect(result.meta.totalChapters).toBe(0);
    });
});
describe('Indian legal parser — BNS style (new criminal codes)', () => {
    it('parses BNS-style sections with explanations and exceptions', () => {
        const structure = (0, indian_legal_parser_1.parseLegalStructure)([
            'BHARATIYA NYAYA SANHITA, 2023',
            'BE IT ENACTED by Parliament in the Seventy-fourth Year of the Republic of India as follows:—',
            'CHAPTER I',
            'PRELIMINARY',
            '1. Short title, commencement and application.—(1) This Act may be called the Bharatiya Nyaya Sanhita, 2023.',
            '(2) It shall come into force on such date as the Central Government may appoint.',
            'CHAPTER VI',
            'OFFENCES AFFECTING THE HUMAN BODY',
            '100. Right of private defence of body and of property.- The right of private defence of the body extends.',
            'Exception.- This section does not extend to the inflicting of more harm than it is necessary.',
            '101. When the right of private defence of the body extends to causing death.',
            '(a) such an assault as may reasonably cause the apprehension that death will otherwise be the consequence;',
            'Explanation.- In this section, the expression "assault" includes an attempt to commit assault.',
        ]);
        const provisions = (0, indian_legal_parser_1.flattenProvisions)(structure);
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
        expect(validation.totalSections).toBeGreaterThanOrEqual(3);
        expect(validation.totalChapters).toBe(2);
        expect(validation.totalExplanations).toBe(1);
        expect(validation.orphanClauses).toBe(0);
        expect(validation.orphanExplanations).toBe(0);
        expect(validation.duplicateProvisions).toEqual([]);
    });
    it('does not create orphan nodes for provisions without a chapter', () => {
        const structure = (0, indian_legal_parser_1.parseLegalStructure)([
            'BHARATIYA SAKSHYA ADHINIYAM, 2023',
            'BE IT ENACTED by Parliament as follows:—',
            '1. Short title, extent and commencement.—(1) This Act may be called the Bharatiya Sakshya Adhiniyam, 2023.',
            '2. Definitions.- In this Act, unless the context otherwise requires,',
            '(a) "court" includes all Judges and Magistrates;',
            '(b) "document" means any matter expressed or described;',
        ]);
        const validation = (0, indian_legal_parser_1.validateLegalStructure)(structure);
        expect(validation.orphanClauses).toBe(0);
        expect(validation.orphanExplanations).toBe(0);
        expect(validation.brokenHierarchy).toHaveLength(0);
    });
});
//# sourceMappingURL=indian-legal-parser.spec.js.map