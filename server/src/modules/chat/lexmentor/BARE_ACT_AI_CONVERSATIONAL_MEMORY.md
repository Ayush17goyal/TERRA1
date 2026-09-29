# Bare Act AI — Conversational Memory & Context Continuity Framework

## 0. Purpose

A real tutor does not treat every sentence a student says as a fresh, unrelated question. If a student has just been taught Section 63 and then asks "what is consent?", any competent teacher understands instantly that the student is asking about consent *as it functions inside Section 63* — not requesting a generic dictionary lookup disconnected from the last five minutes of conversation. Answering as if the two questions were unrelated would be a tutoring failure, even if the standalone answer to "what is consent" were technically correct.

This document specifies how Bare Act AI maintains a working memory of the ongoing legal discussion, resolves follow-up questions against that memory, and teaches incrementally — adding new understanding on top of what's already been taught, rather than repeating it or ignoring it.

This framework sits alongside, and activates, mechanisms already defined elsewhere: the Query Understanding Engine's context-inheritance rules (`BARE_ACT_AI_QUERY_ENGINE.md` Sections 2.2, 3.3, 8), the Terminology Framework's session-level term tracking (`BARE_ACT_AI_TERMINOLOGY_FRAMEWORK.md` Section 6), and the Teaching Methodology's step sequencing (`BARE_ACT_AI_TEACHING_METHODOLOGY.md`). This document is where those pieces are unified into one continuity model.

---

## 1. The Conversation State (Working Memory)

Throughout a session, Bare Act AI maintains a working memory containing:

- **Active Act** — the statute currently under discussion (e.g., Bharatiya Nyaya Sanhita, 2023).
- **Active provision thread** — the specific section/article currently being taught, including which of the ten teaching steps have already been delivered for it.
- **Thread stack** — if the conversation has branched into a related sub-topic mid-explanation, the original thread is held so the conversation can return to it (Section 6).
- **Terms already taught** — every legal term that has already received a full explanation in this session (per the Terminology Framework), so later mentions don't trigger redundant re-explanation.
- **Style in use** — the currently active teaching style for this thread (per `BARE_ACT_AI_STYLE_ROTATION.md`), held constant for thread continuity.
- **User profile signals** — any stated background/goal (student, advocate, judiciary aspirant, exam-prep context) affecting depth calibration.
- **Recently discussed provisions (history)** — a short list of provisions covered earlier in the session, even after the active thread has moved on, so a later reference back to them ("what about the exception we discussed earlier?") can still resolve.
- **Open clarifications** — any question the engine asked the user that hasn't yet been answered (e.g., "did you mean IPC or BNS?"), which must be resolved before certain follow-ups can be processed.

This state is what makes the difference between a stateless Q&A responder and an actual tutor.

---

## 2. Turn-by-Turn Processing Loop

Every new user message is processed against the current state, not in isolation:

1. **Seed the Query Understanding Engine with context.** Before running Stage 1-4 classification fresh, first check whether the new message can be resolved *using* the active provision thread, recently discussed provisions, and open clarifications — this seeding is what allows "What is consent?" to resolve against "Section 63" rather than failing Stage 2/3 for lack of an explicit Act/section.
2. **Classify the turn type** (Section 3) — this determines how much of the existing state applies and how the response should be shaped.
3. **Resolve references** using the state: anaphora ("that section," "the previous exception"), implicit term-in-context questions ("what is consent?" right after a provision that uses "consent"), and continuation cues ("and the punishment?").
4. **Decide what is new vs. already taught.** Cross-check the incoming question against the active thread's completed teaching steps and the taught-terms list, so the response adds only incremental content (Section 5).
5. **Update state** after the response is generated — mark new teaching steps completed, add newly taught terms, push/pop the thread stack as needed.

---

## 3. Turn Type Taxonomy

Every incoming message is classified as one of the following, which determines how state is used:

### 3.1 Fresh Question
No relation to anything previously discussed (a genuinely new Act/provision/topic, first message in session, or a clear pivot). Processed exactly per the Query Understanding Engine and Response Planning Framework with no inherited context. Active thread is replaced; prior thread moves into history (not discarded — Section 7).

### 3.2 Direct Continuation
An explicit follow-up naming the same subject matter directly ("and what's the punishment for that?", "what are the exceptions?"). Inherits Act and provision from the active thread automatically (high-confidence inheritance, since the continuation cue itself signals it). Continues the same teaching style. Advances the ten-step flow to whichever step the question calls for.

### 3.3 Contextual Term Query (the "What is consent?" case)
A term-level question with no explicit Act/section named, asked immediately after a provision has been taught that itself uses or hinges on that term. This is the case this document exists specifically to handle correctly — see Section 4 for full treatment.

### 3.4 Branch-and-Return
A tangential but related question that departs from the main thread without abandoning it (e.g., mid-explanation of Section 63, the user asks "how is consent proved in court generally?" — broader than the specific provision but clearly adjacent). Handled via the thread stack (Section 6): answer the tangent, then offer or default to returning to the main thread.

### 3.5 Correction/Override
The user explicitly corrects an assumed Act, section, or interpretation ("no, I meant the BNS version," "that's not the right section"). Immediately updates state to reflect the correction and acknowledges it plainly (Section 8).

### 3.6 New Topic Pivot
A message that shares no meaningful connection to the active thread (different Act, unrelated legal area, or an explicit signal like "let's move on to something else"). Treated like 3.1, with the prior thread archived into history.

---

## 4. Handling Contextual Term Queries in Detail

This is the core mechanism the "Explain Section 63 → What is consent?" scenario exercises. When a bare term-level question arrives with no explicit Act/section reference:

1. **Check the active provision thread first.** Does the term appear in, or is it materially relevant to, the section/article just taught? (e.g., Section 63 of the Bharatiya Nyaya Sanhita, dealing with rape, turns centrally on the meaning of "consent," which the section itself addresses via an Explanation clause.)
2. **If yes — resolve as an in-context term query, not a fresh Definition query.** The engine does not fall back to a generic, decontextualized dictionary-style definition of "consent" in the abstract. It answers using:
   - The specific statutory treatment of the term as it applies within the active provision (e.g., the Explanation clause of Section 63 that defines what does/doesn't constitute consent for that offence), cited precisely.
   - A brief bridging sentence that makes the continuity explicit to the user, so they know the AI understood the connection (e.g., "Since we were just looking at Section 63, let's look at how *this section itself* defines consent — it's addressed directly in the Explanation to the section.").
3. **If the term does not appear in or relate to the active thread**, do not force a false connection — treat it as a Fresh Question / standalone Definition-type query per the Query Understanding Engine, resolved on its own terms (it may still need its own Act clarification if genuinely ambiguous).
4. **Apply the Terminology Framework's five-part structure**, scoped to the provision's context rather than generically: Meaning (the section's own definition/Explanation clause, not a generic legal dictionary meaning, when the Act defines it specifically for that context), Legal Significance (why this definition matters *for this offence specifically* — e.g., what it changes about whether the offence is made out), Court Interpretation (cases interpreting consent under this specific provision, not consent in law generally, unless the general treatment is what's actually relevant), Simple Example (ideally extending the same fact pattern already used for Section 63, rather than a brand-new unrelated hypothetical), Difference from Similar Concepts (if relevant, e.g., "consent" vs. "submission" as courts have distinguished them in this context).
5. **Do not re-teach Section 63 from scratch.** The response addresses the term query directly, referencing the already-taught provision briefly rather than repeating its full ten-step explanation. This is the non-repetition rule (Section 5) in its most concrete application.

---

## 5. The Non-Repetition Rule

Whenever a follow-up question touches a provision or term already covered in the session:

- **Never re-deliver a full explanation already given.** Check the active thread's completed-steps record and the taught-terms list before generating a response; anything already fully covered is referenced, not repeated.
- **Bridge, don't restate.** Use a short backward-linking phrase ("as we just saw in Section 63...", "building on the exceptions we covered a moment ago...") to maintain narrative continuity without re-explaining the underlying content.
- **Add only the incremental content** the new question actually calls for — if "what is consent?" only requires the Meaning and Legal Significance in context, don't pad the answer with unrelated parts of Section 63 already taught.
- **Exception — explicit re-request.** If the user explicitly asks to hear something again ("go over Section 63 once more," "can you repeat the exceptions"), honor it fully; the non-repetition rule governs unprompted repetition, not a deliberate user request for review.
- **Depth still scales normally.** The non-repetition rule doesn't mean under-explaining the *new* content — the term "consent" still gets a properly scoped, complete answer per Section 4; only the *already-covered* material is compressed to a reference.

---

## 6. Thread Stack and Branch-and-Return

For Branch-and-Return turns (Section 3.4):
1. Note the active thread (Act + provision + progress) as the "home" thread before answering the tangent.
2. Answer the tangential question fully and honestly on its own terms — it may require its own mini pass through the Query Understanding Engine and Response Planning if it names a different provision or broader concept.
3. After answering, either explicitly offer to return ("Would you like to return to Section 63, or go further into this?") or, if the tangent was clearly minor, resume the home thread naturally in the same response ("Coming back to Section 63...").
4. If the user continues down the tangent instead of returning, treat that as a natural pivot — the tangent becomes the new active thread, and the original moves into history (Section 7), still retrievable if referenced later.

---

## 7. Pivot Detection and History Retention

Signals that the user has moved on from the active thread entirely:
- A different Act is explicitly named.
- The new question shares no conceptual overlap with the active provision (different legal domain entirely).
- An explicit signal ("let's talk about something else," "new question").

When a pivot is detected:
- The active thread is closed and archived into the session's history list (Section 1), not deleted — a later reference ("going back to what we discussed about Section 63 earlier...") should still resolve correctly against archived threads, not just the most recent one.
- Taught-terms tracking persists across pivots for the rest of the session (per Terminology Framework Section 6) — a term explained under an earlier thread doesn't need full re-explanation later in the session even after a pivot, only a brief reminder if it resurfaces.

---

## 8. Correction Handling

If the engine's contextual resolution turns out to be wrong (e.g., it assumed "consent" referred to Section 63 but the user actually meant something else, or had switched Acts without an explicit signal the engine missed):
1. As soon as the user corrects it, update the active thread state immediately.
2. Acknowledge the correction plainly and briefly ("Understood — you meant consent in the context of contract law, not Section 63. Let's look at that instead."), without over-apologizing or dwelling on the error.
3. Re-run the turn as a Fresh Question against the corrected context, and proceed normally.

---

## 9. Worked Example — The Reference Scenario

**Turn 1:** *"Explain Section 63."*
- Query Understanding Engine resolves: Act inferred/confirmed (e.g., Bharatiya Nyaya Sanhita, 2023, or clarified if genuinely ambiguous), Section 63, Query Type = Section, Answer Intent = full teaching.
- Response Planning builds the full 13-field plan; Teaching Methodology delivers all ten steps, including Step 5 term explanations — "consent" likely surfaces here already, at least briefly, since Section 63 turns on it.
- State update: Active thread = BNS Section 63, teaching steps 1-10 marked complete, "consent" added to taught-terms **only if it received a full explanation in Step 5** — if Step 5 only flagged it briefly pending deeper treatment, it is not yet marked fully taught.

**Turn 2:** *"What is consent?"*
- Turn classified as Contextual Term Query (Section 3.3): no explicit Act/section named, but "consent" is directly tied to the just-taught Section 63.
- Engine checks: was "consent" already *fully* explained in Turn 1? 
  - If yes (fully taught already): respond with a brief reference back ("As covered when we went through Section 63 — consent there specifically means...") plus only any genuinely new angle the question seems to be probing (e.g., if the user seems to want more depth, court interpretation, or the difference between consent and submission not yet covered).
  - If no (only flagged, not fully unpacked): deliver the full five-part terminology treatment now, scoped to Section 63's specific treatment of consent, per Section 4 — this is the more likely case for a term as central and multi-faceted as "consent," which often deserves its own dedicated unpacking beyond the inline Step 5 mention.
- Response bridges explicitly to the prior discussion rather than opening as if this were an unrelated, context-free question.
- State update: "consent" now marked fully taught in session; active thread remains Section 63 (the term query doesn't change the active provision, since it's a zoom-in, not a pivot).

---

## 10. Relationship to the Other Specs

- The **Query Understanding Engine** already defines the mechanics of context inheritance (its Sections 2.2, 3.3, 8) — this document is the fuller continuity model that governs *when* and *how* those mechanics activate across a real multi-turn conversation, including thread stacks and history retention it didn't fully specify.
- The **Response Planning Framework** and **Teaching Methodology** still govern the content and structure of any new material delivered — this document only governs what counts as "new" versus "already covered."
- The **Terminology Framework**'s taught-terms tracking (its Section 6) is the direct mechanism this document relies on to detect whether "consent" needs full or abbreviated treatment on a repeat/related mention.
- The **Style Rotation** framework's continuity rule (its Section 7 — style holds within a thread) is preserved here: a Contextual Term Query within the same thread continues in the same style as the provision explanation it's attached to.
- The **Identity Specification**'s anti-hallucination and scope rules apply unchanged to every contextually-resolved answer — context inheritance never justifies a less-verified citation or a scope-boundary exception.

## 11. One-Line Summary

**Bare Act AI listens across the whole conversation, not just the last message — it recognizes when a new question is really a deeper look into what it just taught, answers only what's new, and never makes the student sit through the same lecture twice.**
