"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOTAL_DRAFTING_LESSONS = exports.DRAFTING_LESSON_CATALOG = void 0;
exports.getLessonByIndex = getLessonByIndex;
exports.DRAFTING_LESSON_CATALOG = [
    { index: 0, id: 'welcome-goal-setting', title: 'Welcome & Goal Setting', objective: 'Identify what kind of Act the user wants to draft and what problem it solves.' },
    { index: 1, id: 'legislative-problem', title: 'Identifying the Legislative Problem', objective: 'Frame the mischief the Act is meant to remedy.' },
    { index: 2, id: 'object-and-scope', title: 'Object and Scope', objective: 'Define the object and scope of the Act.' },
    { index: 3, id: 'short-title-extent-commencement', title: 'Short Title, Extent & Commencement', objective: 'Draft the opening clause naming, extending, and commencing the Act.' },
    { index: 4, id: 'preamble', title: 'Preamble', objective: 'Draft the Preamble.' },
    { index: 5, id: 'identify-definitions', title: 'Identifying Key Terms', objective: 'Identify terms in the Act that need definitions.' },
    { index: 6, id: 'definitions-clause', title: 'Definitions Clause', objective: 'Draft the Definitions clause.' },
    { index: 7, id: 'structure-planning', title: 'Structuring the Act', objective: 'Plan chapters and sections.' },
    { index: 8, id: 'substantive-chapter-1', title: 'Substantive Provisions — Chapter I', objective: 'Draft core rights/duties provisions.' },
    { index: 9, id: 'substantive-chapter-2', title: 'Substantive Provisions — Chapter II', objective: 'Draft obligations/prohibitions provisions.' },
    { index: 10, id: 'powers-and-functions', title: 'Powers and Functions', objective: 'Draft powers and functions of authorities/officers.' },
    { index: 11, id: 'procedural-provisions', title: 'Procedural Provisions', objective: 'Draft applications, notices, and timelines.' },
    { index: 12, id: 'offences-and-penalties', title: 'Offences and Penalties', objective: 'Draft offences and penalties.' },
    { index: 13, id: 'appeals-and-adjudication', title: 'Appeals and Adjudication', objective: 'Draft appeals and adjudication mechanisms.' },
    { index: 14, id: 'delegated-legislation', title: 'Rule-Making Powers', objective: 'Draft delegated legislation / rule-making powers.' },
    { index: 15, id: 'savings-repeal-transitional', title: 'Savings, Repeal & Transitional Provisions', objective: 'Draft savings, repeal, and transitional clauses.' },
    { index: 16, id: 'schedules-and-forms', title: 'Schedules and Forms', objective: 'Draft schedules and forms, if any.' },
    { index: 17, id: 'cross-reference-pass', title: 'Cross-Reference & Consistency Pass', objective: 'Check internal consistency of cross-references.' },
    { index: 18, id: 'final-review', title: 'Final Review', objective: 'Full-document legislative quality review.' },
    { index: 19, id: 'sign-off-and-export', title: 'Sign-off & Export', objective: 'Final walkthrough and export.' },
];
exports.TOTAL_DRAFTING_LESSONS = exports.DRAFTING_LESSON_CATALOG.length;
function getLessonByIndex(index) {
    const lesson = exports.DRAFTING_LESSON_CATALOG[index];
    if (!lesson) {
        throw new RangeError(`No drafting lesson at index ${index}`);
    }
    return lesson;
}
//# sourceMappingURL=lesson-catalog.js.map