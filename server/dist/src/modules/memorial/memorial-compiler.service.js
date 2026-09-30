"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorialCompilerService = void 0;
const common_1 = require("@nestjs/common");
let MemorialCompilerService = class MemorialCompilerService {
    compile(side, blueprint, graph, issues, authorities, args) {
        const usedAuthorities = this.usedAuthorities(args, authorities);
        const abbreviations = this.abbreviationRows(usedAuthorities, blueprint);
        const authorityGroups = this.authorityGroups(usedAuthorities);
        const jurisdictionParagraphs = this.jurisdictionParagraphs(blueprint, graph, side);
        const factParagraphs = this.factParagraphs(blueprint, side);
        const summaries = this.summaryRows(args, issues, side);
        const prayerParagraphs = this.prayerParagraphs(side, blueprint, issues);
        const renderModel = {
            metadata: {
                competitionName: blueprint.caseMetadata.competitionName || 'MOOT COURT COMPETITION',
                court: blueprint.caseMetadata.court || "THE HON'BLE COURT",
                jurisdictionLine: blueprint.caseMetadata.jurisdiction || blueprint.caseMetadata.jurisdictionProvision || 'APPROPRIATE JURISDICTION',
                caseNumber: blueprint.caseMetadata.caseNumber || '',
                petitionerName: blueprint.caseMetadata.petitionerName || 'THE PETITIONER',
                respondentName: blueprint.caseMetadata.respondentName || 'THE RESPONDENT',
                petitionerLabel: blueprint.caseMetadata.petitionerLabel || 'PETITIONER',
                respondentLabel: blueprint.caseMetadata.respondentLabel || 'RESPONDENT',
                teamCode: blueprint.caseMetadata.teamCode || '',
                side,
                coverColor: side === 'petitioner'
                    ? (blueprint.competitionRules.petitionerCoverColor || 'blue')
                    : (blueprint.competitionRules.respondentCoverColor || 'red'),
            },
            abbreviations,
            authorityGroups,
            jurisdictionParagraphs,
            factParagraphs,
            issues: issues.map((issue, index) => ({
                id: issue.id,
                label: `ISSUE ${this.roman(index + 1)}`,
                text: issue.issue,
                subIssues: issue.subIssues,
            })),
            summaries,
            arguments: args.map((argument, issueIndex) => ({
                issueId: argument.issueId,
                heading: `${this.roman(issueIndex + 1)}. ${issues[issueIndex]?.issue || argument.issueId}`,
                thesis: this.ensurePeriod(argument.thesis),
                roadmap: this.ensurePeriod(argument.roadmap),
                subArguments: argument.subArguments.map((sub, subIndex) => ({
                    label: `${this.roman(issueIndex + 1)}.${String.fromCharCode(65 + subIndex)}`,
                    heading: sub.heading.toUpperCase(),
                    paragraphs: this.subArgumentParagraphs(sub, usedAuthorities),
                    authorityIds: sub.authorityIds,
                })),
                concludingParagraphs: [
                    argument.counterArgument ? `The opposing side principally contends that ${this.lowerFirst(this.ensurePeriod(argument.counterArgument))}` : '',
                    argument.rebuttal ? `That submission is answered because ${this.lowerFirst(this.ensurePeriod(argument.rebuttal))}` : '',
                    this.ensurePeriod(argument.conclusion),
                ].filter(Boolean),
            })),
            authorities: usedAuthorities,
            prayerParagraphs,
        };
        const sections = {
            cover: this.cover(renderModel),
            tableOfContents: this.toc(renderModel),
            abbreviations: abbreviations.map((row) => `${row.abbreviation}\t${row.fullForm}`).join('\n'),
            indexOfAuthorities: authorityGroups.map((group) => `${group.title}\n${group.entries.map((entry, index) => `${index + 1}. ${entry.citation}${entry.pinpoint ? `, ${entry.pinpoint}` : ''}`).join('\n') || 'N/A'}`).join('\n\n'),
            jurisdiction: jurisdictionParagraphs.join('\n\n'),
            statementOfFacts: factParagraphs.join('\n\n'),
            issuesRaised: renderModel.issues.map((issue) => `${issue.label}: ${issue.text}`).join('\n\n'),
            summaryOfArguments: summaries.map((summary) => `${summary.heading}\n${summary.paragraphs.join('\n\n')}`).join('\n\n'),
            argumentsAdvanced: renderModel.arguments.map((argument) => [
                argument.heading,
                argument.thesis,
                argument.roadmap,
                ...argument.subArguments.flatMap((sub) => [`${sub.label} ${sub.heading}`, ...sub.paragraphs]),
                ...argument.concludingParagraphs,
            ].join('\n\n')).join('\n\n'),
            prayer: prayerParagraphs.join('\n'),
        };
        return { sections, renderModel, markdown: this.renderMarkdown(sections) };
    }
    cover(model) {
        const meta = model.metadata;
        return [
            `COVER COLOUR: ${meta.coverColor.toUpperCase()}`,
            meta.teamCode ? `TEAM CODE: ${meta.teamCode}` : 'TEAM CODE: ______',
            meta.competitionName,
            'BEFORE',
            meta.court,
            meta.jurisdictionLine,
            meta.caseNumber,
            'IN THE MATTER OF:',
            `${meta.petitionerName} ........................................................ ${meta.petitionerLabel}`,
            'VERSUS',
            `${meta.respondentName} ........................................................ ${meta.respondentLabel}`,
            `ON SUBMISSION BEFORE ${meta.court}`,
            `WRITTEN SUBMISSION ON BEHALF OF THE ${model.metadata.side === 'petitioner' ? 'PETITIONER' : 'RESPONDENT'}`,
        ].filter(Boolean).join('\n\n');
    }
    toc(model) {
        const issueRows = model.issues.flatMap((issue) => [
            `${issue.label}: ${this.short(issue.text, 105)} ........................................ [computed on export]`,
            ...issue.subIssues.map((subIssue, index) => `${issue.label.replace('ISSUE ', '')}.${String.fromCharCode(65 + index)} ${this.short(subIssue.toUpperCase(), 95)} ........................ [computed on export]`),
        ]);
        return [
            'Table of Abbreviations ............................................................ [computed on export]',
            'Index of Authorities .............................................................. [computed on export]',
            'Statement of Jurisdiction .......................................................... [computed on export]',
            'Statement of Facts ................................................................. [computed on export]',
            'Issues for Consideration ........................................................... [computed on export]',
            'Summary of Arguments ............................................................... [computed on export]',
            'Advance Arguments .................................................................. [computed on export]',
            ...issueRows,
            'Prayer .............................................................................. [computed on export]',
        ].join('\n');
    }
    jurisdictionParagraphs(blueprint, graph, side) {
        const meta = blueprint.caseMetadata;
        const provision = meta.jurisdictionProvision || meta.jurisdiction || 'the applicable constitutional provision';
        const appellate = /136|appellate|special leave/i.test(`${provision} ${meta.proceduralStage}`);
        const procedural = this.bestProceduralFacts(blueprint.facts);
        if (side === 'petitioner') {
            return [
                `The Petitioner respectfully invokes the ${appellate ? 'extraordinary appellate' : 'constitutional'} jurisdiction of this Hon'ble Court under ${provision}.`,
                appellate
                    ? 'The questions presented concern the legal admissibility of electronic evidence, the territorial reach of cyber jurisdiction, the constitutional limits of digital search, and the sustainability of the conviction and sentence. Each alleged error goes to the legal foundation of the impugned judgment rather than to a mere request for re-appreciation of facts.'
                    : 'The petition raises substantial questions concerning the enforcement of fundamental rights and the legality of the impugned State action.',
                procedural.length
                    ? `The proposition records that ${this.lowerFirst(procedural.join(' '))} The Petitioner therefore submits that the threshold for this Hon'ble Court's intervention is satisfied.`
                    : 'The Petitioner therefore submits that this Hon\'ble Court is competent to entertain the matter and grant the reliefs prayed for.',
            ];
        }
        const appellateBurden = graph.burdens.find((burden) => /article 136|appellant|appellate/i.test(burden));
        return [
            `The Respondent submits to the jurisdiction of this Hon'ble Court under ${provision}, subject to the strict threshold governing its exercise.`,
            appellate
                ? (appellateBurden || 'Article 136 is extraordinary and discretionary; it is not intended to operate as a routine third appeal on facts. Interference requires a substantial legal error, perversity, grave miscarriage of justice, or constitutional infirmity.')
                : 'The party invoking constitutional jurisdiction must establish the pleaded infringement and the legal basis for the relief sought.',
            procedural.length
                ? `The proposition records that ${this.lowerFirst(procedural.join(' '))} In the absence of a demonstrated foundational error, the concurrent findings ought to be sustained.`
                : 'In the absence of a demonstrated legal or constitutional error warranting interference, the impugned action ought to be sustained.',
        ];
    }
    factParagraphs(blueprint, side) {
        const facts = this.dedupeFacts(blueprint.facts
            .filter((fact) => fact.materiality !== 'low' && fact.kind !== 'relief' && !this.isJunk(fact.text) && this.isUsableFact(fact)));
        if (!facts.length) {
            return ['The uploaded document did not yield a sufficiently reliable statement of material facts. The system has declined to invent a factual narrative.'];
        }
        const groups = [
            { regex: /aged|student|technician|republic|state|matrimonial|introduced|alliance|private account|social media/i, facts: [] },
            { regex: /message|phone number|threat|call|escort|fake|impersonat|morphed|obscene|circulat|disclosed|harass|ostrac/i, facts: [] },
            { regex: /foreign|server|intermediary|service provider|section 75|southeast asia|europe|jurisdiction/i, facts: [] },
            { regex: /complaint|cyber crime|warrant|search|seiz|laptop|mobile|storage|forensic|deleted|browser|certificate|data minim/i, facts: [] },
            { regex: /trial court|high court|supreme court|convict|sentence|appeal|judgment|aggrieved|petition/i, facts: [] },
        ];
        const ungrouped = [];
        for (const fact of facts) {
            const group = groups.find((candidate) => candidate.regex.test(fact.text));
            (group ? group.facts : ungrouped).push(fact);
        }
        if (ungrouped.length)
            groups[0].facts.unshift(...ungrouped);
        const paragraphs = groups
            .map((group) => this.composeFactParagraph(group.facts, side))
            .filter((paragraph) => paragraph.length > 50);
        return paragraphs.slice(0, 8);
    }
    composeFactParagraph(facts, side) {
        const unique = this.dedupeText(facts.map((fact) => this.qualifyFact(fact, side))).slice(0, 8);
        return unique.join(' ');
    }
    qualifyFact(fact, side) {
        const text = this.ensurePeriod(this.cleanFact(fact.text));
        if (fact.status === 'finding')
            return text;
        if (fact.status === 'alleged' || fact.status === 'disputed') {
            if (/^(?:the prosecution|the complainant|the accused|the petitioner|the respondent)/i.test(text))
                return text;
            return side === 'petitioner'
                ? `The prosecution alleges that ${this.lowerFirst(text)}`
                : `The record alleges that ${this.lowerFirst(text)}`;
        }
        return text;
    }
    summaryRows(args, issues, side) {
        return args.map((argument, index) => {
            const issue = issues[index];
            const paragraphOne = this.ensurePeriod(argument.thesis);
            const subArgumentSummary = argument.subArguments.slice(0, 5).map((sub) => {
                const keyAnalysis = sub.analysis.find((paragraph) => paragraph.length > 120) || sub.rule;
                return `${sub.heading}: ${this.ensurePeriod(keyAnalysis)}`;
            }).join(' ');
            const paragraphTwo = this.ensurePeriod(subArgumentSummary);
            const paragraphThree = argument.rebuttal
                ? `The ${side === 'petitioner' ? 'Petitioner' : 'Respondent'} further submits that ${this.lowerFirst(this.ensurePeriod(argument.rebuttal))}`
                : this.ensurePeriod(argument.conclusion);
            return {
                issueId: argument.issueId,
                heading: `ISSUE ${this.roman(index + 1)}: ${issue?.issue || argument.issueId}`,
                paragraphs: [paragraphOne, paragraphTwo, paragraphThree, this.ensurePeriod(argument.conclusion)]
                    .filter((paragraph, paragraphIndex, array) => paragraph && array.indexOf(paragraph) === paragraphIndex),
            };
        });
    }
    subArgumentParagraphs(sub, authorities) {
        const authorityById = new Map(authorities.map((authority) => [authority.id, authority]));
        const cited = sub.authorityIds.map((id) => authorityById.get(id)).filter(Boolean);
        const ruleParagraph = [
            this.ensurePeriod(sub.rule),
            cited.length ? `The proposition is supported by ${cited.map((authority) => authority.citation).join('; ')}.` : '',
        ].filter(Boolean).join(' ');
        return [
            this.ensurePeriod(sub.claim),
            ruleParagraph,
            ...sub.analysis.map((paragraph) => this.ensurePeriod(paragraph)),
            sub.counterArgument ? `The opposing side may contend that ${this.lowerFirst(this.ensurePeriod(sub.counterArgument))}` : '',
            sub.rebuttal ? `That contention fails because ${this.lowerFirst(this.ensurePeriod(sub.rebuttal))}` : '',
            this.ensurePeriod(sub.miniConclusion),
        ].filter(Boolean);
    }
    prayerParagraphs(side, blueprint, issues) {
        const issueLabels = issues.map((_, index) => this.roman(index + 1));
        const propositionReliefs = blueprint.reliefs
            .filter((relief) => relief.side === side || relief.side === 'neutral')
            .map((relief) => this.cleanFact(relief.text))
            .filter((relief) => !this.isJunk(relief))
            .slice(0, 5);
        const opening = `WHEREFORE, in light of the facts stated, issues raised, authorities cited, and arguments advanced, the ${side === 'petitioner' ? 'Petitioner' : 'Respondent'} most respectfully prays that this Hon'ble Court may be pleased to:`;
        const defaults = side === 'petitioner'
            ? [
                'Allow the present petition or appeal;',
                'Set aside the impugned judgment and the findings founded upon inadmissible electronic evidence;',
                'Hold that jurisdiction over cross-border cyber material must satisfy the statutory nexus and lawful process identified in the written submissions;',
                'Grant appropriate relief for any search or forensic examination found inconsistent with Article 21 and due process;',
                'Set aside or suitably modify the conviction and sentence to the extent required by the findings on Issues I to IV;',
            ]
            : [
                'Dismiss the present petition or appeal as devoid of merit;',
                'Uphold the admission and reliance upon the electronic evidence challenged under Issue I;',
                'Affirm the jurisdiction of the courts in Indica over the conduct and consequences challenged under Issue II;',
                'Hold that the search, seizure, and forensic examination were lawful and constitutionally proportionate;',
                'Affirm the conviction and sentence recorded by the courts below;',
            ];
        const reliefs = propositionReliefs.length ? propositionReliefs.map((relief) => this.ensureSemicolon(relief)) : defaults;
        return [
            opening,
            ...reliefs.map((relief, index) => `${index + 1}. ${this.ensureSemicolon(relief)}`),
            `${reliefs.length + 1}. Pass any other order that this Hon'ble Court may deem fit in the interests of justice;`,
            '',
            `AND FOR THIS ACT OF KINDNESS, THE ${side === 'petitioner' ? 'PETITIONER' : 'RESPONDENT'} SHALL, AS IN DUTY BOUND, EVER PRAY.`,
        ];
    }
    abbreviationRows(authorities, blueprint) {
        const candidates = new Map([
            ['§', 'Section'], ['¶', 'Paragraph'], ['&', 'And'], ['Art.', 'Article'], ['Cl.', 'Clause'],
            ['Const.', 'Constitution'], ['e.g.', 'For example'], ['Ed.', 'Edition'], ['Govt.', 'Government'],
            ['HC', 'High Court'], ["Hon'ble", 'Honourable'], ['i.e.', 'That is'], ['No.', 'Number'], ['Ors.', 'Others'],
            ['p.', 'Page'], ['para.', 'Paragraph'], ['paras.', 'Paragraphs'], ['pp.', 'Pages'], ['r/w', 'Read with'],
            ['SC', 'Supreme Court'], ['SCC', 'Supreme Court Cases'], ['SCR', 'Supreme Court Reports'], ['Sec.', 'Section'],
            ['u/s', 'Under Section'], ['UOI', 'Union of India'], ['v.', 'Versus'], ['Vol.', 'Volume'],
            ['BNS', 'Bharatiya Nyaya Sanhita, 2023'], ['BSA', 'Bharatiya Sakshya Adhiniyam, 2023'],
            ['BNSS', 'Bharatiya Nagarik Suraksha Sanhita, 2023'], ['DPDP Act', 'Digital Personal Data Protection Act, 2023'],
            ['IT Act', 'Information Technology Act, 2000'], ['MLAT', 'Mutual Legal Assistance Treaty'],
        ]);
        const corpus = [
            ...authorities.map((authority) => authority.citation),
            ...blueprint.lawsMentioned.map((law) => law.citation),
            blueprint.caseMetadata.court,
        ].join(' ').toLowerCase();
        return Array.from(candidates.entries())
            .filter(([abbreviation, fullForm]) => ['§', '¶', '&', 'Art.', 'Cl.', 'No.', 'p.', 'para.', 'pp.', 'r/w', 'Sec.', 'u/s', 'v.'].includes(abbreviation)
            || corpus.includes(abbreviation.replace('.', '').toLowerCase())
            || corpus.includes(fullForm.toLowerCase().split(',')[0]))
            .map(([abbreviation, fullForm]) => ({ abbreviation, fullForm }));
    }
    authorityGroups(authorities) {
        const groups = [
            { title: 'I. CASES', types: ['case'] },
            { title: 'II. CONSTITUTIONAL PROVISIONS AND STATUTES', types: ['constitution', 'statute'] },
            { title: 'III. BOOKS, REPORTS, ARTICLES AND OTHER AUTHORITIES', types: ['report', 'book', 'article', 'web'] },
        ];
        return groups.map((group) => ({
            title: group.title,
            entries: authorities
                .filter((authority) => group.types.includes(authority.type))
                .map((authority) => ({ citation: authority.citation, pinpoint: authority.pinpoint })),
        })).filter((group) => group.entries.length);
    }
    bestProceduralFacts(facts) {
        return this.dedupeText(facts
            .filter((fact) => fact.kind === 'procedural' || fact.kind === 'finding')
            .map((fact) => this.ensurePeriod(this.cleanFact(fact.text))))
            .sort((a, b) => this.proceduralOrder(a) - this.proceduralOrder(b))
            .slice(0, 4);
    }
    usedAuthorities(args, authorities) {
        const usedIds = new Set(args.flatMap((argument) => [
            ...argument.authorities.map((authority) => authority.id),
            ...argument.subArguments.flatMap((sub) => sub.authorityIds),
        ]));
        const used = authorities.filter((authority) => usedIds.has(authority.id));
        return this.dedupeAuthorities((used.length ? used : authorities).filter((authority) => this.validAuthority(authority)));
    }
    validAuthority(authority) {
        return authority.verified
            && authority.citation.length < 190
            && !/accused|complainant|alleged|matrimonial|obtained|misused|personal data/i.test(authority.citation);
    }
    renderMarkdown(sections) {
        const labels = {
            cover: 'COVER PAGE',
            tableOfContents: 'TABLE OF CONTENTS',
            abbreviations: 'TABLE OF ABBREVIATIONS',
            indexOfAuthorities: 'INDEX OF AUTHORITIES',
            jurisdiction: 'STATEMENT OF JURISDICTION',
            statementOfFacts: 'STATEMENT OF FACTS',
            issuesRaised: 'ISSUES FOR CONSIDERATION',
            summaryOfArguments: 'SUMMARY OF ARGUMENTS',
            argumentsAdvanced: 'ADVANCE ARGUMENTS',
            prayer: 'PRAYER',
        };
        return Object.keys(sections)
            .map((key) => `# ${labels[key]}\n\n${sections[key]}`)
            .join('\n\n---\n\n');
    }
    isUsableFact(fact) {
        const text = fact.text;
        return text.length > 35
            && !/^(?:whether|issue\b|all laws pari materia)/i.test(text)
            && !/\b(?:Mr|Ms|Mrs|Dr)\.?$/i.test(text);
    }
    isJunk(text) {
        return /participants are invited|aims? to foster|moot problem aims|proposition is situated|explores issues relating|critical thinking|advocacy skills|team shall|each team|speaker|researcher|memorials? are required|cover page|blue cover|red cover|organis|academy|lawctopus|resolvify|patron|convener|registration|award|submission|page limit|font|collaborator|media partner|all laws pari materia|issues raised:/i.test(text);
    }
    proceduralOrder(text) {
        if (/trial court/i.test(text))
            return 1;
        if (/high court/i.test(text))
            return 2;
        if (/aggrieved|supreme court|appeal|petition/i.test(text))
            return 3;
        return 4;
    }
    cleanFact(text) {
        return String(text || '')
            .replace(/\bF\d+\s*:\s*/g, '')
            .replace(/\s+/g, ' ')
            .replace(/([a-z0-9])\.([A-Z])/g, '$1. $2')
            .replace(/\bd\s+espite\b/gi, 'despite')
            .trim();
    }
    dedupeFacts(items) {
        const seen = new Set();
        return items.filter((item) => {
            const key = item.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 240);
            if (!key || seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    dedupeAuthorities(items) {
        const seen = new Set();
        return items.filter((item) => {
            const key = item.citation.toLowerCase().replace(/\s+/g, ' ');
            if (!key || seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    dedupeText(items) {
        const seen = new Set();
        return items.filter((item) => {
            const key = item.toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 240);
            if (!key || seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    ensurePeriod(text) {
        const clean = String(text || '').trim();
        return !clean ? '' : /[.!?;:]$/.test(clean) ? clean : `${clean}.`;
    }
    ensureSemicolon(text) {
        const clean = String(text || '').trim().replace(/[.;]+$/, '');
        return `${clean};`;
    }
    lowerFirst(text) {
        const clean = String(text || '').trim();
        return clean ? clean.charAt(0).toLowerCase() + clean.slice(1) : clean;
    }
    short(text, length) {
        return text.length > length ? `${text.slice(0, length - 3)}...` : text;
    }
    roman(number) {
        return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][number - 1] || String(number);
    }
};
exports.MemorialCompilerService = MemorialCompilerService;
exports.MemorialCompilerService = MemorialCompilerService = __decorate([
    (0, common_1.Injectable)()
], MemorialCompilerService);
//# sourceMappingURL=memorial-compiler.service.js.map