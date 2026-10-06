LEGATRIXON-3 — MEMORIAL FIX PACK
================================
Target baseline: Ayush17goyal/TERRA1 clean-main
Reviewed head: 8af5f9142f97def77d56d58ac5cb7d93d5c0e098

PURPOSE
-------
This pack is a drop-in overlay for the EXISTING LEGATRIXON Memorial / Moot Proposition workflow.
It does NOT replace App.tsx, navigation, sidebar, theme, cards, colors, typography, or the overall UI.

FILES IN THIS PACK
------------------
1) NEW
   src/modules/moot-court/memorialFixes.css

2) REPLACE
   src/modules/moot-court/memorialCommandCenter.ts

3) REPLACE
   src/modules/moot-court/memorialExport.ts

4) REPLACE
   server/src/modules/memorial/issue-engine.service.ts

5) REPLACE
   server/src/modules/memorial/memorial-compiler.service.ts

INSTALL — SIMPLEST METHOD
-------------------------
1. Close the running dev server.
2. Back up your LEGATRIXON-3 folder or commit your current work.
3. Extract this ZIP.
4. Copy the included `src` and `server` folders into the ROOT of LEGATRIXON-3.
5. When Windows asks whether to replace existing files, choose Replace.
6. Start the project again.

NO package.json change is required.
NO new npm dependency is required.
NO database migration is required.
NO App.tsx replacement is required.

WHAT THIS FIXES
---------------
- Right-side Export Options no longer intrudes into the centre research column.
- Long uploaded filenames no longer force the Command Center grid wider.
- Existing export buttons stay inside their container.
- PDF/DOCX continue to be real generated files, using the same structured memorial model.
- DOCX keeps genuine footnotes, TOC field, page borders, A4 layout and dual pagination.
- PDF keeps A4 layout, cover color, borders, dynamic TOC page references and citations.
- Petitioner-side output automatically uses CLAIMANT terminology for investment arbitration.
- Respondent-side arbitration output becomes a COUNTER-MEMORIAL instead of a mechanically renamed petitioner memorial.
- FDI / ICSID propositions use treaty-arbitration issue architecture rather than cyber/constitutional defaults.
- For the supplied FDI 2026 style problem, Stage-I issues are preferred over the later Stage-II expropriation/quantum question when the proposition itself supplies that procedural split.
- Claimant and Respondent positions are independently structured.
- Generic constitutional / boundary / cyber / evidence fallbacks remain available for other moots.

IMPORTANT
---------
The existing clean-main backend already contains:
- asynchronous upload behaviour,
- proposition preservation,
- reference-file SHA-256 caching,
- reusable reference analysis,
- verified-authority filtering,
- PDF/DOCX wiring.

This pack deliberately does not replace those working services just to make a larger patch.

VALIDATION AFTER PASTING
------------------------
From the LEGATRIXON-3 root run:

  npm run typecheck
  npm run test:unit -- --run src/tests/unit/memorialCommandCenter.test.ts src/tests/unit/memorialExport.test.ts
  npm run build

Then test in the UI:
1. Upload a very long filename.
2. Confirm no horizontal deformation or overlapping Export Options.
3. Upload the moot proposition.
4. Generate Petitioner/Claimant memorial.
5. Generate Respondent/Counter-Memorial.
6. Download PDF.
7. Download DOCX.
8. Open both files and check cover, sections, citations, page numbering and content.

ROLLBACK
--------
Restore the four replaced files from your backup and delete:
  src/modules/moot-court/memorialFixes.css

