import { Injectable } from '@nestjs/common';
import {
  ArgumentBlock,
  CaseGraph,
  IssueMatrixItem,
  MemorialRenderModel,
  MemorialSectionSet,
  MemorialSide,
  PropositionBlueprint,
  PropositionFact,
  ResearchAuthority,
} from './memorial.types';

@Injectable()
export class MemorialCompilerService {
  compile(
    side: Exclude<MemorialSide, 'both'>,
    blueprint: PropositionBlueprint,
    graph: CaseGraph,
    issues: IssueMatrixItem[],
    authorities: ResearchAuthority[],
    args: ArgumentBlock[],
  ) {
    const usedAuthorities = this.usedAuthorities(args, authorities);
    const abbreviations = this.abbreviationRows(usedAuthorities, blueprint);
    const authorityGroups = this.authorityGroups(usedAuthorities);
    const jurisdictionParagraphs = this.jurisdictionParagraphs(blueprint, graph, side);
    const factParagraphs = this.factParagraphs(blueprint, side);
    const summaries = this.summaryRows(args, issues, side, blueprint);
    const prayerParagraphs = this.prayerParagraphs(side, blueprint, issues);

    const renderModel: MemorialRenderModel = {
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
        // Side colour is a mandatory filing rule and cannot be overridden by a sample/template.
        coverColor: side === 'petitioner' ? 'blue' : 'red',
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

    const sections: MemorialSectionSet = {
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

  private cover(model: MemorialRenderModel) {
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

  private toc(model: MemorialRenderModel) {
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
      'Arguments Advanced ................................................................. [computed on export]',
      ...issueRows,
      'Prayer .............................................................................. [computed on export]',
    ].join('\n');
  }

  private jurisdictionParagraphs(
    blueprint: PropositionBlueprint,
    graph: CaseGraph,
    side: Exclude<MemorialSide, 'both'>,
  ) {
    const meta = blueprint.caseMetadata;
    const partyLabel = side === 'petitioner' ? (meta.petitionerLabel || 'Petitioner') : (meta.respondentLabel || 'Respondent');
    const provision = meta.jurisdictionProvision || meta.jurisdiction || 'the applicable constitutional provision';
    const appellate = /136|appellate|special leave/i.test(`${provision} ${meta.proceduralStage}`);
    const arbitration = /tribunal|arbitrat|investment agreement/i.test(`${meta.court} ${provision} ${meta.proceduralStage}`);
    const forumLabel = arbitration ? 'Tribunal' : 'Court';
    const procedural = this.bestProceduralFacts(blueprint.facts);

    if (side === 'petitioner') {
      return [
        `The ${partyLabel} respectfully invokes the ${arbitration ? 'arbitral' : appellate ? 'extraordinary appellate' : 'constitutional'} jurisdiction of this Hon'ble ${forumLabel} under ${provision}.`,
        appellate
          ? 'The questions presented concern the legal errors identified in the issues for consideration. Each alleged error is addressed against the governing law and the proposition record rather than as a bare request for re-appreciation of facts.'
          : arbitration
            ? 'The claims raise substantial questions concerning the Tribunal’s jurisdiction, the applicable investment protections, the responsibility alleged, and the relief claimed under the instruments identified in the proposition.'
            : 'The petition raises substantial questions concerning the enforcement of fundamental rights and the legality of the impugned State action.',
        procedural.length
          ? `The proposition records that ${this.lowerFirst(procedural.join(' '))} The ${partyLabel} therefore submits that the threshold for this Hon'ble ${forumLabel}'s intervention is satisfied.`
          : `The ${partyLabel} therefore submits that this Hon'ble ${forumLabel} is competent to entertain the matter and grant the reliefs prayed for.`,
      ];
    }

    const appellateBurden = graph.burdens.find((burden) => /article 136|appellant|appellate/i.test(burden));
    return [
      `The ${partyLabel} submits to the jurisdiction of this Hon'ble ${forumLabel} under ${provision}, subject to the strict threshold governing its exercise.`,
      appellate
        ? (appellateBurden || 'Article 136 is extraordinary and discretionary; it is not intended to operate as a routine third appeal on facts. Interference requires a substantial legal error, perversity, grave miscarriage of justice, or constitutional infirmity.')
        : arbitration
          ? 'The party invoking arbitral jurisdiction must establish consent, the applicable jurisdictional requirements, and the legal basis for each relief sought.'
          : 'The party invoking constitutional jurisdiction must establish the pleaded infringement and the legal basis for the relief sought.',
      procedural.length
        ? `The proposition records that ${this.lowerFirst(procedural.join(' '))} In the absence of a demonstrated foundational error, the concurrent findings ought to be sustained.`
        : 'In the absence of a demonstrated legal or constitutional error warranting interference, the impugned action ought to be sustained.',
    ];
  }

  private factParagraphs(blueprint: PropositionBlueprint, side: Exclude<MemorialSide, 'both'>) {
    const facts = this.dedupeFacts(blueprint.facts
      .filter((fact) => fact.materiality !== 'low' && fact.kind !== 'relief' && !this.isJunk(fact.text) && this.isUsableFact(fact)));
    if (!facts.length) {
      return ['The uploaded document did not yield a sufficiently reliable statement of material facts. The system has declined to invent a factual narrative.'];
    }

    const ordered = [...facts].sort((a, b) => {
      const materiality = { high: 0, medium: 1, low: 2 } as const;
      return materiality[a.materiality] - materiality[b.materiality];
    });
    const groups: PropositionFact[][] = [];
    for (let index = 0; index < ordered.length; index += 4) groups.push(ordered.slice(index, index + 4));

    const paragraphs = groups
      .map((group) => this.composeFactParagraph(group, side))
      .filter((paragraph) => paragraph.length > 50);
    return paragraphs.slice(0, 8);
  }

  private composeFactParagraph(facts: PropositionFact[], side: Exclude<MemorialSide, 'both'>) {
    const unique = this.dedupeText(facts.map((fact) => this.qualifyFact(fact, side))).slice(0, 8);
    return unique.join(' ');
  }

  private qualifyFact(fact: PropositionFact, side: Exclude<MemorialSide, 'both'>) {
    const text = this.ensurePeriod(this.cleanFact(fact.text));
    if (fact.status === 'finding') return text;
    if (fact.status === 'alleged' || fact.status === 'disputed') {
      if (/^(?:the prosecution|the complainant|the accused|the petitioner|the respondent)/i.test(text)) return text;
      return `The proposition records the allegation that ${this.lowerFirst(text)}`;
    }
    return text;
  }

  private summaryRows(args: ArgumentBlock[], issues: IssueMatrixItem[], side: Exclude<MemorialSide, 'both'>, blueprint: PropositionBlueprint) {
    const partyLabel = side === 'petitioner'
      ? (blueprint.caseMetadata.petitionerLabel || 'Petitioner')
      : (blueprint.caseMetadata.respondentLabel || 'Respondent');
    return args.map((argument, index) => {
      const issue = issues[index];
      const paragraphOne = this.ensurePeriod(argument.thesis);
      const subArgumentSummary = argument.subArguments.slice(0, 5).map((sub) => {
        const keyAnalysis = sub.analysis.find((paragraph) => paragraph.length > 120) || sub.rule;
        return `${sub.heading}: ${this.ensurePeriod(keyAnalysis)}`;
      }).join(' ');
      const paragraphTwo = this.ensurePeriod(subArgumentSummary);
      const paragraphThree = argument.rebuttal
        ? `The ${partyLabel} further submits that ${this.lowerFirst(this.ensurePeriod(argument.rebuttal))}`
        : this.ensurePeriod(argument.conclusion);
      return {
        issueId: argument.issueId,
        heading: `ISSUE ${this.roman(index + 1)}: ${issue?.issue || argument.issueId}`,
        paragraphs: [paragraphOne, paragraphTwo, paragraphThree, this.ensurePeriod(argument.conclusion)]
          .filter((paragraph, paragraphIndex, array) => paragraph && array.indexOf(paragraph) === paragraphIndex),
      };
    });
  }

  private subArgumentParagraphs(sub: ArgumentBlock['subArguments'][number], authorities: ResearchAuthority[]) {
    const authorityById = new Map(authorities.map((authority) => [authority.id, authority]));
    const cited = sub.authorityIds.map((id) => authorityById.get(id)).filter(Boolean) as ResearchAuthority[];
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

  private prayerParagraphs(side: Exclude<MemorialSide, 'both'>, blueprint: PropositionBlueprint, issues: IssueMatrixItem[]) {
    const issueLabels = issues.map((_, index) => this.roman(index + 1));
    const partyLabel = side === 'petitioner'
      ? (blueprint.caseMetadata.petitionerLabel || 'Petitioner')
      : (blueprint.caseMetadata.respondentLabel || 'Respondent');
    const propositionReliefs = blueprint.reliefs
      .filter((relief) => relief.side === side || relief.side === 'neutral')
      .map((relief) => this.cleanFact(relief.text))
      .filter((relief) => !this.isJunk(relief))
      .slice(0, 5);

    const forum = /tribunal|arbitrat/i.test(blueprint.caseMetadata.court || '') ? 'Tribunal' : 'Court';
    const opening = `WHEREFORE, in light of the facts stated, issues raised, authorities cited, and arguments advanced, the ${partyLabel} most respectfully prays that this Hon'ble ${forum} may be pleased to:`;
    const defaults = side === 'petitioner'
      ? [
        'Allow the present petition or appeal;',
        'Set aside the impugned action or judgment to the extent found unlawful;',
        `Grant the reliefs that follow from the findings on Issues ${issueLabels.join(', ')};`,
      ]
      : [
        'Dismiss the present petition or appeal as devoid of merit;',
        'Uphold the impugned action or judgment to the extent challenged;',
        `Reject the reliefs sought against the Respondent under Issues ${issueLabels.join(', ')};`,
      ];
    const reliefs = propositionReliefs.length ? propositionReliefs.map((relief) => this.ensureSemicolon(relief)) : defaults;
    return [
      opening,
      ...reliefs.map((relief, index) => `${index + 1}. ${this.ensureSemicolon(relief)}`),
      `${reliefs.length + 1}. Pass any other order that this Hon'ble ${forum} may deem fit in the interests of justice;`,
      '',
      `AND FOR THIS ACT OF KINDNESS, THE ${partyLabel.toUpperCase()} SHALL, AS IN DUTY BOUND, EVER PRAY.`,
    ];
  }

  private abbreviationRows(authorities: ResearchAuthority[], blueprint: PropositionBlueprint) {
    const candidates = new Map<string, string>([
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

  private authorityGroups(authorities: ResearchAuthority[]) {
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

  private bestProceduralFacts(facts: PropositionFact[]) {
    return this.dedupeText(facts
      .filter((fact) => fact.kind === 'procedural' || fact.kind === 'finding')
      .map((fact) => this.ensurePeriod(this.cleanFact(fact.text))))
      .sort((a, b) => this.proceduralOrder(a) - this.proceduralOrder(b))
      .slice(0, 4);
  }

  private usedAuthorities(args: ArgumentBlock[], authorities: ResearchAuthority[]) {
    const usedIds = new Set(args.flatMap((argument) => [
      ...argument.authorities.map((authority) => authority.id),
      ...argument.subArguments.flatMap((sub) => sub.authorityIds),
    ]));
    const used = authorities.filter((authority) => usedIds.has(authority.id));
    return this.dedupeAuthorities((used.length ? used : authorities).filter((authority) => this.validAuthority(authority)));
  }

  private validAuthority(authority: ResearchAuthority) {
    return authority.verified
      && authority.citation.length < 190
      && !/accused|complainant|alleged|matrimonial|obtained|misused|personal data/i.test(authority.citation);
  }

  private renderMarkdown(sections: MemorialSectionSet) {
    const labels: Record<keyof MemorialSectionSet, string> = {
      cover: 'COVER PAGE',
      tableOfContents: 'TABLE OF CONTENTS',
      abbreviations: 'TABLE OF ABBREVIATIONS',
      indexOfAuthorities: 'INDEX OF AUTHORITIES',
      jurisdiction: 'STATEMENT OF JURISDICTION',
      statementOfFacts: 'STATEMENT OF FACTS',
      issuesRaised: 'ISSUES FOR CONSIDERATION',
      summaryOfArguments: 'SUMMARY OF ARGUMENTS',
      argumentsAdvanced: 'ARGUMENTS ADVANCED',
      prayer: 'PRAYER',
    };
    return (Object.keys(sections) as Array<keyof MemorialSectionSet>)
      .map((key) => `# ${labels[key]}\n\n${sections[key]}`)
      .join('\n\n---\n\n');
  }

  private isUsableFact(fact: PropositionFact) {
    const text = fact.text;
    return text.length > 35
      && !/^(?:whether|issue\b|all laws pari materia)/i.test(text)
      && !/\b(?:Mr|Ms|Mrs|Dr)\.?$/i.test(text);
  }

  private isJunk(text: string) {
    return /participants are invited|aims? to foster|moot problem aims|proposition is situated|explores issues relating|critical thinking|advocacy skills|team shall|each team|speaker|researcher|memorials? are required|cover page|blue cover|red cover|organis|academy|lawctopus|resolvify|patron|convener|registration|award|submission|page limit|font|collaborator|media partner|all laws pari materia|issues raised:/i.test(text);
  }

  private proceduralOrder(text: string) {
    if (/trial court/i.test(text)) return 1;
    if (/high court/i.test(text)) return 2;
    if (/aggrieved|supreme court|appeal|petition/i.test(text)) return 3;
    return 4;
  }

  private cleanFact(text: string) {
    return String(text || '')
      .replace(/\bF\d+\s*:\s*/g, '')
      .replace(/\s+/g, ' ')
      .replace(/([a-z0-9])\.([A-Z])/g, '$1. $2')
      .replace(/\bd\s+espite\b/gi, 'despite')
      .trim();
  }

  private dedupeFacts(items: PropositionFact[]) {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 240);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private dedupeAuthorities(items: ResearchAuthority[]) {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.citation.toLowerCase().replace(/\s+/g, ' ');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private dedupeText(items: string[]) {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 240);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private ensurePeriod(text: string) {
    const clean = String(text || '').trim();
    return !clean ? '' : /[.!?;:]$/.test(clean) ? clean : `${clean}.`;
  }

  private ensureSemicolon(text: string) {
    const clean = String(text || '').trim().replace(/[.;]+$/, '');
    return `${clean};`;
  }

  private lowerFirst(text: string) {
    const clean = String(text || '').trim();
    return clean ? clean.charAt(0).toLowerCase() + clean.slice(1) : clean;
  }

  private short(text: string, length: number) {
    return text.length > length ? `${text.slice(0, length - 3)}...` : text;
  }

  private roman(number: number) {
    return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][number - 1] || String(number);
  }
}
