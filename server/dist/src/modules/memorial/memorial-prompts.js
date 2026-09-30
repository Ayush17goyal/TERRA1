"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEMORIAL_SYSTEM = void 0;
exports.propositionPrompt = propositionPrompt;
exports.issuePrompt = issuePrompt;
exports.authorityPrompt = authorityPrompt;
exports.argumentPrompt = argumentPrompt;
exports.qualityPrompt = qualityPrompt;
exports.MEMORIAL_SYSTEM = `You are LEGATRIXON Memorial Architect, a senior Indian moot-court researcher, memorial drafter, and memorial evaluator.
Your output must be competition-grade, source-grounded, side-consistent, and legally reasoned.
Absolute rules:
1. Never treat brochure text, organiser biographies, competition schedules, team-composition rules, cover-colour rules, sponsorship material, addresses, or concept-note marketing language as case facts.
2. Never invent a fact, date, party, procedural step, statutory provision, case citation, holding, quotation, or pinpoint.
3. Every factual proposition must trace to supplied fact IDs or source paragraph IDs.
4. Every legal proposition must trace to supplied authority IDs or clearly be labelled as requiring verification.
5. Preserve explicit issues from the proposition unless a competition rule requires reframing.
6. Petitioner and respondent memorials must be genuinely adversarial, not mirror copies.
7. Do not write drafting instructions such as “should argue”, “the AI must”, or “use these facts”. Write final memorial language only.
8. Avoid repetitive formulae. Build issue-specific reasoning using claim → rule → authority → application → counterargument → rebuttal → conclusion.
9. Return only valid JSON when requested.`;
function propositionPrompt(sourcePackets, rulesOverride) {
    return `Classify and extract the uploaded moot document into a complete proposition blueprint.

SOURCE PACKETS
${sourcePackets}

OPTIONAL USER-SUPPLIED COMPETITION RULES
${rulesOverride || 'None supplied.'}

Return exactly this JSON shape:
{
  "documentSections": [{"type":"moot_proposition|procedural_history|issues|competition_rules|concept_note|cover_or_brochure|organiser_material|clarifications|annexure|unknown","pageStart":1,"pageEnd":1,"reason":"","confidence":0}],
  "caseMetadata": {"court":"","jurisdiction":"","caseNumber":"","proceduralStage":"","petitionerLabel":"Petitioner","respondentLabel":"Respondent","petitionerName":"","respondentName":""},
  "parties": [{"name":"","role":"petitioner|respondent|accused|complainant|victim|prosecution|authority|intermediary|other","description":"","sourceIds":["P1-001"]}],
  "facts": [{"text":"neutral normalized fact","exactQuote":"verbatim source excerpt","sourceIds":["P1-001"],"kind":"background|event|procedural|evidence|allegation|finding|relief|other","status":"admitted|disputed|alleged|finding|unclear","materiality":"high|medium|low","confidence":0}],
  "timeline": [{"date":"","event":"","sourceIds":["P1-001"]}],
  "proceduralHistory": [{"step":"","courtOrAuthority":"","result":"","sourceIds":["P1-001"]}],
  "evidenceInventory": [{"item":"","source":"","collectionMethod":"","authenticityQuestion":"","chainOfCustodyQuestion":"","sourceIds":["P1-001"]}],
  "lawsMentioned": [{"citation":"","context":"","sourceIds":["P1-001"]}],
  "explicitIssues": [{"text":"","sourceIds":["P1-001"]}],
  "reliefs": [{"text":"","side":"petitioner|respondent|neutral","sourceIds":["P1-001"]}],
  "competitionRules": {"petitionerCoverColor":"","respondentCoverColor":"","pageLimit":"","wordLimit":"","bodyFont":"","footnoteFont":"","lineSpacing":"","citationStyle":"","requiredSections":[],"otherRules":[]},
  "excludedContent": [{"sourceId":"P1-001","reason":"brochure/organiser/concept note/competition instruction/not case material"}],
  "unresolvedQuestions": ["" ]
}

Extraction method:
- First classify every source paragraph.
- Keep all legally material facts, including adverse facts for both sides.
- Separate allegations from findings and procedural history.
- Preserve exact issue wording.
- Extract the actual case narrative, not the concept note describing what the proposition explores.
- If a paragraph contains both case facts and junk, extract only the case-fact sentence and identify the paragraph as mixed.
- Use only source IDs that exist in the packets.`;
}
function issuePrompt(blueprintJson, depth, wordBudget) {
    return `Build the issue architecture for an Indian moot memorial from this verified proposition blueprint:
${blueprintJson}

Depth: ${depth}
Total target words for Arguments Advanced: approximately ${wordBudget}.

Return exactly:
{
  "issues": [{
    "issue":"exact or minimally polished issue wording in uppercase",
    "petitionerPosition":"one decisive final-submission thesis",
    "respondentPosition":"one decisive final-submission thesis",
    "subIssues":["3 to 5 non-overlapping propositions"],
    "legalTests":["elements/test/burden that the court must apply"],
    "factIds":["F1"],
    "legalAnchors":["statutes/articles expressly mentioned or necessarily implicated"],
    "authorityQueries":["precise research query for binding Indian authority"],
    "burden":"who bears what burden and why",
    "reliefConsequence":"what follows if this issue is decided for either side",
    "targetWordCount":1200
  }]
}

Rules:
- Preserve all explicit proposition issues and their order.
- Do not create generic or duplicate issues.
- Each sub-issue must be independently arguable and fact-linked.
- Allocate the word budget according to legal complexity, not equally by default.
- Do not cite cases here.`;
}
function authorityPrompt(issueJson, candidateJson) {
    return `Rank and map legal authorities issue-by-issue.

ISSUES
${issueJson}

CANDIDATE AUTHORITIES
${candidateJson}

Return exactly:
{
  "rankings": [{
    "issueId":"ISSUE_1",
    "authorities":[{
      "candidateId":"CAT_1",
      "sideUsefulness":"petitioner|respondent|both",
      "proposition":"precise legal proposition supported",
      "ratioOrRule":"accurate short ratio/rule without invented quotation",
      "relevanceReason":"why it matters to this issue",
      "confidence":0
    }]
  }]
}

Rules:
- Use only supplied candidateId values.
- Prefer binding Supreme Court authority and statutory text.
- Do not repeat the same generic authority across every issue unless it genuinely controls each.
- Select 5 to 10 strong authorities per issue, balanced for both sides.
- Do not manufacture pinpoints or quotations.`;
}
function argumentPrompt(params) {
    return `Draft the complete Arguments Advanced architecture for the ${params.side.toUpperCase()} side.

ISSUES
${params.issues}

VERIFIED FACT LEDGER
${params.facts}

AUTHORITY CARDS
${params.authorities}

Depth: ${params.depth}
Total target length: ${params.totalWords} words, with meaningful issue-wise depth.

Return exactly one issue object in this shape:
{
  "argument": {
    "issueId":"ISSUE_1",
    "thesis":"final court-ready thesis",
    "roadmap":"short roadmap of the propositions",
    "subArguments":[{
      "heading":"court-ready proposition heading",
      "claim":"specific claim",
      "rule":"legal test stated accurately",
      "authorityIds":["AUTH_1"],
      "factIds":["F1"],
      "analysis":["2 to 5 developed court-ready paragraphs, each doing legal application rather than summary"],
      "counterArgument":"best opposing argument",
      "rebuttal":"specific answer to that argument",
      "miniConclusion":"issue-linked conclusion"
    }],
    "overallCounterArgument":"strongest holistic opposition",
    "overallRebuttal":"holistic rebuttal",
    "conclusion":"final issue conclusion"
  }
}

Drafting rules:
- Write final memorial prose, never instructions.
- Use only supplied fact IDs and authority IDs for internal linkage. Never print identifiers such as F1, F12, AUTH_1, or source packet IDs in memorial prose.
- Each sub-argument must contain rule, authority, concrete fact application, counterargument, rebuttal, and mini-conclusion.
- Do not dump an authority list. Explain why each authority applies or is distinguishable.
- This prompt contains one issue only. Make every sub-argument distinct and tied to its own legal test; do not reuse the same thesis or structure from another legal issue.
- Do not assert a missing certificate, broken chain of custody, absent warrant, or other defect unless the fact ledger supports it; where the record is silent, argue the legal consequence of the burden of proof and label the silence precisely.
- Address adverse facts candidly.
- Use formal Indian moot style with varied transitions.
- Avoid “should argue”, “must show” as drafting directions, and generic boilerplate.
- The respondent must independently justify the action and meet burdens; it is not merely the petitioner text negated.
- Return at least three developed sub-arguments, and normally one sub-argument for every supplied sub-issue.
- Each analysis array must contain multiple full paragraphs rather than formulaic one-sentence conclusions.`;
}
function qualityPrompt(payload, threshold) {
    return `Act as a strict Indian national-moot memorial evaluator. Audit the generated memorial against a ${threshold}/100 threshold.

PAYLOAD
${payload}

Return exactly:
{
  "score":0,
  "blockingErrors":[""],
  "warnings":[""],
  "weakIssueIds":["ISSUE_1"],
  "unsupportedFactClaims":[""],
  "irrelevantAuthorities":["AUTH_1"],
  "repetitionExamples":[""],
  "rewriteInstructions":["precise targeted instruction"]
}

Be severe. A memorial fails if it includes brochure/rulebook material as facts, fake or irrelevant authorities, side confusion, generic repeated argument blocks, invented factual defects, shallow application, false page numbers, or drafting instructions.`;
}
//# sourceMappingURL=memorial-prompts.js.map