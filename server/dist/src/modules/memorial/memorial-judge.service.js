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
var MemorialJudgeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemorialJudgeService = void 0;
const common_1 = require("@nestjs/common");
const memorial_ai_service_1 = require("./memorial-ai.service");
const memorial_prompts_1 = require("./memorial-prompts");
let MemorialJudgeService = MemorialJudgeService_1 = class MemorialJudgeService {
    constructor(ai) {
        this.ai = ai;
        this.logger = new common_1.Logger(MemorialJudgeService_1.name);
    }
    async score(sections, args, authorities, blueprint, options) {
        const deterministic = this.deterministic(sections, args, authorities, blueprint);
        try {
            const aiAudit = await this.ai.json({
                system: memorial_prompts_1.MEMORIAL_SYSTEM,
                prompt: (0, memorial_prompts_1.qualityPrompt)(JSON.stringify({
                    sections: {
                        cover: sections.cover,
                        jurisdiction: sections.jurisdiction,
                        statementOfFacts: sections.statementOfFacts,
                        issuesRaised: sections.issuesRaised,
                        summaryOfArguments: sections.summaryOfArguments,
                        argumentsAdvanced: sections.argumentsAdvanced.slice(0, 70_000),
                        prayer: sections.prayer,
                    },
                    arguments: args.map((a) => ({ issueId: a.issueId, thesis: a.thesis, wordCount: a.wordCount, factIds: a.factIds, subArguments: a.subArguments })),
                    authorities: authorities.map((a) => ({ id: a.id, issueId: a.issueId, citation: a.citation, verified: a.verified, relevanceReason: a.relevanceReason })),
                    blueprintFacts: blueprint.facts.map((f) => ({ id: f.id, text: f.text })),
                    metadata: blueprint.caseMetadata,
                }), options.qualityThreshold || 92),
                options,
                maxTokens: 3500,
                stage: 'memorial-quality-audit',
            });
            const aiScore = this.clamp(Number(aiAudit?.score || deterministic.total), 0, 100);
            const blockingErrors = Array.from(new Set([...deterministic.blockingErrors, ...this.stringArray(aiAudit?.blockingErrors)]));
            const warnings = Array.from(new Set([...deterministic.warnings, ...this.stringArray(aiAudit?.warnings), ...this.stringArray(aiAudit?.rewriteInstructions)]));
            const total = blockingErrors.length ? Math.min(deterministic.total, aiScore, 79) : Math.round((deterministic.total * 0.6) + (aiScore * 0.4));
            return { ...deterministic, total, blockingErrors, warnings, diagnostics: { ...deterministic.diagnostics, aiJudgeScore: aiScore, aiWeakIssueCount: this.stringArray(aiAudit?.weakIssueIds).length } };
        }
        catch (error) {
            this.logger.warn(`Memorial AI quality audit unavailable: ${error?.message || error}`);
            deterministic.warnings.push('AI quality audit was unavailable; deterministic quality gates were applied.');
            return deterministic;
        }
    }
    deterministic(sections, args, authorities, blueprint) {
        const warnings = [];
        const blockingErrors = [];
        const combined = Object.values(sections).join('\n');
        const allSectionsPresent = Object.values(sections).every((value) => String(value || '').trim().length > 0);
        const structure = allSectionsPresent ? 10 : 5;
        if (!allSectionsPresent)
            blockingErrors.push('One or more mandatory memorial sections are missing.');
        const issueFraming = args.length >= 2 && args.length <= 6 && args.every((a) => a.thesis.length > 45 && a.subArguments.length >= 3) ? 10 : 6;
        if (!args.length)
            blockingErrors.push('No issue arguments were generated.');
        if (args.some((a) => a.subArguments.length < 3))
            blockingErrors.push('At least one issue lacks a developed sub-issue architecture.');
        const verifiedAuthorities = authorities.filter((a) => a.verified && this.isValidCitation(a.citation));
        const issueCoverage = new Set(verifiedAuthorities.map((a) => a.issueId)).size;
        const legalResearch = Math.min(15, 5 + Math.round(verifiedAuthorities.length / Math.max(1, args.length)) + issueCoverage);
        if (issueCoverage < args.length)
            blockingErrors.push('At least one issue lacks a verified, issue-specific authority set.');
        if (authorities.some((a) => !a.verified))
            warnings.push('Unverified authority suggestions remain in the research workspace and must not be filed without checking.');
        if (authorities.some((a) => !this.isValidCitation(a.citation)))
            blockingErrors.push('A narrative sentence or malformed item was classified as a legal authority.');
        const validFactIds = new Set(blueprint.facts.map((f) => f.id));
        const groundedBlocks = args.filter((a) => a.factIds.length && a.factIds.every((id) => validFactIds.has(id))).length;
        const developedApplications = args.filter((a) => a.application.length > 700 && a.subArguments.every((s) => s.analysis.join(' ').length > 350)).length;
        const factApplication = Math.min(15, 5 + Math.round((groundedBlocks / Math.max(1, args.length)) * 5) + Math.round((developedApplications / Math.max(1, args.length)) * 5));
        if (groundedBlocks < args.length)
            blockingErrors.push('At least one issue contains no valid proposition fact references.');
        if (developedApplications < args.length)
            warnings.push('At least one issue requires deeper fact-to-rule application.');
        const counterArguments = args.every((a) => a.counterArgument.length > 60 && a.rebuttal.length > 90 && a.subArguments.every((s) => s.counterArgument?.length > 35 && s.rebuttal?.length > 55)) ? 10 : 6;
        if (counterArguments < 9)
            warnings.push('Counterargument and rebuttal depth is inconsistent across issues.');
        const correctCover = /COVER COLOU?R:\s*(BLUE|RED)/i.test(sections.cover)
            && /WRITTEN SUBMISSION ON BEHALF OF THE (PETITIONER|RESPONDENT)/i.test(sections.cover)
            && !/SUPREME COURT,\s*HIGH COURT/i.test(sections.cover);
        const formatting = correctCover && /TABLE OF ABBREVIATIONS/i.test(combined) ? 8 : 5;
        if (!correctCover)
            blockingErrors.push('Cover metadata is incomplete, side-inconsistent, or contains an invalid court heading.');
        const citedSubArguments = args.flatMap((a) => a.subArguments).filter((s) => s.authorityIds.length > 0).length;
        const totalSubArguments = args.flatMap((a) => a.subArguments).length;
        const citationCoverage = totalSubArguments ? citedSubArguments / totalSubArguments : 0;
        const citationQuality = Math.min(10, 4 + Math.round((verifiedAuthorities.length / Math.max(1, authorities.length)) * 3) + Math.round(citationCoverage * 3));
        if (citationCoverage < 0.9)
            warnings.push('Some sub-arguments lack verified citation support.');
        const junkPatterns = /participants are invited|aims to foster|proposition is situated|critical thinking|advocacy skills|team shall|speaker|researcher|organis(?:ing|ing) committee|lawctopus|resolvify|patron|convener|page limit|blue cover|red cover/i;
        const internalPatterns = /\bF\d+\s*:|\bAUTH[_-]?\d+\b|the preserved record|this sub-proposition|applicable constitutional and statutory provision/i;
        const factsContainIssueDump = /ISSUES? (?:RAISED|FOR CONSIDERATION)\s*:/i.test(sections.statementOfFacts);
        const hasJunk = junkPatterns.test(sections.statementOfFacts) || junkPatterns.test(sections.argumentsAdvanced);
        const internalLeak = internalPatterns.test(combined);
        const sourceGrounding = (hasJunk || internalLeak || factsContainIssueDump) ? 0 : Math.min(10, 5 + Math.round((blueprint.coverage.coveragePercent / 100) * 5));
        if (hasJunk)
            blockingErrors.push('Brochure, concept-note, organiser, or competition-rule text leaked into case facts or arguments.');
        if (internalLeak)
            blockingErrors.push('Internal fact or authority identifiers, or drafting scaffold language, leaked into the memorial.');
        if (factsContainIssueDump)
            blockingErrors.push('The Statement of Facts contains a copied issue-list block.');
        if (blueprint.coverage.coveragePercent < 70)
            warnings.push(`Proposition coverage is only ${blueprint.coverage.coveragePercent}%; unresolved source paragraphs should be reviewed.`);
        const isPetitioner = /BEHALF OF THE PETITIONER/i.test(sections.cover);
        const sideConfusion = isPetitioner
            ? /BEHALF OF THE RESPONDENT/i.test(sections.cover) || /RESPONDENT most respectfully prays/i.test(sections.prayer)
            : /BEHALF OF THE PETITIONER/i.test(sections.cover) || /PETITIONER most respectfully prays/i.test(sections.prayer);
        const sideConsistency = sideConfusion ? 0 : 7;
        if (sideConfusion)
            blockingErrors.push('The cover, arguments, or prayer use the wrong memorial side.');
        const repeatedRatio = this.repetitionRatio(args.flatMap((a) => [a.application, ...a.subArguments.flatMap((s) => s.analysis)]).join('\n\n'));
        const repetitionControl = repeatedRatio > 0.24 ? 2 : repeatedRatio > 0.14 ? 5 : 7;
        if (repeatedRatio > 0.24)
            blockingErrors.push('Arguments repeat materially identical paragraphs across issues.');
        else if (repeatedRatio > 0.14)
            warnings.push('Some argument paragraphs are repetitive across issues.');
        const totalWords = args.reduce((sum, a) => sum + a.wordCount, 0);
        const minimumWords = Math.max(5000, args.length * 1150);
        if (totalWords < minimumWords)
            warnings.push(`Arguments Advanced are shallow at approximately ${totalWords} words; the target for this issue count is at least ${minimumWords}.`);
        const rawTotal = structure + issueFraming + legalResearch + factApplication + counterArguments + formatting + citationQuality + sourceGrounding + sideConsistency + repetitionControl;
        const total = blockingErrors.length ? Math.min(rawTotal, 79) : Math.min(rawTotal, 100);
        return {
            total,
            structure,
            issueFraming,
            legalResearch,
            factApplication,
            counterArguments,
            formatting,
            citationQuality,
            sourceGrounding,
            sideConsistency,
            repetitionControl,
            warnings,
            blockingErrors,
            diagnostics: {
                argumentWordCount: totalWords,
                verifiedAuthorityCount: verifiedAuthorities.length,
                issueAuthorityCoverage: `${issueCoverage}/${args.length}`,
                citationCoverage: Number(citationCoverage.toFixed(3)),
                propositionCoveragePercent: blueprint.coverage.coveragePercent,
                unresolvedParagraphs: blueprint.coverage.unresolved,
                repetitionRatio: Number(repeatedRatio.toFixed(3)),
                junkLeakage: hasJunk,
                internalIdentifierLeakage: internalLeak,
                factIssueDump: factsContainIssueDump,
            },
        };
    }
    isValidCitation(citation) {
        const text = String(citation || '').replace(/\s+/g, ' ').trim();
        if (!text || text.length > 240)
            return false;
        if (/\b(was alleged|complainant|accused was|during matrimonial|morphed images|phone number|investigation revealed)\b/i.test(text))
            return false;
        return /\b(v\.?|versus)\b/i.test(text)
            || /\b(Article|Section|Rule|Regulation|Act|Constitution|Treaty|Convention|Code|Sanhita|Adhiniyam|Report)\b/i.test(text)
            || /\(\d{4}\)\s*\d+\s*(SCC|SCR|AIR)/i.test(text);
    }
    repetitionRatio(text) {
        const paragraphs = String(text || '').split(/\n{2,}/).map((p) => p.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()).filter((p) => p.length > 80);
        if (paragraphs.length < 2)
            return 0;
        let duplicates = 0;
        for (let i = 0; i < paragraphs.length; i += 1) {
            for (let j = i + 1; j < paragraphs.length; j += 1) {
                if (this.jaccard(paragraphs[i], paragraphs[j]) > 0.82) {
                    duplicates += 1;
                    break;
                }
            }
        }
        return duplicates / paragraphs.length;
    }
    jaccard(a, b) {
        const sa = new Set(a.split(' '));
        const sb = new Set(b.split(' '));
        const intersection = [...sa].filter((x) => sb.has(x)).length;
        const union = new Set([...sa, ...sb]).size || 1;
        return intersection / union;
    }
    stringArray(value) { return (Array.isArray(value) ? value : []).map(String).filter(Boolean); }
    clamp(value, min, max) { return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min; }
};
exports.MemorialJudgeService = MemorialJudgeService;
exports.MemorialJudgeService = MemorialJudgeService = MemorialJudgeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [memorial_ai_service_1.MemorialAiService])
], MemorialJudgeService);
//# sourceMappingURL=memorial-judge.service.js.map