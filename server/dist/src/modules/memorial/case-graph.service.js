"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseGraphService = void 0;
const common_1 = require("@nestjs/common");
let CaseGraphService = class CaseGraphService {
    build(dossier, blueprint) {
        const sourceMap = {};
        dossier.paragraphs.forEach((p) => { sourceMap[p.id] = `Page ${p.pageNo}`; });
        blueprint.facts.forEach((f) => { sourceMap[f.id] = f.sourceIds.map((id) => sourceMap[id] || id).join(', '); });
        const proceduralPosture = blueprint.proceduralHistory.map((p) => [p.step, p.courtOrAuthority, p.result].filter(Boolean).join(' — '));
        const admittedFacts = blueprint.facts.filter((f) => ['admitted', 'finding'].includes(f.status)).map((f) => f.text);
        const disputedFacts = blueprint.facts.filter((f) => ['disputed', 'alleged', 'unclear'].includes(f.status)).map((f) => f.text);
        const claims = blueprint.facts.filter((f) => f.kind === 'allegation' || f.kind === 'relief').map((f) => f.text);
        return {
            parties: blueprint.parties,
            facts: blueprint.facts,
            admittedFacts,
            disputedFacts,
            proceduralPosture,
            claims,
            legalTriggers: dossier.legalTriggers.filter((trigger) => !blueprint.excludedContent.some((x) => x.sourceId === trigger.sourceParagraphId)),
            reliefs: blueprint.reliefs.map((r) => r.text),
            burdens: this.inferBurdens(blueprint),
            evidenceInventory: blueprint.evidenceInventory,
            sourceMap,
        };
    }
    inferBurdens(blueprint) {
        const text = [
            ...blueprint.explicitIssues.map((x) => x.text),
            ...blueprint.lawsMentioned.map((x) => x.citation),
            ...blueprint.facts.map((x) => x.text),
        ].join(' ');
        const burdens = new Set();
        if (/article 136|special leave|supreme court|appeal/i.test(text))
            burdens.add('The appellant must establish a substantial legal error, perversity, grave miscarriage of justice, or constitutional infirmity warranting interference in discretionary appellate jurisdiction.');
        if (/criminal|conviction|accused|prosecution|sentence/i.test(text))
            burdens.add('The prosecution bears the burden of proving every ingredient beyond reasonable doubt; the appellant may demonstrate that evidentiary, jurisdictional, or procedural defects make the finding unsafe.');
        if (/electronic|sakshya|certificate|forensic/i.test(text))
            burdens.add('The party relying on an electronic record must establish the statutory conditions of admissibility, authenticity, source integrity, and continuity of custody applicable to that record.');
        if (/section 75|foreign|server|jurisdiction|extraterritorial/i.test(text))
            burdens.add('The party asserting extraterritorial cyber jurisdiction must establish the statutory nexus and real territorial connection required by the applicable law.');
        if (/article 21|privacy|search|seizure|device|data/i.test(text))
            burdens.add('The State must justify digital intrusion by legality, legitimate aim, necessity, proportionality, scope limitation, and procedural safeguards; the challenger must identify the pleaded defect and resulting prejudice.');
        if (/sentence|punishment|proportionate/i.test(text))
            burdens.add('The party challenging sentence must demonstrate disproportionality or legal error, while the State must justify the sentence by proved culpability, statutory limits, and relevant aggravating and mitigating circumstances.');
        if (!burdens.size)
            burdens.add('The party asserting a legal consequence bears the burden of establishing the factual and legal elements necessary for that consequence.');
        return Array.from(burdens);
    }
};
exports.CaseGraphService = CaseGraphService;
exports.CaseGraphService = CaseGraphService = __decorate([
    (0, common_1.Injectable)()
], CaseGraphService);
//# sourceMappingURL=case-graph.service.js.map