// Env-driven limits and stand-in data, following this codebase's convention of reading
// process.env directly with defaults (no ConfigModule is used anywhere in server/src).

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_DOCUMENT_ENGINE_UPLOAD_BYTES || 25 * 1024 * 1024);

export const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'ppt', 'pptx', 'txt', 'md', 'png', 'jpg', 'jpeg', 'tiff'];

// Stage 3.3 size/degeneracy bounds: documents with less extractable content than this
// (after cleaning) do not proceed past Stage 4 into the expensive parallel branch.
export const MIN_EXTRACTABLE_CHARACTERS = 200;

// Documents whose normalized text exceeds this size are processed in sequential
// page/slide-range batches within the same job (architecture.md §3.3), rather than
// spawning separate jobs — keeps any single stage within a reasonable time budget.
export const LARGE_DOCUMENT_BATCH_CHAR_THRESHOLD = 400_000;

// Storage root for uploaded originals, mirroring the notebook module's local-filesystem
// convention (this repo has no S3 wiring despite aws-sdk being a listed dependency).
export const STORAGE_ROOT_SUBDIR = ['uploads', 'document-engine'];

// Stand-in taxonomy used by the Topic/Subtopic Detection stage (architecture.md §3 Stage 5-6).
// architecture.md's Module 9 (Taxonomy Registry) is a separate, not-yet-built module that is
// meant to own and version this list; Document Engine only *consumes* a taxonomy per the system
// map in architecture.md §2, so this constant is the integration seam to swap for a real
// TaxonomyRegistry lookup once Module 9 exists — it is not a reimplementation of Module 9.
export const TAXONOMY: Record<string, string[]> = {
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

// Minimum density of legal-domain signal words (per 1000 characters) required for a
// document to pass the non-legal-content gate (§3.3).
export const NON_LEGAL_GATE_MIN_DENSITY = 1.5;
export const NON_LEGAL_GATE_KEYWORDS = [
  'section', 'act', 'article', 'clause', 'petitioner', 'respondent', 'appellant',
  'held', 'hereby enacted', 'whereas', 'plaintiff', 'defendant', 'judgment', 'court',
  'statute', 'provision', 'shall mean', 'notwithstanding', 'writ', 'jurisdiction',
  'constitution', 'tribunal', 'bench', 'appeal', 'suit', 'contract', 'liability',
];
