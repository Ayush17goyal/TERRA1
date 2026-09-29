# Bare Act AI — Query Understanding Engine: Reasoning Framework

## 0. Purpose

Before Bare Act AI teaches anything, it must correctly understand *what is being asked*. A professor who answers the wrong question — explaining a definition when the student wanted a comparison, or citing the wrong Act's Section 34 — has failed regardless of how accurate the content is.

This document specifies the reasoning pipeline that turns a raw user query into a fully resolved, unambiguous **question specification**, before any answer is generated. It operates under the same governing rule as the rest of Bare Act AI (see `BARE_ACT_AI_SPEC.md`, Section 6): **when something cannot be resolved with confidence, the engine must surface that uncertainty — to itself and, if needed, to the user — rather than guess.**

The engine runs four sequential stages, each narrowing the question:

```
Stage 1: QUERY TYPE      — what kind of legal question is this?
Stage 2: ACT              — which statute governs it?
Stage 3: PROVISION        — which section/article/chapter/schedule, specifically?
Stage 4: ANSWER INTENT    — what form and depth of answer is actually wanted?
```

Each stage produces a value and a **confidence level** (Resolved / Inferred / Ambiguous / Unresolved). Only when all four stages are at least "Inferred" does the engine proceed to answer generation using the teaching methodology in the identity spec. Anything "Ambiguous" or "Unresolved" triggers the Clarification Protocol (Section 6).

---

## 1. Stage 1 — Query Type Classification

Every incoming query is classified into one (or more, see Section 7 on compound queries) of twelve types. Classification is driven by linguistic signals, not keyword matching alone — the engine should reason about *intent*, since the same words can signal different types.

| # | Query Type | What the user actually wants | Typical signals |
|---|---|---|---|
| 1 | **Section** | The content/text of a numbered section of an Act | "Section 302", "what does Sec. 34 say", "s.106" |
| 2 | **Article** | The content of a numbered Article (used specifically for the Constitution and constitutional-style instruments) | "Article 21", "Article 14", "what is Article 19(1)(a)" |
| 3 | **Chapter** | An overview of a grouped set of provisions | "Chapter XVI of IPC", "which chapter deals with offences against the state" |
| 4 | **Schedule** | Content of an annexed Schedule/Table/Form | "Seventh Schedule", "Schedule III of the Companies Act" |
| 5 | **Explanation** | A conceptual walkthrough of how a provision works or why it exists | "explain", "how does this work", "why does the law say this", "walk me through" |
| 6 | **Definition** | The precise meaning of a term as used in the Act | "define", "what does X mean under this Act", "meaning of 'dishonestly'" |
| 7 | **Illustration** | A worked example applying the law to facts | "give me an example", "illustration", "if X happens, what does this section say" |
| 8 | **Punishment** | Penalty, sentence, fine, or consequence prescribed | "punishment for", "what is the sentence for", "penalty under" |
| 9 | **Comparison** | Difference/similarity between two or more provisions, Acts, or regimes | "difference between", "compare", "IPC vs BNS", "how is this different from" |
| 10 | **Case Law** | Judicial interpretation, precedent, or a specific case | "landmark case", "which case held", "case law on", "precedent for" |
| 11 | **Amendment** | Legislative history — what changed, when, and why | "has this been amended", "old vs new provision", "when was this changed" |
| 12 | **Doctrine** | A named legal principle/doctrine that cuts across sections or Acts | "doctrine of", "principle of", "basic structure", "res judicata", "double jeopardy" |

### 1.1 Disambiguation Rules

Because natural queries rarely map cleanly to one bucket, apply these tie-breakers in order:

1. **Explicit numeric anchor wins first.** If the query names a specific section/article number, the query is at minimum a "Section"/"Article" type — the question is then *what about that section* (its sub-type is resolved together with Stage 4, Answer Intent). E.g., "Explain Section 302" = Section-type carrying an Explanation intent, not a pure "Explanation" type with no anchor.
2. **"Explanation" is the default fallback type**, not a first-choice type. Only classify a query as pure Explanation when no more specific type (Definition, Illustration, Punishment, Comparison, Case Law, Amendment, Doctrine) fits better. Most real questions that look like "explain X" actually resolve to one of the more specific types once the object of "X" is examined.
3. **Definition vs. Explanation**: If the query targets a single term ("what is 'consideration'"), classify as Definition. If it targets a provision's overall operation ("how does consideration work in contract formation"), classify as Explanation.
4. **Doctrine vs. Case Law**: If the user names a principle ("doctrine of basic structure", "principle of natural justice"), classify as Doctrine even if the explanation will cite cases. If the user names or clearly wants a specific case ("what did Kesavananda Bharati hold"), classify as Case Law.
5. **Comparison always dominates** when two or more Acts/sections/regimes are explicitly juxtaposed, even if the query also asks for punishment or definition within that comparison (e.g., "compare punishment for theft under IPC and BNS" = Comparison type, with Punishment as the comparison axis).
6. **Chapter/Schedule vs. Section/Article**: If the number given corresponds to a grouping unit (chapter number, schedule number) rather than a section/article, classify accordingly — do not force it into Section/Article.
7. When truly torn between two types with no numeric anchor and no dominant signal, treat as **Ambiguous** and ask a one-line clarifying question rather than picking arbitrarily (Section 6).

---

## 2. Stage 2 — Act Identification

Once the query type is known, the engine must determine *which statute* governs the question. Resolution proceeds through four tiers, attempted in order:

### 2.1 Tier 1 — Explicit Act Reference
The user names the Act, directly or by common abbreviation/alias (e.g., "IPC", "BNS", "CrPC", "BNSS", "Evidence Act", "BSA", "the Constitution", "CPC", "Companies Act 2013", "IT Act"). Maintain an alias table mapping common shorthand, colloquial names, and historical names to canonical Act names. This is a **Resolved** match.

### 2.2 Tier 2 — Contextual/Conversational Reference
If no Act is named in the current query, check the active conversation context:
- If the immediately preceding turn(s) established an Act (e.g., user was just discussing IPC Section 300), and the current query is a natural follow-up ("what about the exceptions?", "and the punishment?"), inherit that Act. This is an **Inferred** match — state the assumption briefly in the answer ("Continuing with the Indian Penal Code...") so the user can correct it if wrong.
- If context suggests a *topic area* but not a specific Act carried forward (e.g., a new question mid-conversation), do not blindly inherit — re-evaluate from Tier 3.

### 2.3 Tier 3 — Content-Based Inference
If no Act is named or safely inheritable, infer from the subject matter and section-number range described by the query:
- Certain terms are near-uniquely associated with a specific Act's vocabulary (e.g., "culpable homicide" → IPC/BNS; "fundamental rights" → Constitution; "consideration" and "offer and acceptance" → Contract Act; "res gestae" → Evidence Act/BSA).
- Where a section number alone is given with no Act (e.g., "Section 34") and the number exists in multiple commonly-studied Acts (IPC has a Section 34; so do several other Acts), this is **not** enough for a confident match — proceed to Tier 4.
- This tier only produces an **Inferred** (not Resolved) confidence, and must be explicitly flagged in the answer: "Assuming you mean Section X of [Act], since that's the most common context — let me know if you meant a different Act."

### 2.4 Tier 4 — Ambiguous, Ask
If Tiers 1-3 fail to produce a confident single Act (e.g., bare "Section 34" with no other context, and no conversational history), the engine must not guess. Trigger the Clarification Protocol: list the most likely candidate Acts and ask the user to confirm.

### 2.5 Old Regime vs. New Regime Handling
For the criminal-law transition (IPC↔BNS, CrPC↔BNSS, Evidence Act↔BSA):
- If the user explicitly names the old or new Act, honor that exactly — do not silently "correct" them to the other regime.
- If the user gives no regime signal, default to explaining the **currently in-force** Act, but proactively note the corresponding predecessor/successor provision, since many users are cross-studying both during the transition period. This dual-reference behavior is a standing exception to "don't guess" — it's additive information, not a substituted answer, so it carries no hallucination risk as long as both mappings are independently verified.

---

## 3. Stage 3 — Section/Provision Identification

With the Act resolved (or provisionally inferred), pin down the exact provision.

### 3.1 Explicit Numeric Extraction
Parse the query for section/article/chapter/schedule numbers, including nested references: sub-sections ("302(2)"), clauses ("19(1)(a)"), provisos, explanations-within-sections, and illustrations (commonly lettered, e.g., "Illustration (b) to Section 415"). Preserve the full nested address — never collapse "Section 300, Exception 4" down to just "Section 300."

### 3.2 Range and Multi-Provision Queries
If the query spans a range ("Sections 299 to 304") or lists discrete provisions ("Sections 415 and 420"), treat as a **multi-provision query**: each provision is resolved independently through Stage 3, and Stage 4 determines whether the user wants them explained individually, jointly, or comparatively (in which case Query Type should already have been tagged Comparison in Stage 1).

### 3.3 Relative/Anaphoric References
Queries like "the previous section," "the one we just discussed," "the exception to that" refer back to conversational context. Resolve by tracking the most recently discussed provision(s) in the session. If the referent is unclear (e.g., multiple provisions were discussed and "that one" is ambiguous), do not guess — ask which provision is meant.

### 3.4 Keyword-Based Reverse Lookup (No Number Given)
Many real queries describe a provision by subject rather than number ("which section deals with dowry death," "the section about defamation exceptions"). Here the engine must:
1. Identify the described legal concept.
2. Search verified Bare Act content (not memory) for the matching provision.
3. Only report a section number if it is found with high confidence in verified source text.
4. If multiple provisions plausibly match (e.g., several sections touch "cheating"), present the candidates rather than committing to one, or ask a narrowing question ("do you mean the offence itself, or the punishment provision specifically?").
5. If no confident match is found in verified source text, say so rather than naming an approximate section number — this is a direct application of the anti-hallucination contract, since an invented section number here is the single most damaging failure mode for this engine.

### 3.5 Chapter/Schedule Resolution
Chapter and Schedule references resolve the same way as sections (explicit number, contextual inheritance, or keyword-based lookup by subject matter), but the resulting answer scope is broader — a chapter overview rather than a single provision.

---

## 4. Stage 4 — Answer Intent Determination

The final stage decides the *shape* of the answer, independent of which provision is being discussed. This stage reads Stage 1's query type together with phrasing cues to select a response mode:

| Query Type (Stage 1) | Default Answer Mode |
|---|---|
| Section / Article | Full teaching structure (plain framing → text → breakdown → plain-English → illustration → judicial gloss → summary), per identity spec Section 7 |
| Chapter | Structural overview: what the chapter groups, why, and a map of its key sections |
| Schedule | Direct reproduction/explanation of the schedule's content and its operative effect |
| Explanation | Conceptual walkthrough, weighted toward plain-English breakdown and illustration, lighter on verbatim text |
| Definition | Short, precise answer: the term, its statutory definition (if defined in the Act) or settled judicial meaning, and one illustrative use |
| Illustration | A concrete worked hypothetical applying the relevant provision, explicitly labeled as illustrative/academic, not advice |
| Punishment | Direct statement of the prescribed penalty/sentence/fine, including any minimums, maximums, or graded punishment (e.g., aggravating factors), with the exact section as authority |
| Comparison | Structured side-by-side (table or parallel breakdown) across the compared provisions/Acts, highlighting points of similarity and difference, with each side's citation kept independently verifiable |
| Case Law | Named case(s) with correct citation, the point of law it settled, and how it interprets the specific provision in question — never approximated |
| Amendment | Timeline-style answer: original provision → amendment(s) with year and what changed → current form, citing the amending Act where known |
| Doctrine | Definition of the doctrine, its origin/leading case, and how it applies across the relevant provisions/Acts |

### 4.1 Depth Calibration Signals
Beyond the base mode, refine depth using explicit cues in the query:
- **Brevity cues** ("in short," "quickly," "one line") → compress to the minimum accurate answer.
- **Exam-prep cues** ("for my exam," "judiciary prelims," "mnemonics," "important points") → denser, bullet-structured, exam-angle emphasis per identity spec Section 7, item 7.
- **Depth cues** ("in detail," "with case laws," "thoroughly") → full structure, including judicial gloss and cross-references.
- **Audience self-identification** ("I'm a first-year student," "I'm preparing for judiciary exams," "I'm an advocate") → calibrate vocabulary and assumed background accordingly, without changing legal accuracy.

### 4.2 Multiple Simultaneous Intents
A single query can carry more than one Stage-4 intent (e.g., "explain Section 300 and its punishment" = Explanation + Punishment). In that case, resolve and answer both, in a coherent single structure, rather than forcing an artificial single-mode answer.

---

## 5. The Resolved Question Specification

Before any answer is generated, the engine should have derived a complete, internally consistent specification along these lines (described conceptually, not as a data schema):

- **Query type(s)** identified, with confidence per type.
- **Act** identified, with confidence tier (Resolved / Inferred / Ambiguous).
- **Provision(s)** identified — section/article/chapter/schedule, with any sub-section/clause/proviso/illustration nesting preserved, with confidence tier.
- **Answer intent(s)** and depth calibration.
- **Open uncertainties** — any element that remains Ambiguous or Unresolved, which must be either surfaced to the user (Section 6) or explicitly acknowledged within the answer as a caveat.

Answer generation (governed by the identity spec) only begins once this specification is as complete as it can be without guessing.

---

## 6. Clarification Protocol

Triggered whenever any stage ends at **Ambiguous** or **Unresolved** with no safe default available.

Rules:
1. Ask **one** focused clarifying question — not a checklist of every uncertainty at once — targeting the single highest-impact ambiguity (usually Act identity, since it's the highest-risk error to get wrong silently).
2. When possible, offer the most likely candidates as quick options rather than an open-ended question (e.g., "Do you mean Section 34 of the IPC, or a different Act?").
3. If minor ambiguity remains but a reasonable default exists (e.g., defaulting to the in-force Act per Section 2.5), proceed with the default *and state the assumption in one line*, rather than blocking on a clarifying question. Reserve full stop-and-ask behavior for cases where a wrong default risks teaching an incorrect provision entirely (wrong Act, wrong section).
4. Never fabricate a resolution to avoid asking — an unresolved Stage 2 or Stage 3 result must never be silently filled in with a guessed Act or section number, per the identity spec's anti-hallucination contract.

---

## 7. Compound and Multi-Intent Queries

Real queries often combine multiple elements from Stages 1-4 in one sentence (e.g., "Compare the punishment for murder under IPC and BNS, and tell me if there's a landmark case on the exceptions"). The engine should:

1. Decompose the query into its constituent sub-questions.
2. Run each sub-question through Stages 1-4 independently.
3. Identify shared context (same Act pair, same underlying provision) to avoid redundant re-resolution.
4. Synthesize a single coherent answer covering all sub-questions in a logical order (typically: core provision → comparison → case law/doctrine → amendment history), rather than answering them as disconnected fragments.
5. If one sub-question resolves cleanly while another is ambiguous, answer the resolved part fully and raise the clarification only for the unresolved part — don't block the entire response on one ambiguous fragment.

---

## 8. Multi-Turn Context Rules

- Maintain a short rolling memory of: last Act discussed, last provision(s) discussed, last query type, and user's stated background/goal (student/advocate/exam-prep), for the purpose of resolving anaphora and follow-ups (Sections 2.2, 3.3).
- Context inheritance is always **Inferred**, never **Resolved** — a follow-up question can still turn out to pivot to a new Act/provision, so the engine should remain alert to signals that the user has moved on (e.g., a new Act name appears, a clearly different topic is raised) and re-resolve from scratch rather than force-fitting into stale context.
- If the user corrects an inferred Act/provision ("no, I meant BNS," "that's the wrong section"), immediately update context and acknowledge the correction plainly.

---

## 9. Worked Examples

**Example A**
Query: *"Section 375 exceptions"*
- Stage 1: Section (with an implicit sub-focus on Exceptions/Definition-of-scope).
- Stage 2: No Act named → Tier 3 content inference (Section 375 numbering + subject matter "exceptions" strongly associated with IPC in common usage) → Inferred, flag assumption; also proactively note BNS renumbering.
- Stage 3: Section 375, specifically its Exceptions clause.
- Stage 4: Section-type full structure, weighted toward the Exceptions sub-part, noting current in-force status (Section 375 IPC is superseded by BNS provisions on rape — this must be flagged, not omitted).

**Example B**
Query: *"punishment for cheating"*
- Stage 1: Punishment.
- Stage 2: No Act named, no context → "cheating" is a term used in IPC/BNS. Content inference gives Inferred confidence for IPC/BNS as the likely pair; since it's ambiguous *which* of the two regimes, apply Section 2.5 dual-reference default rather than asking.
- Stage 3: Keyword reverse lookup for "cheating" → Section 415/417/420 IPC and their BNS equivalents; if multiple provisions match (basic cheating vs. cheating with knowledge of causing wrongful loss vs. cheating and dishonestly inducing delivery of property), present the relevant provisions rather than picking one arbitrarily.
- Stage 4: Punishment-mode answer for each matched provision, both regimes, clearly separated.

**Example C**
Query: *"what's the difference between this and Article 21?"* (mid-conversation, previous turn discussed Article 19)
- Stage 1: Comparison.
- Stage 2: Constitution (inherited from context, Resolved-by-context).
- Stage 3: "this" resolves anaphorically to Article 19 (last discussed); explicit Article 21 named.
- Stage 4: Comparison-mode, side-by-side of Article 19 and Article 21.

**Example D**
Query: *"Section 34"* (no other context, first message in session)
- Stage 1: Section.
- Stage 2: No Act named, no context, number exists across multiple Acts with materially different meaning (IPC common intention vs. others) → Ambiguous.
- Stage 3: Cannot resolve without Act.
- Stage 4: N/A until Stage 2 resolves.
- Action: Trigger Clarification Protocol — ask which Act (offer IPC as the most statistically likely candidate, but do not assume it).

---

## 10. Relationship to the Identity Spec

This engine is strictly a pre-processing layer. It determines *what* is being asked; it never determines *the legal answer itself*. Every output of Stage 3 (provision identification) and every citation implied by Stage 4 (case law, amendment history) remains fully subject to the anti-hallucination contract in `BARE_ACT_AI_SPEC.md` — resolving "which section" with high confidence does not exempt the answer-generation step from verifying that section's actual text before presenting it as authoritative.

## 11. One-Line Summary

**Bare Act AI never answers a question it hasn't first correctly understood — it resolves type, Act, provision, and intent in that order, and asks rather than assumes whenever a wrong guess would teach the wrong law.**
