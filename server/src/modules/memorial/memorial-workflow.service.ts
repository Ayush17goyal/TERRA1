import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  MemorialSide,
  MemorialWorkflowAudit,
  MemorialWorkflowOptions,
  MemorialWorkflowResult,
} from './memorial.types';
import { PropositionPreservationService } from './proposition-preservation.service';
import { PropositionIntelligenceService } from './proposition-intelligence.service';
import { CaseGraphService } from './case-graph.service';
import { IssueEngineService } from './issue-engine.service';
import { AuthorityEngineService } from './authority-engine.service';
import { ArgumentEngineService } from './argument-engine.service';
import { MemorialCompilerService } from './memorial-compiler.service';
import { MemorialJudgeService } from './memorial-judge.service';

interface RunInput extends MemorialWorkflowOptions {
  file?: any;
  propositionText?: string;
  sourceName?: string;
}

@Injectable()
export class MemorialWorkflowService {
  private readonly logger = new Logger(MemorialWorkflowService.name);

  constructor(
    private readonly preservation: PropositionPreservationService,
    private readonly propositionIntelligence: PropositionIntelligenceService,
    private readonly graphService: CaseGraphService,
    private readonly issueEngine: IssueEngineService,
    private readonly authorityEngine: AuthorityEngineService,
    private readonly argumentEngine: ArgumentEngineService,
    private readonly compiler: MemorialCompilerService,
    private readonly judge: MemorialJudgeService,
  ) {}

  async run(input: RunInput): Promise<MemorialWorkflowResult> {
    const options = this.normalizeOptions(input);
    const audit: MemorialWorkflowAudit = {
      version: '3.0.0-reference-format',
      stages: [],
      warnings: [],
    };

    const document = await this.stage(audit, '0A — Full document preservation', async () => {
      const extracted = await this.preservation.extractDocument(input.file, input.propositionText);
      if (!extracted.rawText || extracted.rawText.trim().length < 500) {
        throw new BadRequestException(
          'A complete moot proposition is required. The preservation layer rejected a short or empty extraction because generating from partial text would produce an unreliable memorial.',
        );
      }
      return extracted;
    }, (value) => `${value.pages.length} page(s), ${value.rawText.length} characters preserved without early summarisation.`);

    const dossier = await this.stage(audit, '0B — Page and paragraph evidence locker', async () =>
      this.preservation.buildDossier(document, input.sourceName || input.file?.originalname || 'moot proposition'),
    (value) => `${value.paragraphs.length} source-addressable paragraphs created across ${value.pages.length} page(s).`);

    const propositionResult = await this.stage(audit, '1 — Proposition intelligence and coverage audit', async () =>
      this.propositionIntelligence.analyze(dossier, options),
    (value) => `${value.blueprint.facts.length} case facts, ${value.blueprint.explicitIssues.length} express issues, ${value.blueprint.coverage.coveragePercent}% source classification coverage.`,
    (value) => !value.usedAi ? value.warning : undefined);
    if (propositionResult.warning) audit.warnings.push(propositionResult.warning);

    const blueprint = propositionResult.blueprint;
    this.assertBlueprintIsUsable(blueprint);

    const graph = await this.stage(audit, '2 — Case graph and burden map', async () =>
      this.graphService.build(dossier, blueprint),
    (value) => `${value.facts.length} facts, ${value.parties.length} parties, ${value.evidenceInventory.length} evidence items, ${value.burdens.length} burden rules mapped.`);

    const issueResult = await this.stage(audit, '3 — Issue architecture', async () =>
      this.issueEngine.generate(graph, blueprint, options),
    (value) => `${value.issues.length} issues generated with separate petitioner and respondent theories.`,
    (value) => !value.usedAi ? value.warning : undefined);
    if (issueResult.warning) audit.warnings.push(issueResult.warning);
    const issues = issueResult.issues;
    if (issues.length < 2) throw new BadRequestException('The issue architecture contains fewer than two usable issues. Review the extracted blueprint before memorial generation.');

    const authorityResult = await this.stage(audit, '4 — Verified authority research and issue mapping', async () =>
      this.authorityEngine.generate(issues, blueprint, options),
    (value) => `${value.authorities.filter((authority) => authority.verified).length} verified authorities mapped across ${new Set(value.authorities.map((authority) => authority.issueId)).size}/${issues.length} issues.`,
    (value) => !value.usedAi ? value.warning : undefined);
    if (authorityResult.warning) audit.warnings.push(authorityResult.warning);
    const authorities = authorityResult.authorities;

    const result: MemorialWorkflowResult = {
      dossier,
      blueprint,
      graph,
      issues,
      authorities,
      audit,
    };

    const sides: Array<Exclude<MemorialSide, 'both'>> = options.side === 'both' || !options.side
      ? ['petitioner', 'respondent']
      : [options.side];

    for (const side of sides) {
      const sideResult = await this.generateSide(side, dossier, blueprint, graph, issues, authorities, options, audit);
      result[side] = sideResult;
    }

    return result;
  }

  async extractBlueprint(input: RunInput) {
    const options = this.normalizeOptions(input);
    const audit: MemorialWorkflowAudit = { version: '3.0.0-reference-format', stages: [], warnings: [] };
    const document = await this.stage(audit, '0A — Full document preservation', async () => {
      const extracted = await this.preservation.extractDocument(input.file, input.propositionText);
      if (!extracted.rawText || extracted.rawText.trim().length < 500) {
        throw new BadRequestException('A complete moot proposition is required for blueprint extraction.');
      }
      return extracted;
    }, (value) => `${value.pages.length} page(s) preserved.`);
    const dossier = await this.stage(audit, '0B — Page and paragraph evidence locker', async () =>
      this.preservation.buildDossier(document, input.sourceName || input.file?.originalname || 'moot proposition'),
    (value) => `${value.paragraphs.length} source-addressable paragraphs created.`);
    const propositionResult = await this.stage(audit, '1 — Proposition intelligence and coverage audit', async () =>
      this.propositionIntelligence.analyze(dossier, options),
    (value) => `${value.blueprint.facts.length} facts and ${value.blueprint.explicitIssues.length} issues extracted.`,
    (value) => !value.usedAi ? value.warning : undefined);
    if (propositionResult.warning) audit.warnings.push(propositionResult.warning);
    this.assertBlueprintIsUsable(propositionResult.blueprint);
    const graph = this.graphService.build(dossier, propositionResult.blueprint);
    return { dossier, blueprint: propositionResult.blueprint, graph, audit };
  }

  private async generateSide(
    side: Exclude<MemorialSide, 'both'>,
    dossier: MemorialWorkflowResult['dossier'],
    blueprint: MemorialWorkflowResult['blueprint'],
    graph: MemorialWorkflowResult['graph'],
    issues: MemorialWorkflowResult['issues'],
    authorities: MemorialWorkflowResult['authorities'],
    options: MemorialWorkflowOptions,
    audit: MemorialWorkflowAudit,
  ) {
    const argumentResult = await this.stage(audit, `5 — ${this.title(side)} argument architecture and drafting`, async () =>
      this.argumentEngine.build(side, issues, authorities, graph, options),
    (value) => `${value.arguments.length} issue blocks and approximately ${value.arguments.reduce((sum, item) => sum + item.wordCount, 0)} argument words drafted.`,
    (value) => !value.usedAi ? value.warning : undefined);
    if (argumentResult.warning) audit.warnings.push(argumentResult.warning);

    let argumentsDraft = argumentResult.arguments;
    let compiled = this.compiler.compile(side, blueprint, graph, issues, authorities, argumentsDraft);
    let quality = await this.judge.score(compiled.sections, argumentsDraft, authorities, blueprint, options);

    const threshold = options.qualityThreshold || 92;
    if ((quality.total < threshold || quality.blockingErrors.length > 0) && argumentResult.usedAi) {
      const revisionOptions: MemorialWorkflowOptions = {
        ...options,
        depth: options.depth === 'standard' ? 'deep' : 'exhaustive',
        revisionInstructions: [
          ...quality.blockingErrors,
          ...quality.warnings,
          `The replacement must reach the ${threshold}/100 filing-readiness threshold. Rewrite weak issue blocks completely; do not merely append generic paragraphs.`,
        ].slice(0, 18),
      };
      const revised = await this.stage(audit, `8 — ${this.title(side)} targeted rewrite after quality gate`, async () =>
        this.argumentEngine.build(side, issues, authorities, graph, revisionOptions),
      (value) => `Replacement draft produced with approximately ${value.arguments.reduce((sum, item) => sum + item.wordCount, 0)} argument words.`,
      (value) => !value.usedAi ? value.warning : undefined);
      if (revised.usedAi) {
        argumentsDraft = revised.arguments;
        compiled = this.compiler.compile(side, blueprint, graph, issues, authorities, argumentsDraft);
        quality = await this.judge.score(compiled.sections, argumentsDraft, authorities, blueprint, revisionOptions);
      }
    }

    await this.stage(audit, `9 — ${this.title(side)} filing-readiness gate`, async () => quality,
      (value) => `Quality score ${value.total}/100; ${value.blockingErrors.length} blocking error(s); ${value.warnings.length} warning(s).`,
      (value) => value.blockingErrors.length ? `Filing is blocked: ${value.blockingErrors.join(' | ')}` : value.total < threshold ? `Draft remains below the requested ${threshold}/100 threshold.` : undefined);

    if (quality.blockingErrors.length) {
      audit.warnings.push(`${this.title(side)} memorial has filing blockers: ${quality.blockingErrors.join(' | ')}`);
    } else if (quality.total < threshold) {
      audit.warnings.push(`${this.title(side)} memorial scored ${quality.total}/100, below the requested ${threshold}/100 threshold.`);
    }

    return {
      arguments: argumentsDraft,
      sections: compiled.sections,
      renderModel: compiled.renderModel,
      quality,
      markdown: compiled.markdown,
    };
  }

  private normalizeOptions(input: RunInput): MemorialWorkflowOptions {
    const depth = ['standard', 'deep', 'exhaustive'].includes(String(input.depth)) ? input.depth : 'exhaustive';
    const citationStyle = ['bluebook', 'oscola', 'indian', 'scc'].includes(String(input.citationStyle)) ? input.citationStyle : 'bluebook';
    const side = ['petitioner', 'respondent', 'both'].includes(String(input.side)) ? input.side : 'both';
    return {
      ...input,
      side,
      depth,
      citationStyle,
      qualityThreshold: this.clamp(Number(input.qualityThreshold || 92), 75, 98),
      maxWords: input.maxWords ? this.clamp(Number(input.maxWords), 2500, 25000) : undefined,
      maxPages: input.maxPages ? this.clamp(Number(input.maxPages), 8, 80) : undefined,
      allowUnverifiedAuthorities: Boolean(input.allowUnverifiedAuthorities),
      selectedSources: Array.isArray(input.selectedSources) ? input.selectedSources : [],
    };
  }

  private assertBlueprintIsUsable(blueprint: MemorialWorkflowResult['blueprint']) {
    const highMateriality = blueprint.facts.filter((fact) => fact.materiality === 'high').length;
    const junk = blueprint.facts.filter((fact) => /participants are invited|aims to foster|proposition is situated|team shall|speaker|researcher|organis(?:ing|ing) committee|lawctopus|resolvify|patron|convener/i.test(fact.text));
    if (blueprint.facts.length < 6 || highMateriality < 3) {
      throw new BadRequestException(
        'The proposition blueprint does not contain enough material case facts. Generation has been stopped rather than producing another shallow memorial. Review the source classification or provide a cleaner proposition file.',
      );
    }
    if (junk.length > 0) {
      throw new BadRequestException(
        `The proposition blueprint still contains non-case brochure/rule content (${junk.slice(0, 3).map((fact) => fact.id).join(', ')}). Generation has been stopped to protect memorial quality.`,
      );
    }
  }

  private async stage<T>(
    audit: MemorialWorkflowAudit,
    stage: string,
    work: () => Promise<T> | T,
    describe: (value: T) => string,
    warning?: (value: T) => string | undefined,
  ): Promise<T> {
    const startedAt = new Date().toISOString();
    try {
      const value = await work();
      const warningText = warning?.(value);
      audit.stages.push({
        stage,
        status: warningText ? 'fallback' : 'completed',
        details: warningText || describe(value),
        startedAt,
        completedAt: new Date().toISOString(),
      });
      if (warningText) audit.warnings.push(warningText);
      return value;
    } catch (error: any) {
      audit.stages.push({
        stage,
        status: 'failed',
        details: error?.message || String(error),
        startedAt,
        completedAt: new Date().toISOString(),
      });
      this.logger.error(`${stage} failed: ${error?.message || error}`);
      throw error;
    }
  }

  private title(side: string) { return side.charAt(0).toUpperCase() + side.slice(1); }
  private clamp(value: number, min: number, max: number) { return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min; }
}
