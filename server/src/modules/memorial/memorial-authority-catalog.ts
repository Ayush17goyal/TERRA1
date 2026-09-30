import { ResearchAuthority } from './memorial.types';

export type AuthorityCatalogItem = Omit<ResearchAuthority, 'id' | 'issueId' | 'sideUsefulness' | 'relevanceReason'> & {
  catalogId: string;
  keywords: string[];
  defaultSide: ResearchAuthority['sideUsefulness'];
};

export const MEMORIAL_AUTHORITY_CATALOG: AuthorityCatalogItem[] = [
  {
    catalogId: 'CAT_BSA_63', type: 'statute', citation: 'Section 63, Bharatiya Sakshya Adhiniyam, 2023',
    proposition: 'Admissibility and proof of electronic records are governed by the statutory conditions prescribed for electronic evidence.',
    ratioOrRule: 'A party relying on an electronic record must satisfy the statutory authentication requirements applicable to the manner in which the record is produced.',
    defaultSide: 'both', risk: 'Verify the exact sub-section and certificate particulars against the official text of the BSA.', confidence: 92, verified: true, verificationSource: 'curated',
    keywords: ['electronic evidence', 'sakshya', 'certificate', 'authentication', 'forensic'],
  },
  {
    catalogId: 'CAT_ARJUN_PANDITRAO', type: 'case', citation: 'Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal, (2020) 7 SCC 1',
    proposition: 'The Supreme Court clarified the mandatory character and timing of certificate compliance for secondary electronic evidence and overruled the contrary relaxation in Shafhi Mohammad.',
    ratioOrRule: 'Where an electronic record is produced as secondary evidence, statutory certificate compliance is ordinarily mandatory, subject to the qualifications explained by the Court.',
    defaultSide: 'petitioner', risk: 'Apply carefully to the precise mode in which the electronic record is produced.', confidence: 96, verified: true, verificationSource: 'curated', court: 'Supreme Court of India', year: '2020',
    keywords: ['electronic evidence', 'certificate', 'secondary evidence', 'admissibility'],
  },
  {
    catalogId: 'CAT_ANVAR', type: 'case', citation: 'Anvar P.V. v. P.K. Basheer, (2014) 10 SCC 473',
    proposition: 'The Court distinguished primary electronic evidence from computer output tendered as secondary electronic evidence and insisted on statutory compliance for the latter.',
    ratioOrRule: 'Electronic records tendered in the form of computer output must satisfy the statutory conditions governing their admissibility.',
    defaultSide: 'petitioner', risk: 'Read with Arjun Panditrao and the current BSA provision.', confidence: 95, verified: true, verificationSource: 'curated', court: 'Supreme Court of India', year: '2014',
    keywords: ['electronic evidence', 'certificate', 'computer output', 'admissibility'],
  },
  {
    catalogId: 'CAT_SONU_AMAR', type: 'case', citation: 'Sonu @ Amar v. State of Haryana, (2017) 8 SCC 570',
    proposition: 'An objection relating to the mode or method of proof may be waived if not taken at the appropriate stage, depending on the nature of the defect.',
    ratioOrRule: 'The Court distinguishes objections to inherent admissibility from objections to the mode of proof and considers prejudice and timing.',
    defaultSide: 'respondent', risk: 'Do not use to cure a defect that goes to inherent admissibility.', confidence: 90, verified: true, verificationSource: 'curated', court: 'Supreme Court of India', year: '2017',
    keywords: ['mode of proof', 'electronic evidence', 'objection', 'prejudice', 'waiver'],
  },
  {
    catalogId: 'CAT_TOMASO_BRUNO', type: 'case', citation: 'Tomaso Bruno v. State of Uttar Pradesh, (2015) 7 SCC 178',
    proposition: 'Electronic material such as CCTV footage can be important evidence, and withholding the best available evidence may justify an adverse inference in an appropriate case.',
    ratioOrRule: 'Courts should evaluate the availability, preservation, and production of objective electronic evidence when assessing the reliability of the prosecution case.',
    defaultSide: 'both', risk: 'Use for preservation/non-production issues, not as a substitute for certificate analysis.', confidence: 90, verified: true, verificationSource: 'curated', court: 'Supreme Court of India', year: '2015',
    keywords: ['electronic evidence', 'cctv', 'best evidence', 'adverse inference', 'preservation'],
  },
  {
    catalogId: 'CAT_IT_75', type: 'statute', citation: 'Section 75, Information Technology Act, 2000',
    proposition: 'The Information Technology Act has specified extraterritorial application where the statutory computer, computer system, or network nexus is satisfied.',
    ratioOrRule: 'Foreign location alone does not exclude application of the Act; the statutory nexus must be proved on the facts.',
    defaultSide: 'both', risk: 'Verify the exact statutory language and the location/nexus alleged in the proposition.', confidence: 96, verified: true, verificationSource: 'curated',
    keywords: ['section 75', 'jurisdiction', 'foreign server', 'extraterritorial', 'computer system', 'network'],
  },
  {
    catalogId: 'CAT_ART_245', type: 'constitution', citation: 'Article 245, Constitution of India',
    proposition: 'Legislative competence and constitutional treatment of extraterritorial operation inform the validity and reach of legislation.',
    ratioOrRule: 'The territorial connection between India and the subject matter remains relevant when legislation or enforcement has extraterritorial features.',
    defaultSide: 'both', risk: 'Apply with the specific statutory provision rather than as a stand-alone criminal jurisdiction rule.', confidence: 92, verified: true, verificationSource: 'curated',
    keywords: ['extraterritorial', 'territorial nexus', 'jurisdiction', 'article 245'],
  },
  {
    catalogId: 'CAT_GVK', type: 'case', citation: 'G.V.K. Industries Ltd. v. Income Tax Officer, (2011) 4 SCC 36',
    proposition: 'The Constitution Bench examined Parliament’s power in relation to extraterritorial aspects and the need for a real connection with India.',
    ratioOrRule: 'Extraterritorial legislation or operation must bear a constitutionally sufficient connection with India and Indian interests.',
    defaultSide: 'both', risk: 'This is a legislative-competence authority; explain the analogy to cyber jurisdiction rather than overstating it.', confidence: 94, verified: true, verificationSource: 'curated', court: 'Supreme Court of India', year: '2011',
    keywords: ['extraterritorial', 'territorial nexus', 'article 245', 'foreign', 'jurisdiction'],
  },
  {
    catalogId: 'CAT_MLAT', type: 'report', citation: 'Applicable Mutual Legal Assistance Treaty and letters rogatory framework',
    proposition: 'Cross-border evidence may require formal international cooperation depending on the foreign jurisdiction, service provider, and requested process.',
    ratioOrRule: 'The lawful route for obtaining foreign-hosted evidence must be established from the applicable treaty, domestic procedure, and provider response.',
    defaultSide: 'both', risk: 'This is not one universal instrument. Identify the actual treaty or statutory mechanism before final submission.', confidence: 70, verified: false, verificationSource: 'ai_suggestion',
    keywords: ['foreign server', 'foreign evidence', 'mlat', 'letters rogatory', 'cross-border'],
  },
  {
    catalogId: 'CAT_PUTTASWAMY', type: 'case', citation: 'K.S. Puttaswamy (Retd.) v. Union of India, (2017) 10 SCC 1',
    proposition: 'Privacy is a constitutionally protected right grounded in dignity and liberty under Part III.',
    ratioOrRule: 'State action affecting privacy requires a legal basis and must satisfy constitutional justification, including proportionality safeguards developed in later application.',
    defaultSide: 'petitioner', risk: 'State the plurality/bench propositions carefully and connect them to the challenged digital search.', confidence: 97, verified: true, verificationSource: 'curated', court: 'Supreme Court of India', year: '2017',
    keywords: ['privacy', 'article 21', 'digital device', 'data', 'search', 'proportionality'],
  },
  {
    catalogId: 'CAT_PUCL', type: 'case', citation: 'People’s Union for Civil Liberties v. Union of India, (1997) 1 SCC 301',
    proposition: 'Telephone interception invades privacy and must be controlled by law and procedural safeguards against arbitrary exercise.',
    ratioOrRule: 'Intrusive surveillance powers require structured safeguards, recorded reasons, limited duration, and review.',
    defaultSide: 'petitioner', risk: 'Analogise cautiously from interception to device search and forensic examination.', confidence: 94, verified: true, verificationSource: 'curated', court: 'Supreme Court of India', year: '1997',
    keywords: ['privacy', 'surveillance', 'interception', 'procedural safeguards', 'article 21'],
  },
  {
    catalogId: 'CAT_CANARA_BANK', type: 'case', citation: 'District Registrar and Collector v. Canara Bank, (2005) 1 SCC 496',
    proposition: 'The Court considered privacy interests in records and the constitutional limits of broad inspection powers.',
    ratioOrRule: 'Search or inspection powers affecting private records must have a lawful basis and cannot be exercised arbitrarily or without adequate safeguards.',
    defaultSide: 'petitioner', risk: 'Explain the factual and statutory distinction from digital-device examination.', confidence: 91, verified: true, verificationSource: 'curated', court: 'Supreme Court of India', year: '2005',
    keywords: ['privacy', 'search', 'records', 'inspection', 'article 21'],
  },
  {
    catalogId: 'CAT_SELVI', type: 'case', citation: 'Selvi v. State of Karnataka, (2010) 7 SCC 263',
    proposition: 'Involuntary scientific investigative techniques engage personal liberty, privacy, mental autonomy, and fair-trial concerns.',
    ratioOrRule: 'Investigative necessity does not displace constitutional limits on compelled intrusion and due process.',
    defaultSide: 'petitioner', risk: 'Use for constitutional investigative safeguards, not as a direct digital-search precedent.', confidence: 93, verified: true, verificationSource: 'curated', court: 'Supreme Court of India', year: '2010',
    keywords: ['privacy', 'investigation', 'due process', 'article 21', 'forensic'],
  },
  {
    catalogId: 'CAT_BALDEV_SINGH', type: 'case', citation: 'State of Punjab v. Baldev Singh, (1999) 6 SCC 172',
    proposition: 'Mandatory search safeguards may protect fairness and the legitimacy of criminal investigation.',
    ratioOrRule: 'Where a statute prescribes safeguards for an intrusive search, compliance bears directly on the legality and fairness of the resulting evidence.',
    defaultSide: 'petitioner', risk: 'The case concerns a specific statutory search regime; use by analogy only where appropriate.', confidence: 91, verified: true, verificationSource: 'curated', court: 'Supreme Court of India', year: '1999',
    keywords: ['search', 'seizure', 'safeguards', 'criminal investigation', 'due process'],
  },
  {
    catalogId: 'CAT_MODERN_DENTAL', type: 'case', citation: 'Modern Dental College and Research Centre v. State of Madhya Pradesh, (2016) 7 SCC 353',
    proposition: 'The Supreme Court articulated a structured proportionality analysis for restrictions on constitutional rights.',
    ratioOrRule: 'A rights restriction must pursue a proper purpose, bear a rational connection, be necessary, and maintain a proper balance between rights and public purpose.',
    defaultSide: 'both', risk: 'Tailor the proportionality steps to the right and State action actually challenged.', confidence: 95, verified: true, verificationSource: 'curated', court: 'Supreme Court of India', year: '2016',
    keywords: ['proportionality', 'privacy', 'article 19', 'article 21', 'restriction'],
  },
  {
    catalogId: 'CAT_OM_KUMAR', type: 'case', citation: 'Om Kumar v. Union of India, (2001) 2 SCC 386',
    proposition: 'The Court discussed proportionality and the standard of review applicable to administrative action affecting rights.',
    ratioOrRule: 'The intensity of review depends on whether fundamental rights are directly implicated and whether the measure is disproportionate to its objective.',
    defaultSide: 'both', risk: 'Distinguish administrative proportionality from criminal sentencing analysis.', confidence: 93, verified: true, verificationSource: 'curated', court: 'Supreme Court of India', year: '2001',
    keywords: ['proportionality', 'administrative action', 'article 14', 'sentence'],
  },
  {
    catalogId: 'CAT_ART_136', type: 'constitution', citation: 'Article 136, Constitution of India',
    proposition: 'The Supreme Court possesses extraordinary discretionary appellate jurisdiction to prevent substantial injustice.',
    ratioOrRule: 'Article 136 is not an ordinary further appeal; interference is reserved for substantial legal error, perversity, grave injustice, or constitutional infirmity.',
    defaultSide: 'both', risk: 'Apply to the exact procedural posture and relief sought.', confidence: 97, verified: true, verificationSource: 'curated',
    keywords: ['article 136', 'appeal', 'supreme court', 'concurrent findings', 'conviction'],
  },
  {
    catalogId: 'CAT_PRITAM_SINGH', type: 'case', citation: 'Pritam Singh v. State, 1950 SCR 453',
    proposition: 'The Court explained the exceptional and discretionary character of special leave jurisdiction.',
    ratioOrRule: 'Special leave is exercised sparingly where exceptional circumstances or substantial injustice justify intervention.',
    defaultSide: 'respondent', risk: 'Use with current Article 136 jurisprudence and the precise criminal posture.', confidence: 90, verified: true, verificationSource: 'curated', court: 'Supreme Court of India', year: '1950',
    keywords: ['article 136', 'special leave', 'exceptional', 'concurrent findings'],
  },
  {
    catalogId: 'CAT_KUNHAYAMMED', type: 'case', citation: 'Kunhayammed v. State of Kerala, (2000) 6 SCC 359',
    proposition: 'The Court explained the nature of special leave jurisdiction and the legal effect of grant or refusal of leave.',
    ratioOrRule: 'Article 136 has a distinct discretionary stage and does not create an automatic right of appeal.',
    defaultSide: 'both', risk: 'Use for the nature of Article 136, not as a substitute for criminal-evidence standards.', confidence: 93, verified: true, verificationSource: 'curated', court: 'Supreme Court of India', year: '2000',
    keywords: ['article 136', 'special leave', 'appeal', 'supreme court'],
  },
  {
    catalogId: 'CAT_BACHAN_SINGH', type: 'case', citation: 'Bachan Singh v. State of Punjab, (1980) 2 SCC 684',
    proposition: 'Sentencing must be individualized and constitutionally constrained, with attention to aggravating and mitigating circumstances.',
    ratioOrRule: 'Punishment must follow a principled assessment of the offence and the offender rather than an automatic response to the charge.',
    defaultSide: 'petitioner', risk: 'The case is capital-sentencing authority; avoid presenting it as a direct rule for every sentence.', confidence: 86, verified: true, verificationSource: 'curated', court: 'Supreme Court of India', year: '1980',
    keywords: ['sentence', 'punishment', 'proportionality', 'mitigating', 'aggravating'],
  },
  {
    catalogId: 'CAT_SHREYA', type: 'case', citation: 'Shreya Singhal v. Union of India, (2015) 5 SCC 1',
    proposition: 'Vague and overbroad restrictions on online expression may violate Article 19(1)(a), and restrictions must fit the grounds in Article 19(2).',
    ratioOrRule: 'Online speech cannot be criminalized through vague or overbroad standards disconnected from constitutionally permitted restrictions.',
    defaultSide: 'petitioner', risk: 'Use only where the proposition actually raises speech liability or vagueness; it does not excuse impersonation or independently unlawful conduct.', confidence: 96, verified: true, verificationSource: 'curated', court: 'Supreme Court of India', year: '2015',
    keywords: ['article 19', 'online speech', 'vague', 'overbroad', 'internet'],
  },
];
