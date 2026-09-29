# Bare Act AI — Reliability & Graceful Degradation Framework

## 0. Purpose

Every system fails sometimes — retrieval misses, generation errors out, a model output doesn't clear the Quality Assurance gate. What separates a trustworthy legal education tool from a broken one is not the absence of failure, but what happens *when* it fails. A professor whose train of thought breaks mid-sentence doesn't hand the class a blank page — they fall back to their notes, read the statute aloud, and give the class something real to work with.

This document specifies Bare Act AI's failure-handling pipeline: a sequence of decreasingly ambitious, increasingly certain fallback levels, ending in an absolute guarantee that **no response is ever empty, and no fallback ever fabricates to compensate for a failure.**

```
User asks question
        ↓
Retrieve section              (Stage A)
        ↓
LLM explains                  (Stage B — full pipeline: Specs 1-8)
        ↓
   [fails QA gate?] ──no──→ Deliver full answer (PASS)
        │ yes
        ↓
Retry                         (Stage C — one adjusted attempt)
        ↓
   [fails again?] ──no──→ Deliver full answer (PASS)
        │ yes
        ↓
Show retrieved Bare Act text  (Stage D — raw, zero-risk fallback)
        ↓
Generate structured explanation
from retrieved text only      (Stage E — constrained, extractive generation)
        ↓
   [partially fails?]
        │ yes
        ↓
Show: Section + Simple Summary
+ Important Terms + Related
Sections (whatever succeeded) (Stage F — guaranteed minimum bundle)
        ↓
NEVER RETURN AN EMPTY RESPONSE (Stage G — absolute floor)
```

---

## 1. The Governing Principle: Degrade in Sophistication, Never in Honesty

As the pipeline descends through fallback levels, **the answer is allowed to become simpler, shorter, and less richly taught — it is never allowed to become less accurate or less honest.** Each fallback level trades ambition for certainty, not the other way around:

- Stage B (full explanation) carries the richest teaching but the highest generation complexity.
- Stage D (raw retrieved text) carries zero generation risk, because it is not generated at all — it is the verified source text itself.
- Stage E/F sit between the two: constrained generation, strictly derived from the retrieved text, with no room for invented legal history, case law, or unverifiable claims.

At no point does a lower fallback level "fill in" for a higher one by guessing. If Stage B fails because a citation couldn't be verified, Stage D/E do not invent that citation either — they simply stop trying to include it and show what is actually known.

---

## 2. Stage A — Retrieval

**What happens:** The relevant Bare Act section/article/chapter/schedule text is retrieved from the verified corpus, based on the Query Understanding Engine's resolved Act and provision (`BARE_ACT_AI_QUERY_ENGINE.md` Stages 2-3).

**Failure mode specific to this stage:** If retrieval itself returns nothing (the section doesn't exist in the corpus, or the resolved provision reference doesn't match anything retrievable), this is a distinct, upstream failure from anything the rest of this pipeline handles — there is no text to fall back to. In this case:
- Do not proceed to Stage B with a guessed or remembered version of the text from model memory — that reintroduces exactly the fabrication risk this framework exists to prevent.
- Fall through directly to an honest, non-empty response: state plainly that the specific provision could not be located in verified source material, and invite the user to confirm the Act/section (this doubles as re-entering the Clarification Protocol from the Query Understanding Engine).
- This still satisfies Stage G (never empty) — an honest "I couldn't retrieve this" is a valid, complete response, not a failure to respond.

**Success condition:** Verified section text is retrieved and passed forward as the grounding source for every subsequent stage.

---

## 3. Stage B — LLM Explanation (Full Pipeline)

**What happens:** The full system runs as designed elsewhere — Query Understanding → Response Planning → Teaching Methodology sequencing → Style rendering → Conversational Memory continuity → the Quality Assurance gate (`BARE_ACT_AI_QUALITY_ASSURANCE.md`).

**Failure criteria (what "explanation fails" means):** The QA gate returns **REVISE** with a Major issue that cannot be automatically corrected in place, or **BLOCK-AND-CLARIFY** due to a Critical failure (wrong Act/section detected, a fabricated-or-unverifiable authority that the draft stated as fact, a meaning-changing terminology error) — or a hard generation error/timeout prevents a draft from being produced at all.

**Success condition:** The QA gate returns PASS, or REVISE issues were corrected in place and the corrected draft then passes. This is the normal, expected path for the large majority of questions — the fallback stages below exist for the exception, not the rule.

---

## 4. Stage C — Retry

**What happens:** On a Stage B failure, exactly **one** retry is attempted before escalating further. Infinite or repeated retries are not used — a single, deliberately adjusted attempt, followed by escalation if it also fails, keeps latency and cost bounded and avoids masking a systemic issue behind repeated silent retries.

**What changes on retry, relative to the first attempt:**
- If the failure was traced to a specific unverifiable claim (e.g., a case citation that couldn't be confirmed), the retry is constrained to omit that specific claim and explicitly flag it as a gap, rather than attempting to re-generate the same unverifiable content again.
- If the failure was traced to a misresolved Act/section (a Query Understanding error), the retry first re-runs Stages 2-3 of the Query Understanding Engine with any available disambiguating signal, rather than re-running the same (wrong) resolution.
- If the failure was a structural/flow issue (Teaching Methodology step order, non-repetition violation, style inconsistency), the retry regenerates with those specific structural constraints reinforced.
- If the failure was a hard error/timeout with no diagnosable content issue, the retry is a straightforward re-attempt.

**Failure criteria:** The retried draft fails the QA gate again, on the same or a different check.

**Success condition:** The retried draft passes the QA gate — deliver it as the final answer, with no visible sign to the user that a retry occurred.

---

## 5. Stage D — Show the Retrieved Bare Act Text

**What happens:** If both the original attempt and the retry fail, the pipeline stops trying to produce free-form generated explanation and instead shows the **raw, verified retrieved section text** from Stage A directly to the user.

**Why this is safe:** This stage introduces no new generation risk whatsoever — it is not an LLM output, it is the actual statutory text already confirmed to exist in the corpus. It cannot be factually wrong about what the Act says, because it *is* what the Act says.

**Presentation:** Accompanied by a brief, honest, non-alarming note in the identity spec's voice (never a raw system error message) — e.g., "I want to make sure I give you a fully reliable explanation rather than one I'm not confident in, so here is the exact text of the provision while I put together a more structured explanation below."

---

## 6. Stage E — Generate Structured Explanation From Retrieved Text Only

**What happens:** A second, more constrained generation attempt is made — but with a materially narrower mandate than Stage B. This generation is **extractive and organizational, not exploratory**: it is only permitted to work with what is directly present in or safely derivable from the retrieved text itself, not from the model's broader legal knowledge.

**What this generation is allowed to produce:**
- A structural breakdown of the retrieved text into its clauses (Response Planning field 1.6-equivalent), since this only requires parsing the text already in hand.
- Identification of terms that appear in the retrieved text and qualify under the Terminology Framework's detection tiers, with their meaning drawn from the Act's own definitions clause if that clause is also part of the retrieved/available corpus text.
- A plain-language restatement of the retrieved text (Response Planning field 1.7-equivalent).

**What this generation is explicitly not allowed to produce at this fallback level:**
- Legislative history/purpose claims not verifiable from the retrieved text itself (Step 2 of the Teaching Methodology is skipped or heavily qualified at this level, since it typically requires broader knowledge than the bare text provides).
- Case law / judicial interpretation content (Step 8) — this requires knowledge beyond the retrieved statutory text and carries the highest fabrication risk; it is omitted at this fallback level rather than attempted.
- Exam-importance commentary requiring broader pattern knowledge beyond this text — included only if it can be stated with genuine confidence, otherwise omitted.

**Failure criteria ("generation partially fails"):** One or more of the components attempted in this stage (clause breakdown, term extraction, plain-language summary) individually fails generation or fails a scoped version of the QA gate, while others succeed.

---

## 7. Stage F — The Guaranteed Minimum Bundle

**What happens:** Whatever succeeded from Stage E (and always including the raw text from Stage D) is assembled into the guaranteed minimum response:

1. **Section** — the verified retrieved text (always present; this is the one component that cannot fail, since it requires no generation).
2. **Simple Summary** — a plain-language restatement, if Stage E succeeded in producing one; if this specific component failed, state plainly that a simplified summary couldn't be reliably generated right now, rather than showing nothing or a broken partial sentence.
3. **Important Terms** — terms identified and defined from the retrieved text, if that component succeeded; if it failed, omit it with the same honest one-line note rather than an empty or malformed section.
4. **Related Sections** — any related provisions the system can confidently identify (e.g., from the Act's own cross-references present in or near the retrieved text, or from previously verified session context per the Conversational Memory Framework); omitted with an honest note if not confidently available.

**Independent component failure handling:** Each of the four components is generated and validated independently. A failure in one (e.g., Related Sections) never blocks the others from being shown — the user always receives every component that could be reliably produced, plus an honest, brief note about any component that couldn't.

---

## 8. Stage G — The Absolute Non-Empty Guarantee

**Rule:** Under no combination of failures — retrieval failure, Stage B and C failure, Stage E partial or total failure — does Bare Act AI ever return a blank response, a raw system error, a stack trace, or a generic unhelpful "something went wrong" message with no legal content or next step.

**The absolute floor**, used only if every prior stage fails to produce any usable content at all (retrieval found nothing, and no text exists to fall back to):
- Plainly state what was attempted and what could not be confirmed (e.g., "I wasn't able to locate verified text for this specific provision.").
- Never speculate to fill the gap.
- Always give the user a concrete next step: confirm the Act, rephrase the section reference, or clarify the question — turning the failure into a productive next turn rather than a dead end.
- This message is still written in Bare Act AI's normal voice and tone (identity spec Section 8) — calm, professional, never apologetic to the point of undermining confidence in the product, never a raw technical error string.

This floor response is itself considered a **successful, complete response** for the purposes of this framework — "never empty" does not mean "always produce a full explanation regardless of what's true," it means "always produce something genuinely useful and honest, even when that something is a clearly stated limitation."

---

## 9. Failure Detection Reference Table

| Stage | Trigger to escalate further | What the next stage does differently |
|---|---|---|
| A → floor | Retrieval returns no matching verified text | Skip generation entirely; honest no-match message + next step |
| B → C | QA gate: REVISE (uncorrectable) or BLOCK, or hard error | One retry, adjusted based on the specific failure diagnosed |
| C → D | QA gate fails again on retry | Stop generating; show raw retrieved text |
| D → E | (Always proceeds after D) | Attempt constrained, extractive-only structured generation |
| E → F | One or more Stage E components fail | Assemble whatever succeeded; honest notes for what didn't |
| F → G | (Always the final safety net) | Guarantees the bundle itself is never blank |

---

## 10. Relationship to the Other Specs

- **Stage A** relies on the **Query Understanding Engine**'s Stage 2/3 resolution to know what to retrieve, and re-enters its Clarification Protocol if retrieval fails entirely.
- **Stage B** is the full, ordinary operation of every other spec working together: Response Planning content, Teaching Methodology sequencing, Terminology Framework term handling, Style Rotation delivery, Conversational Memory continuity — gated by the **Quality Assurance** checklist.
- **Stages C-F** are governed throughout by the same **anti-hallucination contract** from the Identity Specification — degradation trades richness for certainty precisely because that contract never relaxes, no matter how deep into the fallback chain the pipeline goes.
- **Stage G**'s wording is governed by the Identity Specification's tone rules (Section 8) — even a failure message is still "the professor," never a broken system surfacing raw errors.

## 11. One-Line Summary

**Bare Act AI would rather hand the student the verified statute itself than a confident-sounding guess — every failure steps down to a simpler, safer form of help, and the one thing that never happens, at any level, is silence.**
