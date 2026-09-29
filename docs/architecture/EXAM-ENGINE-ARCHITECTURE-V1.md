# LEGATRIXON AI Exam Engine — Architecture v1.0

**Status:** Source of truth. Supersedes all prior design discussion.
**Scope:** Document ingestion through mock test delivery and answer evaluation, for the Mock Test / AI Exam Engine feature of LEGATRIXON.
**Rule:** Every future implementation PR touching this feature must be consistent with this document. Deviations require updating this document first, not silently diverging from it.

---

## 0. Problem Statement (unchanged from original brief)

Prior implementation suffered from: shallow document understanding, incomplete extraction, generic questions, long generation latency, short/failing answers, low user trust. This architecture exists to eliminate all six.

---

## 1. Core Principles

1. **Expensive work happens once, upstream, in the background.** Nothing on a user-facing request path performs OCR, parsing, LLM structural extraction, question synthesis, or answer drafting. Request-time work is read + score + assemble only.
2. **Every generated claim is traceable to a source.** Every question, model answer, and evaluation must resolve to specific source entities (`boundEntityRefs` / `sourceRefs`) or a tagged Legal Authority citation. Untraceable content is never persisted as usable.
3. **Per-user isolation is structural, not incidental.** Enforced at both application query layer and database layer (defense in depth).
4. **Incremental by default.** Adding, correcting, or removing one document must never require reprocessing the rest of a user's library. Cost of change is O(affected entities), never O(library size).
5. **Fail visible, not silent.** Low-confidence extraction, stale content, provider failure, and coverage shortfalls are surfaced as explicit states — never masked by degraded-but-unlabeled output.
6. **Reuse before regeneration.** Questions and answers are durable, cached artifacts, deduplicated and shared across users where safe to do so, regenerated only when their specific source material changes.

---

## 2. System Map

Eight modules, in pipeline order, plus one cross-cutting orchestration layer:

```
[1] Document Ingestion Engine
        │
        ▼
[2] Knowledge Engine  ───────────┐
        │                        │
        ▼                        ▼
[3] Question Generation Engine   │  (reads Legal Authority Index [3b] for enrichment)
        │                        │
        ▼                        │
[4] Model Answer Engine ─────────┘
        │
        ▼
[5] Mock Test Engine (assembly, request-time)
        │
        ▼
[6] Answer Evaluation Engine (student submissions)

Cross-cutting: [7] Orchestration & Multi-Provider AI Layer, [8] Background Processing / Queue Layer
Shared, non-user-scoped: [3b] Legal Authority Index, [9] Taxonomy Registry
```

Module `[6]` (Answer Evaluation) and `[9]` (Taxonomy Registry) are new in v1.0, added by CTO review — the prior design had no closed feedback loop and no owner for the classification taxonomy. Both are load-bearing, not optional add-ons.

---

## 3. Module 1 — Document Ingestion Engine

**Input:** PDF, scanned PDF, DOCX, PPT (teacher notes, Bare Acts, case compilations).
**Output:** `KnowledgeBaseRecord` per document.

### 3.1 Pipeline (strict order through Stage 4, parallel branch after)

```
0 Format Normalization
1 OCR & Layout Recovery
2 Text Cleaning & Noise Removal
3 Structural Skeleton Detection (heading/hierarchy tree)
4 Section Extraction
        ├─▶ 5 Topic Detection ─▶ 6 Subtopic Detection ─┐
        ├─▶ 7 Definition Extraction                     │
        ├─▶ 8 Illustration Extraction                   ├─▶ 11 Cross-Linking ─▶ 12 Metadata & KB Assembly
        └─▶ 9 Case Extraction ─▶ 10 Citation Extraction ┘
```

Stages 0–4 are strictly sequential (each later stage addresses into structure the previous stage created). Stages 5–10 run in parallel over the same `SectionNode[]`; 9→10 is internally ordered (citations classified relative to already-known case boundaries). Stages 11–12 run last, sequentially, once every parallel branch completes.

### 3.2 Stage Responsibilities (summary — see §3.3 for gates added by review)

| Stage | Responsibility | Output |
|---|---|---|
| 0 | Normalize PDF/DOCX/PPT into one internal block representation; flag pages needing OCR | `NormalizedDocument` |
| 1 | Recover text + spatial layout from scanned/image content, with per-block confidence | `OCRBlock[]` |
| 2 | Pattern-aware noise removal (headers/footers, hyphenation, OCR artifacts) without destroying legal markers (§, numbering, quotes) | `CleanedDocument` |
| 3 | Multi-signal heading/hierarchy detection (font, numbering, indentation, native style tags), document-type classification (Bare Act / case compilation / notes / textbook) | `DocumentTree` |
| 4 | Materialize legally coherent content units against tree nodes; route low-confidence/orphaned text to review | `SectionNode[]` |
| 5–6 | Classify sections against the taxonomy (owned by Module 9); flag exam-relevant constructs (tests, exceptions, holdings) | `topicTags[]`, `subtopicTags[]`, `examConstructs[]` |
| 7 | Extract formal + conceptual definitions | `DefinitionEntry[]` |
| 8 | Extract illustrations/worked examples, linked to what they demonstrate | `IllustrationEntry[]` |
| 9–10 | Extract case discussions (full structure or lighter mentions) and formal citations, canonicalized | `CaseEntry[]`, `CitationEntry[]` |
| 11 | Bind every extracted entity into one connected graph anchored on the `DocumentTree`; flag unresolved cross-document references | `DocumentGraph` |
| 12 | Package the graph into retrievable units + document-level metadata and confidence/review flags | `KnowledgeBaseRecord` |

### 3.3 Input Validation Gates (added by review — mandatory, run before Stage 5)

- **Language detection**: non-English/mixed-language content (Hindi/regional-language legal text) is detected at Stage 0/2; routed through language-appropriate OCR/extraction rather than silently mis-processed as English. Documents with unsupported languages are flagged `needsReview`, not silently degraded.
- **Non-legal content gate**: after Stage 3 (structural detection) produces a document-type classification, documents that don't resolve to a recognized legal document type with reasonable confidence are halted before the expensive parallel extraction branch (5–10) runs, and flagged back to the user rather than processed at full cost.
- **Duplicate detection**: content-hash computed at Stage 0; an exact re-upload of an already-ingested document short-circuits to the existing `KnowledgeBaseRecord` rather than reprocessing and double-counting coverage.
- **Size/degeneracy bounds**: documents below a minimum extractable-content threshold (e.g. near-empty after cleaning) do not proceed to full pipeline processing; documents above a size threshold are chunked into independently-processed sub-units at Stage 0 so no single stage job exceeds its timeout budget.
- **Prompt-injection isolation**: every LLM call in Stages 5–10 treats extracted document text as strictly delimited data, never as instruction context. Any classifier output (topic tag, importance score, construct type) falling outside its expected schema/taxonomy is rejected and the section flagged `needsReview` rather than trusted.

### 3.4 Confidence Propagation
Every stage that produces a confidence score (OCR quality, heading detection, topic classification) propagates it forward. Stage 12 aggregates all upstream signals into one document-level `needsReview` flag — the single trustworthy quality indicator consumed by every downstream module.

---

## 4. Module 2 — Knowledge Engine

**Input:** `KnowledgeBaseRecord` per document, for one user.
**Output:** `PersonalExamLibrary` — a topic-centric restructuring, not a document-centric one.

### 4.1 Core data unit: `TopicKnowledgeUnit` (TKU)
One per `(user, topic, subtopic)`. Fields: `summary`, `definitions[]`, `provisions[]`, `cases[]`, `principles[]`, `exceptions[]`, `comparisons[]`, `examples[]`, `keywords[]`, `references[]`, `coverageScore`, `confidenceScore`, `lastUpdated`, **`version`** (added by review, §4.4).

Supporting record types: `DefinitionRecord`, `ProvisionRecord`, `CaseRecord` (with `isLandmark`/`isReferenced` distinction), `PrincipleRecord`, `ExceptionRecord` (linked to the principle it qualifies), `ComparisonRecord` (cross-type, only materialized where source material or structural similarity actually supports it), `ExampleRecord`, `ReferenceRecord` (full traceability chain back to source document/section).

TKUs connect via a `topicGraph`: `parentTopic`/`childSubtopics` (hierarchy) and `relatedTopics[]` (non-hierarchical cross-subject links).

### 4.2 Processing Flow
```
A. Ingestion Intake         — per completed document, event-triggered
B. Topic Routing            — route extracted entities to matching TKU(s), creating TKUs as needed
C. Entity Merge & Dedup     — match against existing entities (term/citation/semantic similarity); merge, don't duplicate
D. Relational Linking       — resolve exceptions→principles, examples→what they illustrate, cases→provisions
E. Summary Synthesis        — regenerate TKU summary on material change, not on every document add
F. Coverage & Confidence Scoring — breadth + depth + upstream confidence aggregation
G. Cross-Topic Graph Update — detect new relatedTopics links
H. Library Persistence      — emit "topic ready" signal once thresholds are crossed
```

### 4.3 Incrementality
Adding a document touches only the TKUs its content maps to. Deleting a document retracts or demotes entities whose sole `sourceRef` was that document; entities with multiple `sourceRefs` are re-scored, not deleted. No full-library rebuild ever occurs.

### 4.4 Concurrency Control (added by review — mandatory)
TKU writes use optimistic concurrency: every merge job reads the current `version`, computes its merge, and writes conditionally (compare-and-swap on `version`). On conflict, the job re-reads the latest state and retries the merge rather than blind-overwriting. This prevents concurrent document uploads mapping to the same TKU from silently losing each other's contributions.

### 4.5 User Correction Flow (added by review)
A user disputing a misclassified topic, wrong definition, or a `needsReview`-flagged extraction can submit a correction targeting a specific entity (not requiring re-upload). Corrections are applied as a merge event through the same Stage C path, with `sourceType: userCorrection` taking precedence over automatically-extracted variants, and propagate through D–H exactly like any other update.

---

## 5. Module 3 — Legal Authority Index

Shared, non-user-scoped, versioned Qdrant collection of statutes, bare acts, and landmark case law. Maintained centrally (scheduled `authority-index-sync` job, not user-triggered). Used only as enrichment — never as a substitute for a user's own grounded material — in Modules 3 (Question Generation) and 4 (Model Answer). Enrichment-sourced content is always tagged distinctly from user-sourced content in any downstream output, so the split is visible to the end user.

**Legal-currency handling (added by review):** when a sync updates or flags an authority entry as overruled/superseded, every downstream `QuestionBankEntry`/model answer whose `groundingSources` reference that entry is marked `stale` and routed into the standard targeted-regeneration path (§7.4). This is the mechanism that prevents cached "topper-level" answers from silently going legally out of date.

---

## 6. Module 9 — Taxonomy Registry (added by review)

Owns the legal-subject taxonomy consumed by Ingestion Stage 5–6 and Knowledge Engine topic routing. Versioned. Provides:
- An `Uncategorized` fallback bucket for content that doesn't map cleanly to any existing taxonomy node — never force-fit content into the nearest wrong category.
- A change-propagation job: when a taxonomy node is added, split, merged, or renamed, affected TKUs and their downstream questions are queued for reclassification via the batch-reconciliation path (§7.5), not the standard per-document incremental path (a taxonomy change has a wide blast radius by nature).

---

## 7. Module 4 — Question Generation Engine

**Input:** `PersonalExamLibrary` (TKUs + coverage index + topic graph).
**Output:** persisted `QuestionBankEntry` records.

### 7.1 Workflow
```
1. Coverage Planning   — target matrix per TKU: question type × mark value (5/10/15/20), cell eligibility determined by actual TKU content depth
2. Slot Allocation     — bind eligible cells to specific TKU entities; this binding is the primary duplicate-avoidance mechanism
3. Question Synthesis  — question text + model answer + rubric per slot (delegates answer drafting to Module 5)
4. Validation           — gated checks (§7.2)
5. Storage & Indexing   — persist accepted entries; requeue/reject failures
6. Coverage Reconciliation — periodic sweep to fill gaps as TKUs evolve
```

Type eligibility rules (unchanged from design): Direct needs definitions/provisions; Analytical needs principles with application notes or exceptions; Comparative needs an actual `ComparisonRecord` or shared comparison axis; Critical needs a principle plus a landmark case or exception implying unsettled ground; Case-based needs a case with populated facts/held/ratio. Mark-value eligibility requires a minimum count of linked entities per tier — sparse TKUs get fewer, honest slots; rich TKUs get the full matrix.

### 7.2 Validation Gates
1. **Structural** — required fields present, mark value matches rubric total, type matches actual framing.
2. **Groundedness** — every claim traces to a `boundEntityRef` or Legal Authority citation.
3. **Duplication** — structural (slot-binding uniqueness) + semantic (embedding similarity against same-TKU and `relatedTopics` bank entries), capped via approximate-nearest-neighbor search rather than full scan (§13.1 performance note).
4. **Quality/difficulty** — cognitive demand matches declared type and mark value.
5. **Coverage sanity** — rejects further additions to an already-saturated `(topic, type, markValue)` cell.
6. **Private-content leakage (added by review, gates promotion only)** — before a question is promoted to the shared cross-user pool, an independent content-similarity check against the originating user's private source documents confirms no phrasing/example leakage occurred during synthesis, beyond what the structural `boundEntityRefs` check alone verifies. Fails closed: ambiguous cases stay user-scoped.

### 7.3 Storage
`QuestionBankEntry`: `questionId`, scope (`userId` or shared), `topicPath`, `subtopicId`, `questionType`, `markValue`, `questionText`, `modelAnswer` (structured, rubric-segmented), `rubric`, `boundEntityRefs[]`, `groundingSources[]` (user-material vs. authority-enrichment split), `qualityScore`, `usageCount`, `lastUsed`, `status` (`active`/`stale`/`retracted`).

Two-tier scoping: user-private questions (bound to private documents) vs. shared-eligible questions (bound entirely to Legal Authority Index entities, promoted only after passing Gate 6).

### 7.4 Lifecycle
`stale` on underlying entity change or authority update (§5); `retracted` on failed re-validation or source deletion — retained for audit, never hard-deleted. Regeneration always scoped to the specific affected entry via `boundEntityRefs`.

### 7.5 Batch Reconciliation Path (added by review)
Distinct from per-entity incremental regeneration: handles wide-blast-radius changes (taxonomy restructure, a widely-referenced authority correction) via a rate-limited batch job, throttled against LLM provider quotas, rather than firing thousands of regenerations at once.

---

## 8. Module 5 — Model Answer Engine

**Input:** a `QuestionBankEntry` + its source TKU (+ Legal Authority Index where needed).
**Output:** structured `modelAnswer`, persisted on the entry (§7.3) — generation happens once, at question-creation time, never at serving time.

### 8.1 Structure (mark-calibrated, not uniform)

| Component | 5 marks | 10 marks | 15 marks | 20 marks |
|---|---|---|---|---|
| Introduction | 1 line | short | contextual | full contextual |
| Statutory Provisions | cited only | quoted briefly | quoted + interpreted | quoted + interpreted + related provisions |
| Explanation | core rule only | rule + application | rule + application + nuance | + doctrinal development |
| Case Law | 0–1, holding only | 1, holding + facts | 2–3, full structure | 3+, full structure + inter-relation |
| Critical Analysis | omitted | omitted/one line | present, focused | present, substantive |
| Conclusion | one line | short | standard | standard + implications |
| Examiner Keywords | 3–5 | 5–8 | 8–12 | 10–15 |

### 8.2 Flow
Context assembly (from `boundEntityRefs`, same entities the question was built from — never a fresh drift-prone retrieval) → component planning against the table above → grounded drafting per component with sentence-level source attribution → keyword extraction derived from the drafted text itself (not independently generated) → assembly.

### 8.3 Validation Gates
1. Structural conformance to the mark-value table.
2. Groundedness — sentence-level source attribution checked for presence and entailment (does the source actually support the claim).
3. Case law accuracy — facts/held/ratio drafted from structured `CaseRecord` fields, not free recall.
4. Coherence — components read as one answer.
5. Keyword-content consistency.
6. Enrichment boundary — Legal Authority content visibly distinguished from user-material content.

Failures trigger targeted component-level regeneration, not full-answer regeneration.

---

## 9. Module 6 — Mock Test Engine

**Input:** paper specification (total marks, scope, format template, optional constraints) + Question Bank + `TopicCoverageIndex`.
**Output:** assembled paper. Request-time only; no LLM calls on this path.

### 9.1 Selection Algorithm
Candidate pooling per mark-value slot (active status, scope-matched, TKU confidence above threshold) → scored ranking (recency-inverse for repetition avoidance, coverage contribution, quality score, type-diversity pressure) → sequential greedy fill in descending mark-value order (narrowest pools claim best candidates first) → backtracking/reallocation on empty slots per template fallback rules.

Hard exclusion (not just scoring penalty) of questions used in the user's immediately preceding paper on the same scope.

### 9.2 Balancing
Topic balance: running marks tally per topic, target proportional to `coverageScore`-weighted syllabus share. Type balance: running count per question type against template targets. Difficulty: derived from mark value + type + source-entity depth, not a separately assigned tag.

### 9.3 Shortfall Handling
Insufficient material for a requested scope shrinks the paper honestly or flags specific topics back to the user — with a corresponding user-facing prompt to upload more material for that topic (added by review — the original design handled the shortfall algorithmically but never closed the loop back to the user with an actionable next step).

### 9.4 Workflow
```
1. Specification Resolution
2. Coverage Snapshot (indexed read)
3. Candidate Pooling
4. Greedy Slot Filling
5. Balance Verification
6. Shortfall Resolution
7. Paper Assembly (sectioned, ordered)
8. Usage Recording
9. Delivery (model answers withheld until submission/review)
```

---

## 10. Module 7 — Answer Evaluation Engine (new, added by review)

**Why it exists:** Without this module the system generates exams but never assesses a student's actual performance — the Rubric Generator output (§7) had no consumer. This closes the core loop the product is named for.

**Input:** `SubmissionRecord` (student's written answer for a specific `questionId`) + that question's existing `rubric` and `modelAnswer`.
**Output:** per-component score + grounded feedback (not a bare number) — feedback text must itself pass the same groundedness discipline as Model Answer generation (§8.3 Gate 2): no "you should have known X" claims that don't trace back to the rubric/model answer.

### 10.1 Flow
```
1. Submission intake
2. Component-wise comparison against rubric (issue-spotting, rule statement, application, authority citation, conclusion)
3. Score assignment per component, aggregated to total
4. Feedback drafting per component, grounded in modelAnswer content (what was present/missing, not generic commentary)
5. Persistence (SubmissionRecord updated with scores + feedback)
```

### 10.2 Data Model
`SubmissionRecord`: `submissionId`, `questionId`, `userId`, `submittedText`, `scorePerComponent[]`, `totalScore`, `feedback[]` (per component), `attemptTimestamp`. Enables future weak-topic analytics (out of scope for v1.0, noted in §16).

---

## 11. Module 8 — Orchestration & Multi-Provider AI Layer

Extends the existing platform multi-provider layer (OpenRouter + fallback, BYOK, credit tracking) uniformly across all LLM-bound stages in Modules 1, 4, 5, 7. Routes ingestion-time work to higher-context/higher-latency-tolerant models; routes any live-interactive work to fast/cached paths.

**Provider-failure handling (added by review):** every LLM-bound job stage has an explicit terminal-failure state distinct from retry — on exhausting the fallback chain, the job surfaces as "needs attention" on the ingestion status stream rather than leaving a document invisibly stuck mid-pipeline.

**Credit/quota integration (added by review):** every LLM-bound stage debits the platform's existing credit system. Bulk upload submission performs a pre-flight credit check and rejects/queues-with-warning if projected cost would exceed remaining balance. Per-user ingestion submission is rate-limited independently of the existing per-file size/count limits, to bound abuse cost exposure.

---

## 12. Background Processing & Job Queues

### 12.1 Queue Segmentation (by latency class, not shared)
- `ingestion-extraction` — OCR/parsing, high concurrency
- `ingestion-understanding` — entity/topic/definition extraction, LLM-bound, provider-rate-limited
- `knowledge-aggregation` — TKU merge/synthesis, per-document triggered
- `question-generation` / `answer-generation` — paired, lowest urgency, off-peak eligible
- `coverage-reconciliation` — periodic sweep, lowest priority
- `taxonomy-reconciliation` (added by review) — batch path for wide-blast-radius taxonomy/authority changes, rate-limited separately from per-document queues

### 12.2 Fairness & Idempotency
Per-user fair-share scheduling within LLM-bound queues (round-robin, not strict FIFO) so one user's bulk upload cannot starve others. Every job keyed by `(entityId, stageName)` for resumability; duplicate submission against completed work is a no-op. Backpressure applied at the upload endpoint under queue-depth pressure — accept and queue honestly, never silently degrade.

### 12.3 Progress Visibility
Every stage emits a real completion event (never a synthetic/estimated progress value) to a status stream consumed by the frontend via the existing Socket.io layer. Per-topic "ready" events allow partial-library actions (generating a test scoped to already-ready topics) without waiting for a full library to finish processing.

---

## 13. Caching Strategy

| Layer | Content | Invalidation |
|---|---|---|
| L1 — DUR/vector cache | Parsed & embedded document structure | Document re-upload/delete only |
| L2 — TKU cache | Assembled topic knowledge units | Targeted, per-entity, on merge/update |
| L3 — Question/Answer bank | Generated questions + model answers | `boundEntityRef`/`groundingSources` staleness only |
| L4 — Coverage index (Redis) | `TopicCoverageIndex` summaries | Incremental, per-document-add |
| L5 — Assembled-paper cache (Redis, short TTL) | Recently assembled papers per `(user, scope, template)` | TTL + explicit bypass for repetition-avoidance |
| L6 — Legal Authority retrieval cache | Statute/case-law lookups | Authority-index sync only |

L1–L4 are the actual latency lever for "papers generate in seconds" — L5 is a defensive idempotency cache only, deliberately short-TTL so it never conflicts with repetition avoidance. A cache miss on L1–L3 during a request is treated as a bug signal (querying before a readiness event fired), never a trigger for inline live generation.

### 13.1 Duplicate-Check Cost Bound (added by review)
Gate 3 (§7.2) semantic duplication checks use approximate-nearest-neighbor search with a bounded candidate set, not full-corpus comparison — cost stays roughly constant as the shared pool grows, rather than scaling with total bank size.

---

## 14. Database & Indexing Strategy

### 14.1 Indexes (purpose-built per access pattern)
- DUR store: `(userId, documentId, sectionPath)`; vector index payload-filtered by `userId`.
- TKU store: `(userId, topicPath, subtopicId)` primary; secondary on `coverageScore`/`confidenceScore`.
- QuestionBankEntry: composite `(topicPath, subtopicId, questionType, markValue, status)` — the highest-traffic index in the system, hit once per slot on every paper assembly; secondary `(userId, lastUsed)` for repetition-window lookups.
- Legal Authority Index: exact/normalized-key lookup (`actName + sectionNumber`, canonical citation).
- Coverage Index table: deliberately small and denormalized, kept off the heavier TKU tables specifically to stay on the hot path cheaply.

### 14.2 Row-Level Security (added by review — mandatory, defense in depth)
RLS enabled on every user-scoped table (`documents`, `TopicKnowledgeUnit`, private `QuestionBankEntry`, `SubmissionRecord`). Application-layer `userId` filtering remains required, but RLS is a non-negotiable second layer so a single missed filter in future feature work cannot become a cross-user data leak.

### 14.3 Concurrency Control
Optimistic versioning on TKU writes (§4.4). Shared-pool promotion writes are similarly version-guarded to prevent race conditions when multiple users' documents independently contribute toward the same shared-eligible candidate.

### 14.4 Archival (added by review)
`stale`/`retracted` records beyond a retention window move to a cheaper storage tier (partitioned by status/age), keeping hot-path indexes lean without violating the audit-retention requirement.

### 14.5 Read Scaling (added by review)
Shared Question Bank pool is read-heavy/write-rare; paper-assembly reads route to read replicas as concurrent load grows (exam-season peak load pattern), keeping the primary free for write-path (ingestion, generation) work.

---

## 15. Security Architecture

- **Prompt-injection isolation** at every LLM call boundary in ingestion (Stage 5–10) and generation — document/user content is always data, never instruction context; classifier outputs outside expected schema are rejected (§3.3).
- **Private-content leakage gate** before any question/answer promotion to the shared cross-user pool (§7.2 Gate 6) — independent of the structural `boundEntityRefs` check.
- **RLS on all user-scoped tables** (§14.2).
- **Audit logging** on all admin/founder access to a user's private library content, routed through the existing `founder-security` module's audited access path — no unlogged reads of private user material.
- **Abuse prevention**: per-user ingestion rate limiting + credit pre-flight checks (§11), independent of existing per-file size/bulk-count limits.
- **Legal-currency integrity**: overruled/superseded authority entries cascade `stale` status to dependent content (§5) rather than leaving outdated legal positions live indefinitely.

---

## 16. User Flows

Covered end-to-end: upload → ingestion progress → library browse → correction of misclassified content (§4.5) → mock test generation → paper delivery → answer submission → evaluation/feedback (§10) → low-coverage prompt-to-upload-more (§9.3).

**Data rights (added by review):** export and full deletion of a user's Personal Exam Library must be supported as an explicit flow — deletion cascades through TKU retraction logic (§4.3) exactly as document deletion does today, and must additionally purge/never have promoted private content into the shared pool (verified via §7.2 Gate 6's audit trail).

---

## 17. Edge Cases (must be handled, not deferred)

- Multi-language source documents (§3.3).
- Duplicate upload via content-hash short-circuit (§3.3).
- Non-legal document upload gated before expensive processing (§3.3).
- Pathologically large/small documents — chunked processing / minimum-content threshold (§3.3).
- Novel topics outside the current taxonomy — `Uncategorized` fallback, not force-fit (§6).
- Concurrent uploads mapping to the same TKU — optimistic concurrency (§4.4).
- Provider outage mid-pipeline — explicit terminal-failure state, surfaced not silent (§11).
- Overruled case law — cascading staleness (§5).

---

## 18. Launch Scope

**Must ship in v1.0 (launch-blocking):**
Modules 1–8 as specified, including Answer Evaluation Engine, RLS, TKU concurrency control, private-content leakage gate, prompt-injection isolation, credit/quota integration.

**Should ship in v1.0, can trail by one iteration if necessary:**
API contract finalization, data export/deletion flow, multi-language OCR support, non-legal-document gate, taxonomy registry's reclassification batch job.

**Explicitly deferred (track for scale, not launch-blocking):**
Read-replica routing for the shared pool (§14.5), archival tier automation (§14.4), weak-topic analytics on top of `SubmissionRecord` (§10.2), embedding-model version migration tooling.

---

## 19. Change Control

This document is the source of truth. Any implementation decision that contradicts it must either conform to it or trigger an explicit revision of this document first — no silent architectural drift during implementation.
