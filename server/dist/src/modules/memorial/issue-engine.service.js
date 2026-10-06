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
var IssueEngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueEngineService = void 0;
const common_1 = require("@nestjs/common");
const memorial_ai_service_1 = require("./memorial-ai.service");
const memorial_prompts_1 = require("./memorial-prompts");
let IssueEngineService = IssueEngineService_1 = class IssueEngineService {
    constructor(ai) {
        this.ai = ai;
        this.logger = new common_1.Logger(IssueEngineService_1.name);
    }
    async generate(graph, blueprint, options) {
        const expressIssues = this.prioritizedExplicitIssues(blueprint);
        const totalWordBudget = this.totalWordBudget(options, expressIssues.length || 4);
        try {
            const response = await this.ai.json({
                system: memorial_prompts_1.MEMORIAL_SYSTEM,
                prompt: (0, memorial_prompts_1.issuePrompt)(JSON.stringify(this.compactBlueprint(blueprint, graph)), options.depth || 'deep', totalWordBudget),
                options,
                maxTokens: 4500,
                stage: 'issue-architecture',
            });
            const issues = this.normalize(response?.issues, graph, blueprint, totalWordBudget, expressIssues);
            if (issues.length < 2)
                throw new Error('Issue engine returned fewer than two usable issues.');
            return { issues, usedAi: true };
        }
        catch (error) {
            this.logger.warn(`Issue engine fallback used: ${error?.message || error}`);
            return {
                issues: this.fallback(graph, blueprint, totalWordBudget, expressIssues),
                usedAi: false,
                warning: `AI issue architecture unavailable; deterministic source-grounded issue architecture used: ${error?.message || error}`,
            };
        }
    }
    compactBlueprint(blueprint, graph) {
        return {
            caseMetadata: blueprint.caseMetadata,
            parties: blueprint.parties,
            facts: blueprint.facts.map((fact) => ({
                id: fact.id,
                text: fact.text,
                kind: fact.kind,
                status: fact.status,
                materiality: fact.materiality,
                sourceIds: fact.sourceIds,
            })),
            proceduralHistory: blueprint.proceduralHistory,
            lawsMentioned: blueprint.lawsMentioned,
            explicitIssues: this.prioritizedExplicitIssues(blueprint).map((text) => ({ text })),
            reliefs: blueprint.reliefs,
            burdens: graph.burdens,
            competitionRules: blueprint.competitionRules,
        };
    }
    normalize(rawIssues, graph, blueprint, totalBudget, expressIssues) {
        const supplied = Array.isArray(rawIssues) ? rawIssues : [];
        const sourceIssues = expressIssues.length
            ? expressIssues
            : supplied.map((item) => this.normalizeIssue(String(item?.issue || ''))).filter(Boolean);
        const factIds = new Set(graph.facts.map((fact) => fact.id));
        const issueCount = Math.max(1, sourceIssues.length || supplied.length);
        const result = sourceIssues.slice(0, 6).map((issue, index) => {
            const raw = this.bestRawIssue(issue, supplied) || supplied[index] || {};
            const fallback = this.fallbackIssue(issue, index, graph, blueprint, Math.max(900, Math.round(totalBudget / issueCount)));
            const selectedFactIds = Array.from(new Set((Array.isArray(raw.factIds) ? raw.factIds : [])
                .map((value) => String(value))
                .filter((id) => factIds.has(id))));
            const rawSubIssues = this.cleanArray(raw.subIssues, 6);
            const rawTests = this.cleanArray(raw.legalTests, 10);
            const compatibleSubIssues = this.isCompatibleStructure(issue, rawSubIssues) ? rawSubIssues : fallback.subIssues;
            const compatibleTests = this.isCompatibleStructure(issue, rawTests) ? rawTests : fallback.legalTests;
            const factSelection = selectedFactIds.length >= 2 ? selectedFactIds : fallback.factIds;
            const target = Number(raw.targetWordCount || 0);
            return {
                id: `ISSUE_${index + 1}`,
                issue,
                petitionerPosition: this.cleanPosition(raw.petitionerPosition) || fallback.petitionerPosition,
                respondentPosition: this.cleanPosition(raw.respondentPosition) || fallback.respondentPosition,
                subIssues: compatibleSubIssues,
                legalTests: compatibleTests,
                factualAnchors: factSelection
                    .map((id) => graph.facts.find((fact) => fact.id === id)?.text || '')
                    .filter(Boolean),
                factIds: factSelection,
                legalAnchors: this.cleanArray(raw.legalAnchors, 10).length
                    ? this.cleanArray(raw.legalAnchors, 10)
                    : fallback.legalAnchors,
                authorityQueries: this.cleanArray(raw.authorityQueries, 8).length
                    ? this.cleanArray(raw.authorityQueries, 8)
                    : fallback.authorityQueries,
                burden: String(raw.burden || fallback.burden),
                reliefConsequence: String(raw.reliefConsequence || fallback.reliefConsequence),
                targetWordCount: target > 500 ? Math.round(target) : fallback.targetWordCount,
            };
        }).filter((item) => item.issue.length > 35);
        return this.dedupe(result).slice(0, 6);
    }
    prioritizedExplicitIssues(blueprint) {
        const normalized = blueprint.explicitIssues
            .map((item) => this.normalizeIssue(item.text))
            .filter(Boolean);
        if (!this.isInvestmentArbitration(blueprint) || !normalized.length)
            return this.dedupeStrings(normalized).slice(0, 6);
        const controlling = [];
        const preclusion = normalized.find((issue) => /preclud(?:ed|ing).{0,80}(?:damages|claim).{0,100}(?:termination|PSA)|(?:damages|claim).{0,100}preclud/i.test(issue));
        const mfn = normalized.find((issue) => /(?:import|MFN|most[- ]favou?red).{0,120}(?:FET|fair and equitable)|(?:FET|fair and equitable).{0,120}(?:import|MFN|most[- ]favou?red)/i.test(issue));
        const fetMerits = normalized.find((issue) => /(?:violat|breach).{0,80}article\s*3|article\s*3.{0,80}(?:violat|breach)|fair and equitable treatment/i.test(issue)
            && !/(?:import|MFN|most[- ]favou?red)/i.test(issue));
        const antiSuit = normalized.find((issue) => /anti[- ]?suit injunction|provisional measure.{0,100}(?:insolvency|proceeding)/i.test(issue));
        [preclusion, mfn, fetMerits, antiSuit].forEach((match) => {
            if (match && !controlling.includes(match))
                controlling.push(match);
        });
        if (controlling.length >= 3)
            return controlling.slice(0, 6);
        return this.dedupeStrings(normalized).slice(0, 6);
    }
    fallback(graph, blueprint, totalBudget, expressIssues) {
        const corpus = this.corpus(blueprint);
        const inferred = [];
        if (this.isInvestmentArbitration(blueprint)) {
            if (/preclud|prior litigation|prior arbitration|same matter|termination of the PSA|article\s*10\s*\(?4\)?/i.test(corpus)) {
                inferred.push('WHETHER THE CLAIMANT IS PRECLUDED FROM CLAIMING DAMAGES OR OTHER TREATY RELIEF ARISING FROM THE TERMINATION OF THE PSA?');
            }
            if (/MFN|most[- ]favou?red|Danubia|import.{0,80}FET|fair and equitable treatment/i.test(corpus)) {
                inferred.push('WHETHER THE CLAIMANT MAY RELY ON THE MOST-FAVOURED-NATION CLAUSE TO IMPORT THE FAIR AND EQUITABLE TREATMENT PROVISION RELIED UPON FROM THE THIRD-STATE INVESTMENT AGREEMENT?');
            }
            if (/article\s*3|fair and equitable treatment|legitimate expectations|retroactive|arbitrar|FET/i.test(corpus)) {
                inferred.push('WHETHER THE RESPONDENT VIOLATED THE APPLICABLE FAIR AND EQUITABLE TREATMENT OBLIGATIONS UNDER ARTICLE 3 OF THE INVESTMENT AGREEMENT?');
            }
            if (/anti[- ]?suit|provisional measure|insolvency proceedings|rule\s*47|article\s*47/i.test(corpus)) {
                inferred.push('WHETHER THE TRIBUNAL SHOULD GRANT THE REQUESTED ANTI-SUIT INJUNCTION OR OTHER PROVISIONAL MEASURE CONCERNING THE INSOLVENCY PROCEEDINGS?');
            }
        }
        else {
            if (/(?:electronic|digital).{0,40}evidence|certificate.{0,60}(?:electronic|computer)|sakshya|forensic|computer output/i.test(corpus)) {
                inferred.push('WHETHER THE ELECTRONIC EVIDENCE RELIED UPON IS ADMISSIBLE IN ACCORDANCE WITH THE APPLICABLE EVIDENTIARY SAFEGUARDS?');
            }
            if (/section 75|foreign[- ]hosted|foreign server|intermediary|extraterritorial|cross[- ]border cyber/i.test(corpus)) {
                inferred.push('WHETHER THE COURT HAS JURISDICTION OVER THE ALLEGED CROSS-BORDER CYBER CONDUCT AND FOREIGN-HOSTED MATERIAL?');
            }
            if (/search|seizure|device|privacy|article 21|data minimisation/i.test(corpus)) {
                inferred.push('WHETHER THE SEARCH, SEIZURE, AND FORENSIC EXAMINATION OF DIGITAL DEVICES COMPLIED WITH ARTICLE 21 AND DUE PROCESS?');
            }
            if (/inter-state river|river water|water dispute|article 262|river project/i.test(corpus)) {
                inferred.push('WHETHER THE INTER-STATE WATER DISPUTE AND THE CHALLENGED WATER PROJECT MAY BE ADJUDICATED BY THE PRESENT FORUM IN LIGHT OF THE CONSTITUTIONAL AND STATUTORY DISPUTE-RESOLUTION FRAMEWORK?');
            }
            if (/(?:inter-state|interstate|state).{0,80}(?:boundary|border|demarcat)|(?:boundary|border|demarcat).{0,80}(?:inter-state|interstate|state)/i.test(corpus)) {
                inferred.push('WHETHER THE COMPETING INTER-STATE BOUNDARY CLAIMS ARE JUSTICIABLE BEFORE THE IDENTIFIED FORUM AND HOW THE RELIED-UPON HISTORICAL INSTRUMENTS AFFECT THOSE CLAIMS?');
            }
            if (/article 131|original jurisdiction|article 3|parliament.{0,80}(?:boundary|territor)/i.test(corpus)) {
                inferred.push('WHETHER THE PRESENT DISPUTE FALLS WITHIN THE COURT’S ORIGINAL JURISDICTION OR WITHIN A CONSTITUTIONAL POWER RESERVED TO PARLIAMENT OR ANOTHER INSTITUTION?');
            }
            if (/central forces|armed contingent|article 355|public order|status quo/i.test(corpus)) {
                inferred.push('WHETHER THE DEPLOYMENT OF CENTRAL FORCES AND THE INTERIM SECURITY ARRANGEMENTS ARE CONSISTENT WITH THE APPLICABLE CONSTITUTIONAL DISTRIBUTION OF POWERS?');
            }
            if (/\b(?:conviction|sentence|punishment|proportionate)\b/i.test(corpus)) {
                inferred.push('WHETHER THE IMPUGNED CONVICTION AND SENTENCE ARE LEGALLY SUSTAINABLE AND PROPORTIONATE?');
            }
        }
        const selected = (expressIssues.length ? expressIssues : inferred.map((issue) => this.normalizeIssue(issue))).slice(0, 6);
        return selected.map((issue, index) => this.fallbackIssue(issue, index, graph, blueprint, Math.max(900, Math.round(totalBudget / Math.max(1, selected.length)))));
    }
    fallbackIssue(issue, index, graph, blueprint, target) {
        const claimant = this.partyLabel(blueprint, 'petitioner');
        const respondent = this.partyLabel(blueprint, 'respondent');
        const facts = this.pickFacts(issue, graph.facts);
        const arbitration = this.isInvestmentArbitration(blueprint);
        const isPreclusion = arbitration && /preclud|same matter|prior (?:litigation|arbitration)|claiming damages|termination of the PSA/i.test(issue);
        const isMfn = arbitration && /MFN|most[- ]favou?red|import.{0,80}(?:FET|fair and equitable)|third[- ]state/i.test(issue);
        const isFet = arbitration && !isMfn && /FET|fair and equitable|article\s*3|legitimate expectations|arbitrar|transparen/i.test(issue);
        const isAntiSuit = arbitration && /anti[- ]?suit|provisional measure|insolvency/i.test(issue);
        const isEvidence = /(?:ELECTRONIC|DIGITAL).{0,40}EVIDENCE|SAKSHYA|FORENSIC|COMPUTER OUTPUT/i.test(issue);
        const isCyberJurisdiction = /FOREIGN[- ]HOSTED|FOREIGN SERVER|INTERMEDIAR|EXTRATERRITORIAL|SECTION 75|CROSS[- ]BORDER CYBER/i.test(issue);
        const isPrivacy = /SEARCH|SEIZURE|PRIVACY|ARTICLE 21|DEVICE/i.test(issue);
        const isSentence = /\b(?:CONVICTION|SENTENCE|PROPORTIONATE|PUNISHMENT)\b/i.test(issue);
        const petitionerPosition = isPreclusion
            ? `The ${claimant} submits that the treaty claim is not barred merely because a related contractual dispute was previously pursued; the Tribunal must compare the parties, cause of action, legal source, relief, and the exact wording of any fork-in-the-road or same-matter clause.`
            : isMfn
                ? `The ${claimant} submits that the relied-upon MFN clause is capable of extending the more favourable treatment identified in the third-State agreement, subject to the text, temporal operation, and scope of the relevant treaties.`
                : isFet
                    ? `The ${claimant} submits that the challenged measures breached the applicable fair and equitable treatment standard, including the protections that are actually supported by the treaty text and the proposition record.`
                    : isAntiSuit
                        ? `The ${claimant} submits that the requested provisional measure should be granted only if the Tribunal is satisfied that it has power to preserve the asserted rights and that urgency, necessity, proportionality, and prejudice to both parties support the measure.`
                        : isEvidence
                            ? `The ${claimant} submits that the electronic record cannot be relied upon unless the mandatory rules governing authentication, source integrity, chain of custody, and forensic reliability are satisfied.`
                            : isCyberJurisdiction
                                ? `The ${claimant} submits that cross-border internet use does not by itself create unlimited jurisdiction; the statutory nexus, territorial connection, and lawful acquisition of foreign material must each be established.`
                                : isPrivacy
                                    ? `The ${claimant} submits that digital search and forensic examination are unlawful when they exceed lawful scope or lack necessity, proportionality, minimisation, and auditable safeguards.`
                                    : isSentence
                                        ? `The ${claimant} submits that a conviction or sentence founded on evidentiary, jurisdictional, or procedural error cannot stand and must independently satisfy proportionality.`
                                        : `The ${claimant} submits that the impugned measure is legally unsustainable on the governing law and proposition record.`;
        const respondentPosition = isPreclusion
            ? `The ${respondent} submits that the prior proceedings and the treaty’s dispute-resolution wording preclude re-litigation to the extent the present claim is the same matter or otherwise falls within the agreed bar.`
            : isMfn
                ? `The ${respondent} submits that the MFN clause cannot be used beyond its text to import a materially different obligation, procedure, or treaty standard where the required comparability, temporal operation, or consent is absent.`
                : isFet
                    ? `The ${respondent} submits that no breach of fair and equitable treatment is established because the challenged measures fall within the State’s lawful regulatory space and the proposition does not establish a protected assurance, arbitrariness, discrimination, or other treaty breach.`
                    : isAntiSuit
                        ? `The ${respondent} submits that the extraordinary provisional measure should be refused where jurisdiction over the relevant actor or proceeding is insufficient, harm is compensable or not imminent, or the measure would disproportionately prejudice lawful domestic proceedings.`
                        : isEvidence
                            ? `The ${respondent} submits that the electronic record is admissible where the statutory certificate, seizure record, forensic recovery, and surrounding circumstances cumulatively establish source, integrity, and reliability.`
                            : isCyberJurisdiction
                                ? `The ${respondent} submits that jurisdiction is established by the domestic nexus, harmful effects, investigation, and applicable statutory provisions notwithstanding foreign infrastructure.`
                                : isPrivacy
                                    ? `The ${respondent} submits that the search and forensic examination were lawful, necessary, proportionate, and accompanied by safeguards appropriate to the investigation.`
                                    : isSentence
                                        ? `The ${respondent} submits that the findings and sentence are legally sustainable, supported by reliable evidence, and proportionate to the proved conduct.`
                                        : `The ${respondent} submits that the impugned measure is lawful and should be upheld on the governing law and proposition record.`;
        return {
            id: `ISSUE_${index + 1}`,
            issue,
            petitionerPosition,
            respondentPosition,
            subIssues: this.subIssuesFor(issue, arbitration),
            legalTests: this.testsFor(issue, arbitration),
            factualAnchors: facts.map((fact) => fact.text),
            factIds: facts.map((fact) => fact.id),
            legalAnchors: this.anchorsFor(issue, blueprint),
            authorityQueries: this.queriesFor(issue, blueprint),
            burden: graph.burdens.find((burden) => this.relevantBurden(issue, burden))
                || graph.burdens[index % Math.max(1, graph.burdens.length)]
                || 'The party asserting the proposition bears the burden required by the governing law.',
            reliefConsequence: isAntiSuit
                ? 'The finding determines whether the requested provisional anti-suit relief is granted, limited, or refused.'
                : arbitration
                    ? 'The finding determines the success or failure of the corresponding treaty claim or objection at the present procedural stage.'
                    : 'The finding determines whether the challenged action, evidence, jurisdiction, or relief can be sustained.',
            targetWordCount: Math.max(900, Math.round(target)),
        };
    }
    subIssuesFor(issue, arbitration) {
        if (arbitration && /preclud|same matter|claiming damages|termination of the PSA/i.test(issue)) {
            return ['Text and scope of the prior-proceedings bar', 'Identity of parties and legal causes of action', 'Contract claim versus treaty claim', 'Identity of relief and legal interests', 'Effect of the prior award or proceedings'];
        }
        if (arbitration && /MFN|most[- ]favou?red|import.{0,80}(?:FET|fair and equitable)|third[- ]state/i.test(issue)) {
            return ['Text and scope of the MFN clause', 'Comparability of treatment', 'Nature of the provision sought to be imported', 'Temporal operation and any sunset clause', 'Consent and limits on treaty importation'];
        }
        if (arbitration && /FET|fair and equitable|article\s*3|legitimate expectations|arbitrar|transparen/i.test(issue)) {
            return ['Content of the applicable FET obligation', 'Legitimate expectations and specific assurances', 'Stability, non-retroactivity, and transparency', 'Arbitrariness or discriminatory treatment', 'Attribution and the State’s right to regulate'];
        }
        if (arbitration && /anti[- ]?suit|provisional measure|insolvency/i.test(issue)) {
            return ['Tribunal power to recommend provisional measures', 'Right requiring preservation', 'Urgency', 'Necessity and irreparable/prejudicial harm', 'Proportionality and effect on both parties', 'Relationship between the State and the domestic proceeding'];
        }
        if (/(?:ELECTRONIC|DIGITAL).{0,40}EVIDENCE|SAKSHYA|FORENSIC|COMPUTER OUTPUT/i.test(issue)) {
            return ['Statutory authentication', 'Source and authorship', 'Chain of custody and forensic integrity', 'Effect of any defect or prejudice'];
        }
        if (/FOREIGN[- ]HOSTED|FOREIGN SERVER|INTERMEDIAR|EXTRATERRITORIAL|SECTION 75|CROSS[- ]BORDER CYBER/i.test(issue)) {
            return ['Statutory nexus', 'Territorial connection and effects', 'Foreign intermediaries and comity', 'Lawful acquisition and enforceability'];
        }
        if (/SEARCH|SEIZURE|PRIVACY|ARTICLE 21|DEVICE/i.test(issue)) {
            return ['Legality and scope', 'Necessity', 'Proportionality and minimisation', 'Procedural safeguards and auditability'];
        }
        if (/\b(?:CONVICTION|SENTENCE|PROPORTIONATE|PUNISHMENT)\b/i.test(issue)) {
            return ['Standard of appellate interference', 'Proof and reliability', 'Effect of foundational defects', 'Individualised proportionality'];
        }
        return ['Governing legal rule', 'Threshold requirements', 'Application to proposition facts', 'Opposing submission and rebuttal', 'Relief consequence'];
    }
    testsFor(issue, arbitration) {
        if (arbitration && /preclud|same matter|claiming damages|termination of the PSA/i.test(issue)) {
            return ['treaty text', 'identity of parties', 'identity of cause of action', 'identity of object/relief', 'contract-versus-treaty distinction', 'effect of prior adjudication'];
        }
        if (arbitration && /MFN|most[- ]favou?red|import.{0,80}(?:FET|fair and equitable)|third[- ]state/i.test(issue)) {
            return ['treaty interpretation', 'scope of MFN clause', 'comparability', 'temporal application', 'sunset clause if applicable', 'consent'];
        }
        if (arbitration && /FET|fair and equitable|article\s*3|legitimate expectations|arbitrar|transparen/i.test(issue)) {
            return ['treaty text', 'legitimate expectations', 'specific representation or legal framework', 'reasonableness', 'transparency', 'non-discrimination', 'right to regulate', 'causal connection'];
        }
        if (arbitration && /anti[- ]?suit|provisional measure|insolvency/i.test(issue)) {
            return ['prima facie jurisdiction/power', 'right to preserve', 'urgency', 'necessity', 'risk of prejudice', 'proportionality', 'effect on each party'];
        }
        if (/(?:ELECTRONIC|DIGITAL).{0,40}EVIDENCE|SAKSHYA|FORENSIC|COMPUTER OUTPUT/i.test(issue))
            return ['statutory authentication', 'authenticity', 'integrity', 'chain of custody', 'prejudice'];
        if (/FOREIGN[- ]HOSTED|FOREIGN SERVER|INTERMEDIAR|EXTRATERRITORIAL|SECTION 75|CROSS[- ]BORDER CYBER/i.test(issue))
            return ['statutory nexus', 'real territorial connection', 'effects', 'comity', 'lawful cross-border process'];
        if (/SEARCH|SEIZURE|PRIVACY|ARTICLE 21|DEVICE/i.test(issue))
            return ['legality', 'legitimate aim', 'necessity', 'proportionality', 'scope limitation', 'procedural safeguards'];
        if (/\b(?:CONVICTION|SENTENCE|PROPORTIONATE|PUNISHMENT)\b/i.test(issue))
            return ['substantial legal error', 'reliability of evidence', 'proved ingredients', 'individualised proportionality'];
        return ['governing rule', 'elements', 'application', 'counterargument', 'relief'];
    }
    anchorsFor(issue, blueprint) {
        const cited = blueprint.lawsMentioned
            .filter((law) => this.tokenOverlap(issue, `${law.citation} ${law.context}`) > 0)
            .map((law) => law.citation)
            .slice(0, 6);
        if (cited.length)
            return cited;
        if (this.isInvestmentArbitration(blueprint)) {
            if (/anti[- ]?suit|provisional measure/i.test(issue))
                return ['ICSID Convention Article 47', 'ICSID Arbitration Rule 47'];
            if (/MFN|most[- ]favou?red/i.test(issue))
                return ['MFN clause in the applicable investment agreement', 'relevant third-State investment agreement'];
            if (/FET|fair and equitable|article\s*3/i.test(issue))
                return ['Article 3 of the applicable investment agreement', 'applicable rules of international law'];
            if (/preclud|same matter/i.test(issue))
                return ['dispute-resolution clause of the applicable investment agreement', 'effect of prior proceedings'];
        }
        return [];
    }
    queriesFor(issue, blueprint) {
        if (this.isInvestmentArbitration(blueprint)) {
            if (/preclud|same matter|termination of the PSA/i.test(issue)) {
                return ['investment treaty fork in the road same matter contract claim treaty claim prior arbitration', 'investment arbitration res judicata collateral estoppel triple identity treaty claim contract claim'];
            }
            if (/MFN|most[- ]favou?red|import.{0,80}(?:FET|fair and equitable)/i.test(issue)) {
                return ['investment treaty MFN clause import substantive FET standard third treaty', 'investment arbitration MFN temporal scope sunset clause treaty interpretation'];
            }
            if (/FET|fair and equitable|article\s*3|legitimate expectations/i.test(issue)) {
                return ['investment arbitration fair and equitable treatment legitimate expectations specific assurances regulatory change', 'FET arbitrariness transparency non-retroactivity right to regulate investment treaty'];
            }
            if (/anti[- ]?suit|provisional measure|insolvency/i.test(issue)) {
                return ['ICSID provisional measures anti-suit injunction domestic proceedings urgency necessity irreparable harm', 'ICSID Arbitration Rule 47 effect on each party preservation of rights anti-suit'];
            }
        }
        return [issue.replace(/^WHETHER\s+/i, '').replace(/\?$/, '')];
    }
    pickFacts(issue, graph) {
        const scored = graph.map((fact) => ({
            fact,
            score: this.tokenOverlap(issue, fact.text)
                + (fact.materiality === 'high' ? 5 : fact.materiality === 'medium' ? 2 : 0)
                + (fact.kind === 'procedural' || fact.kind === 'finding' ? 2 : 0),
        }));
        const selected = scored.sort((a, b) => b.score - a.score).map((item) => item.fact).slice(0, 12);
        return selected.length ? selected : graph.slice(0, 12);
    }
    bestRawIssue(issue, supplied) {
        let best = null;
        let bestScore = 0;
        for (const candidate of supplied) {
            const score = this.tokenOverlap(issue, String(candidate?.issue || ''));
            if (score > bestScore) {
                best = candidate;
                bestScore = score;
            }
        }
        return bestScore >= 2 ? best : null;
    }
    isCompatibleStructure(issue, items) {
        if (items.length < 2)
            return false;
        const joined = items.join(' ').toLowerCase();
        if (/anti[- ]?suit|provisional measure/i.test(issue))
            return /urgenc|necess|proportion|prejudice|preserv|jurisdiction/.test(joined);
        if (/MFN|most[- ]favou?red|import.{0,80}(?:FET|fair and equitable)/i.test(issue))
            return /mfn|treaty|compar|scope|temporal|sunset|import/.test(joined);
        if (/FET|fair and equitable|article\s*3/i.test(issue))
            return /expect|arbitrar|transparen|regulat|treaty|fet|equitable/.test(joined);
        if (/preclud|same matter|claiming damages/i.test(issue))
            return /prior|same matter|claim|contract|treaty|res judic|preclud/.test(joined);
        return true;
    }
    isInvestmentArbitration(blueprint) {
        const corpus = [
            blueprint.caseMetadata.court,
            blueprint.caseMetadata.jurisdiction,
            blueprint.caseMetadata.jurisdictionProvision,
            blueprint.caseMetadata.proceduralStage,
            blueprint.caseMetadata.petitionerLabel,
            ...blueprint.lawsMentioned.map((law) => law.citation),
            ...blueprint.explicitIssues.map((issue) => issue.text),
        ].join(' ');
        return /ICSID|investor[- ]state|investment (?:treaty|agreement|arbitration)|arbitral tribunal|claimant|FET|fair and equitable|MFN/i.test(corpus);
    }
    partyLabel(blueprint, side) {
        const value = side === 'petitioner' ? blueprint.caseMetadata.petitionerLabel : blueprint.caseMetadata.respondentLabel;
        return this.titleCase(String(value || (side === 'petitioner' ? 'Petitioner' : 'Respondent')));
    }
    totalWordBudget(options, issueCount) {
        if (options.maxWords)
            return options.maxWords;
        const base = options.depth === 'standard' ? 3200 : options.depth === 'exhaustive' ? 7800 : 5600;
        return Math.max(base, issueCount * (options.depth === 'exhaustive' ? 1700 : options.depth === 'standard' ? 850 : 1250));
    }
    cleanArray(value, max) {
        const values = (Array.isArray(value) ? value : [])
            .map((item) => String(item).replace(/\s+/g, ' ').trim())
            .filter(Boolean);
        return Array.from(new Set(values)).slice(0, max);
    }
    cleanPosition(value) {
        return String(value || '')
            .replace(/^the\s+(petitioners|respondents|claimants?)\s+should argue that\s+/i, '')
            .replace(/^should argue that\s+/i, '')
            .trim();
    }
    normalizeIssue(issue) {
        const clean = String(issue || '')
            .replace(/\s+/g, ' ')
            .replace(/^WHETHER\s+whether\s+/i, 'WHETHER ')
            .replace(/^whether\s+/i, 'WHETHER ')
            .replace(/\?+$/, '')
            .trim();
        return clean ? `${clean}?`.toUpperCase() : '';
    }
    dedupe(items) {
        const seen = new Set();
        return items.filter((item) => {
            const key = this.normalizedKey(item.issue).slice(0, 220);
            if (!key || seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    dedupeStrings(items) {
        const seen = new Set();
        return items.filter((item) => {
            const key = this.normalizedKey(item);
            if (!key || seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    corpus(blueprint) {
        return [
            blueprint.caseMetadata.court,
            blueprint.caseMetadata.jurisdiction,
            blueprint.caseMetadata.proceduralStage,
            ...blueprint.explicitIssues.map((item) => item.text),
            ...blueprint.facts.map((item) => item.text),
            ...blueprint.lawsMentioned.map((item) => `${item.citation} ${item.context}`),
            ...blueprint.proceduralHistory.map((item) => `${item.step} ${item.result}`),
        ].join(' ');
    }
    relevantBurden(issue, burden) {
        const tokens = this.tokens(issue).filter((token) => token.length > 6);
        const lower = burden.toLowerCase();
        return tokens.some((token) => lower.includes(token));
    }
    tokenOverlap(left, right) {
        const leftTokens = new Set(this.tokens(left));
        const rightTokens = new Set(this.tokens(right));
        let count = 0;
        leftTokens.forEach((token) => { if (rightTokens.has(token))
            count += 1; });
        return count;
    }
    tokens(value) {
        const stop = new Set(['whether', 'the', 'and', 'that', 'this', 'from', 'with', 'under', 'should', 'shall', 'against', 'claimant', 'respondent', 'petitioner']);
        return String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 3 && !stop.has(token));
    }
    normalizedKey(value) {
        return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }
    titleCase(value) {
        return value.toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
    }
};
exports.IssueEngineService = IssueEngineService;
exports.IssueEngineService = IssueEngineService = IssueEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [memorial_ai_service_1.MemorialAiService])
], IssueEngineService);
//# sourceMappingURL=issue-engine.service.js.map