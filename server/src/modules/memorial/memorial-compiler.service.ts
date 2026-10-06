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

/**
 * Converts source-grounded memorial data into a single structured render model.
 * PDF, DOCX and the in-app preview should all consume this same model.
 */
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
    const metadata = this.buildMetadata(side, blueprint);
    const abbreviations = this.abbreviationRows(usedAuthorities, blueprint, issues);
    const authorityGroups = this.authorityGroups(usedAuthorities);
    const jurisdictionParagraphs = this.jurisdictionParagraphs(blueprint, graph, side);
    const factParagraphs = this.factParagraphs(blueprint, side);
    const summaries = this.summaryRows(args, issues, side, blueprint);
    const prayerParagraphs = this.prayerParagraphs(side, blueprint, issues);

    const renderModel: MemorialRenderModel = {
      metadata,
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
          argument.counterArgument
            ? `The opposing side principally contends that ${this.lowerFirst(this.ensurePeriod(argument.counterArgument))}`
            : '',
          argument.rebuttal
            ? `That submission is answered because ${this.lowerFirst(this.ensurePeriod(argument.rebuttal))}`
            : '',
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
      indexOfAuthorities: authorityGroups.map((group) => [
        group.title,
        ...group.entries.map((entry, index) => `${index + 1}. ${entry.citation}${entry.pinpoint ? `, ${entry.pinpoint}` : ''}`),
      ].join('\n')).join('\n\n'),
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

  private buildMetadata(side: Exclude<MemorialSide, 'both'>, blueprint: PropositionBlueprint): MemorialRenderModel['metadata'] {
    const arbitration = this.isArbitration(blueprint);
    const petitionerLabel = this.cleanLabel(blueprint.caseMetadata.petitionerLabel || (arbitration ? 'CLAIMANT' : 'PETITIONER'));
    const respondentLabel = this.cleanLabel(blueprint.caseMetadata.respondentLabel || 'RESPONDENT');

    return {
      competitionName: blueprint.caseMetadata.competitionName || 'MOOT COURT COMPETITION',
      court: blueprint.caseMetadata.court || (arbitration ? 'THE ARBITRAL TRIBUNAL' : "THE HON'BLE COURT"),
      jurisdictionLine: blueprint.caseMetadata.jurisdiction || blueprint.caseMetadata.jurisdictionProvision || 'APPROPRIATE JURISDICTION',
      caseNumber: blueprint.caseMetadata.caseNumber || '',
      petitionerName: this.resolvePartyName(blueprint, 'petitioner'),
      respondentName: this.resolvePartyName(blueprint, 'respondent'),
      petitionerLabel,
      respondentLabel,
      teamCode: blueprint.caseMetadata.teamCode || '',
      side,
      // Mandatory baseline rule supplied for LEGATRIXON memorials.
      coverColor: side === 'petitioner' ? 'blue' : 'red',
    };
  }

  private resolvePartyName(blueprint: PropositionBlueprint, side: 'petitioner' | 'respondent') {
    const metaValue = side === 'petitioner'
      ? blueprint.caseMetadata.petitionerName
      : blueprint.caseMetadata.respondentName;
    const generic = /^(?:THE\s+)?(?:PETITIONER|APPELLANT|CLAIMANT|RESPONDENT|DEFENDANT)$/i.test(String(metaValue || '').trim());
    if (metaValue && !generic) return this.cleanName(metaValue).toUpperCase();

    const rolePattern = side === 'petitioner'
      ? /claimant|petitioner|appellant|applicant/i
      : /respondent|defendant|state|union|republic/i;
    const parties = Array.isArray(blueprint.parties) ? blueprint.parties : [];
    const party = parties.find((item) => rolePattern.test(item.role) && item.name)
      || parties.find((item) => rolePattern.test(item.name));

    if (party?.name) return this.cleanName(party.name).toUpperCase();
    if (metaValue) return this.cleanName(metaValue).toUpperCase();
    return side === 'petitioner'
      ? (this.isArbitration(blueprint) ? 'THE CLAIMANT' : 'THE PETITIONER')
      : 'THE RESPONDENT';
  }

  private cover(model: MemorialRenderModel) {
    const meta = model.metadata;
    const title = this.submissionTitle(model);
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
      title,
    ].filter(Boolean).join('\n\n');
  }

  private submissionTitle(model: MemorialRenderModel) {
    const arbitration = this.isArbitrationMetadata(model.metadata);
    const label = model.metadata.side === 'petitioner'
      ? model.metadata.petitionerLabel
      : model.metadata.respondentLabel;
    if (arbitration && model.metadata.side === 'respondent') {
      return `COUNTER-MEMORIAL ON BEHALF OF THE ${label}`;
    }
    return `MEMORIAL ON BEHALF OF THE ${label}`;
  }

  private toc(model: MemorialRenderModel) {
    const issueRows = model.issues.flatMap((issue) => [
      `${issue.label}: ${this.short(issue.text, 105)} ........................................ [computed on export]`,
      ...issue.subIssues.map((subIssue, index) => `${issue.label.replace('ISSUE ', '')}.${String.fromCharCode(65 + index)} ${this.short(subIssue.toUpperCase(), 95)} ........................ [computed on export]`),
    ]);
    return [
      'List of Abbreviations ............................................................. [computed on export]',
      'Index of Authorities .............................................................. [computed on export]',
      'Statement of Jurisdiction .......................................................... [computed on export]',
      'Statement of Facts ................................................................. [computed on export]',
      'Issues for Consideration ........................................................... [computed on export]',
      'Summary of Arguments ............................................................... [computed on export]',
      'Arguments Advanced ................................................................. [computed on export]',
      ...issueRows,
      'Prayer for Relief .................................................................. [computed on export]',
    ].join('\n');
  }

  private jurisdictionParagraphs(
    blueprint: PropositionBlueprint,
    graph: CaseGraph,
    side: Exclude<MemorialSide, 'both'>,
  ) {
    const meta = blueprint.caseMetadata;
    const arbitration = this.isArbitration(blueprint);
    const partyLabel = this.partyLabel(blueprint, side);
    const provision = meta.jurisdictionProvision || meta.jurisdiction || 'the applicable jurisdictional instrument';
    const appellate = /136|appellate|special leave/i.test(`${provision} ${meta.proceduralStage}`);
    const forumLabel = arbitration ? 'Tribunal' : 'Court';
    const procedural = this.bestProceduralFacts(blueprint.facts);

    if (arbitration) {
      if (side === 'petitioner') {
        return [
          `The ${partyLabel} respectfully invokes the arbitral jurisdiction of this Hon'ble ${forumLabel} under ${provision}.`,
          'The jurisdictional and merits questions are determined by the consent expressed in the applicable investment instrument, the applicable arbitration framework, and the issues fixed by the procedural orders contained in the proposition.',
          procedural.length
            ? `The proposition further records that ${this.lowerFirst(procedural.join(' '))} The ${partyLabel} accordingly requests the Tribunal to determine only the issues committed to the present procedural stage.`
            : `The ${partyLabel} respectfully submits that the Tribunal is competent to determine the issues and reliefs committed to the present procedural stage.`,
        ];
      }
      return [
        `The ${partyLabel} addresses this Hon'ble ${forumLabel}'s jurisdiction under ${provision}, without conceding any issue-specific objection preserved in the memorial.`,
        'The party invoking a particular head of arbitral jurisdiction or relief must establish the consent, treaty requirements, procedural preconditions, and legal basis applicable to that claim.',
        procedural.length
          ? `The proposition records that ${this.lowerFirst(procedural.join(' '))} The ${partyLabel} respectfully requests that the Tribunal confine its determination to the issues fixed for the present stage.`
          : `The ${partyLabel} respectfully requests that each claim and requested remedy be tested against the exact consent and procedural framework contained in the proposition.`,
      ];
    }

    if (side === 'petitioner') {
      return [
        `The ${partyLabel} respectfully invokes the ${appellate ? 'extraordinary appellate' : 'constitutional'} jurisdiction of this Hon'ble ${forumLabel} under ${provision}.`,
        appellate
          ? 'The questions presented concern the legal errors identified in the issues for consideration. Each alleged error is addressed against the governing law and the proposition record rather than as a bare request for re-appreciation of facts.'
          : 'The petition raises substantial questions concerning the enforcement of rights and the legality of the impugned State action.',
        procedural.length
          ? `The proposition records that ${this.lowerFirst(procedural.join(' '))} The ${partyLabel} therefore submits that the threshold for intervention is satisfied.`
          : `The ${partyLabel} therefore submits that this Hon'ble ${forumLabel} is competent to entertain the matter and grant the reliefs prayed for.`,
      ];
    }

    const appellateBurden = graph.burdens.find((burden) => /article 136|appellant|appellate/i.test(burden));
    return [
      `The ${partyLabel} submits to the jurisdiction of this Hon'ble ${forumLabel} under ${provision}, subject to the threshold governing its exercise.`,
      appellate
        ? (appellateBurden || 'Extraordinary appellate jurisdiction is not intended to operate as a routine third appeal on facts; interference requires a legally cognisable error or miscarriage of justice.')
        : 'The party invoking constitutional jurisdiction must establish the pleaded infringement and the legal basis for the relief sought.',
      procedural.length
        ? `The proposition records that ${this.lowerFirst(procedural.join(' '))} In the absence of a demonstrated foundational error, the impugned action ought to be sustained.`
        : 'In the absence of a demonstrated legal or constitutional error warranting interference, the impugned action ought to be sustained.',
    ];
  }

  private factParagraphs(blueprint: PropositionBlueprint, side: Exclude<MemorialSide, 'both'>) {
    const facts = this.dedupeFacts(blueprint.facts
      .filter((fact) => fact.materiality !== 'low' && fact.kind !== 'relief' && !this.isJunk(fact.text) && this.isUsableFact(fact)));

    if (!facts.length) {
      return ['The uploaded proposition did not yield a sufficiently reliable statement of material facts. The system has declined to invent a factual narrative.'];
    }

    const materialityOrder = { high: 0, medium: 1, low: 2 } as const;
    const ordered = [...facts].sort((a, b) => {
      const pageA = this.firstSourcePage(a.sourceIds);
      const pageB = this.firstSourcePage(b.sourceIds);
      if (pageA !== pageB) return pageA - pageB;
      return materialityOrder[a.materiality] - materialityOrder[b.materiality];
    });

    const groups: PropositionFact[][] = [];
    for (let index = 0; index < ordered.length; index += 4) groups.push(ordered.slice(index, index + 4));
    return groups
      .map((group) => this.composeFactParagraph(group, side))
      .filter((paragraph) => paragraph.length > 50)
      .slice(0, 10);
  }

  private firstSourcePage(sourceIds: string[] = []) {
    const pages = (sourceIds || [])
      .map((id) => Number(String(id).match(/P(?:AGE)?[_-]?(\d+)/i)?.[1] || Number.MAX_SAFE_INTEGER))
      .filter(Number.isFinite);
    return pages.length ? Math.min(...pages) : Number.MAX_SAFE_INTEGER;
  }

  private composeFactParagraph(facts: PropositionFact[], _side: Exclude<MemorialSide, 'both'>) {
    return this.dedupeText(facts.map((fact) => this.qualifyFact(fact))).slice(0, 8).join(' ');
  }

  private qualifyFact(fact: PropositionFact) {
    const text = this.ensurePeriod(this.cleanFact(fact.text));
    if (fact.status === 'finding' || fact.status === 'admitted') return text;
    if (fact.status === 'alleged' || fact.status === 'disputed') {
      if (/^(?:the claimant|the respondent|the prosecution|the complainant|the accused|the petitioner)/i.test(text)) return text;
      return `The proposition records the allegation that ${this.lowerFirst(text)}`;
    }
    return text;
  }

  private summaryRows(
    args: ArgumentBlock[],
    issues: IssueMatrixItem[],
    side: Exclude<MemorialSide, 'both'>,
    blueprint: PropositionBlueprint,
  ) {
    const partyLabel = this.partyLabel(blueprint, side);
    return args.map((argument, index) => {
      const issue = issues[index];
      const paragraphOne = this.ensurePeriod(argument.thesis);
      const paragraphTwo = this.ensurePeriod(argument.subArguments.slice(0, 5).map((sub) => {
        const keyAnalysis = sub.analysis.find((paragraph) => paragraph.length > 120) || sub.rule;
        return `${sub.heading}: ${this.ensurePeriod(keyAnalysis)}`;
      }).join(' '));
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
    const cited = sub.authorityIds
      .map((id) => authorityById.get(id))
      .filter(Boolean) as ResearchAuthority[];

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

  private prayerParagraphs(
    side: Exclude<MemorialSide, 'both'>,
    blueprint: PropositionBlueprint,
    issues: IssueMatrixItem[],
  ) {
    const issueLabels = issues.map((_, index) => this.roman(index + 1));
    const partyLabel = this.partyLabel(blueprint, side);
    const arbitration = this.isArbitration(blueprint);
    const propositionReliefs = blueprint.reliefs
      .filter((relief) => relief.side === side || relief.side === 'neutral')
      .map((relief) => this.cleanFact(relief.text))
      .filter((relief) => !this.isJunk(relief))
      .slice(0, 6);

    const forum = arbitration ? 'Tribunal' : 'Court';
    const opening = `WHEREFORE, in light of the facts stated, issues raised, authorities cited, and arguments advanced, the ${partyLabel} most respectfully prays that this Hon'ble ${forum} may be pleased to:`;

    let defaults: string[];
    if (arbitration && side === 'petitioner') {
      defaults = [
        `DECLARE the ${partyLabel} successful on the issues on which it has discharged its burden at the present stage;`,
        'GRANT the treaty and provisional relief, if any, that is expressly claimed in and supported by the proposition record;',
        `REJECT the objections advanced against the ${partyLabel} to the extent inconsistent with the Tribunal’s findings on Issues ${issueLabels.join(', ')};`,
      ];
    } else if (arbitration) {
      defaults = [
        `DISMISS or reject the claims and requests on which the ${partyLabel} succeeds at the present stage;`,
        'REFUSE any provisional or substantive relief for which the legal requirements have not been established;',
        `DECLARE the legal consequences that follow from the Tribunal’s findings on Issues ${issueLabels.join(', ')};`,
      ];
    } else if (side === 'petitioner') {
      defaults = [
        'Allow the present petition or appeal;',
        'Set aside the impugned action or judgment to the extent found unlawful;',
        `Grant the reliefs that follow from the findings on Issues ${issueLabels.join(', ')};`,
      ];
    } else {
      defaults = [
        'Dismiss the present petition or appeal as devoid of merit;',
        'Uphold the impugned action or judgment to the extent challenged;',
        `Reject the reliefs sought against the Respondent under Issues ${issueLabels.join(', ')};`,
      ];
    }

    const reliefs = propositionReliefs.length
      ? propositionReliefs.map((relief) => this.ensureSemicolon(relief))
      : defaults;

    return [
      opening,
      ...reliefs.map((relief, index) => `${index + 1}. ${this.ensureSemicolon(relief)}`),
      `${reliefs.length + 1}. Pass any other order or direction that this Hon'ble ${forum} may deem appropriate within its jurisdiction;`,
      '',
      `ALL OF WHICH IS RESPECTFULLY SUBMITTED ON BEHALF OF THE ${partyLabel.toUpperCase()}.`,
    ];
  }

  private abbreviationRows(authorities: ResearchAuthority[], blueprint: PropositionBlueprint, issues: IssueMatrixItem[]) {
    const candidates = new Map<string, string>([
      ['§', 'Section'], ['¶', 'Paragraph'], ['&', 'And'], ['Art.', 'Article'], ['Cl.', 'Clause'],
      ['Const.', 'Constitution'], ['Ed.', 'Edition'], ['Govt.', 'Government'], ['HC', 'High Court'],
      ["Hon'ble", 'Honourable'], ['No.', 'Number'], ['p.', 'Page'], ['para.', 'Paragraph'], ['paras.', 'Paragraphs'],
      ['pp.', 'Pages'], ['SC', 'Supreme Court'], ['SCC', 'Supreme Court Cases'], ['Sec.', 'Section'], ['v.', 'Versus'],
      ['Vol.', 'Volume'], ['BNS', 'Bharatiya Nyaya Sanhita, 2023'], ['BSA', 'Bharatiya Sakshya Adhiniyam, 2023'],
      ['BNSS', 'Bharatiya Nagarik Suraksha Sanhita, 2023'], ['IT Act', 'Information Technology Act, 2000'],
      ['ICSID', 'International Centre for Settlement of Investment Disputes'],
      ['FET', 'Fair and Equitable Treatment'], ['MFN', 'Most-Favoured-Nation'],
      ['BIT', 'Bilateral Investment Treaty'], ['PSA', 'Purchase and Service Agreement'],
      ['PO1', 'Procedural Order No. 1'], ['PO2', 'Procedural Order No. 2'],
      ['UNCITRAL', 'United Nations Commission on International Trade Law'],
    ]);

    const corpus = [
      ...authorities.map((authority) => `${authority.citation} ${authority.ratioOrRule || ''}`),
      ...(blueprint.lawsMentioned || []).map((law) => `${law.citation} ${law.context}`),
      ...(blueprint.facts || []).map((fact) => fact.text),
      ...issues.map((issue) => `${issue.issue} ${issue.subIssues.join(' ')}`),
      blueprint.caseMetadata.court,
      blueprint.caseMetadata.jurisdiction,
    ].join(' ').toLowerCase();

    return Array.from(candidates.entries())
      .filter(([abbreviation, fullForm]) => {
        const bare = abbreviation.replace(/[.]/g, '').toLowerCase();
        const exactPattern = new RegExp(`(^|[^a-z0-9])${this.escapeRegex(bare)}([^a-z0-9]|$)`, 'i');
        return ['§', '¶', '&'].includes(abbreviation)
          ? corpus.includes(abbreviation)
          : exactPattern.test(corpus.replace(/[.]/g, '')) || corpus.includes(fullForm.toLowerCase());
      })
      .map(([abbreviation, fullForm]) => ({ abbreviation, fullForm }))
      .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
  }

  private authorityGroups(authorities: ResearchAuthority[]) {
    const groups = [
      { title: 'I. CASES AND ARBITRAL DECISIONS', test: (authority: ResearchAuthority) => authority.type === 'case' },
      { title: 'II. TREATIES, CONVENTIONS AND INTERNATIONAL INSTRUMENTS', test: (authority: ResearchAuthority) => /treaty|agreement|convention|ICSID|UNCITRAL|ILC Articles|arbitration rules/i.test(authority.citation) },
      { title: 'III. CONSTITUTIONAL PROVISIONS AND STATUTES', test: (authority: ResearchAuthority) => ['constitution', 'statute'].includes(authority.type) && !/treaty|agreement|convention/i.test(authority.citation) },
      { title: 'IV. BOOKS, REPORTS, ARTICLES AND OTHER AUTHORITIES', test: (authority: ResearchAuthority) => ['report', 'book', 'article', 'web'].includes(authority.type) },
    ];

    const assigned = new Set<string>();
    const output = groups.map((group) => {
      const entries = authorities.filter((authority) => {
        if (assigned.has(authority.id) || !group.test(authority)) return false;
        assigned.add(authority.id);
        return true;
      }).map((authority) => ({ citation: authority.citation, pinpoint: authority.pinpoint }));
      return { title: group.title, entries };
    }).filter((group) => group.entries.length);

    const remaining = authorities
      .filter((authority) => !assigned.has(authority.id))
      .map((authority) => ({ citation: authority.citation, pinpoint: authority.pinpoint }));
    if (remaining.length) output.push({ title: 'V. OTHER AUTHORITIES', entries: remaining });
    return output;
  }

  private bestProceduralFacts(facts: PropositionFact[]) {
    return this.dedupeText(facts
      .filter((fact) => fact.kind === 'procedural' || fact.kind === 'finding')
      .map((fact) => this.ensurePeriod(this.cleanFact(fact.text))))
      .slice(0, 5);
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
      && authority.citation.length >= 5
      && authority.citation.length < 220
      && !/accused|complainant|alleged|obtained|misused|personal data/i.test(authority.citation);
  }

  private renderMarkdown(sections: MemorialSectionSet) {
    const labels: Record<keyof MemorialSectionSet, string> = {
      cover: 'COVER PAGE',
      tableOfContents: 'TABLE OF CONTENTS',
      abbreviations: 'LIST OF ABBREVIATIONS',
      indexOfAuthorities: 'INDEX OF AUTHORITIES',
      jurisdiction: 'STATEMENT OF JURISDICTION',
      statementOfFacts: 'STATEMENT OF FACTS',
      issuesRaised: 'ISSUES FOR CONSIDERATION',
      summaryOfArguments: 'SUMMARY OF ARGUMENTS',
      argumentsAdvanced: 'ARGUMENTS ADVANCED',
      prayer: 'PRAYER FOR RELIEF',
    };
    return (Object.keys(sections) as Array<keyof MemorialSectionSet>)
      .map((key) => `# ${labels[key]}\n\n${sections[key]}`)
      .join('\n\n---\n\n');
  }

  private partyLabel(blueprint: PropositionBlueprint, side: Exclude<MemorialSide, 'both'>) {
    return this.titleCase(side === 'petitioner'
      ? blueprint.caseMetadata.petitionerLabel || (this.isArbitration(blueprint) ? 'Claimant' : 'Petitioner')
      : blueprint.caseMetadata.respondentLabel || 'Respondent');
  }

  private isArbitration(blueprint: PropositionBlueprint) {
    return /arbitrat|ICSID|investor[- ]state|investment agreement|claimant|FET|MFN/i.test([
      blueprint.caseMetadata.court,
      blueprint.caseMetadata.jurisdiction,
      blueprint.caseMetadata.jurisdictionProvision,
      blueprint.caseMetadata.proceduralStage,
      blueprint.caseMetadata.petitionerLabel,
      ...(blueprint.lawsMentioned || []).map((law) => law.citation),
    ].join(' '));
  }

  private isArbitrationMetadata(metadata: MemorialRenderModel['metadata']) {
    return /arbitrat|ICSID|claimant|investment/i.test(`${metadata.court} ${metadata.jurisdictionLine} ${metadata.petitionerLabel}`);
  }

  private isUsableFact(fact: PropositionFact) {
    const text = fact.text;
    return text.length > 35
      && !/^(?:whether|issue\b|all laws pari materia)/i.test(text)
      && !/\b(?:Mr|Ms|Mrs|Dr)\.?$/i.test(text);
  }

  private isJunk(text: string) {
    return /participants are invited|aims? to foster|moot problem aims|proposition is situated|explores issues relating|critical thinking|advocacy skills|team shall|each team|speaker|researcher|memorials? are required|cover page|blue cover|red cover|organis|academy|lawctopus|resolvify|patron|convener|registration|award|submission deadline|page limit|font|collaborator|media partner|all laws pari materia/i.test(text);
  }

  private cleanFact(text: string) {
    return String(text || '')
      .replace(/\bF\d+\s*:\s*/g, '')
      .replace(/\s+/g, ' ')
      .replace(/([a-z0-9])\.([A-Z])/g, '$1. $2')
      .trim();
  }

  private cleanName(text: string) {
    return String(text || '').replace(/\.{2,}.*$/g, '').replace(/\s+/g, ' ').trim();
  }

  private cleanLabel(text: string) {
    return String(text || '').replace(/[^A-Za-z /&-]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  private dedupeFacts(items: PropositionFact[]) {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 260);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private dedupeAuthorities(items: ResearchAuthority[]) {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.citation.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private dedupeText(items: string[]) {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 260);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private ensurePeriod(text: string) {
    const value = String(text || '').trim();
    return !value ? '' : /[.!?;:]$/.test(value) ? value : `${value}.`;
  }

  private ensureSemicolon(text: string) {
    const value = String(text || '').trim().replace(/[.;]+$/, '');
    return `${value};`;
  }

  private lowerFirst(text: string) {
    const value = String(text || '').trim();
    return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
  }

  private short(text: string, length: number) {
    return text.length > length ? `${text.slice(0, length - 3)}...` : text;
  }

  private roman(number: number) {
    return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][number - 1] || String(number);
  }

  private titleCase(value: string) {
    return String(value || '').toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
