"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NON_LEGAL_GATE_KEYWORDS = exports.NON_LEGAL_GATE_MIN_DENSITY = exports.TAXONOMY = exports.STORAGE_ROOT_SUBDIR = exports.LARGE_DOCUMENT_BATCH_CHAR_THRESHOLD = exports.MIN_EXTRACTABLE_CHARACTERS = exports.SUPPORTED_EXTENSIONS = exports.MAX_UPLOAD_BYTES = void 0;
exports.MAX_UPLOAD_BYTES = Number(process.env.MAX_DOCUMENT_ENGINE_UPLOAD_BYTES || 25 * 1024 * 1024);
exports.SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'ppt', 'pptx', 'txt', 'md', 'png', 'jpg', 'jpeg', 'tiff'];
exports.MIN_EXTRACTABLE_CHARACTERS = 200;
exports.LARGE_DOCUMENT_BATCH_CHAR_THRESHOLD = 400_000;
exports.STORAGE_ROOT_SUBDIR = ['uploads', 'document-engine'];
exports.TAXONOMY = {
    'Constitutional Law': ['Fundamental Rights', 'Directive Principles', 'Federalism', 'Judicial Review', 'Emergency Provisions', 'Amendment Power'],
    'Contract Law': ['Formation', 'Consideration', 'Free Consent', 'Breach & Remedies', 'Quasi-Contract', 'Discharge'],
    'Tort Law': ['Negligence', 'Defamation', 'Strict Liability', 'Nuisance', 'Vicarious Liability'],
    'Criminal Law': ['General Exceptions', 'Offences Against Body', 'Offences Against Property', 'Criminal Conspiracy', 'Punishments'],
    'Administrative Law': ['Delegated Legislation', 'Natural Justice', 'Judicial Review of Administrative Action', 'Tribunals'],
    'Family Law': ['Marriage', 'Divorce', 'Maintenance', 'Succession', 'Guardianship'],
    'Property Law': ['Transfer of Property', 'Easements', 'Mortgages', 'Lease'],
    'Jurisprudence': ['Schools of Law', 'Sources of Law', 'Rights & Duties', 'Legal Personality'],
    'Company Law': ['Incorporation', 'Directors', 'Shareholders', 'Winding Up'],
    'Evidence Law': ['Relevancy', 'Burden of Proof', 'Witnesses', 'Documentary Evidence'],
};
exports.NON_LEGAL_GATE_MIN_DENSITY = 1.5;
exports.NON_LEGAL_GATE_KEYWORDS = [
    'section', 'act', 'article', 'clause', 'petitioner', 'respondent', 'appellant',
    'held', 'hereby enacted', 'whereas', 'plaintiff', 'defendant', 'judgment', 'court',
    'statute', 'provision', 'shall mean', 'notwithstanding', 'writ', 'jurisdiction',
    'constitution', 'tribunal', 'bench', 'appeal', 'suit', 'contract', 'liability',
];
//# sourceMappingURL=document-engine.constants.js.map