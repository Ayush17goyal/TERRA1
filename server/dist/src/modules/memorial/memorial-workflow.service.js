"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MemorialWorkflowService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorialWorkflowService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const proposition_preservation_service_1 = require("./proposition-preservation.service");
const proposition_intelligence_service_1 = require("./proposition-intelligence.service");
const case_graph_service_1 = require("./case-graph.service");
const issue_engine_service_1 = require("./issue-engine.service");
const authority_engine_service_1 = require("./authority-engine.service");
const argument_engine_service_1 = require("./argument-engine.service");
const memorial_compiler_service_1 = require("./memorial-compiler.service");
const memorial_judge_service_1 = require("./memorial-judge.service");
let MemorialWorkflowService = MemorialWorkflowService_1 = class MemorialWorkflowService {
    constructor(preservation, propositionIntelligence, graphService, issueEngine, authorityEngine, argumentEngine, compiler, judge) {
        this.preservation = preservation;
        this.propositionIntelligence = propositionIntelligence;
        this.graphService = graphService;
        this.issueEngine = issueEngine;
        this.authorityEngine = authorityEngine;
        this.argumentEngine = argumentEngine;
        this.compiler = compiler;
        this.judge = judge;
        this.logger = new common_1.Logger(MemorialWorkflowService_1.name);
        this.referenceCache = new Map();
    }
    async run(input) {
        let options = this.normalizeOptions(input);
        const audit = {
            version: '3.0.0-reference-format',
            stages: [],
            warnings: [],
        };
        const references = await this.stage(audit, '0 — Reference classification and authority ordering', async () => this.analyzeReferences(input.referenceFiles || []), (value) => `${value.length} reference document(s) classified without using sample facts as proposition facts.`);
        options = this.applyReferenceRules(options, references);
        const document = await this.stage(audit, '0A — Full document preservation', async () => {
            const extracted = await this.preservation.extractDocument(input.file, input.propositionText);
            if (!extracted.rawText || extracted.rawText.trim().length < 500) {
                throw new common_1.BadRequestException('A complete moot proposition is required. The preservation layer rejected a short or empty extraction because generating from partial text would produce an unreliable memorial.');
            }
            return extracted;
        }, (value) => `${value.pages.length} page(s), ${value.rawText.length} characters preserved without early summarisation.`);
        const dossier = await this.stage(audit, '0B — Page and paragraph evidence locker', async () => this.preservation.buildDossier(document, input.sourceName || input.file?.originalname || 'moot proposition'), (value) => `${value.paragraphs.length} source-addressable paragraphs created across ${value.pages.length} page(s).`);
        const propositionResult = await this.stage(audit, '1 — Proposition intelligence and coverage audit', async () => this.propositionIntelligence.analyze(dossier, options), (value) => `${value.blueprint.facts.length} case facts, ${value.blueprint.explicitIssues.length} express issues, ${value.blueprint.coverage.coveragePercent}% source classification coverage.`, (value) => !value.usedAi ? value.warning : undefined);
        if (propositionResult.warning)
            audit.warnings.push(propositionResult.warning);
        const blueprint = propositionResult.blueprint;
        this.assertBlueprintIsUsable(blueprint);
        const graph = await this.stage(audit, '2 — Case graph and burden map', async () => this.graphService.build(dossier, blueprint), (value) => `${value.facts.length} facts, ${value.parties.length} parties, ${value.evidenceInventory.length} evidence items, ${value.burdens.length} burden rules mapped.`);
        const issueResult = await this.stage(audit, '3 — Issue architecture', async () => this.issueEngine.generate(graph, blueprint, options), (value) => `${value.issues.length} issues generated with separate petitioner and respondent theories.`, (value) => !value.usedAi ? value.warning : undefined);
        if (issueResult.warning)
            audit.warnings.push(issueResult.warning);
        const issues = issueResult.issues;
        if (issues.length < 2)
            throw new common_1.BadRequestException('The issue architecture contains fewer than two usable issues. Review the extracted blueprint before memorial generation.');
        const authorityResult = await this.stage(audit, '4 — Verified authority research and issue mapping', async () => this.authorityEngine.generate(issues, blueprint, options), (value) => `${value.authorities.filter((authority) => authority.verified).length} verified authorities mapped across ${new Set(value.authorities.map((authority) => authority.issueId)).size}/${issues.length} issues.`, (value) => !value.usedAi ? value.warning : undefined);
        if (authorityResult.warning)
            audit.warnings.push(authorityResult.warning);
        const authorities = authorityResult.authorities;
        const result = {
            dossier,
            blueprint,
            graph,
            issues,
            authorities,
            audit,
            references,
        };
        const sides = options.side === 'both' || !options.side
            ? ['petitioner', 'respondent']
            : [options.side];
        const sideResults = await Promise.all(sides.map(async (side) => ({
            side,
            value: await this.generateSide(side, dossier, blueprint, graph, issues, authorities, options, audit),
        })));
        sideResults.forEach(({ side, value }) => { result[side] = value; });
        return result;
    }
    async extractBlueprint(input) {
        let options = this.normalizeOptions(input);
        const audit = { version: '3.0.0-reference-format', stages: [], warnings: [] };
        const references = await this.stage(audit, '0 — Reference classification and authority ordering', async () => this.analyzeReferences(input.referenceFiles || []), (value) => `${value.length} reference document(s) classified.`);
        options = this.applyReferenceRules(options, references);
        const document = await this.stage(audit, '0A — Full document preservation', async () => {
            const extracted = await this.preservation.extractDocument(input.file, input.propositionText);
            if (!extracted.rawText || extracted.rawText.trim().length < 500) {
                throw new common_1.BadRequestException('A complete moot proposition is required for blueprint extraction.');
            }
            return extracted;
        }, (value) => `${value.pages.length} page(s) preserved.`);
        const dossier = await this.stage(audit, '0B — Page and paragraph evidence locker', async () => this.preservation.buildDossier(document, input.sourceName || input.file?.originalname || 'moot proposition'), (value) => `${value.paragraphs.length} source-addressable paragraphs created.`);
        const propositionResult = await this.stage(audit, '1 — Proposition intelligence and coverage audit', async () => this.propositionIntelligence.analyze(dossier, options), (value) => `${value.blueprint.facts.length} facts and ${value.blueprint.explicitIssues.length} issues extracted.`, (value) => !value.usedAi ? value.warning : undefined);
        if (propositionResult.warning)
            audit.warnings.push(propositionResult.warning);
        this.assertBlueprintIsUsable(propositionResult.blueprint);
        const graph = this.graphService.build(dossier, propositionResult.blueprint);
        return { dossier, blueprint: propositionResult.blueprint, graph, references, audit };
    }
    async analyzeReferences(files) {
        const analyses = await Promise.all(files.slice(0, 12).map((file) => {
            const buffer = Buffer.isBuffer(file?.buffer) ? file.buffer : Buffer.from(file?.buffer || '');
            const cacheKey = (0, crypto_1.createHash)('sha256').update(buffer).digest('hex');
            const cached = this.referenceCache.get(cacheKey);
            if (cached)
                return cached;
            const pending = this.analyzeReference(file).catch((error) => {
                this.referenceCache.delete(cacheKey);
                throw error;
            });
            this.referenceCache.set(cacheKey, pending);
            return pending;
        }));
        return analyses.sort((a, b) => a.authorityLevel - b.authorityLevel);
    }
    async analyzeReference(file) {
        const extracted = await this.preservation.extractDocument(file);
        const fileName = String(file?.originalname || 'reference document');
        const haystack = `${fileName}\n${extracted.rawText.slice(0, 60000)}`.toLowerCase();
        let category = 'other';
        let authorityLevel = 7;
        let contentUse = 'other';
        if (/competition rules|specific instructions|brochure|schedule|scoring criteria|penal deductions/i.test(haystack) && !/master guide|drafting rulebook/i.test(haystack)) {
            category = 'competition_rules';
            authorityLevel = 2;
            contentUse = 'formatting';
        }
        else if (/template/i.test(fileName) && /petitioner|appellant/i.test(haystack)) {
            category = 'petitioner_template';
            authorityLevel = 3;
            contentUse = 'structure';
        }
        else if (/template/i.test(fileName) && /respondent|defendant/i.test(haystack)) {
            category = 'respondent_template';
            authorityLevel = 3;
            contentUse = 'structure';
        }
        else if (/rulebook|drafting master guide|formatting rules|technical formatting|handbook/i.test(haystack)) {
            category = 'drafting_rulebook';
            authorityLevel = 4;
            contentUse = 'formatting';
        }
        else if (/completed|winning/i.test(fileName) && /memorial on behalf of the petitioner|memorial for the petitioner/i.test(haystack)) {
            category = 'completed_petitioner_memorial';
            authorityLevel = 5;
            contentUse = 'example';
        }
        else if (/completed|winning/i.test(fileName) && /memorial on behalf of the respondent|memorial for the respondent/i.test(haystack)) {
            category = 'completed_respondent_memorial';
            authorityLevel = 5;
            contentUse = 'example';
        }
        else if (/memorial on behalf of the petitioner|memorial for the petitioner/i.test(haystack)) {
            category = 'completed_petitioner_memorial';
            authorityLevel = 5;
            contentUse = 'example';
        }
        else if (/memorial on behalf of the respondent|memorial for the respondent/i.test(haystack)) {
            category = 'completed_respondent_memorial';
            authorityLevel = 5;
            contentUse = 'example';
        }
        else if (/practice|sample|mock/i.test(fileName) || /practice memorial|sample memorial/i.test(haystack)) {
            category = 'practice_material';
            authorityLevel = 6;
            contentUse = 'example';
        }
        else if (/moot proposition|compromis|statement of facts|issues raised/i.test(haystack)) {
            category = 'moot_proposition';
            authorityLevel = 2;
            contentUse = 'case_material';
        }
        else if (/citation|case law|legal research|authorit|compilation/i.test(haystack)) {
            category = 'legal_research';
            authorityLevel = 6;
            contentUse = 'case_material';
        }
        const rules = [
            /blue cover|blue background/i.test(haystack) ? 'Petitioner/Appellant cover must have a solid blue full-page background.' : '',
            /red cover|red background/i.test(haystack) ? 'Respondent/Defendant cover must have a solid red full-page background.' : '',
            /times new roman/i.test(haystack) ? 'Use Times New Roman throughout.' : '',
            /10\s*(?:points?|pt).*footnote|footnote[^\n]{0,50}10\s*(?:points?|pt)/i.test(haystack) ? 'Use 10 pt footnotes with single line spacing.' : '',
            /12\s*(?:points?|pt).*body|body[^\n]{0,50}12\s*(?:points?|pt)/i.test(haystack) ? 'Use 12 pt body text with 1.5 line spacing.' : '',
            /1\.5\s*(?:line )?spacing/i.test(haystack) ? 'Use 1.5 line spacing for body text, fully justified.' : '',
            /1\s*inch|2\.54\s*cm/i.test(haystack) ? 'Maintain 1-inch (2.54 cm) margins on all 4 sides.' : '',
            /page border|box border/i.test(haystack) ? 'Apply single box border (0.5 pt - 1 pt) on all pages.' : '',
            /roman[^\n]{0,100}prelim|prelim[^\n]{0,100}roman/i.test(haystack) ? 'Use lowercase Roman numerals for preliminary pages (i, ii, iii...).' : '',
            /arabic[^\n]{0,100}arguments|arguments[^\n]{0,100}arabic/i.test(haystack) ? 'Begin Arabic pagination (1, 2...) at Arguments Advanced.' : '',
            /anonym/i.test(haystack) ? 'Preserve 100% anonymity: identify participants only by assigned team code.' : '',
        ].filter(Boolean);
        return { fileName, category, authorityLevel, pageCount: extracted.pages.length, extractedRules: rules, contentUse };
    }
    applyReferenceRules(options, references) {
        const authoritativeRules = references
            .filter((reference) => reference.authorityLevel <= 4)
            .flatMap((reference) => reference.extractedRules.map((rule) => `[${reference.category}] ${rule}`));
        return {
            ...options,
            competitionRulesText: [options.competitionRulesText, ...authoritativeRules].filter(Boolean).join('\n'),
        };
    }
    async generateSide(side, dossier, blueprint, graph, issues, authorities, options, audit) {
        const argumentResult = await this.stage(audit, `5 — ${this.title(side)} argument architecture and drafting`, async () => this.argumentEngine.build(side, issues, authorities, graph, options), (value) => `${value.arguments.length} issue blocks and approximately ${value.arguments.reduce((sum, item) => sum + item.wordCount, 0)} argument words drafted.`, (value) => !value.usedAi ? value.warning : undefined);
        if (argumentResult.warning)
            audit.warnings.push(argumentResult.warning);
        let argumentsDraft = argumentResult.arguments;
        let compiled = this.compiler.compile(side, blueprint, graph, issues, authorities, argumentsDraft);
        let quality = await this.judge.score(compiled.sections, argumentsDraft, authorities, blueprint, options);
        const threshold = options.qualityThreshold || 92;
        if ((quality.total < threshold || quality.blockingErrors.length > 0) && argumentResult.usedAi) {
            const revisionOptions = {
                ...options,
                depth: options.depth === 'standard' ? 'deep' : 'exhaustive',
                revisionInstructions: [
                    ...quality.blockingErrors,
                    ...quality.warnings,
                    `The replacement must reach the ${threshold}/100 filing-readiness threshold. Rewrite weak issue blocks completely; do not merely append generic paragraphs.`,
                ].slice(0, 18),
            };
            const revised = await this.stage(audit, `8 — ${this.title(side)} targeted rewrite after quality gate`, async () => this.argumentEngine.build(side, issues, authorities, graph, revisionOptions), (value) => `Replacement draft produced with approximately ${value.arguments.reduce((sum, item) => sum + item.wordCount, 0)} argument words.`, (value) => !value.usedAi ? value.warning : undefined);
            if (revised.usedAi) {
                argumentsDraft = revised.arguments;
                compiled = this.compiler.compile(side, blueprint, graph, issues, authorities, argumentsDraft);
                quality = await this.judge.score(compiled.sections, argumentsDraft, authorities, blueprint, revisionOptions);
            }
        }
        await this.stage(audit, `9 — ${this.title(side)} filing-readiness gate`, async () => quality, (value) => `Quality score ${value.total}/100; ${value.blockingErrors.length} blocking error(s); ${value.warnings.length} warning(s).`, (value) => value.blockingErrors.length ? `Filing is blocked: ${value.blockingErrors.join(' | ')}` : value.total < threshold ? `Draft remains below the requested ${threshold}/100 threshold.` : undefined);
        if (quality.blockingErrors.length) {
            audit.warnings.push(`${this.title(side)} memorial has filing blockers: ${quality.blockingErrors.join(' | ')}`);
        }
        else if (quality.total < threshold) {
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
    normalizeOptions(input) {
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
    assertBlueprintIsUsable(blueprint) {
        const highMateriality = blueprint.facts.filter((fact) => fact.materiality === 'high').length;
        const junk = blueprint.facts.filter((fact) => /participants are invited|aims to foster|proposition is situated|team shall|speaker|researcher|organis(?:ing|ing) committee|lawctopus|resolvify|patron|convener/i.test(fact.text));
        if (blueprint.facts.length < 6 || highMateriality < 3) {
            throw new common_1.BadRequestException('The proposition blueprint does not contain enough material case facts. Generation has been stopped rather than producing another shallow memorial. Review the source classification or provide a cleaner proposition file.');
        }
        if (junk.length > 0) {
            throw new common_1.BadRequestException(`The proposition blueprint still contains non-case brochure/rule content (${junk.slice(0, 3).map((fact) => fact.id).join(', ')}). Generation has been stopped to protect memorial quality.`);
        }
    }
    async stage(audit, stage, work, describe, warning) {
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
            if (warningText)
                audit.warnings.push(warningText);
            return value;
        }
        catch (error) {
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
    title(side) { return side.charAt(0).toUpperCase() + side.slice(1); }
    clamp(value, min, max) { return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min; }
};
exports.MemorialWorkflowService = MemorialWorkflowService;
exports.MemorialWorkflowService = MemorialWorkflowService = MemorialWorkflowService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [proposition_preservation_service_1.PropositionPreservationService,
        proposition_intelligence_service_1.PropositionIntelligenceService,
        case_graph_service_1.CaseGraphService,
        issue_engine_service_1.IssueEngineService,
        authority_engine_service_1.AuthorityEngineService,
        argument_engine_service_1.ArgumentEngineService,
        memorial_compiler_service_1.MemorialCompilerService,
        memorial_judge_service_1.MemorialJudgeService])
], MemorialWorkflowService);
//# sourceMappingURL=memorial-workflow.service.js.map