export type AcademyLesson = { index:number; number:number; moduleIndex:number; module:string; title:string; concept:string };

// ─────────────────────────────────────────────────────────────────────────────
// CONCEPT BRIEF FORMAT:
//   TEACH: What this lesson covers
//   NOT: What this lesson must NOT teach (boundary enforcement)
//   KNOWS: What students already know coming into this lesson
//   EXERCISE: What the student must produce
// ─────────────────────────────────────────────────────────────────────────────

const curriculum: Array<[string, Array<[string, string]>]> = [

 // ═══════════════════════════════════════════════════════════════════════════
 // MODULE 1 — LEGISLATIVE FOUNDATIONS
 // PURPOSE: Build the professional mindset of a legislative drafter.
 // NEVER: Teach drafting language devices, definitions, or specific provisions.
 // ═══════════════════════════════════════════════════════════════════════════
 ['LEGISLATIVE FOUNDATIONS', [

  ['Introduction to Legislative Drafting',
   'TEACH: What legislative drafting is as a professional discipline distinct from legal practice, academic study, and transactional drafting. Explain the role of a Parliamentary Counsel or Legislative Counsel — the professional who drafts Bills for Parliament and State Legislatures. Explain why drafting is a skill of precision and policy translation: the drafter must convert a government policy decision into legally binding, unambiguous text. Introduce the concept that every word in an Act carries a legal consequence. NOT: Do not teach specific language devices such as "shall" vs "may". Do not explain constitutional provisions. Do not begin any drafting exercise. KNOWS: No prior knowledge assumed — this is the first lesson. EXERCISE: Students must write a paragraph explaining in their own words why legislative drafting is different from writing any other legal document, and what unique responsibility the drafter carries.'],

  ['What Makes a Good Law?',
   'TEACH: The five criteria by which a law is judged to be well made: (1) Constitutional validity — it must be within the competence of the enacting legislature and not violate fundamental rights; (2) Policy accuracy — it must do exactly what the government intends, no more, no less; (3) Legal certainty — courts must be able to apply it without guesswork; (4) Practical workability — administrators must be able to implement it; (5) Accessibility — citizens and practitioners must be able to read and understand it. Illustrate each criterion with one example from Indian legislation. NOT: Do not teach how to draft. Do not explain language devices. KNOWS: Students know what legislative drafting is (Lesson 1). EXERCISE: Students must evaluate one real Indian Act against all five criteria and identify which criterion it satisfies best and which it falls short on.'],

  ['Characteristics of a Well Drafted Bare Act',
   'TEACH: The hallmarks of excellent legislative drafting as found in well-drafted Indian Acts: precision (every term carries an exact legal meaning), clarity (one sentence, one legal idea), completeness (no gap that requires the reader to guess), consistency (the same term always means the same thing), and accessibility (a legally trained reader can apply it without external aid). Use the Right to Information Act 2005 as the primary example — show how Section 3 (rights), Section 2(f) (definitions), and Section 19 (appeals) each demonstrate these hallmarks. NOT: Do not teach specific language devices or drafting techniques. KNOWS: Students know what makes a good law (Lesson 2). EXERCISE: Students must identify one provision from the RTI Act that exemplifies each of the five hallmarks and explain why it qualifies.'],

  ['Role and Responsibility of a Legislative Drafter',
   'TEACH: The institutional role of a Legislative Counsel: (1) they serve the policy intention of the Government, not their personal legal view; (2) they must identify and fill legal gaps in the policy brief before drafting; (3) they are responsible for constitutional validity, legal consistency, and language precision; (4) they must anticipate how courts will interpret every provision; (5) they must coordinate with all affected Ministries and departments. Teach the ethical dimension — a drafter who inserts their own policy preferences into the text breaches professional duty. NOT: Do not teach language devices or drafting techniques. KNOWS: Students know what good legislation looks like (Lessons 1-3). EXERCISE: Students must describe three specific situations where a Legislative Counsel must push back on a policy brief — situations where the brief, if implemented literally, would produce unconstitutional or legally unworkable legislation.'],

  ['Life Cycle of a Law',
   'TEACH: The complete journey from social problem to implemented Act: (1) Problem identification — a social, economic, or legal gap is identified; (2) Policy formulation — the Cabinet or Ministry decides the legislative response; (3) Drafting — Legislative Counsel prepares the Bill; (4) Parliamentary process — introduction, committee review, debate, passage by both Houses; (5) Presidential assent; (6) Gazette notification and commencement; (7) Rule-making — subordinate legislation is drafted and notified; (8) Implementation — executive agencies enforce the Act. Teach the feedback loop: court interpretations, committee reviews, and implementation gaps lead to amendment. NOT: Do not teach how any stage is actually performed. KNOWS: Students know the drafter\'s role (Lessons 1-4). EXERCISE: Students must trace the life cycle of one real Indian Act — from the social problem it addressed to its current state of implementation — and identify one point where the cycle led to an amendment.'],

  ['Course Project: Drafting Your Own Bare Act',
   'TEACH: Introduce the course project that students will develop throughout the entire programme: drafting an original Bare Act from first principles. Students must select a real social problem in India that currently lacks adequate legislative coverage. The project will be developed lesson-by-lesson: problem analysis in Module 2, research in Module 3, planning in Module 4, drafting language in Module 5, full drafting in Module 6, review in Module 7, and final submission in Module 10. Teach what makes a suitable project topic: specific, actionable through legislation, within a definite legislative competence, and of real public interest. NOT: Do not begin drafting. This lesson is project selection only. KNOWS: Students have completed the full foundations module. EXERCISE: Students must select their project topic, write a one-paragraph justification explaining the social problem it addresses, and submit the working title of their proposed Act.'],

 ]],

 // ═══════════════════════════════════════════════════════════════════════════
 // MODULE 2 — UNDERSTANDING THE LEGISLATIVE PROBLEM
 // PURPOSE: Teach how legislation begins — problem identification and framing.
 // NEVER: Begin drafting. Never introduce language devices or provisions.
 // ═══════════════════════════════════════════════════════════════════════════
 ['UNDERSTANDING THE LEGISLATIVE PROBLEM', [

  ['Identifying a Legislative Problem',
   'TEACH: How to identify and articulate the legislative mischief — the precise gap in existing law, the harm to persons or public interest, and the legal consequence of not legislating. Based on the Heydon Rule: courts ask what mischief the Act was meant to remedy. Students must articulate the problem in the form: (1) what is the current law; (2) what is the gap; (3) what harm results; (4) how the proposed Act will remedy it. Show how Law Commission Reports identify legislative problems in exactly this format. NOT: Do not begin drafting any provision. Do not introduce definitions or language devices. KNOWS: Students have selected a project topic (Module 1). EXERCISE: Students must produce a mischief statement for their project Act in the four-part form taught, using the format found in Law Commission Reports.'],

  ['Choosing the Right Legislative Topic',
   'TEACH: How to evaluate whether a chosen legislative topic is appropriate for a Parliamentary Act. A topic must be: specific (not "improve education" but "regulate private school infrastructure quality"), actionable through legislation rather than executive order, within the legislative competence of the chosen legislature, and not already adequately covered by existing law. Teach students to validate their project topic against these four criteria. NOT: Do not explain Schedule VII in depth — that is Lesson 7. Do not begin drafting. KNOWS: Students have identified a mischief (Lesson 1). EXERCISE: Students must validate their project topic against all four criteria and confirm or revise their choice with a written justification.'],

  ['Classifying Legislative Problems',
   'TEACH: How to classify a legislative problem under the Seventh Schedule to the Constitution: Union List (List I — only Parliament may legislate), State List (List II — only State Legislature may legislate), Concurrent List (List III — either may legislate, with Parliament prevailing in case of repugnancy under Article 254). Teach the doctrine of pith and substance: a law is classified by its dominant subject matter even if it incidentally touches another List. Give worked examples from all three Lists. NOT: Do not explain constitutional limitations on fundamental rights — that is Lesson 8. Do not begin drafting. KNOWS: Students have selected and validated their topic (Lessons 1-2). EXERCISE: Students must classify their project topic under Schedule VII, identify the specific List entry, and explain why that entry covers their subject matter.'],

  ['Need for Legislation',
   'TEACH: How to justify the need for legislation over non-legislative alternatives: administrative circulars, executive orders, and court directions. Legislation is required when rights must be conferred, duties imposed, authorities created, offences defined, or existing law repealed. Teach the test: "Could the government achieve this objective by executive order? If yes, is legislation still preferable for permanence, democratic accountability, and enforceability?" NOT: Do not begin drafting. KNOWS: Students have classified their topic under Schedule VII (Lesson 3). EXERCISE: Students must write three sentences explaining why only Parliament or a State Legislature — not the executive — can solve their identified legislative problem.'],

  ['Setting Legislative Objectives',
   'TEACH: How to translate a legislative policy into concrete, measurable legal objectives. A policy goal ("protect gig workers") must become a legislative objective ("confer a right to social security benefits, impose a duty on platform companies to register workers, create an enforcement authority"). Teach students to convert their policy goal into 3-5 specific legal objectives each expressible as a provision. NOT: Do not draft the provisions — objectives only. KNOWS: Students have justified the need for their Act (Lesson 4). EXERCISE: Students must convert their project policy goal into exactly three measurable legal objectives, each in the form: "The Act will [confer/impose/create/define] [what] on [whom]."'],

  ['Stakeholder Analysis',
   'TEACH: How to map every person affected by proposed legislation: rights-holders (who benefits), duty-bearers (who is obliged), regulatory authorities (who enforces), affected third parties (who is indirectly affected). Teach why stakeholder analysis prevents drafting gaps — if a class of persons is not identified before drafting, the Act cannot bind or protect them. NOT: Do not begin drafting. KNOWS: Students have set legislative objectives (Lesson 5). EXERCISE: Students must produce a stakeholder table for their project Act with four columns: actor, type, what the Act requires of them, and one drafting risk if they are omitted.'],

  ['Constitutional Competence',
   'TEACH: How to confirm that Parliament or a State Legislature has competence to enact the proposed legislation. Teach Articles 245-248 (territorial and subject-matter competence), Article 254 (Concurrent List repugnancy), and the doctrine of occupied field. Teach how to identify the correct legislature for any proposed Bill. NOT: Do not teach constitutional limitations on fundamental rights — that is the next lesson. KNOWS: Students have completed stakeholder analysis (Lesson 6). EXERCISE: Students must identify the correct legislature for their project Act, cite the constitutional authority (Article and Schedule VII entry), and explain what happens if a State legislature were to enact the same law on a Union List subject.'],

  ['Constitutional Limitations',
   'TEACH: The constitutional limits a drafter must anticipate: Article 13 (laws inconsistent with fundamental rights are void), Article 14 (equality — intelligible differentia and rational nexus to objective), Article 19 (reasonable restrictions only), Article 21 (procedure established by law must be fair, just, and reasonable). Teach the doctrine of proportionality as applied by the Supreme Court. NOT: Do not draft any provision. KNOWS: Students understand constitutional competence (Lesson 7). EXERCISE: Students must identify one provision in their proposed Act that could face a fundamental rights challenge and explain how it should be designed to withstand that challenge.'],

 ]],

 // ═══════════════════════════════════════════════════════════════════════════
 // MODULE 3 — LEGISLATIVE RESEARCH
 // PURPOSE: Teach professional legislative research methodology.
 // NEVER: Draft or plan any legislation. Research and analyse only.
 // ═══════════════════════════════════════════════════════════════════════════
 ['LEGISLATIVE RESEARCH', [

  ['Planning Legislative Research',
   'TEACH: How to plan a legislative research strategy before beginning any research. A research plan must identify: (1) which existing Acts cover the subject area; (2) the constitutional provisions that apply; (3) the Supreme Court and High Court decisions that constrain or guide the drafting; (4) Law Commission and Parliamentary Committee reports on the subject; (5) comparable foreign legislation. Teach the sequence: existing law first, constitutional framework second, judicial decisions third, expert reports fourth, comparative models last. NOT: Do not begin drafting or planning the Act structure. KNOWS: Students have completed Module 2 problem analysis. EXERCISE: Students must produce a one-page research plan for their project Act identifying every category of source they will research and why each is necessary.'],

  ['Research Existing Laws',
   'TEACH: How to locate and analyse Central Acts that already govern the subject matter of the proposed legislation. Teach: how to find Acts on India Code and the Parliament website, how to read a scope clause, how to identify what existing law covers and what it leaves unaddressed. Students must identify gaps that their Act must fill and provisions it must supersede. NOT: Do not plan the new Act structure. Do not draft any provision. KNOWS: Students have a research plan (Lesson 1). EXERCISE: Students must produce a two-paragraph analysis: (1) what existing law currently covers; (2) the gap that their Act must address.'],

  ['Research Constitutional Provisions',
   'TEACH: How to identify and analyse the constitutional articles, fundamental rights, directive principles, and Schedule VII entries that directly govern the subject matter of the proposed Act. Teach how to read constitutional provisions systematically. NOT: Do not re-explain constitutional competence from Module 2 — build on it. KNOWS: Students have researched existing Acts (Lesson 2). EXERCISE: Students must list every constitutional provision their Act must comply with and identify one Directive Principle it gives effect to.'],

  ['Research Supreme Court Judgments',
   'TEACH: How to locate Supreme Court judgments relevant to proposed legislation using SCC Online, Indian Kanoon, and the Supreme Court website. Teach: how to identify ratio decidendi versus obiter dicta, how to extract the binding legal principle, and how a Parliamentary Counsel uses judgments to anticipate constitutional challenges. NOT: Do not draft provisions. KNOWS: Students have researched constitutional provisions (Lesson 3). EXERCISE: Students must identify one binding Supreme Court principle relevant to their Act and explain how their Act must give effect to that principle.'],

  ['Research High Court Judgments',
   'TEACH: How to locate and use High Court decisions that have identified gaps in existing legislation, interpreted relevant provisions, or declared existing laws unconstitutional. Teach how High Court decisions differ from Supreme Court decisions in precedential weight. Teach why drafters read judgments — to anticipate how courts will interpret their draft. NOT: Do not draft provisions. KNOWS: Students know how to research Supreme Court judgments (Lesson 4). EXERCISE: Students must identify one High Court judgment relevant to their Act and extract the single drafting lesson it provides.'],

  ['Research Law Commission Reports',
   'TEACH: How to locate Law Commission of India reports relevant to the subject area. Teach how these reports are structured: the mischief identified, existing law analysis, recommendations, and draft Bill. Teach why Parliamentary Counsel read them — they represent decades of expert legislative analysis. NOT: Do not draft provisions. KNOWS: Students know how to research judgments (Lessons 4-5). EXERCISE: Students must identify the mischief identified in a relevant Law Commission Report, its recommended objectives, and one specific drafting recommendation they will adopt.'],

  ['Research Parliamentary Committee Reports',
   'TEACH: How to locate and analyse Standing Committee, Select Committee, and Joint Committee reports on Bills in the subject area. Teach what these committees examine: constitutional validity, drafting quality, stakeholder concerns, and implementation issues. NOT: Do not draft provisions. KNOWS: Students have researched Law Commission Reports (Lesson 6). EXERCISE: Students must extract from a committee report: one objection raised, one proposed amendment, and one drafting improvement they will incorporate.'],

  ['Comparative Foreign Legislation',
   'TEACH: How to identify and analyse legislation from comparable jurisdictions — United Kingdom, Australia, Canada, and South Africa — on the same subject. Teach what to look for: drafting structure, definition techniques, enforcement mechanisms, and rights formulations. Teach what adaptations are necessary for the Indian constitutional context. NOT: Do not adopt foreign legislative text without analysis. KNOWS: Students have completed domestic and judicial research (Lessons 1-7). EXERCISE: Students must identify one foreign legislative provision to adapt, state what adaptation is necessary for the Indian context, and explain why the Indian version must differ.'],

  ['Gap Analysis',
   'TEACH: How to produce a gap analysis — comparing the existing legislative framework against the policy objectives to identify precisely what the new Act must provide that existing law does not. Teach the gap analysis table format: column 1 — policy objective; column 2 — existing law; column 3 — gap; column 4 — what the new Act must provide. NOT: Do not draft the provisions that will fill the gaps. KNOWS: Students have completed all research categories (Lessons 1-8). EXERCISE: Students must produce a complete gap analysis table for their project Act with at least three rows.'],

  ['Preparing a Legislative Research Report',
   'TEACH: How to compile legislative research into a structured report that will guide drafting. The report must contain: (1) the mischief; (2) existing law and its gaps; (3) constitutional framework; (4) comparative models examined; (5) recommended legislative approach. NOT: Do not begin drafting or planning the Act structure. KNOWS: Students have completed all research steps. EXERCISE: Students must produce a one-page legislative research report for their project Act following the exact structure taught.'],

 ]],

 // ═══════════════════════════════════════════════════════════════════════════
 // MODULE 4 — LEGISLATIVE PLANNING
 // PURPOSE: Teach students to design legislation before writing it.
 // NEVER: Write actual legislative provisions. Plan only.
 // ═══════════════════════════════════════════════════════════════════════════
 ['LEGISLATIVE PLANNING', [

  ['Creating the Legislative Blueprint',
   'TEACH: How to prepare a legislative blueprint before drafting begins. The blueprint must specify: the Act\'s name, its constitutional authority, its purpose (one sentence), its major components in order, and the key provisions it will contain. Parliamentary Counsel never begin drafting without it. NOT: Do not draft any actual provision. KNOWS: Students have completed research and produced a legislative research report (Module 3). EXERCISE: Students must produce a complete legislative blueprint for their project Act covering all required elements.'],

  ['Determining the Scope of the Act',
   'TEACH: How to precisely define what the Act will and will not cover. Scope determination requires: (1) identifying the persons, entities, and transactions covered; (2) specifying the geographical extent; (3) identifying explicit exclusions; (4) deciding what will be left to delegated legislation (Rules) and what must be in the Act itself. Teach why over-scoping (covering too much) creates constitutional risk and under-scoping (covering too little) leaves gaps that defeat the Act\'s purpose. NOT: Do not draft the Application or Extent clauses — that is Module 6. Plan only. KNOWS: Students have produced a legislative blueprint (Lesson 1). EXERCISE: Students must produce a scope statement for their project Act identifying inclusions, exclusions, and matters to be handled by Rules.'],

  ['Planning Parts, Chapters and Sections',
   'TEACH: How to decide the Part and Chapter structure of the proposed Act. Standard structure: Part I Preliminary, Part II Substantive Rights and Duties, Part III Institutional Framework, Part IV Procedures, Part V Offences and Penalties, Part VI Miscellaneous. Teach why this structure exists and when to use Parts vs Chapters vs unnumbered sections. NOT: Do not draft the sections. KNOWS: Students have determined scope (Lesson 2). EXERCISE: Students must plan every Part and Chapter for their project Act with a one-line description of each Chapter\'s content.'],

  ['Structuring Legislative Flow',
   'TEACH: How to ensure that a planned Act reads as a logical whole: definitions support operative provisions, rights lead to remedies, offences connect to penalties, rule-making powers support enforcement, saving clauses protect existing arrangements. Students must trace the legislative flow of their proposed Act from the first definition to the last Schedule. NOT: Do not draft any provision. KNOWS: Students have planned Parts, Chapters, and section arrangement (Lesson 3). EXERCISE: Students must trace the legislative flow of their project Act and identify any gap — any provision that cannot be read correctly because a preceding provision is missing from the plan.'],

  ['Identifying Rights and Duties',
   'TEACH: How to identify every right and duty the Act will create before drafting begins. A rights-duties analysis identifies: who has the right, what they are entitled to, who bears the corresponding duty, what that duty requires, and what the consequence of breach is. Teach why every right must have a corresponding duty — a right without a duty-bearer cannot be enforced. NOT: Do not draft the provisions themselves. KNOWS: Students have structured legislative flow (Lesson 4). EXERCISE: Students must produce a rights-duties table for their project Act with five columns: right-holder, the right, duty-bearer, the duty, and the enforcement consequence.'],

  ['Designing Regulatory Authorities',
   'TEACH: How to plan the regulatory authority or authorities the Act will establish before drafting their provisions. Every authority needs: a name, a function (regulatory, adjudicatory, or both), composition and appointment process, independence safeguards, and accountability mechanisms. Teach why planning the authority before drafting prevents structural gaps. NOT: Do not draft the establishment provisions — that is Module 6. KNOWS: Students have identified rights and duties (Lesson 5). EXERCISE: Students must produce a design brief for the primary regulatory authority in their project Act covering all required elements.'],

  ['Planning Enforcement Mechanisms',
   'TEACH: How to plan the enforcement architecture of the Act: inspection powers, investigation powers, search and seizure, show-cause notices, adjudication, orders, penalties, appeals, and prosecution. Teach why enforcement must be planned as a complete sequence — a gap in the sequence (e.g., no procedure for the show-cause notice) makes the penalty unenforceable. NOT: Do not draft enforcement provisions — that is Module 6. KNOWS: Students have designed regulatory authorities (Lesson 6). EXERCISE: Students must map the complete enforcement sequence for their project Act from detection of non-compliance to the final penalty order.'],

  ['Planning Rule Making Powers',
   'TEACH: How to plan what will be left to delegated legislation (Rules, Regulations, and Orders made under the Act) and what must appear in the Act itself. Legislative matters that must be in the Act: rights, duties, criminal offences, penalties, and the structure of regulatory authorities. Matters suitable for Rules: procedural details, technical specifications, forms, fees, and timelines that may change over time. Teach why Parliament insists on the Parliamentary laying requirement for Rules. NOT: Do not draft rule-making provisions — that is Module 6. KNOWS: Students have planned enforcement mechanisms (Lesson 7). EXERCISE: Students must produce a rule-making schedule for their project Act listing what will be in the Act and what will be left to Rules, with a justification for each allocation.'],

 ]],

 // ═══════════════════════════════════════════════════════════════════════════
 // MODULE 5 — LEGISLATIVE DRAFTING LANGUAGE
 // PURPOSE: Master the specific language devices used in Indian legislation.
 // NEVER: Teach multiple devices in one lesson. Never draft complete sections.
 // ═══════════════════════════════════════════════════════════════════════════
 ['LEGISLATIVE DRAFTING LANGUAGE', [

  ['Principles of Legislative Drafting',
   'TEACH: The five core principles that govern every word in Indian legislation: (1) Precision — use the exact word that carries the intended legal effect, never a near-synonym; (2) Clarity — one sentence, one legal idea; (3) Completeness — state the actor, the effect, and the scope; (4) Consistency — the same term must carry the same meaning throughout; (5) Accessibility — a legally trained reader must understand the provision without external aid. These principles govern every language decision in this module. NOT: Do not teach any specific language device — those are individual lessons. KNOWS: Students have completed the planning module. EXERCISE: Given five draft clauses (one violating each principle), students must identify which principle is violated and state the specific correction.'],

  ['Plain Legislative Language',
   'TEACH: How to write legislative provisions in plain, direct language without unnecessary complexity. Replace archaic formulations: "notwithstanding" → "despite", "aforesaid" → "mentioned above" or a specific reference, "hereinafter" → delete and reference the defined term directly, "thereto" → delete. Plain language does not sacrifice legal precision — it eliminates unnecessary obscurity. NOT: Do not teach specific language devices. KNOWS: Students understand the five drafting principles (Lesson 1). EXERCISE: Students must rewrite a supplied overcomplicated draft clause in plain legislative language without losing any legal content.'],

  ['Mandatory vs Directory Provisions',
   'TEACH: The distinction between mandatory and directory provisions. A mandatory provision must be strictly complied with — non-compliance has a legal consequence (invalidity, liability, or penalty). A directory provision is guidance — non-compliance does not invalidate the act done. Teach how courts determine whether a provision is mandatory or directory: (1) if the Act prescribes a consequence for non-compliance, it is mandatory; (2) if no consequence is stated, the court examines the legislative intent. Teach how drafters signal mandatory intent by using "shall" and directory intent by using "may". NOT: Do not conflate this with the "shall vs may" lesson — this lesson teaches the legal concept; the next teaches the language. KNOWS: Students know plain language (Lesson 2). EXERCISE: Given four supplied provisions, students must classify each as mandatory or directory and explain the drafting signal that led to that classification.'],

  ['Using Shall, May and Must',
   'TEACH: The precise legal distinction between "shall" (mandatory obligation or mandatory conferral — no discretion), "may" (discretionary power — the authority has a choice), "shall not" (absolute prohibition), and "must" (used in some modern Acts as equivalent to "shall"). Teach that the choice is a policy decision, not grammatical preference. Show examples from the RTI Act (Section 3: "shall have the right"), the Indian Contract Act (essential elements), and an administrative provision using "may". NOT: Do not re-teach mandatory vs directory — apply the distinction to modal verb choice. KNOWS: Students understand mandatory vs directory (Lesson 3). EXERCISE: Students must draft one mandatory and one discretionary provision for their project Act, explain why each modal verb was chosen, and identify the legal consequence if the wrong verb were used.'],

  ['Drafting Definitions',
   'TEACH: The four techniques for drafting definition clauses: (1) exhaustive definition ("means" — restricts to what is stated, nothing else qualifies); (2) inclusive definition ("means and includes" — extends the ordinary meaning); (3) extended definition ("includes" — expands without restricting the ordinary meaning); (4) deeming definition ("shall be deemed to be" — creates a legal fiction). Teach when each technique is correct. Show real examples from the RTI Act Section 2(f) (inclusive) and the Indian Contract Act (exhaustive elements). NOT: Do not teach interpretation clauses — that is the next lesson. KNOWS: Students understand shall vs may (Lesson 4). EXERCISE: Students must draft three definitions for their project Act — one exhaustive, one inclusive, and one deeming — and explain why each technique was chosen.'],

  ['Interpretation Clauses',
   'TEACH: How to draft interpretation clauses that establish rules of construction for the whole Act: singular includes plural, masculine includes feminine and neuter, "person" includes individuals, bodies corporate, and associations, references to other Acts mean those Acts as amended from time to time, and how the General Clauses Act 1897 fills gaps. Distinguish a definition (defines a term) from an interpretation clause (establishes how all terms are read). NOT: Do not re-teach definitions. KNOWS: Students know how to draft definitions (Lesson 5). EXERCISE: Students must draft a complete interpretation clause for their project Act covering gender neutrality, singular/plural, "person", and references to other Acts.'],

  ['Provisos',
   'TEACH: What a proviso is and how to draft it correctly. A proviso creates a specific exception or qualification to the main provision immediately preceding it and must begin "Provided that". Rules: (1) a proviso qualifies only the immediately preceding sentence — it cannot introduce new substantive rights; (2) it must not expand the main provision; (3) multiple provisos are permissible but each must qualify the main provision, not the previous proviso. NOT: Do not teach exceptions or explanations — separate lessons. KNOWS: Students know interpretation clauses (Lesson 6). EXERCISE: Students must identify what is wrong with three supplied provisos — one that expands scope, one that introduces new subject matter, one that qualifies the wrong provision — and draft corrected versions.'],

  ['Explanations',
   'TEACH: What an Explanation is and how to use it. An Explanation clarifies the scope of a provision without creating a new right or duty — it removes doubt about application to a specific situation. An Explanation is not a definition and not an exception. Show examples from the Bharatiya Nyaya Sanhita where Explanations clarify what conduct is included in an offence. NOT: Do not re-teach provisos or exceptions. KNOWS: Students know provisos (Lesson 7). EXERCISE: Students must identify whether three supplied clauses are correctly drafted as Explanations (not definitions or provisos) and draft one Explanation for a provision in their project Act.'],

  ['Illustrations',
   'TEACH: What a legislative Illustration is and how to use it. An Illustration demonstrates how a provision applies to a specific factual situation and forms part of the Act — it is binding as to how the provision applies to the illustrated facts. Rules: an Illustration must not limit the general scope of the provision; it must demonstrate application to a concrete and realistic situation. Show examples from the Indian Contract Act 1872. NOT: Do not re-teach Explanations. KNOWS: Students know Explanations (Lesson 8). EXERCISE: Students must draft one Illustration for a provision in their project Act that demonstrates a concrete application without limiting the provision\'s general scope.'],

  ['Exceptions',
   'TEACH: How to draft exception clauses that exclude a category of persons, things, or situations from the scope of a provision. Rules: (1) the exception must be precisely scoped — it must identify exactly what is excluded; (2) the exception must not be so wide that it swallows the main provision; (3) the exception must be placed immediately after the provision it qualifies. NOT: Do not re-teach provisos or Explanations. KNOWS: Students know Illustrations (Lesson 9). EXERCISE: Students must draft one exception clause for their project Act, identifying precisely what is excluded and why.'],

  ['Non Obstante Clauses',
   'TEACH: What a non obstante clause ("Notwithstanding anything contained in...") does — it overrides other provisions and must identify exactly what it overrides. Rules: (1) it must specifically identify the provision or Act it overrides; (2) use only when a specific conflict must be resolved, not as a blanket override; (3) the scope of the override must not exceed what is necessary. Show a real example (e.g., Section 22 of the RTI Act). NOT: Do not re-teach saving clauses — next lesson. KNOWS: Students know all prior language devices in this module. EXERCISE: Students must draft one non obstante clause for their project Act, identify the specific provision overridden, and explain why the override is necessary and proportionate.'],

  ['Saving Clauses',
   'TEACH: What a saving clause does — it preserves existing rights, liabilities, and proceedings when a new Act replaces or amends existing law. A saving clause prevents the new Act from destroying rights that accrued under the old law. Teach what must always be saved: pending proceedings, existing appointments, past transactions, and accrued rights. NOT: Do not re-teach non obstante clauses. KNOWS: Students have now learned all 12 language devices in this module. EXERCISE: Students must identify what must be saved in their project Act and draft a saving clause that protects all pending proceedings, existing rights, and past transactions.'],

 ]],

 // ═══════════════════════════════════════════════════════════════════════════
 // MODULE 6 — DRAFTING EVERY PART OF A BARE ACT
 // PURPOSE: Teach how to draft each specific component of a Bare Act.
 // NEVER: Combine multiple components in one lesson. Never review drafts here.
 // ═══════════════════════════════════════════════════════════════════════════
 ['DRAFTING EVERY PART OF A BARE ACT', [

  ['Preamble',
   'TEACH: How to draft the Preamble of a Bare Act. The Preamble begins "Whereas it is expedient to..." and states the legislative purpose and policy. Teach: (1) what it must contain — the mischief, the objective, and the approach; (2) how courts use it to resolve ambiguity in operative provisions; (3) the correct form. The Preamble does not confer rights or impose duties. NOT: Do not draft any other component. KNOWS: Students have mastered all language devices in Module 5. EXERCISE: Students must draft a complete Preamble for their project Act in correct form, stating the mischief and legislative objective.'],

  ['Statement of Objects and Reasons',
   'TEACH: How to draft the Statement of Objects and Reasons (SOR) — the explanatory note that accompanies a Bill when introduced in Parliament. The SOR explains: (1) why the legislation is needed; (2) the existing law and its inadequacy; (3) the objects the Bill seeks to achieve; (4) the reasons for the specific approach taken. Teach how the SOR differs from the Preamble: the SOR is not part of the Act and cannot be used to override clear statutory text, but courts use it to understand legislative intent when provisions are ambiguous. NOT: Do not draft the Preamble again. KNOWS: Students have drafted the Preamble (Lesson 1). EXERCISE: Students must draft a complete Statement of Objects and Reasons for their project Act covering all four required elements.'],

  ['Short Title',
   'TEACH: How to draft the Short Title clause: "This Act may be called the [Name] Act, [Year]." Rules: (1) the title must be descriptive and specific; (2) it must not be identical to an existing Act; (3) "may be called" is the correct form; (4) the year refers to the year of enactment. NOT: Do not draft Extent or Commencement — those are separate lessons. KNOWS: Students have drafted the SOR (Lesson 2). EXERCISE: Students must draft the Short Title for their project Act and explain why the chosen name accurately describes its subject matter without conflicting with an existing Act title.'],

  ['Extent',
   'TEACH: How to draft the Extent clause specifying territorial application: "It extends to the whole of India" or a specific territory. Teach: (1) why extent must be stated explicitly; (2) how it connects to Schedule VII competence; (3) how to draft an extent clause that extends to specific States. NOT: Do not draft Commencement — next lesson. KNOWS: Students have drafted the Short Title (Lesson 3). EXERCISE: Students must draft the Extent clause for their project Act and explain whether their constitutional authority supports the territorial scope chosen.'],

  ['Commencement',
   'TEACH: How to draft the Commencement clause: (1) "on the date of its publication in the Official Gazette" — immediate; (2) on a specific fixed date; (3) "on such date as the Central Government may, by notification in the Official Gazette, appoint" — notified commencement. Teach when each is appropriate and what happens if the notification is never issued. NOT: Do not draft Application — next lesson. KNOWS: Students have drafted Preamble, SOR, Short Title, and Extent. EXERCISE: Students must draft the Commencement clause for their project Act and explain why they chose that mechanism over the alternatives.'],

  ['Application',
   'TEACH: How to draft the Application clause specifying who and what the Act applies to and explicit exclusions. Rules: (1) identify persons, entities, activities, or transactions covered; (2) exclusions must be express — not implied; (3) the application clause governs the entire Act. NOT: Do not draft Definitions — next lesson. KNOWS: Students have drafted the preliminary clauses. EXERCISE: Students must draft a complete Application clause for their project Act identifying inclusions, exclusions, and the justification for each exclusion.'],

  ['Definitions',
   'TEACH: How to draft the complete Definitions section. The standard opening: "In this Act, unless the context otherwise requires—". Apply definition techniques from Module 5 (exhaustive, inclusive, extended, deeming) to the project Act. Rules: (1) define only legally loaded or repeatedly used terms; (2) arrange alphabetically; (3) every defined term must appear in the operative provisions. NOT: Do not re-explain techniques — apply them. KNOWS: Students have drafted preliminary provisions and know all definition techniques. EXERCISE: Students must draft the complete Definitions section for their project Act — a minimum of five definitions using at least three different techniques.'],

  ['Rights',
   'TEACH: How to draft rights provisions — provisions that confer legal entitlements. A rights provision must state: (1) the rights-holder; (2) the right itself; (3) any conditions or limitations; (4) the corresponding duty-bearer. Use RTI Act Section 3 as the model: "Subject to the provisions of this Act, all citizens shall have the right to information." NOT: Do not draft duty provisions — next lesson. KNOWS: Students have drafted all preliminary provisions including Definitions. EXERCISE: Students must draft at least two rights provisions for their project Act.'],

  ['Duties',
   'TEACH: How to draft duty provisions — provisions that impose legal obligations. A duty provision must state: (1) the duty-bearer; (2) the specific obligation; (3) the timeline; (4) the consequence of non-compliance (connecting to the offences module). Use "shall" throughout. NOT: Do not draft authorities or powers. KNOWS: Students have drafted rights provisions (Lesson 8). EXERCISE: Students must draft at least two duty provisions for their project Act using "shall", naming the duty-bearer precisely, and stating a specific compliance timeline.'],

  ['Authorities',
   'TEACH: How to draft provisions establishing statutory authorities. Every statutory authority needs: (1) the body\'s name; (2) its constitution and composition; (3) the appointment process; (4) qualifications of members; (5) term of office; (6) removal procedure; (7) quorum requirements. Teach why each element is required — an authority without a specified removal procedure can be dismantled arbitrarily. NOT: Do not draft powers provisions — next lesson. KNOWS: Students have drafted rights and duties. EXERCISE: Students must draft the establishment provision for the primary authority in their project Act covering all required elements.'],

  ['Powers',
   'TEACH: How to draft powers provisions — provisions that confer discretionary or regulatory powers. Powers provisions use "may". A powers provision must specify: (1) which authority holds the power; (2) what the power permits; (3) any conditions, limitations, or procedural requirements. Distinguish powers (what the authority may do) from duties (what it must do). NOT: Do not draft procedural provisions — next lesson. KNOWS: Students have drafted authorities (Lesson 10). EXERCISE: Students must draft at least two powers provisions for the authority in their project Act.'],

  ['Procedures',
   'TEACH: How to draft procedural provisions: the complete sequence for one administrative action — application (form, content, who files, where), notice (who issues, to whom, timeline), hearing (opportunity to be heard), order (form, reasons, communication). Teach that procedural provisions must provide natural justice: notice and opportunity to be heard. NOT: Do not draft appeals — next lesson. KNOWS: Students have drafted authorities and powers. EXERCISE: Students must draft a complete procedure for one administrative action under their project Act.'],

  ['Appeals',
   'TEACH: How to draft appeal provisions. A complete appeal provision must specify: (1) the appellate authority; (2) who may appeal; (3) grounds for appeal; (4) time limit for filing; (5) procedure on appeal; (6) powers of the appellate authority (confirm, vary, set aside, or remand); (7) whether the order appealed is stayed pending appeal. NOT: Do not draft offences or penalties. KNOWS: Students have drafted procedures (Lesson 12). EXERCISE: Students must draft a complete appeal provision for their project Act covering all required elements.'],

  ['Offences',
   'TEACH: How to draft offence provisions — provisions that define prohibited conduct. An offence provision must: (1) describe the prohibited act or omission precisely; (2) identify who commits the offence; (3) state whether the offence is cognisable or non-cognisable, bailable or non-bailable; (4) not combine the penalty in the offence provision itself. NOT: Do not draft penalties — next lesson. KNOWS: Students have drafted all prior provisions. EXERCISE: Students must draft at least two offence provisions for their project Act.'],

  ['Penalties',
   'TEACH: How to draft penalty provisions that connect each offence to a specific punishment. Teach: (1) penalties must be proportionate; (2) fines must be expressed as maximum amounts; (3) imprisonment must state the maximum term; (4) enhanced penalties for repeat offences; (5) the penalty schedule format for multiple offences. NOT: Do not draft new offences. KNOWS: Students have drafted offence provisions (Lesson 14). EXERCISE: Students must draft a penalty table connecting each offence to a specific, proportionate penalty.'],

  ['Rule Making Powers',
   'TEACH: How to draft rule-making provisions. A complete rule-making provision must specify: (1) who has the power; (2) the subjects on which rules may be made — this list cannot be open-ended; (3) the Parliamentary laying requirement; (4) that rules must be consistent with the Act. NOT: Do not draft repeal provisions — next lesson. KNOWS: Students have drafted offences and penalties. EXERCISE: Students must draft a complete rule-making provision for their project Act listing specific subjects and including the Parliamentary laying clause.'],

  ['Repeal and Saving Clauses',
   'TEACH: How to draft repeal provisions and saving clauses together. A repeal provision must: (1) identify the Acts or specific provisions being repealed by their exact name and year; (2) be followed immediately by a saving clause. The saving clause must preserve: all acts done under the repealed law, pending proceedings, existing appointments, accrued rights, and issued notifications. NOT: Do not re-teach saving clauses from Module 5 — apply the technique to actual repeal. KNOWS: Students know saving clauses from Module 5. EXERCISE: Students must draft the repeal and saving provision for their project Act.'],

  ['Schedules and Forms',
   'TEACH: How to draft Schedules and Forms. Rules for Schedules: (1) every Schedule must be referred to in the body by section number; (2) the Schedule heading must exactly match the reference; (3) Schedules may be amended by notification if the rule-making provision permits. Rules for Forms: (1) each Form must specify its title and number, who completes it, the information required, and the authority to which it is submitted. NOT: Do not re-draft miscellaneous provisions — separate content. KNOWS: Students have drafted all main Act provisions. EXERCISE: Students must draft one Schedule and one Form for their project Act, ensuring each is correctly cross-referenced in the body.'],

 ]],

 // ═══════════════════════════════════════════════════════════════════════════
 // MODULE 7 — LEGISLATIVE REVIEW
 // PURPOSE: Review legislation like Legislative Counsel.
 // NEVER: Draft new provisions as the primary content. Only review.
 // ═══════════════════════════════════════════════════════════════════════════
 ['LEGISLATIVE REVIEW', [

  ['Consistency Review',
   'TEACH: How to conduct a consistency review. Check: (1) every defined term appears in the Definitions section; (2) every defined term is actually used in operative provisions; (3) no provision contradicts another; (4) the same modal verb is used consistently for the same type of obligation; (5) the same term is used for the same concept throughout. NOT: Do not draft new provisions as the primary lesson content. KNOWS: Students have drafted a complete Act in Module 6. EXERCISE: Students must apply all five consistency tests to a supplied draft Act and identify every consistency error.'],

  ['Constitutional Review',
   'TEACH: How to conduct a constitutional review. Check: (1) every provision complies with fundamental rights under Part III; (2) the enacting legislature has Schedule VII competence; (3) no provision is void under Article 13; (4) penalty provisions comply with Article 20; (5) any classification of persons has intelligible differentia and rational nexus to the objective. NOT: Do not re-explain constitutional law. Apply it. KNOWS: Students understand constitutional competence from Module 2. EXERCISE: Students must conduct a constitutional review of their draft Act and identify any constitutionally vulnerable provision.'],

  ['Cross Reference Review',
   'TEACH: How to review for cross-reference accuracy. Check: (1) every cross-referenced section exists and the number is correct; (2) no provision references a deleted or renumbered section; (3) references to other Acts include the year; (4) section numbering is sequential with no gaps or duplicates; (5) Schedule entry references are accurate. NOT: Do not draft new provisions. KNOWS: Students have conducted consistency and constitutional reviews. EXERCISE: Students must check all cross-references in their draft Act and produce a cross-reference error report.'],

  ['Ambiguity Review',
   'TEACH: How to identify and correct ambiguous provisions. Sources of ambiguity: (1) vague operative words without defined standards ("adequate", "reasonable", "appropriate"); (2) undefined terms in operative provisions; (3) provisions with more than one plausible interpretation; (4) provisos that conflict with the main provision; (5) duties without specified timelines. For each ambiguity, state the two interpretations possible and propose the redraft. NOT: Do not draft completely new provisions. KNOWS: Students have conducted consistency and constitutional reviews. EXERCISE: Students must apply all five ambiguity tests to their draft Act and produce an ambiguity report with corrections.'],

  ['Plain Language Review',
   'TEACH: How to review a draft Act for plain language compliance. Apply these tests: (1) no archaic legalese (notwithstanding, aforesaid, hereinafter, thereto); (2) no double negatives; (3) no passive voice where the actor must be identified for enforcement; (4) no sentence longer than three lines without a semi-colon structure; (5) no term used in two different senses. NOT: Do not re-teach plain language — apply it. KNOWS: Students know plain language from Module 5. EXERCISE: Students must apply all five language tests to their draft Act and correct every language error found.'],

  ['Drafting Error Review',
   'TEACH: How to identify and correct technical drafting errors: (1) a proviso that expands rather than restricts the main provision; (2) a definition that contradicts an operative provision; (3) "may" where "shall" was required by policy; (4) an offence provision that combines the act and the penalty in the same sentence; (5) a saving clause that fails to preserve pending proceedings. For each error type, show an example and the correction. NOT: Do not repeat ambiguity or plain language review — focus on technical drafting errors. KNOWS: Students have conducted all prior reviews. EXERCISE: Given a draft Act containing five deliberate technical drafting errors, students must identify and correct each one.'],

  ['Formatting and Structure Review',
   'TEACH: How to review a draft Act for correct formatting: (1) section numbers — bold, flush left; (2) sub-section numbers in parentheses — (1), (2), (3); (3) clause letters in parentheses — (a), (b), (c); (4) "Provided that" in italics followed by a colon; (5) "Explanation" and "Illustration" as labels; (6) Schedule headings match their body references; (7) Form numbers are sequential. NOT: Do not draft new provisions. KNOWS: Students have completed all substantive reviews. EXERCISE: Students must reformat a supplied incorrectly formatted draft extract to meet all formatting requirements.'],

  ['Final Legislative Review Checklist',
   'TEACH: How to conduct a comprehensive final review of a complete draft Act — combining all seven review types from this module: consistency, constitutional, cross-reference, ambiguity, plain language, drafting errors, and formatting. Teach the professional review checklist format used by legislative offices: each provision reviewed against all criteria, errors logged with section number, error type, and proposed correction. NOT: Do not draft new material. KNOWS: Students have conducted every type of individual review. EXERCISE: Students must produce a one-page professional self-assessment of their complete draft Act: three strongest provisions, three weakest provisions, and the corrections required for each weakness.'],

 ]],

 // ═══════════════════════════════════════════════════════════════════════════
 // MODULE 8 — PRACTICAL DRAFTING EXERCISES
 // PURPOSE: Students practice drafting after every concept. Minimal theory.
 // NEVER: Re-teach theory already covered in Modules 1-7.
 // ═══════════════════════════════════════════════════════════════════════════
 ['PRACTICAL DRAFTING EXERCISES', [

  ['Draft a Preamble',
   'TEACH: Assign the task directly. Students independently draft a Preamble for a supplied legislative scenario without guidance — applying all prior knowledge. The Preamble must: state the mischief, state the legislative objective, use correct form ("Whereas it is expedient to..."), and be proportionate in length. NOT: Do not re-teach Preamble drafting from Module 6. KNOWS: Students have completed Modules 1-7. EXERCISE: Students must draft a complete Preamble for a supplied scenario and submit it for AI review.'],

  ['Draft Definitions',
   'TEACH: Assign the task. Students independently draft a Definitions section for a supplied scenario: selecting every term requiring definition, applying the correct technique (exhaustive, inclusive, deeming), and verifying that every defined term appears in the supplied operative provisions. NOT: Do not re-teach definition techniques. KNOWS: Students have mastered definition drafting from Modules 5 and 6. EXERCISE: Students must draft and submit the Definitions section for the supplied scenario for AI review.'],

  ['Draft Rights and Duties',
   'TEACH: Assign the task. Students independently draft a paired rights and duties provision for a supplied scenario: identifying the rights-holder, the right, the duty-bearer, and the corresponding duty with a specific timeline. NOT: Do not re-teach rights or duties drafting. KNOWS: Students have drafted rights and duties in Module 6. EXERCISE: Students must draft and submit one rights provision and one corresponding duty provision for AI review.'],

  ['Draft Powers of an Authority',
   'TEACH: Assign the task. Students independently draft the powers provisions for a regulatory authority described in a supplied scenario: identifying discretionary powers (using "may"), mandatory functions (using "shall"), and the conditions or limitations on each power. NOT: Do not re-teach powers drafting. KNOWS: Students have drafted authority and powers provisions in Module 6. EXERCISE: Students must draft and submit at least three powers provisions for the described authority for AI review.'],

  ['Draft an Offence Provision',
   'TEACH: Assign the task. Students independently draft an offence provision for a supplied scenario: describing the prohibited conduct precisely, identifying the offender, specifying whether the offence is cognisable or non-cognisable, and keeping the penalty in a separate provision. NOT: Do not re-teach offence drafting. KNOWS: Students have drafted offences in Module 6. EXERCISE: Students must draft and submit one complete offence provision for AI review.'],

  ['Draft a Penalty Clause',
   'TEACH: Assign the task. Students independently draft a penalty clause for the offence drafted in the previous lesson: expressing the fine as a maximum amount, stating the imprisonment term, providing for enhanced penalties for repeat offences, and ensuring proportionality. NOT: Do not re-teach penalty drafting. KNOWS: Students have drafted the corresponding offence (previous lesson). EXERCISE: Students must draft and submit the penalty clause that connects to their offence provision for AI review.'],

  ['Draft an Appeal Provision',
   'TEACH: Assign the task. Students independently draft a complete appeal provision for a supplied regulatory scenario: specifying the appellate authority, who may appeal, the filing timeline, the hearing procedure, the powers of the appellate authority, and the stay of operation pending appeal. NOT: Do not re-teach appeals drafting. KNOWS: Students have drafted appeals in Module 6. EXERCISE: Students must draft and submit a complete appeal provision for AI review.'],

  ['Draft Rule Making Powers',
   'TEACH: Assign the task. Students independently draft a rule-making provision for a supplied scenario: listing specific subjects for which rules may be made, including the Parliamentary laying clause, and ensuring the list is not open-ended. NOT: Do not re-teach rule-making drafting. KNOWS: Students have drafted rule-making provisions in Module 6. EXERCISE: Students must draft and submit a complete rule-making provision for AI review.'],

  ['Draft a Complete Chapter',
   'TEACH: Assign the task. Students independently draft a complete Chapter of legislation for a supplied scenario: selecting and arranging sections correctly, using consistent defined terms, and ensuring each section connects to the next in a logical sequence. NOT: Do not re-teach any theory. KNOWS: Students have drafted all individual provision types in Modules 6 and earlier exercises. EXERCISE: Students must draft and submit a complete Chapter for AI review.'],

  ['Draft a Mini Bare Act',
   'TEACH: Assign the task. Students independently draft a mini Bare Act (8-12 sections) for a supplied compact legislative scenario: Preamble, Short Title, Extent, Commencement, Definitions, at least one right, at least one duty, one offence, one penalty, and a rule-making provision. NOT: Do not re-teach any component. KNOWS: Students have individually drafted every provision type and a complete Chapter. EXERCISE: Students must draft and submit the complete mini Bare Act for AI review.'],

 ]],

 // ═══════════════════════════════════════════════════════════════════════════
 // MODULE 9 — ADVANCED LEGISLATIVE DRAFTING
 // PURPOSE: Teach advanced drafting techniques not covered in the core modules.
 // NEVER: Repeat theory from Modules 1-8. Advanced content only.
 // ═══════════════════════════════════════════════════════════════════════════
 ['ADVANCED LEGISLATIVE DRAFTING', [

  ['Drafting Amendment Acts',
   'TEACH: How to draft an Act that amends an existing Act. Amendment drafting uses specific formulas: "In section X of the [Principal Act], for [existing text], substitute [new text]." Rules: (1) identify the Principal Act by exact name and year; (2) use the substitution formula for replacements, insertion formula for additions, and omission formula for deletions; (3) never paraphrase — quote the exact text being amended; (4) ensure the amendment takes effect from a specified date. NOT: Do not teach repeal Acts — next lesson. KNOWS: Students have mastered all core drafting skills in Modules 5-8. EXERCISE: Students must draft an amendment section modifying two provisions of a supplied Act using correct amendment formulas.'],

  ['Drafting Repeal Acts',
   'TEACH: How to draft an Act that repeals one or more existing Acts. Rules: (1) identify the Acts being repealed by exact name and year; (2) immediately follow the repeal with a saving clause preserving pending proceedings, accrued rights, and existing appointments; (3) specify what happens to Rules, Regulations, and Orders made under the repealed Act; (4) specify what happens to pending applications and proceedings. NOT: Do not re-teach saving clauses from Modules 5-6 — apply them. KNOWS: Students know amendment Acts (Lesson 1). EXERCISE: Students must draft a complete Repeal and Saving section for a supplied scenario where two Acts are being replaced by a new Act.'],

  ['Drafting Rules and Regulations',
   'TEACH: How to draft Statutory Rules made under the rule-making powers of an Act. Rules follow the same drafting standards as Acts but: (1) they must stay within the subjects specified in the parent Act\'s rule-making provision; (2) they cannot create criminal offences or penalties not authorised by the parent Act; (3) they must begin with a citation clause naming the parent Act authority; (4) definitions in the Rules must be consistent with the parent Act. NOT: Do not teach Orders or Notifications — separate lessons. KNOWS: Students know how to plan and draft rule-making provisions (Modules 4-6). EXERCISE: Students must draft three rules under a supplied rule-making provision, ensuring each rule stays within the authorised subjects.'],

  ['Drafting Notifications and Orders',
   'TEACH: How to draft executive Notifications and Orders made under the statutory powers conferred by an Act. Notifications: used for commencement, extension of the Act, and appointment of authorities. Orders: used for specific executive decisions under the Act. Teach the standard format: recital of authority, operative direction, and official signature. Teach the ultra vires risk — a notification or order that exceeds the parent Act\'s authorisation is void. NOT: Do not re-teach Rules — prior lesson. KNOWS: Students know how to draft Rules (Lesson 3). EXERCISE: Students must draft one Commencement Notification and one Order under a supplied parent Act provision.'],

  ['Drafting Delegated Legislation',
   'TEACH: The full landscape of delegated legislation — Rules, Regulations, Orders, Notifications, Bye-laws, and Schemes — and how the drafting technique for each differs. Key distinctions: Regulations are typically made by statutory bodies, not governments; Bye-laws are made by local authorities; Schemes are comprehensive administrative frameworks. Teach when each form is appropriate and how each is authorised by the parent Act. NOT: Do not repeat Rules or Orders from prior lessons — focus on Regulations, Bye-laws, and Schemes. KNOWS: Students know Rules and Orders (Lessons 3-4). EXERCISE: Students must identify the correct form of delegated legislation for four supplied scenarios and explain why each form is appropriate.'],

  ['Common Legislative Drafting Mistakes',
   'TEACH: The most common legislative drafting mistakes found in Indian legislation and how to correct them: (1) vague operative words without defined standards; (2) missing definitions for key terms in operative provisions; (3) contradictory provisions; (4) using "may" where "shall" is required; (5) non obstante clauses that override more than intended; (6) provisos that expand rather than restrict the main provision; (7) penalties disproportionate to the offence. For each mistake show a real example, the consequence, and the correction. NOT: Do not draft new Acts. KNOWS: Students have completed the entire programme. EXERCISE: Students must correct a supplied draft Act containing seven deliberate drafting errors — one of each type.'],

  ['Best Drafting Practices',
   'TEACH: The hallmarks of excellent legislative drafting across Indian Acts: (1) precise definitions that prevent litigation rather than create it; (2) mandatory duties with named duty-bearers and timelines; (3) penalty provisions proportionate to offence severity; (4) saving clauses that prevent unintended disruption; (5) Schedules that separate technical detail from policy provisions; (6) plain language that does not sacrifice precision; (7) consistent use of defined terms throughout. For each practice, show a real example from Indian legislation. NOT: Do not repeat review methodology from Module 7. KNOWS: Students have completed the programme. EXERCISE: Students must compile a personal checklist of ten good drafting practices each supported by one real example.'],

  ['AI Assisted Legislative Drafting',
   'TEACH: How to use AI tools productively in legislative drafting without compromising professional responsibility. Teach: (1) AI can draft initial frameworks — the drafter must verify constitutional validity, policy accuracy, and legal precision; (2) AI cannot replace the drafter\'s judgment on policy choices; (3) how to evaluate AI-generated draft provisions against the drafting standards of this course; (4) the professional responsibility principle — the drafter who signs the Bill remains responsible for every word regardless of the drafting tool used. NOT: Do not suggest that AI replaces professional judgment. KNOWS: Students have mastered all drafting skills. EXERCISE: Students must evaluate an AI-generated draft provision against the five drafting principles from Module 5 and produce a corrected version with written justification for every change.'],

 ]],

 // ═══════════════════════════════════════════════════════════════════════════
 // MODULE 10 — BARE ACT ANALYSIS AND CAPSTONE
 // PURPOSE: Learn from real legislation and complete a full drafting project.
 // NEVER: Draft new legislation as the primary lesson content. Analyse only.
 // ═══════════════════════════════════════════════════════════════════════════
 ['BARE ACT ANALYSIS AND CAPSTONE', [

  ['Analyze the Indian Contract Act',
   'TEACH: The drafting techniques used in the Indian Contract Act 1872: (1) the use of Illustrations — the ICA uses more Illustrations than any other Indian Act, demonstrating how abstract contract principles apply to concrete facts; (2) the structure of Exceptions — Sections 23, 27 use "Nothing in this section shall render unlawful..." for precise carve-outs; (3) the definition chain in Section 2 — how "contract" chains through Sections 2(a)-2(h); (4) the consistent use of imperative language before modern draftsmen shifted to "shall". NOT: Do not draft new provisions. KNOWS: Students have completed the full programme. EXERCISE: Students must identify three drafting techniques used by the original ICA drafters, explain why each was chosen, and assess whether each would be used in the same way in a modern Act.'],

  ['Analyze the Bharatiya Nyaya Sanhita',
   'TEACH: The drafting techniques in the Bharatiya Nyaya Sanhita 2023: (1) how offence definitions separate the act, the intent, and the aggravating circumstance with greater precision than the IPC; (2) the penalty gradation — imprisonment and fine combinations, enhanced penalties for repeat offenders; (3) Explanations to exclude specific conduct from an offence; (4) Section 1\'s non obstante clause overriding the IPC. NOT: Do not compare to foreign criminal codes. KNOWS: Students have analysed the ICA (Lesson 1). EXERCISE: Students must identify one BNS provision that is better drafted than its IPC predecessor and explain the specific drafting improvement.'],

  ['Analyze the Right to Information Act',
   'TEACH: The drafting architecture of the RTI Act 2005: (1) Section 3 — how rights are conferred; (2) Section 2(f) definition of "information" — inclusive definition maximising coverage; (3) Section 5 — duty provisions on Public Information Officers; (4) the two-tier appeal mechanism (Sections 18-19); (5) Section 20 — how penalty provisions connect to duties and how the Commission\'s discretion is structured. NOT: Do not draft new provisions. KNOWS: Students have analysed ICA and BNS. EXERCISE: Students must map the RTI Act\'s legislative flow from right (Section 3) to remedy (Section 19) to penalty (Section 20), explaining how each stage connects.'],

  ['Analyze the Companies Act',
   'TEACH: The structural drafting techniques of the Companies Act 2013: (1) how Parts and Chapters organise 470 sections into navigable groups; (2) the layered definition of "company" in Section 2(20); (3) the extensive rule-making delegation in Section 469; (4) the structure of offence provisions using enhanced penalties for second and subsequent offences. NOT: Do not teach company law — only the drafting architecture. KNOWS: Students have analysed three Indian Acts. EXERCISE: Students must identify three structural features of the Companies Act that make it legible despite its scale, and explain how they would apply these features to their own Act if it grew to 50+ sections.'],

  ['Analyze a State Act',
   'TEACH: How to analyse a State Act and compare its drafting quality to a Central Act on a related subject. The analysis must examine: (1) whether the State Act is within State List competence; (2) whether it is repugnant to any Central Act on the Concurrent List; (3) how its definitions compare to the Central Act definitions; (4) whether its enforcement provisions are adequate; (5) any drafting errors not present in the comparable Central Act. NOT: Do not draft new provisions. KNOWS: Students have analysed four major Central Acts. EXERCISE: Students must select a State Act in their project subject area and produce a comparative analysis against a Central Act on the same subject.'],

  ['Improve a Poorly Drafted Provision',
   'TEACH: How to identify and correct poorly drafted legislative provisions in real legislation. The analysis must: (1) identify the specific drafting error (vague language, wrong modal verb, missing definition, structural flaw); (2) explain the legal consequence of the error; (3) draft the corrected version; (4) explain why the correction resolves the identified problem. This lesson uses real provisions from Indian legislation that have been criticised by courts or Law Commission Reports. NOT: Do not draft new legislation. Focus on correction of identified errors. KNOWS: Students have completed all analysis lessons. EXERCISE: Students must correct five supplied real provisions that contain identified drafting errors, explaining each correction.'],

  ['Draft a Complete Bare Act',
   'TEACH: Assign the final drafting task. Students independently draft a complete Bare Act for their course project: Preamble, Statement of Objects and Reasons, Short Title, Extent, Commencement, Application, Definitions, substantive rights and duties provisions, authorities, powers, procedures, appeals, offences, penalties, rule-making powers, repeal and saving clause, and at least one Schedule. NOT: Do not re-teach any component. This is the complete integration exercise. KNOWS: Students have individually drafted every component throughout the course. EXERCISE: Students must draft and submit the complete project Bare Act for AI review.'],

  ['Self Review and Peer Review',
   'TEACH: How to conduct a professional self-review of your own draft Act using the complete review methodology from Module 7, and how to conduct a peer review of another student\'s draft. For self-review: apply the Final Legislative Review Checklist. For peer review: the reviewer must produce a written report identifying the three most significant drafting improvements required and explaining why each matters legally. NOT: Do not re-teach review methodology. Apply it. KNOWS: Students have completed the complete draft Act (Lesson 7) and mastered review methodology (Module 7). EXERCISE: Students must produce a self-review report for their project Act and a peer review report for a supplied draft Act.'],

  ['Graduation Project',
   'TEACH: Assign the final submission. Students present the final professionally revised project Bare Act. The submission must include: (1) the complete Act in correct format; (2) a one-page drafting note explaining three key drafting decisions made during the course and the policy reasoning behind each; (3) a self-certification that all provisions comply with the Constitution and the drafting standards of this academy; (4) a reflection on one provision they would redraft if they could start again, and why. NOT: This is the capstone — no new theory. KNOWS: Students have completed the entire programme and revised their Act based on AI review. EXERCISE: Students submit the final complete Act with the drafting note, self-certification, and reflection.'],

 ]],
];

export const ACADEMY_CURRICULUM: AcademyLesson[] = curriculum
 .flatMap(([module, lessons], moduleIndex) =>
  lessons.map(([title, concept]) => ({ index: 0, number: 0, moduleIndex, module, title, concept }))
 )
 .map((lesson, index) => ({ ...lesson, index, number: index + 1 }));

export const ACADEMY_TOTAL_LESSONS = ACADEMY_CURRICULUM.length;

export function academyLesson(index: number): AcademyLesson {
 const lesson = ACADEMY_CURRICULUM[index];
 if (!lesson) throw new RangeError(`Academy lesson must be between 0 and ${ACADEMY_TOTAL_LESSONS - 1}`);
 return lesson;
}
