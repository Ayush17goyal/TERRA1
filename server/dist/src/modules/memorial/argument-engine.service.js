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
var ArgumentEngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArgumentEngineService = void 0;
const common_1 = require("@nestjs/common");
const memorial_ai_service_1 = require("./memorial-ai.service");
const memorial_prompts_1 = require("./memorial-prompts");
let ArgumentEngineService = ArgumentEngineService_1 = class ArgumentEngineService {
    constructor(ai) {
        this.ai = ai;
        this.logger = new common_1.Logger(ArgumentEngineService_1.name);
    }
    async build(side, issues, authorities, graph, options) {
        const blocks = [];
        const warnings = [];
        let aiBlocks = 0;
        for (const issue of issues) {
            try {
                const block = await this.buildIssue(side, issue, authorities, graph, options);
                blocks.push(block);
                aiBlocks += 1;
            }
            catch (error) {
                this.logger.warn(`Issue-specific argument fallback used for ${side}/${issue.id}: ${error?.message || error}`);
                blocks.push(this.fallbackBlock(side, issue, authorities, graph));
                warnings.push(`${issue.id}: ${error?.message || error}`);
            }
        }
        const usedAi = aiBlocks === issues.length;
        return {
            arguments: blocks,
            usedAi,
            warning: warnings.length
                ? `Issue-specific deterministic fallback was used for ${warnings.length} issue(s): ${warnings.join(' | ')}`
                : undefined,
        };
    }
    async buildIssue(side, issue, authorities, graph, options) {
        const issueAuthorities = authorities.filter((authority) => authority.issueId === issue.id
            && (authority.sideUsefulness === side || authority.sideUsefulness === 'both'));
        const issueFacts = this.issueFacts(issue, graph);
        const prompt = this.buildPrompt(side, issue, issueAuthorities, issueFacts, graph, options);
        const tokenBudget = options.depth === 'exhaustive' ? 5200 : options.depth === 'standard' ? 3200 : 4300;
        let raw = await this.ai.json({
            system: memorial_prompts_1.MEMORIAL_SYSTEM,
            prompt,
            options,
            maxTokens: tokenBudget,
            stage: `argument-generation-${side}-${issue.id}`,
        });
        let block = this.normalizeIssue(raw?.argument || raw?.arguments?.[0], side, issue, issueAuthorities, graph);
        const minimumWords = Math.max(650, Math.round(issue.targetWordCount * 0.55));
        if (block.wordCount < minimumWords || block.subArguments.length < Math.min(3, issue.subIssues.length)) {
            raw = await this.ai.json({
                system: memorial_prompts_1.MEMORIAL_SYSTEM,
                prompt: `${prompt}\n\nThe prior answer was too short or incomplete. Return a replacement argument for this issue only. Develop every supplied sub-issue with multiple fact-specific application paragraphs. Target at least ${Math.max(900, Math.round(issue.targetWordCount * 0.75))} words. Do not print fact IDs or authority IDs in prose.`,
                options,
                maxTokens: tokenBudget + 1200,
                stage: `argument-expansion-${side}-${issue.id}`,
            });
            block = this.normalizeIssue(raw?.argument || raw?.arguments?.[0], side, issue, issueAuthorities, graph);
        }
        if (block.wordCount < Math.max(500, Math.round(issue.targetWordCount * 0.35))) {
            throw new Error(`AI draft remained under-depth at ${block.wordCount} words.`);
        }
        return block;
    }
    buildPrompt(side, issue, authorities, facts, graph, options) {
        const issuePayload = [{
                id: issue.id,
                issue: issue.issue,
                sidePosition: side === 'petitioner' ? issue.petitionerPosition : issue.respondentPosition,
                opposingPosition: side === 'petitioner' ? issue.respondentPosition : issue.petitionerPosition,
                subIssues: issue.subIssues,
                legalTests: issue.legalTests,
                factIds: issue.factIds,
                legalAnchors: issue.legalAnchors,
                burden: issue.burden,
                reliefConsequence: issue.reliefConsequence,
                targetWordCount: issue.targetWordCount,
            }];
        const factPayload = facts.map((fact) => ({
            id: fact.id,
            text: fact.text,
            kind: fact.kind,
            status: fact.status,
            materiality: fact.materiality,
            source: graph.sourceMap[fact.id],
        }));
        const authorityPayload = authorities.map((authority) => ({
            id: authority.id,
            issueId: authority.issueId,
            type: authority.type,
            citation: authority.citation,
            ratioOrRule: authority.ratioOrRule,
            proposition: authority.proposition,
            risk: authority.risk,
            verified: authority.verified,
        }));
        const basePrompt = (0, memorial_prompts_1.argumentPrompt)({
            side,
            issues: JSON.stringify(issuePayload),
            facts: JSON.stringify(factPayload),
            authorities: JSON.stringify(authorityPayload),
            depth: options.depth || 'deep',
            totalWords: issue.targetWordCount,
        });
        const revision = options.revisionInstructions?.length
            ? `\n\nMANDATORY QUALITY-GATE REWRITE INSTRUCTIONS:\n${options.revisionInstructions.map((item, index) => `${index + 1}. ${item}`).join('\n')}\nReturn replacement memorial prose, not commentary.`
            : '';
        return `${basePrompt}${revision}`;
    }
    normalizeIssue(raw, side, issue, authorities, graph) {
        const authorityById = new Map(authorities.map((authority) => [authority.id, authority]));
        const validFactIds = new Set(graph.facts.map((fact) => fact.id));
        const rawSubArguments = Array.isArray(raw?.subArguments) ? raw.subArguments : [];
        const subArguments = [];
        for (let index = 0; index < Math.max(issue.subIssues.length, rawSubArguments.length); index += 1) {
            const rawSub = rawSubArguments[index];
            if (!rawSub && index >= issue.subIssues.length)
                continue;
            const heading = this.cleanHeading(rawSub?.heading || issue.subIssues[index] || `Proposition ${index + 1}`);
            const authorityIds = Array.from(new Set((Array.isArray(rawSub?.authorityIds) ? rawSub.authorityIds : [])
                .map((value) => String(value))
                .filter((id) => authorityById.has(id))));
            const factIds = Array.from(new Set((Array.isArray(rawSub?.factIds) ? rawSub.factIds : [])
                .map((value) => String(value))
                .filter((id) => validFactIds.has(id))));
            const analysis = (Array.isArray(rawSub?.analysis) ? rawSub.analysis : [rawSub?.analysis])
                .map((paragraph) => this.cleanProse(paragraph))
                .filter((paragraph) => paragraph.length > 55)
                .slice(0, 8);
            const normalized = {
                heading,
                claim: this.cleanProse(rawSub?.claim || ''),
                rule: this.cleanProse(rawSub?.rule || ''),
                authorityIds,
                factIds,
                analysis,
                counterArgument: this.cleanProse(rawSub?.counterArgument || ''),
                rebuttal: this.cleanProse(rawSub?.rebuttal || ''),
                miniConclusion: this.cleanProse(rawSub?.miniConclusion || ''),
            };
            if (!normalized.claim || !normalized.rule || normalized.analysis.length < 2 || !normalized.factIds.length) {
                subArguments.push(this.fallbackSubArgument(side, issue, heading, index, this.issueFacts(issue, graph), authorities));
            }
            else {
                if (!normalized.counterArgument)
                    normalized.counterArgument = side === 'petitioner' ? issue.respondentPosition : issue.petitionerPosition;
                if (!normalized.rebuttal)
                    normalized.rebuttal = this.defaultRebuttal(side, issue);
                if (!normalized.miniConclusion)
                    normalized.miniConclusion = this.miniConclusion(side, heading);
                subArguments.push(normalized);
            }
        }
        const dedupedSubArguments = this.dedupeSubArguments(subArguments).slice(0, 6);
        const allAuthorityIds = Array.from(new Set(dedupedSubArguments.flatMap((sub) => sub.authorityIds)));
        const selectedAuthorities = allAuthorityIds.map((id) => authorityById.get(id)).filter(Boolean);
        const allFactIds = Array.from(new Set(dedupedSubArguments.flatMap((sub) => sub.factIds)));
        const block = {
            issueId: issue.id,
            side,
            thesis: this.cleanProse(raw?.thesis || (side === 'petitioner' ? issue.petitionerPosition : issue.respondentPosition)),
            roadmap: this.cleanProse(raw?.roadmap || `The submission is advanced through ${dedupedSubArguments.map((sub) => sub.heading.toLowerCase()).join('; ')}.`),
            rule: dedupedSubArguments.map((sub) => sub.rule).filter(Boolean).join(' '),
            authorities: selectedAuthorities.length ? selectedAuthorities : authorities.slice(0, 10),
            application: dedupedSubArguments.flatMap((sub) => sub.analysis).join('\n\n'),
            subArguments: dedupedSubArguments,
            counterArgument: this.cleanProse(raw?.overallCounterArgument || (side === 'petitioner' ? issue.respondentPosition : issue.petitionerPosition)),
            rebuttal: this.cleanProse(raw?.overallRebuttal || this.defaultRebuttal(side, issue)),
            conclusion: this.cleanProse(raw?.conclusion || `Accordingly, ${issue.id.replace('_', ' ')} ought to be answered in favour of the ${side === 'petitioner' ? 'Petitioners' : 'Respondents'}.`),
            factIds: allFactIds,
            wordCount: 0,
        };
        block.wordCount = this.countBlockWords(block);
        return block;
    }
    fallbackBlock(side, issue, authorities, graph) {
        const issueAuthorities = authorities.filter((authority) => authority.issueId === issue.id
            && (authority.sideUsefulness === side || authority.sideUsefulness === 'both')).slice(0, 10);
        const facts = this.issueFacts(issue, graph);
        const subArguments = issue.subIssues.slice(0, 5).map((heading, index) => this.fallbackSubArgument(side, issue, heading, index, facts, issueAuthorities));
        const block = {
            issueId: issue.id,
            side,
            thesis: side === 'petitioner' ? issue.petitionerPosition : issue.respondentPosition,
            roadmap: `The submission proceeds through ${subArguments.map((sub) => sub.heading.toLowerCase()).join('; ')}.`,
            rule: subArguments.map((sub) => sub.rule).join(' '),
            authorities: issueAuthorities,
            application: subArguments.flatMap((sub) => sub.analysis).join('\n\n'),
            subArguments,
            counterArgument: side === 'petitioner' ? issue.respondentPosition : issue.petitionerPosition,
            rebuttal: this.defaultRebuttal(side, issue),
            conclusion: `Accordingly, ${issue.id.replace('_', ' ')} ought to be answered in favour of the ${side === 'petitioner' ? 'Petitioners' : 'Respondents'}.`,
            factIds: Array.from(new Set(subArguments.flatMap((sub) => sub.factIds))),
            wordCount: 0,
        };
        block.wordCount = this.countBlockWords(block);
        return block;
    }
    fallbackSubArgument(side, issue, heading, index, facts, authorities) {
        const family = this.issueFamily(issue.issue);
        const selectedFacts = this.selectFactsForSubIssue(facts, heading, family, index);
        const selectedAuthorities = this.selectAuthoritiesForSubIssue(authorities, heading, family, index);
        const rule = this.fallbackRule(family, heading, side, selectedAuthorities);
        const analysis = this.fallbackAnalysis(family, heading, side, selectedFacts, selectedAuthorities, issue);
        return {
            heading: this.cleanHeading(heading),
            claim: this.fallbackClaim(family, heading, side),
            rule,
            authorityIds: selectedAuthorities.map((authority) => authority.id),
            factIds: selectedFacts.map((fact) => fact.id),
            analysis,
            counterArgument: side === 'petitioner' ? issue.respondentPosition : issue.petitionerPosition,
            rebuttal: this.fallbackRebuttal(family, heading, side),
            miniConclusion: this.miniConclusion(side, heading),
        };
    }
    fallbackAnalysis(family, heading, side, facts, authorities, issue) {
        const factSentences = facts.map((fact) => fact.text).filter(Boolean);
        const authoritySentence = authorities.length
            ? authorities.slice(0, 2).map((authority) => `${authority.citation} supports the proposition that ${this.lowerFirst(authority.ratioOrRule)}`).join(' ')
            : 'The governing constitutional and statutory text supplies the applicable standard.';
        const factsParagraph = factSentences.length
            ? factSentences.slice(0, 3).join(' ')
            : 'The proposition does not expressly record every technical step relevant to this sub-question.';
        if (family === 'evidence') {
            return side === 'petitioner'
                ? [
                    `${authoritySentence} The statutory safeguard is substantive because digital material can be copied, altered, incompletely recovered, or attributed to the wrong user without visible change. The prosecution therefore carries the burden of connecting the record to the relevant device, person, method of production, and period of control.`,
                    `${factsParagraph} These facts establish the existence of electronic material, but existence is not the same as legal admissibility. The Court must separately determine whether the certificate covers the precise computer output relied upon, whether the seizure and forensic image were documented, and whether the method used to recover deleted material was capable of producing a reliable result.`,
                    `Where the proposition is silent on a mandatory link in authentication or custody, that silence cannot be converted into a presumption against the accused. A conviction substantially dependent on electronic material is safe only when the prosecution proves the legal foundation of that material beyond a merely formal assertion of compliance.`,
                ]
                : [
                    `${authoritySentence} The Respondents accept that electronic evidence is not self-proving, but the legal inquiry remains directed to reliability and prejudice rather than ritualistic exclusion. A certificate, lawful seizure, forensic recovery, and corroborating circumstances must be read together.`,
                    `${factsParagraph} The electronic record is not an isolated screenshot; it forms part of a wider evidentiary sequence involving the seized devices, recovered digital artefacts, account activity, and the surrounding conduct alleged in the proposition. The cumulative record may establish source and integrity even where the accused disputes individual technical particulars.`,
                    `The Petitioners must identify a defect that affects authenticity, authorship, continuity, or fairness. A technical objection that neither undermines the source nor demonstrates prejudice does not require exclusion of otherwise probative evidence, particularly where the courts below recorded concurrent findings after considering the challenge.`,
                ];
        }
        if (family === 'jurisdiction') {
            return side === 'petitioner'
                ? [
                    `${authoritySentence} Extraterritorial jurisdiction is a statutory power and cannot be enlarged merely because the alleged conduct occurred through the internet. The statutory computer-system nexus and the real territorial connection must be independently established.`,
                    `${factsParagraph} The proposition distinguishes the domestic accused and victim from foreign-hosted platforms and service providers. Jurisdiction over a person present in Indica, jurisdiction to obtain data held abroad, and enforceability against a foreign intermediary are separate legal questions; treating them as one obscures the limits of Section 75.`,
                    `A harm-based theory may explain why the State has a legitimate interest, but it does not by itself prove lawful acquisition of foreign material or authority over a foreign entity. International comity and the applicable cooperation process remain relevant to both jurisdiction and evidentiary reliability.`,
                ]
                : [
                    `${authoritySentence} Section 75 must be applied to the realities of cyber conduct, in which the location of a server may be chosen precisely to distance the offender from the victim and the consequences. The proper inquiry is whether the offence has a real and substantial connection with Indica.`,
                    `${factsParagraph} The alleged accused, victim, investigation, harmful effects, and substantial conduct are connected with Indica, while foreign infrastructure served as the medium through which the harm was delivered. That combination supplies a territorial nexus capable of supporting domestic adjudication.`,
                    `Respect for foreign law governs the means used to obtain or compel overseas material; it does not automatically erase jurisdiction over the domestic offence. The Court may distinguish adjudicatory jurisdiction over the accused from coercive jurisdiction over a foreign intermediary while sustaining the prosecution of conduct directed at an Indican victim.`,
                ];
        }
        if (family === 'privacy') {
            return side === 'petitioner'
                ? [
                    `${authoritySentence} A digital device contains communications, photographs, location history, credentials, and unrelated private life. A warrant or general investigative power must therefore be interpreted with particularity, purpose limitation, and safeguards against indiscriminate examination.`,
                    `${factsParagraph} The proposition records seizure and forensic examination of multiple devices and an allegation that unrelated personal data was accessed. The State was required to confine the search to offence-linked categories, preserve an auditable forensic image, and explain how irrelevant data was segregated or protected.`,
                    `The seriousness of the alleged offence establishes a legitimate aim, but it does not complete the proportionality inquiry. The State must also show necessity, a rational connection, a less intrusive feasible method, and safeguards proportionate to the breadth of the information examined.`,
                ]
                : [
                    `${authoritySentence} Privacy is protected, but it is not absolute. A search undertaken pursuant to lawful authority, directed to specified cyber offences, and accompanied by forensic safeguards may satisfy legality, necessity, and proportionality.`,
                    `${factsParagraph} The alleged offence itself was digital and the relevant proof was liable to deletion, encryption, or remote alteration. Seizure and forensic imaging were therefore closely connected to the investigative objective and capable of being necessary to preserve evidence.`,
                    `The constitutional question is whether the process was targeted and fair, not whether investigators encountered unrelated information while examining a complex device. Unless the Petitioners establish that the scope materially exceeded the warrant or that private material was misused, the search should not be invalidated in the abstract.`,
                ];
        }
        if (family === 'sentence') {
            return side === 'petitioner'
                ? [
                    `${authoritySentence} Article 136 is exceptional, yet it remains available where a conviction rests on a foundational error of admissibility, jurisdiction, fair procedure, or proof beyond reasonable doubt. Concurrent findings do not immunise an error of law.`,
                    `${factsParagraph} The impugned conviction substantially depends on contested electronic material and the legal conclusions challenged under the preceding issues. If that material is inadmissible, unlawfully obtained, or outside the court's jurisdictional reach, the conviction cannot survive merely because two courts accepted it.`,
                    `Sentence must also be individualised. The court must identify the proved conduct, statutory range, aggravating circumstances, mitigating circumstances, and reasons why the chosen punishment is no more severe than necessary. Public concern about cyber abuse cannot substitute for a reasoned proportionality analysis.`,
                ]
                : [
                    `${authoritySentence} Article 136 does not create a routine third appeal on facts. Interference is justified only where the concurrent findings reveal perversity, substantial legal error, or grave injustice.`,
                    `${factsParagraph} The courts below were entitled to assess the electronic record cumulatively with the victim's account, recovered material, investigative process, and the consequences attributed to the conduct. Where that assessment is reasoned and legally admissible, reweighing the evidence is unwarranted.`,
                    `The sentence may reflect the deliberate use of technical skill, impersonation, sexualised harassment, privacy invasion, and reputational harm established by the record. Unless it exceeds statutory limits or ignores material mitigation, the punishment is entitled to appellate deference.`,
                ];
        }
        return [
            `${authoritySentence}`,
            `${factsParagraph}`,
            `${issue.burden}`,
        ];
    }
    fallbackRule(family, heading, side, authorities) {
        const authorityRule = authorities[0]?.ratioOrRule;
        if (authorityRule)
            return authorityRule;
        if (family === 'evidence')
            return 'Electronic evidence must satisfy the applicable statutory conditions of authentication, source integrity, and proof before it can support a criminal finding.';
        if (family === 'jurisdiction')
            return 'Cross-border cyber jurisdiction requires statutory authority, a real territorial nexus, and lawful treatment of foreign-hosted material.';
        if (family === 'privacy')
            return 'Digital search must satisfy legality, legitimate aim, necessity, proportionality, scope limitation, and effective procedural safeguards.';
        if (family === 'sentence')
            return 'Appellate interference depends on substantial legal error or injustice, and punishment must be proportionate to proved culpability and harm.';
        return `${heading} must be tested against the governing statutory and constitutional standard.`;
    }
    fallbackClaim(family, heading, side) {
        if (side === 'petitioner') {
            if (family === 'evidence')
                return `The prosecution has not established ${heading.toLowerCase()} to the standard required for reliance on the electronic record.`;
            if (family === 'jurisdiction')
                return `${heading} does not establish the statutory and territorial basis necessary for the impugned exercise of jurisdiction.`;
            if (family === 'privacy')
                return `The challenged search fails the constitutional requirement of ${heading.toLowerCase()}.`;
            if (family === 'sentence')
                return `${heading} requires appellate interference with the impugned conviction or sentence.`;
        }
        else {
            if (family === 'evidence')
                return `The cumulative record satisfies ${heading.toLowerCase()} and supports admission of the electronic evidence.`;
            if (family === 'jurisdiction')
                return `${heading} confirms a sufficient statutory and territorial connection with Indica.`;
            if (family === 'privacy')
                return `The investigative process satisfies ${heading.toLowerCase()} in the circumstances of the alleged cyber offences.`;
            if (family === 'sentence')
                return `${heading} supports deference to the concurrent findings and sentence.`;
        }
        return `${heading} supports the ${side === 'petitioner' ? 'Petitioners’' : 'Respondents’'} position.`;
    }
    fallbackRebuttal(family, _heading, side) {
        if (side === 'petitioner') {
            if (family === 'evidence')
                return 'Cumulative suspicion cannot cure a missing legal foundation for authenticity, authorship, or forensic integrity.';
            if (family === 'jurisdiction')
                return 'Domestic harm may support State interest, but it cannot replace the statutory nexus or lawful cross-border process required by law.';
            if (family === 'privacy')
                return 'A warrant and a serious allegation do not authorise unlimited access to unrelated digital life; constitutional safeguards remain operative.';
            if (family === 'sentence')
                return 'Concurrent findings deserve respect only when reached through admissible evidence, lawful jurisdiction, and fair procedure.';
        }
        else {
            if (family === 'evidence')
                return 'The Petitioners identify possible technical imperfections but do not demonstrate a defect that destroys source reliability or causes material prejudice.';
            if (family === 'jurisdiction')
                return 'A narrow server-location rule would reward deliberate offshore routing and defeat the statutory response to cross-border cyber harm.';
            if (family === 'privacy')
                return 'The Constitution does not require investigative paralysis where a targeted, warrant-backed forensic process is necessary to preserve digital evidence.';
            if (family === 'sentence')
                return 'The Petitioners recast evidentiary disagreement as constitutional error without meeting the exceptional threshold for Article 136 interference.';
        }
        return 'The opposing submission does not displace the governing legal test when applied to the complete material record.';
    }
    defaultRebuttal(side, issue) {
        return this.fallbackRebuttal(this.issueFamily(issue.issue), '', side);
    }
    issueFacts(issue, graph) {
        const selected = issue.factIds.map((id) => graph.facts.find((fact) => fact.id === id)).filter(Boolean);
        const familyRegex = this.familyRegex(this.issueFamily(issue.issue));
        const related = graph.facts.filter((fact) => familyRegex.test(fact.text));
        return this.dedupeFacts([...selected, ...related, ...graph.facts.filter((fact) => fact.materiality === 'high')]).slice(0, 18);
    }
    selectFactsForSubIssue(facts, heading, family, index) {
        const tokens = this.tokens(heading);
        const ranked = facts.map((fact) => ({
            fact,
            score: this.overlap(tokens, this.tokens(fact.text)) + (this.familyRegex(family).test(fact.text) ? 2 : 0) + (fact.materiality === 'high' ? 1 : 0),
        })).sort((a, b) => b.score - a.score).map((item) => item.fact);
        const selected = ranked.filter((fact, i) => i < 4 && (i === 0 || this.overlap(tokens, this.tokens(fact.text)) > 0));
        return selected.length ? selected : facts.slice(index * 2, index * 2 + 3);
    }
    selectAuthoritiesForSubIssue(authorities, heading, family, index) {
        const tokens = this.tokens(`${heading} ${family}`);
        const ranked = authorities.map((authority) => ({
            authority,
            score: this.overlap(tokens, this.tokens(`${authority.citation} ${authority.proposition} ${authority.ratioOrRule}`))
                + (authority.verified ? 2 : 0)
                + authority.confidence / 100,
        })).sort((a, b) => b.score - a.score).map((item) => item.authority);
        return (ranked.length ? ranked : authorities).slice(0, index === 0 ? 3 : 2);
    }
    issueFamily(issue) {
        if (/(?:ELECTRONIC|DIGITAL).{0,40}EVIDENCE|SAKSHYA|FORENSIC|COMPUTER OUTPUT/i.test(issue))
            return 'evidence';
        if (/FOREIGN[- ]HOSTED|FOREIGN SERVER|SERVER|INTERMEDIAR|EXTRATERRITORIAL|SECTION 75|CROSS[- ]BORDER CYBER/i.test(issue))
            return 'jurisdiction';
        if (/SEARCH|SEIZURE|PRIVACY|ARTICLE 21|DEVICE|DATA MINIM/i.test(issue))
            return 'privacy';
        if (/\b(?:CONVICTION|SENTENCE|PUNISHMENT|PROPORTIONATE)\b/i.test(issue))
            return 'sentence';
        return 'general';
    }
    familyRegex(family) {
        if (family === 'evidence')
            return /evidence|certificate|forensic|device|deleted|browser|account|seiz|record|custody|authentic/i;
        if (family === 'jurisdiction')
            return /foreign|server|intermediary|jurisdiction|territor|victim|harm|service provider|section 75/i;
        if (family === 'privacy')
            return /search|seizure|device|privacy|data|minimis|warrant|forensic|personal|unrelated/i;
        if (family === 'sentence')
            return /convict|sentence|high court|trial court|appeal|punish|harm|finding|article 136/i;
        return /./;
    }
    miniConclusion(side, heading) {
        return `For these reasons, the proposition concerning ${heading.toLowerCase()} must be resolved in favour of the ${side === 'petitioner' ? 'Petitioners' : 'Respondents'}.`;
    }
    cleanHeading(value) {
        return String(value || '').replace(/^\s*[A-Z0-9]+[.)]\s*/, '').replace(/\s+/g, ' ').trim();
    }
    cleanProse(value) {
        return String(value || '')
            .replace(/\b(?:the\s+)?(?:petitioner|respondent)s?\s+should argue that\s+/gi, '')
            .replace(/\bshould argue that\s+/gi, '')
            .replace(/\bF\d+\s*:\s*/g, '')
            .replace(/\bAUTH_\d+\b/g, '')
            .replace(/\bthe preserved record\b/gi, 'the proposition record')
            .replace(/\bthis sub-proposition\b/gi, 'this submission')
            .replace(/\s+/g, ' ')
            .replace(/\.{2,}/g, '.')
            .trim();
    }
    dedupeSubArguments(items) {
        const seen = new Set();
        return items.filter((item) => {
            const key = item.heading.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
            if (!key || seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    dedupeFacts(items) {
        const seen = new Set();
        return items.filter((item) => {
            const key = item.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 220);
            if (!key || seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    tokens(text) {
        return Array.from(new Set(String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 4)));
    }
    overlap(a, b) {
        const set = new Set(b);
        return a.reduce((sum, token) => sum + (set.has(token) ? 1 : 0), 0);
    }
    lowerFirst(text) {
        const clean = String(text || '').trim();
        return clean ? clean.charAt(0).toLowerCase() + clean.slice(1) : clean;
    }
    countWords(text) {
        return String(text || '').trim().split(/\s+/).filter(Boolean).length;
    }
    countBlockWords(block) {
        return this.countWords([
            block.thesis, block.roadmap, block.rule, block.application, block.counterArgument, block.rebuttal, block.conclusion,
            ...block.subArguments.flatMap((sub) => [sub.heading, sub.claim, sub.rule, ...sub.analysis, sub.counterArgument, sub.rebuttal, sub.miniConclusion]),
        ].join(' '));
    }
};
exports.ArgumentEngineService = ArgumentEngineService;
exports.ArgumentEngineService = ArgumentEngineService = ArgumentEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [memorial_ai_service_1.MemorialAiService])
], ArgumentEngineService);
//# sourceMappingURL=argument-engine.service.js.map