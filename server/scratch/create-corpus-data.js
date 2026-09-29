const fs = require('fs');
const path = require('path');

const baseDir = 'c:/Users/goyal/OneDrive/Desktop/LEGATRIXON-3/server/corpus-data';

const filesToCreate = {
  'constitution/constitution_of_india.txt': `THE CONSTITUTION OF INDIA

Article 14: Equality before law
The State shall not deny to any person equality before the law or the equal protection of the laws within the territory of India. It prohibits discrimination on grounds of religion, race, caste, sex or place of birth.

Article 19: Protection of certain rights regarding freedom of speech, etc.
(1) All citizens shall have the right—
(a) to freedom of speech and expression;
(b) to assemble peaceably and without arms;
(c) to form associations or unions or co-operative societies;
(d) to move freely throughout the territory of India;
(e) to reside and settle in any part of the territory of India; and
(g) to practice any profession, or to carry on any occupation, trade or business.

Article 21: Protection of life and personal liberty
No person shall be deprived of his life or personal liberty except according to procedure established by law. This right has been interpreted to include the right to live with human dignity, right to clean environment, and right to privacy.

Article 32: Remedies for enforcement of rights conferred by this Part
(1) The right to move the Supreme Court by appropriate proceedings for the enforcement of the rights conferred by this Part is guaranteed.
(2) The Supreme Court shall have power to issue directions or orders or writs, including writs in the nature of habeas corpus, mandamus, prohibition, quo warranto and certiorari, whichever may be appropriate.`,

  'bns/bharatiya_nyaya_sanhita.txt': `BHARATIYA NYAYA SANHITA (BNS), 2023

The Bharatiya Nyaya Sanhita (BNS) replaces the Indian Penal Code (IPC), 1860. It streamlines provisions and introduces modern definitions of crimes.

Section 103: Punishment for Murder
(1) Whoever commits murder shall be punished with death or imprisonment for life, and shall also be liable to fine.
(2) When a group of five or more persons acting in concert commits murder on the ground of race, caste or community, sex, place of birth, language, personal belief or any other ground, each member of such group shall be punished with death or with imprisonment for life or imprisonment for a term which shall not be less than seven years, and shall also be liable to fine.

Section 113: Terrorist Act
Whoever commits any act with intent to threaten or likely to threaten the unity, integrity, sovereignty, security or economic security of India, or with intent to strike terror or likely to strike terror in the people or any section of the people in India or in any foreign country commits a terrorist act.

Section 303: Theft
Whoever, intending to take dishonestly any movable property out of the possession of any person without that person's consent, moves that property in order to such taking, is said to commit theft. Punishment includes imprisonment for a term which may extend to three years, or with fine.`,

  'bnss/bharatiya_nagarik_suraksha_sanhita.txt': `BHARATIYA NAGARIK SURAKSHA SANHITA (BNSS), 2023

The Bharatiya Nagarik Suraksha Sanhita (BNSS) replaces the Code of Criminal Procedure (CrPC), 1973. It establishes timelines and digitizes the justice delivery process.

First Information Report (FIR) and Zero FIR:
Any information relating to the commission of a cognizable offence can be registered via electronic communication (e-FIR) or at any police station irrespective of the jurisdiction (Zero FIR).

Forensic Investigation Mandate:
Forensic investigation has been made mandatory for offences punishable with imprisonment of seven years or more. Forensic experts must visit crime scenes to collect evidence, which must be videographed.

Search and Seizure Videography:
The process of search and seizure by police officers must be recorded through audio-video electronic means (e.g. mobile phones or cameras). This ensures transparency and prevents evidence tampering.`,

  'bsa/bharatiya_sakshya_adhiniyam.txt': `BHARATIYA SAKSHYA ADHINIYAM (BSA), 2023

The Bharatiya Sakshya Adhiniyam (BSA) replaces the Indian Evidence Act, 1872. It updates rules of evidence to include digital records.

Electronic and Digital Records Admissibility:
Digital records are given the same legal status as paper documents. This includes emails, server logs, smartphone messages, files stored on cloud databases, and digital signatures.

Secondary Evidence Expansion:
Secondary evidence now includes oral admissions, written admissions, and copies made from original documents using mechanical or digital processes that ensure accuracy.

Admissibility of Confessions:
Confessions made to police officers remain inadmissible. Confessions must be recorded before a Magistrate to be legally binding and accepted in trial proceedings.`,

  'supreme_court/kesavananda_bharati.txt': `Kesavananda Bharati Sripadagalvaru v. State of Kerala (1973) 4 SCC 225

Bench: 13 Judges (Largest constitution bench in history)
Decision Date: 24 April 1973

Summary:
The Supreme Court of India ruled that while the Parliament has wide powers to amend the Constitution under Article 368, it cannot amend or alter the "Basic Structure" of the Constitution. 

Key Principles:
1. Basic Structure Doctrine: Certain features of the Constitution (like democracy, secularism, separation of powers, federalism, judicial review) form the core bedrock and cannot be destroyed by amendments.
2. Supremacy of the Constitution: The Constitution is supreme, and parliamentary sovereignty is limited by constitutional boundaries.
3. Power of Judicial Review: The courts have the power to review constitutional amendments to determine if they violate the basic structure.`,

  'supreme_court/maneka_gandhi.txt': `Maneka Gandhi v. Union of India (1978) 1 SCC 248

Bench: 7 Judges
Decision Date: 25 January 1978

Summary:
The Supreme Court significantly expanded the scope of Article 21 (Right to Life and Personal Liberty) and ruled that any procedure depriving a person of personal liberty must be "just, fair, and reasonable", and not arbitrary or oppressive.

Key Principles:
1. Procedure Established by Law vs. Due Process of Law: The court integrated the American concept of "Due Process of Law" into Article 21, holding that mere statutory procedure is not enough; it must be fair.
2. Freedom of Travel: The right to travel abroad is part of personal liberty under Article 21.
3. Interrelationship of Rights: Fundamental rights form an integrated whole (Golden Triangle: Articles 14, 19, and 21) and must be read together.`,

  'high_court/landmark_hc_cases.txt': `Landmark High Court Precedents in India

1. Allahabad High Court - State of UP v. Raj Narain (1975):
The High Court set aside the election of Prime Minister Indira Gandhi on grounds of electoral malpractices, which eventually led to the imposition of National Emergency in India.

2. Delhi High Court - Naz Foundation v. Govt. of NCT of Delhi (2009):
The High Court held that Section 377 of the IPC, which criminalized consensual homosexual acts, violated Articles 14, 15, and 21 of the Constitution, marking a historic step for LGBTQ+ rights.

3. Bombay High Court - Arjun Panditrao Khotkar v. Kailash Kushanrao Gorantyal (2020):
The High Court clarified certificates required under Section 65B(4) of the Evidence Act for admissibility of electronic evidence in trials.`,

  'research_papers/legal_implications_ai.txt': `Research Paper: Legal Implications and Ethics of Artificial Intelligence in Law

Abstract:
This paper analyzes the integration of AI models, automated document extraction, and vector databases in legal research. It examines legal liability, compliance under data protection laws, and intellectual property.

Key Discussion Points:
1. Algorithmic Bias: Legal AI engines can inherit bias from historical court data, perpetuating historical discrimination in sentencing recommendations.
2. Admissibility of AI Outputs: How courts view AI-generated case outlines, summaries, and predicted judgments under statutory evidence acts.
3. Professional Liability: The duty of care of advocates when relying on LLMs for drafting submissions, and liability for AI hallucinations (cite: federal rules of civil procedure).`,

  'law_commission/report_277.txt': `Law Commission of India - Report No. 277: Wrongful Prosecution (Miscarriage of Justice)

Summary:
The Law Commission analyzed the issues surrounding wrongful prosecution, where innocent individuals are falsely accused and imprisoned. It recommended statutory remedies and compensation mechanisms.

Key Recommendations:
1. Special Courts: Establishment of designated courts for speedy disposal of claims regarding wrongful prosecution.
2. Financial Compensation: Framework calculating pecuniary and non-pecuniary damages, including loss of earnings, health, and social reputation.
3. Accountability of State: Recommending action against delinquent police or prosecuting officers who willfully register false charges.`
};

Object.entries(filesToCreate).forEach(([relPath, content]) => {
  const fullPath = path.join(baseDir, relPath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
  fs.writeFileSync(fullPath, content.trim(), 'utf8');
  console.log(`Created file: ${fullPath}`);
});

console.log('🎉 All corpus files created successfully!');
