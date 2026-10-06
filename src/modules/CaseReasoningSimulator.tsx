import { API_BASE_URL } from '../lib/api'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { DemoUsageBadge } from '../components/DemoUsageBadge'
import {
  AlertTriangle,
  Award,
  BookOpen,
  Brain,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  GraduationCap,
  History,
  Info,
  Lightbulb,
  RotateCcw,
  Save,
  Scale,
  Send,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Clock,
  ArrowLeft,
  ArrowRight,
  Search,
  Filter,
  Sliders,
  Check,
  ChevronLeft,
  X,
  BrainCircuit,
} from 'lucide-react'
import './CaseReasoningSimulator.css'

type SectionReport = {
  summary: string
  strengths: string[]
  gaps: string[]
  suggestions: string[]
}

type CaseOverview = {
  caseName: string
  natureOfDispute: string
  areaOfLaw: string
  keyLegalIssue: string
  difficultyLevel: string
}

type PerformanceScore = {
  overallLegalReasoning: number
  factIdentification: number
  issueSpotting: number
  lawApplication: number
  caseLawUsage: number
  professionalWriting: number
  argumentQuality: number
  criticalThinking: number
  argumentStrength: number
  finalScore: number
  grade: string
}

type BestCaseReport = {
  title: string
  introduction: string
  facts: string[]
  issues: string[]
  applicableLaw: string[]
  caseLaw: string[]
  analysis: string
  counterArguments: string[]
  conclusion: string
  legalPrinciple: string
  examReadyAnswer: string
}

type AnalysisReport = {
  attemptId?: string
  caseNameOrProblem: string
  status: 'evaluated' | 'saved'
  createdAt: string
  sections: {
    caseOverview: CaseOverview
    understandingOfFacts: SectionReport
    issueIdentification: SectionReport
    applicableLaw: SectionReport
    caseLawAnalysis: SectionReport
    legalReasoning: SectionReport
    simplifiedExplanation: {
      facts: string
      issues: string
      law: string
      application: string
      reasoning: string
      courtReasoning: string
      decision: string
      ratiodecidendi: string
      legalPrinciple: string
      practicalApplication: string
      examTips: string
      realLifeExample: string
    }
    mistakes: string[]
    professionalSolution: string
    bestCaseReport: BestCaseReport
    modelLegalAnswer?: {
      issue: string
      materialFacts: string
      legalFramework: string
      precedentApplication: string
      petitionerCase: string
      respondentCase: string
      rebuttal: string
      likelyJudicialApproach: string
      conclusion: string
      remedyRelief?: string
      examTakeaway: string
    }
    learningRecommendations: {
      whatStudentDidWell: string[]
      whatToImprove: string[]
      relatedBareActs: string[]
      relatedSections: string[]
      relatedCases: string[]
      relatedMockTests: string[]
      relatedFlashcards: string[]
      relatedResearchTopics: string[]
    }
    performanceScore: PerformanceScore
  }
  professorComments: string
  provider: string
}

type HistoryItem = {
  id: string
  caseName: string
  date: string
  score: number
  status: string
}

const LANDMARK_CASES = [
  {
    id: 'kesavananda',
    name: 'Kesavananda Bharati v. State of Kerala',
    court: 'Supreme Court of India',
    year: '1973',
    area: 'Constitutional Law',
    subArea: 'Basic Structure Doctrine',
    difficulty: 'Advanced',
    summary: 'Established the Basic Structure Doctrine, placing limitations on Parliament\'s power to amend the Constitution under Article 368.',
    scenarios: {
      analysis: {
        scenario: `Parliament passes a constitutional amendment that seeks to significantly alter a fundamental constitutional principle. A constitutional challenge is filed before the Supreme Court...`,
        question: `You are appearing as counsel for the petitioner. Analyse whether the amendment can validly be challenged in light of the principles established in Kesavananda Bharati.`
      },
      issue: {
        scenario: `A state government amends the judicial appointment process, vesting final veto authority in the executive. The Bar Association challenges the amendment, claiming it destroys judicial independence.`,
        question: `Identify the issues. Focus on Article 368, the scope of amending power, and whether judicial independence is part of the basic structure.`
      },
      judgment: {
        scenario: `Examine the historic 7:6 majority opinion in Kesavananda Bharati. Focus on the concept of 'implied limitations' on constituent power.`,
        question: `Analyze the ratio decidendi. What is the scope of the amending power under Article 368 according to the majority?`
      },
      application: {
        scenario: `Parliament inserts a new clause in Article 368 stating that amendments cannot be reviewed by courts on any ground.`,
        question: `Analyse whether this clause violates the Basic Structure Doctrine.`
      }
    }
  },
  {
    id: 'maneka',
    name: 'Maneka Gandhi v. Union of India',
    court: 'Supreme Court of India',
    year: '1978',
    area: 'Fundamental Rights',
    subArea: 'Personal Liberty',
    difficulty: 'Advanced',
    summary: 'Transformed the interpretation of Article 21, establishing that "procedure established by law" must be fair, just, and reasonable.',
    scenarios: {
      analysis: {
        scenario: `An administrative passport authority impounds a prominent citizen's passport "in the interest of the general public" without providing reasons or a prior hearing.`,
        question: `Analyse whether this restriction of personal liberty violates Articles 14, 19, and 21. Evaluate whether the procedure satisfies procedural fairness and due process principles as established in Maneka Gandhi.`
      },
      issue: {
        scenario: `A local public security law authorizes police to detain citizens under night curfew without right to appeal or disclosure of reasons.`,
        question: `Identify the constitutional issues under Article 21 and natural justice.`
      },
      judgment: {
        scenario: `Review the majority opinion in Maneka Gandhi regarding how it integrated Articles 14, 19, and 21.`,
        question: `Explain the ratio and the significance of reading 'due process' into Article 21.`
      },
      application: {
        scenario: `The state passes a digital tracking mandate for political parolees without data privacy or administrative safeguards.`,
        question: `Apply the due process test of Maneka Gandhi to evaluate the validity of the state's procedure.`
      }
    }
  },
  {
    id: 'bommai',
    name: 'S.R. Bommai v. Union of India',
    court: 'Supreme Court of India',
    year: '1994',
    area: 'Constitutional Law',
    subArea: 'President\'s Rule',
    difficulty: 'Advanced',
    summary: 'Clarified the scope of Article 356, establishing that the President\'s power to dismiss state governments is subject to judicial review.',
    scenarios: {
      analysis: {
        scenario: `Following minor localized law-and-order protests, the central government issues a proclamation under Article 356 dismissing the state cabinet and dissolving the legislative assembly before a floor test is conducted.`,
        question: `Analyse the validity of the President's Rule in light of the S.R. Bommai case. Focus on federalism, judicial review of executive satisfaction, and the necessity of a legislative floor test to establish a majority.`
      },
      issue: {
        scenario: `A governor recommends Article 356 on secularism grounds, claiming a state government's municipal funding violates secular machinery.`,
        question: `Identify the constitutional issues under Article 356 and the basic structure feature of secularism.`
      },
      judgment: {
        scenario: `Review the holding in S.R. Bommai regarding the power of courts to restore dissolved assemblies.`,
        question: `Explain the court's reasoning on the limits of Article 356.`
      },
      application: {
        scenario: `The central cabinet dismisses a state cabinet because it refuses to comply with a non-binding center policy directive.`,
        question: `Apply the S.R. Bommai ratio to determine if this executive action can withstand constitutional scrutiny.`
      }
    }
  },
  {
    id: 'vishaka',
    name: 'Vishaka v. State of Rajasthan',
    court: 'Supreme Court of India',
    year: '1997',
    area: 'Human Rights',
    subArea: 'Workplace Rights',
    difficulty: 'Medium',
    summary: 'Laid down the historic Vishaka Guidelines to combat sexual harassment at the workplace in the absence of domestic legislation.',
    scenarios: {
      analysis: {
        scenario: `A female social worker reports repeated instances of verbal harassment and hostile behavior by a local supervisor. The non-profit organization has no internal complaints committee, policy, or grievance mechanism.`,
        question: `Identify the applicable constitutional protections and legal principles under Articles 14, 19, and 21. Evaluate the scenario and the employer's responsibility based on the judicial guidelines formulated in Vishaka.`
      },
      issue: {
        scenario: `An employee is terminated after reporting sexual harassment. The firm has an all-male grievance committee with no external representative.`,
        question: `Identify the legal issues. Focus on the required composition of the complaints committee under the Vishaka guidelines.`
      },
      judgment: {
        scenario: `Examine the court's reliance on the CEDAW convention to frame workplace guidelines.`,
        question: `Analyze the ratio and how international conventions are imported into domestic fundamental rights law.`
      },
      application: {
        scenario: `A municipal school fails to implement any grievance mechanism or safety guidelines for teachers during district tours.`,
        question: `Apply the Vishaka guidelines to evaluate the institution's liability.`
      }
    }
  },
  {
    id: 'puttaswamy',
    name: 'K.S. Puttaswamy v. Union of India',
    court: 'Supreme Court of India',
    year: '2017',
    area: 'Constitutional Law',
    subArea: 'Right to Privacy',
    difficulty: 'Advanced',
    summary: 'Declared the right to privacy as a fundamental right protected under Article 21 and the Constitution.',
    scenarios: {
      analysis: {
        scenario: `The state makes it mandatory for all citizens to link their genetic profile data to a national healthcare database to receive basic subsidised medicines, claiming it prevents identity theft and distribution leakages.`,
        question: `Analyse whether this state action constitutionally violates the right to privacy. Apply the triple test of legality, legitimate state aim, and proportionality as established in Puttaswamy.`
      },
      issue: {
        scenario: `A local council deploys facial recognition cameras in municipal parks without any statutory backing or rules.`,
        question: `Frame the constitutional issues regarding state surveillance and personal autonomy.`
      },
      judgment: {
        scenario: `Review the overruling of Kharak Singh and M.P. Sharma by the 9-judge bench in Puttaswamy.`,
        question: `Deconstruct the court's definition of privacy as intrinsic to dignity and life.`
      },
      application: {
        scenario: `A private contractor collects biometric details of day-laborers for state projects, storing them on unsecured public servers.`,
        question: `Apply the proportionality standard to determine if the state-authorized program passes privacy muster.`
      }
    }
  },
  {
    id: 'navtej',
    name: 'Navtej Singh Johar v. Union of India',
    court: 'Supreme Court of India',
    year: '2018',
    area: 'Human Rights',
    subArea: 'Section 377 IPC',
    difficulty: 'Advanced',
    summary: 'Decriminalised consensual sexual acts between adults, declaring Section 377 of the IPC unconstitutional to that extent.',
    scenarios: {
      analysis: {
        scenario: `Two consenting adults are harassed and threatened with prosecution by local police under Section 377 IPC for cohabitating in a private apartment.`,
        question: `Analyse this state action under the constitutional guarantees of equality (Art 14), non-discrimination (Art 15), and privacy (Art 21). Apply the constitutional morality standards of Navtej Singh Johar.`
      },
      issue: {
        scenario: `A corporate housing colony bans leasing to same-sex couples, claiming traditional public morals.`,
        question: `Identify the issues under equality, non-discrimination, and dignity.`
      },
      judgment: {
        scenario: `Deconstruct the concept of "constitutional morality" versus "popular morality" in Navtej Singh Johar.`,
        question: `Analyze the ratio regarding sexual orientation as an essential part of individual identity under Article 21.`
      },
      application: {
        scenario: `A private school dismisses a teacher who marries a same-sex partner, citing values and community character.`,
        question: `Apply the Navtej Singh Johar standards on non-discrimination and personal choice.`
      }
    }
  },
  {
    id: 'shayarabano',
    name: 'Shayara Bano v. Union of India',
    court: 'Supreme Court of India',
    year: '2017',
    area: 'Personal Law',
    subArea: 'Triple Talaq',
    difficulty: 'Advanced',
    summary: 'Declared the practice of instant triple talaq (Talaq-e-Biddat) unconstitutional and void under Article 14.',
    scenarios: {
      analysis: {
        scenario: `A husband pronounces instant triple talaq (Talaq-e-Biddat) to his wife via a text message during a domestic dispute, claiming absolute protection under uncodified Muslim personal law.`,
        question: `Analyse the constitutional validity of this practice. Apply the arguments concerning fundamental rights under Article 14 and the test of manifest arbitrariness established in Shayara Bano.`
      },
      issue: {
        scenario: `A wife is evicted after her husband declares Talaq-e-Biddat, claiming personal customs terminate all marital housing claims.`,
        question: `Identify the constitutional issues of gender equality, arbitrary dissolution, and religious freedom (Article 25).`
      },
      judgment: {
        scenario: `Analyze the majority opinions, particularly Justice Nariman's doctrine of manifest arbitrariness.`,
        question: `Deconstruct the ratio. Why was Talaq-e-Biddat struck down as un-Islamic and arbitrary?`
      },
      application: {
        scenario: `A government agency refuses to award medical benefits to a spouse, claiming the marriage was terminated by triple talaq text.`,
        question: `Apply the Shayara Bano ruling to determine the spouse's legal status.`
      }
    }
  },
  {
    id: 'indrasawhney',
    name: 'Indra Sawhney v. Union of India',
    court: 'Supreme Court of India',
    year: '1992',
    area: 'Constitutional Law',
    subArea: 'Reservation Limits',
    difficulty: 'Advanced',
    summary: 'Upheld the 27% reservation for Other Backward Classes (OBCs), while establishing the "creamy layer" exclusion and a 50% cap on total reservations.',
    scenarios: {
      analysis: {
        scenario: `A state government issues an executive order reserving 65% of civil services posts for backward classes, including a class that has achieved substantial representation in the state's administrative ranks.`,
        question: `Analyse the constitutional validity of this reservation scheme. Apply the reservation limits, creamy layer exclusion, and the reservation criteria as set out in Indra Sawhney.`
      },
      issue: {
        scenario: `A state bank includes high-income OBC families in reservation slots, claiming casting is the only criterion.`,
        question: `Frame the legal issues. Focus on the definition of the creamy layer and equal opportunity.`
      },
      judgment: {
        scenario: `Examine the Mandal judgment on Article 16(4) limits.`,
        question: `Deconstruct the court's reasoning on the 50% cap and why reservation in promotions is unconstitutional under this ratio.`
      },
      application: {
        scenario: `A group of general category students challenges a 55% reservation scheme that reserves quota based purely on economic status.`,
        question: `Apply the Indra Sawhney ruling. Is reservation based solely on economic criteria valid?`
      }
    }
  },
  {
    id: 'mcmehta',
    name: 'M.C. Mehta v. Union of India',
    court: 'Supreme Court of India',
    year: '1987',
    area: 'Environmental Law',
    subArea: 'Absolute Liability',
    difficulty: 'Advanced',
    summary: 'Formulated the doctrine of Absolute Liability for hazardous and inherently dangerous industries, rejecting the exceptions of strict liability.',
    scenarios: {
      analysis: {
        scenario: `A chemical plant located near a populated suburb leaks toxic gas due to an unexpected pipe rupture during a storm. The plant operator claims the leak was an Act of God and they took all reasonable precautions, denying liability.`,
        question: `Determine the plant's liability under environmental tort principles. Applying the doctrine established in M.C. Mehta, evaluate the validity of the operator's defenses and contrast strict liability with absolute liability.`
      },
      issue: {
        scenario: `A company stores hazardous acids in thin metal drums that leak and poison a municipal water reservoir. The company claims act of a stranger.`,
        question: `Spot the legal issues. Focus on the Polluter Pays Principle and absolute liability rules.`
      },
      judgment: {
        scenario: `Examine Chief Justice Bhagwati's rejection of Rylands v. Fletcher exceptions.`,
        question: `Explain why the court developed a stricter rule of absolute liability for modern industrial India.`
      },
      application: {
        scenario: `A competitor sabotages an industrial pipeline, causing a leak that ruins adjacent farm crops.`,
        question: `Apply the absolute liability principle. Is the plant owner liable despite the sabotage?`
      }
    }
  },
  {
    id: 'olgatellis',
    name: 'Olga Tellis v. Bombay Municipal Corporation',
    court: 'Supreme Court of India',
    year: '1985',
    area: 'Fundamental Rights',
    subArea: 'Right to Livelihood',
    difficulty: 'Medium',
    summary: 'Ruled that the right to life under Article 21 includes the right to livelihood, requiring procedural fairness before evictions.',
    scenarios: {
      analysis: {
        scenario: `A municipal corporation summarily evicts hundreds of street vendors and pavement dwellers to clear paths for a VIP convoy, destroying their carts and shelters without prior notice or providing alternative spaces.`,
        question: `Analyse the constitutional validity of this eviction. Using the Olga Tellis precedent, discuss whether the right to livelihood is an extension of Article 21, and evaluate the requirement of procedural fairness.`
      },
      issue: {
        scenario: `A city authority bans hawking on all public roads to clear traffic, destroying the livelihood of thousands.`,
        question: `Identify the issues of livelihood under Article 21 and the right to carry on trade under Article 19.`
      },
      judgment: {
        scenario: `Review the Olga Tellis judgment on the link between life and livelihood.`,
        question: `Deconstruct the court's reasoning on procedural safeguards and the right to a hearing before deprivation of livelihood.`
      },
      application: {
        scenario: `A state railway orders immediate demolition of disused-track markets with 24-hour verbal notice.`,
        question: `Apply the Olga Tellis principles. Does the demolition violate Article 21 and natural justice?`
      }
    }
  },
  {
    id: 'shahbano',
    name: 'Mohd. Ahmed Khan v. Shah Bano Begum',
    court: 'Supreme Court of India',
    year: '1985',
    area: 'Family Law',
    subArea: 'Maintenance',
    difficulty: 'Medium',
    summary: 'Held that Section 125 of the CrPC applies to all citizens irrespective of religion, overriding conflicting personal laws on maintenance.',
    scenarios: {
      analysis: {
        scenario: `A divorced Muslim woman, unable to maintain herself, files an application under Section 125 of the Criminal Procedure Code, 1973. Her husband argues that he is only liable to pay maintenance during the period of iddat as prescribed under Muslim personal law.`,
        question: `Analyse the statutory maintenance remedy under Section 125 CrPC in the historical context of this case. Explain if it overrides conflicting personal law provisions on maintenance.`
      },
      issue: {
        scenario: `A husband claims a one-time mahr payment at marriage absolves him of post-divorce maintenance under criminal law codes.`,
        question: `Identify the legal issues. Address the scope of Section 125 CrPC and religious codes in 1985.`
      },
      judgment: {
        scenario: `Review the court's reasoning in Shah Bano on secular statutory remedies.`,
        question: `Analyse how the court interpreted religious scriptures to find they do not bar statutory maintenance.`
      },
      application: {
        scenario: `An elderly divorced wife is denied maintenance by her husband on religious grounds, despite having no independent income.`,
        question: `Apply the Shah Bano ratio to determine the husband's maintenance liability under Section 125 CrPC.`
      }
    }
  },
  {
    id: 'hussainara',
    name: 'Hussainara Khatoon v. State of Bihar',
    court: 'Supreme Court of India',
    year: '1979',
    area: 'Criminal Law',
    subArea: 'Speedy Trial',
    difficulty: 'Medium',
    summary: 'Held that the right to a speedy trial is an essential part of the fundamental right to life and liberty under Article 21.',
    scenarios: {
      analysis: {
        scenario: `An undertrial prisoner remains detained in jail for seven years awaiting trial on an accusation where the maximum statutory sentence if convicted is only three years. The prisoner has no legal representation due to poverty.`,
        question: `Analyse the prisoner's constitutional rights in light of Hussainara Khatoon. Identify the constitutional rights involved, access to legal aid, and the state's obligation to ensure access to justice under Article 21.`
      },
      issue: {
        scenario: `Inmates are detained under extreme bail conditions they cannot afford, while trial schedules stretch over years.`,
        question: `Identify the issues regarding access to justice, excessive bail, and speedy trial under Article 21.`
      },
      judgment: {
        scenario: `Review the court's pathbreaking rulings on PILs and legal aid in Hussainara Khatoon.`,
        question: `Examine the court's construction of Article 21 read with Article 39A (free legal aid).`
      },
      application: {
        scenario: `A suspect is kept in remand custody for three years without a formal charge sheet due to staff shortages.`,
        question: `Apply the Hussainara Khatoon ruling to evaluate the suspect's detention.`
      }
    }
  },
  {
    id: 'dkbasu',
    name: 'D.K. Basu v. State of West Bengal',
    court: 'Supreme Court of India',
    year: '1997',
    area: 'Criminal Law',
    subArea: 'Arrest Safeguards',
    difficulty: 'Advanced',
    summary: 'Prescribed strict guidelines to be followed by police during arrest and detention to prevent custodial torture and protect individual rights.',
    scenarios: {
      analysis: {
        scenario: `Police officers arrest a suspect at midnight from his home without wearing identification tags, preparing a memo of arrest, or informing his family. The suspect is detained in custody and subjected to physical coercion.`,
        question: `Identify the safeguards and constitutional issues. In light of the D.K. Basu guidelines, evaluate the consequences of police non-compliance.`
      },
      issue: {
        scenario: `A suspect dies in police custody, and the station refuses to allow an independent doctor to perform an autopsy.`,
        question: `Frame the issues. Focus on custodial torture, sovereign immunity, and Article 21 protection.`
      },
      judgment: {
        scenario: `Review the mandatory guidelines formulated by the Supreme Court to prevent abuse in lockups.`,
        question: `Deconstruct the ratio. What are the key procedural safeguards required by police officers during arrest?`
      },
      application: {
        scenario: `A citizen is arrested for fraud and kept in isolation for 48 hours without access to counsel or relatives.`,
        question: `Apply the D.K. Basu guidelines. Can the police justify this custodial isolation?`
      }
    }
  },
  {
    id: 'madhukar',
    name: 'State of Maharashtra v. Madhukar Narayan Mardikar',
    court: 'Supreme Court of India',
    year: '1991',
    area: 'Women\'s Rights',
    subArea: 'Witness Credibility',
    difficulty: 'Advanced',
    summary: 'Held that even a woman of "easy virtue" is entitled to privacy and dignity under Article 21, and her character cannot justify sexual violence.',
    scenarios: {
      analysis: {
        scenario: `A police inspector is accused of attempting to sexually assault a woman in custody. During the disciplinary hearing and trial, the defense argues that because the woman has a history of sex work, her allegations lack credibility and her consent can be presumed.`,
        question: `Analyse consent, witness credibility, dignity, and the relevance of a woman's character. Evaluate whether assumptions about character can determine credibility or consent under Article 21.`
      },
      issue: {
        scenario: `A court discounts a sexual assault claim because the victim traveled late at night, implying consent.`,
        question: `Identify the issues of character evidence, victim privacy, and consent under gender justice guidelines.`
      },
      judgment: {
        scenario: `Deconstruct the court's rejection of unchaste character defenses in assault cases.`,
        question: `Analyze how the court interpreted Article 21 in relation to privacy and bodily integrity for all women.`
      },
      application: {
        scenario: `A school dismisses a teacher's harassment complaint against a colleague because she had a previous relationship.`,
        question: `Apply the Madhukar Narayan Mardikar ratio to evaluate the school's handling of credibility.`
      }
    }
  },
  {
    id: 'donoghue',
    name: 'Donoghue v. Stevenson',
    court: 'House of Lords',
    year: '1932',
    area: 'Law of Torts',
    subArea: 'Duty of Care',
    difficulty: 'Beginner/Medium',
    summary: 'Established the modern law of negligence, laying down the historic "Neighbour principle" and defining manufacturer liability.',
    scenarios: {
      analysis: {
        scenario: `A consumer purchases a bottle of ginger beer from a retailer. The bottle is opaque, preventing visual inspection of its contents. The consumer drinks the beverage and discovers the decomposed remains of a snail at the bottom, falling severely ill. The consumer has no contract with the manufacturer.`,
        question: `Determine whether a duty of care exists using the Neighbour principle. Analyze the manufacturer's liability to the ultimate consumer and the definition of negligence in the absence of a contract.`
      },
      issue: {
        scenario: `A customer suffers burns from a sealed impurity in a bottle of hair dye bought from a store.`,
        question: `Frame the tort issues. Address duty of care, intermediate inspection capability, and manufacturer liability.`
      },
      judgment: {
        scenario: `Review Lord Atkin's famous moral-legal neighbor formulation.`,
        question: `Examine the ratio. How does the Neighbour principle override the privity of contract rule in torts?`
      },
      application: {
        scenario: `A baker sells bread containing a stone that breaks a child's tooth. The baker blames the flour mill supplier.`,
        question: `Apply the Neighbour principle. Is the baker liable to the child who ate the bread?`
      }
    }
  }
]

const CATEGORIES = [
  'All',
  'Constitutional Law',
  'Fundamental Rights',
  'Criminal Law',
  'Environmental Law',
  'Family Law',
  'Personal Law',
  'Human Rights',
  'Law of Torts',
  'Women\'s Rights'
]

const TIMER_OPTIONS = ['5 min', '10 min', '15 min', '20 min', '30 min', '45 min', '60 min', 'Custom']

const sectionLabels = [
  { key: 'understandingOfFacts', title: '2. Understanding of Facts' },
  { key: 'issueIdentification', title: '4. Issue Identification' },
  { key: 'applicableLaw', title: '5. Applicable Law Analysis' },
  { key: 'caseLawAnalysis', title: '6. Case Law Analysis' },
  { key: 'legalReasoning', title: '7. Legal Reasoning Review' },
] as const

const simplifiedExplanationLabels: { key: keyof AnalysisReport['sections']['simplifiedExplanation']; label: string }[] = [
  { key: 'facts', label: 'Facts' },
  { key: 'issues', label: 'Legal Issues' },
  { key: 'law', label: 'Applicable Law' },
  { key: 'application', label: 'Application' },
  { key: 'reasoning', label: 'How to Think Like a Lawyer' },
  { key: 'courtReasoning', label: "Court's Reasoning" },
  { key: 'decision', label: 'Final Decision' },
  { key: 'ratiodecidendi', label: 'Ratio Decidendi' },
  { key: 'legalPrinciple', label: 'Legal Principle' },
  { key: 'practicalApplication', label: 'Practical Application' },
  { key: 'examTips', label: 'Exam Tips' },
  { key: 'realLifeExample', label: 'Real-Life Example' },
]

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function scoreTone(score: number) {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'solid'
  if (score >= 40) return 'needs-work'
  return 'weak'
}

function gradeTone(grade: string) {
  if (grade === 'A') return 'excellent'
  if (grade === 'B') return 'solid'
  if (grade === 'C') return 'needs-work'
  return 'weak'
}

function renderList(items: string[]) {
  return items.length ? items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>) : <li>No specific points returned.</li>
}

function formatDate(value: string | Date) {
  const date = new Date(value as string)
  if (Number.isNaN(date.getTime())) return 'Recent'
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function renderChatMarkdown(text: string) {
  if (!text) return null
  const lines = text.split('\n')
  return lines.map((line, idx) => {
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      return (
        <li key={idx} className="crs-chat-li">
          {renderChatInline(line.trim().substring(2))}
        </li>
      )
    }
    if (/^\d+\.\s/.test(line.trim())) {
      const cleanLine = line.trim().replace(/^\d+\.\s/, '')
      return (
        <li key={idx} className="crs-chat-ol-li">
          {renderChatInline(cleanLine)}
        </li>
      )
    }
    if (line.trim().startsWith('### ')) {
      return <h4 key={idx} className="crs-chat-h4">{renderChatInline(line.trim().substring(4))}</h4>
    }
    if (line.trim().startsWith('## ')) {
      return <h3 key={idx} className="crs-chat-h3">{renderChatInline(line.trim().substring(3))}</h3>
    }
    return <p key={idx} className="crs-chat-p">{renderChatInline(line)}</p>
  })
}

function renderChatInline(raw: string) {
  const parts = []
  const re = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g
  let cur = 0, m: RegExpExecArray | null, k = 0
  while ((m = re.exec(raw)) !== null) {
    if (m.index > cur) parts.push(raw.slice(cur, m.index))
    if (m[1]) parts.push(<strong key={k++}>{m[2]}</strong>)
    else if (m[3]) parts.push(<em key={k++}>{m[4]}</em>)
    else if (m[5]) parts.push(<code key={k++} className="crs-chat-code">{m[6]}</code>)
    cur = m.index + m[0].length
  }
  if (cur < raw.length) parts.push(raw.slice(cur))
  return parts.length ? <>{parts}</> : raw
}

export default function CaseReasoningSimulator({ theme }: { theme?: 'light' | 'dark' }) {
  const { getToken } = useAuth()
  
  // Custom Flow States
  const [step, setStep] = useState<'select' | 'config' | 'practice' | 'submitted' | 'review-quick' | 'review-step'>('select')
  const [reviewModeTab, setReviewModeTab] = useState<'student' | 'model' | 'mistakes'>('student')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<string>('')
  const [customCaseName, setCustomCaseName] = useState('')
  const [customScenarioInput, setCustomScenarioInput] = useState('')
  const [customQuestionInput, setCustomQuestionInput] = useState('')
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium')
  const [questionType, setQuestionType] = useState<'Case Analysis' | 'Issue Spotting' | 'Judgment Analysis' | 'Application Based'>('Case Analysis')
  const [timerOption, setTimerOption] = useState<string>('15 min')
  const [customTimerValue, setCustomTimerValue] = useState<string>('')
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [timerActive, setTimerActive] = useState<boolean>(false)
  const [initialTimeLimit, setInitialTimeLimit] = useState<number>(0)
  const [activeQuestion, setActiveQuestion] = useState<{ scenario: string; question: string }>({ scenario: '', question: '' })
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null)
  const [reviewStepIndex, setReviewStepIndex] = useState<number>(0)
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showStructureGuide, setShowStructureGuide] = useState<boolean>(true)
  const [isTimeUp, setIsTimeUp] = useState<boolean>(false)
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('saved')
  const [historyStack, setHistoryStack] = useState<string[]>([''])
  const [historyPointer, setHistoryPointer] = useState<number>(0)
  const [editorFocused, setEditorFocused] = useState<boolean>(false)
  const isUndoRedoAction = useRef<boolean>(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Legacy variables bound to components
  const [caseNameOrProblem, setCaseNameOrProblem] = useState('')
  const [studentReasoning, setStudentReasoning] = useState('')
  const [analysis, setAnalysis] = useState<AnalysisReport | null>(null)
  const [reportMode, setReportMode] = useState<'analysis' | 'case'>('analysis')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    caseOverview: true,
    understandingOfFacts: true,
    issueIdentification: true,
    applicableLaw: true,
    caseLawAnalysis: true,
    legalReasoning: true,
    simplifiedExplanation: true,
    mistakes: true,
    professionalSolution: true,
    learningRecommendations: true,
  })
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [customCaseNameError, setCustomCaseNameError] = useState('')
  const [customScenarioInputError, setCustomScenarioInputError] = useState('')
  const [customQuestionInputError, setCustomQuestionInputError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const reportRef = useRef<HTMLDivElement>(null)

  // Chatbot states
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([
    {
      id: 'initial',
      role: 'assistant',
      content: "Hi! I'm Legatrixon AI. I can explain the case you're studying, break down the judgment, identify legal principles, and answer your questions."
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatSessionId] = useState(() => 'sess_' + Math.random().toString(36).substring(2, 11))
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Context-Aware Chatbot Messenger
  const sendChatMessage = async (text: string, customDisplay?: string) => {
    const trimmed = text.trim()
    if (!trimmed || chatLoading) return

    const displayMsg = customDisplay || trimmed
    const newMsgId = 'u_' + Date.now()
    
    // Add user message to UI
    setChatMessages(prev => [
      ...prev,
      { id: newMsgId, role: 'user', content: displayMsg }
    ])
    setChatInput('')
    setChatLoading(true)

    // Tailor Context Payload
    let promptPayload = trimmed
    const caseObj = LANDMARK_CASES.find(c => c.id === selectedCaseId)
    const activeCaseName = caseObj ? caseObj.name : customCaseName || 'No specific case selected'
    
    if (step === 'practice') {
      promptPayload = `[CONSTRAINTS: STUDENT IN TIMED PRACTICE (DO NOT REVEAL MODEL ANSWERS/DECISION DIRECTLY). Case: ${activeCaseName}. Question: ${activeQuestion.question}. Scenario: ${activeQuestion.scenario}. If the student asks for a hint, provide a limited, conceptual hint without revealing the final answer/conclusions. Keep your tone encouraging but academic.] User: ${trimmed}`
    } else if (step === 'review-step') {
      const reviewSteps = [
        { title: 'Material Facts', data: analysis?.sections?.bestCaseReport?.facts?.join(', ') || analysis?.sections?.understandingOfFacts?.summary },
        { title: 'Legal Issues', data: analysis?.sections?.bestCaseReport?.issues?.join(', ') || analysis?.sections?.issueIdentification?.summary },
        { title: 'Applicable Law', data: analysis?.sections?.bestCaseReport?.applicableLaw?.join(', ') || analysis?.sections?.applicableLaw?.summary },
        { title: 'Relevant Case Principle', data: analysis?.sections?.bestCaseReport?.legalPrinciple || analysis?.sections?.caseLawAnalysis?.summary },
        { title: 'Arguments', data: analysis?.sections?.bestCaseReport?.counterArguments?.join(', ') || analysis?.sections?.legalReasoning?.summary },
        { title: 'Application of Law', data: analysis?.sections?.bestCaseReport?.analysis || analysis?.sections?.legalReasoning?.summary },
        { title: 'Court\'s Reasoning', data: analysis?.sections?.simplifiedExplanation?.courtReasoning || analysis?.sections?.caseLawAnalysis?.summary },
        { title: 'Conclusion / Holding', data: `Holding: ${analysis?.sections?.bestCaseReport?.conclusion}. Decision: ${analysis?.sections?.simplifiedExplanation?.decision}` },
        { title: 'Exam Takeaway', data: `Exam Tips: ${analysis?.sections?.simplifiedExplanation?.examTips}. Recommendations: ${analysis?.sections?.learningRecommendations?.whatToImprove?.join(', ')}` }
      ]
      const currentStepObj = reviewSteps[reviewStepIndex] || { title: 'General Review', data: '' }
      promptPayload = `[CONTEXT: STUDENT IN STEP-BY-STEP REVIEW. Case: ${activeCaseName}. Question: ${activeQuestion.question}. Review Step: ${reviewStepIndex + 1} - ${currentStepObj.title}. Model solution details for this step: "${currentStepObj.data}". Student's answer: "${studentReasoning}". Help explain this step conceptually or clarify rules/doctrines.] User: ${trimmed}`
    } else if (step === 'review-quick' && analysis) {
      const modelAns = analysis.sections.modelLegalAnswer;
      const mistakesList = analysis.sections.mistakes.join(' • ');
      promptPayload = `[CONTEXT: STUDENT IN QUICK REVIEW (Mode: ${reviewModeTab}). 
Case: ${activeCaseName}. 
Question: ${activeQuestion.question}. 
Scenario: ${activeQuestion.scenario}. 
Student Answer: "${studentReasoning}". 
Mistake Analysis (All Mistakes): "${mistakesList}". 
AI Model Solution: 
- Issue: "${modelAns?.issue}"
- Material Facts & Assumptions: "${modelAns?.materialFacts}"
- Legal Framework: "${modelAns?.legalFramework}"
- Application of Precedent: "${modelAns?.precedentApplication}"
- Petitioner's Case: "${modelAns?.petitionerCase}"
- Respondent's Case: "${modelAns?.respondentCase}"
- Rebuttal: "${modelAns?.rebuttal}"
- Likely Judicial Approach: "${modelAns?.likelyJudicialApproach}"
- Conclusion: "${modelAns?.conclusion}"
- Remedy / Relief: "${modelAns?.remedyRelief || 'N/A'}"
- Exam Takeaway: "${modelAns?.examTakeaway}"
If the student asks why the AI reached a conclusion, explains an argument, asks why an Article is relevant, or compares the AI model answer with their own, help explain the legal concepts, reasoning, and context clearly instead of blindly repeating the answers. Use encouraging, academic, and professional legal mentoring tone.] User: ${trimmed}`;
    } else if (selectedCaseId || customCaseName) {
      promptPayload = `[CONTEXT: Case: ${activeCaseName}. Question: ${activeQuestion.question || 'N/A'}] User: ${trimmed}`
    }

    try {
      const headers = await authHeaders()
      const response = await fetch(`${API_BASE_URL}/chat/message`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: chatSessionId,
          message: promptPayload,
          depth: 'Intermediate',
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const botMsgId = 'b_' + Date.now()
      setChatMessages(prev => [
        ...prev,
        { id: botMsgId, role: 'assistant', content: data.content || 'No response received from Legatrixon AI.' }
      ])
    } catch (err) {
      console.error('Chatbot request failed:', err)
      const errMsgId = 'e_' + Date.now()
      setChatMessages(prev => [
        ...prev,
        { id: errMsgId, role: 'assistant', content: 'Sorry, I encountered an error communicating with Legatrixon AI. Please try again.' }
      ])
    } finally {
      setChatLoading(false)
    }
  }

  // Active Practice Question Scenario Grabber
  const getScenarioAndQuestion = (caseId: string, qType: string) => {
    if (caseId === 'custom') {
      return {
        scenario: customScenarioInput.trim() || 'A custom legal dispute involving the parties under dispute.',
        question: customQuestionInput.trim() || 'Analyze the constitutional, statutory, and common law principles applicable to this scenario, frame relevant issues, build legal arguments, and arrive at a logical judicial conclusion.'
      }
    }
    const caseObj = LANDMARK_CASES.find(c => c.id === caseId)
    if (!caseObj) return { scenario: '', question: '' }
    
    let key: 'analysis' | 'issue' | 'judgment' | 'application' = 'analysis'
    if (qType === 'Issue Spotting') key = 'issue'
    else if (qType === 'Judgment Analysis') key = 'judgment'
    else if (qType === 'Application Based') key = 'application'
    
    return caseObj.scenarios[key] || caseObj.scenarios.analysis
  }

  // Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setTimerActive(false)
            handleAutoSubmit()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else if (timeLeft === 0 && timerActive) {
      setTimerActive(false)
      handleAutoSubmit()
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [timerActive, timeLeft])

  const formatTimeLeft = (sec: number) => {
    const mins = Math.floor(sec / 60)
    const secs = sec % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const handleAutoSubmit = () => {
    setTimerActive(false)
    setIsTimeUp(true)
    setNotice("Time's Up! Your answer has been locked. Click 'Submit Answer' to get your score and feedback.")
  }

  const scoreRows = useMemo(() => {
    if (!analysis) return []
    const score = analysis.sections.performanceScore
    return [
      ['Fact Identification', score.factIdentification],
      ['Issue Spotting', score.issueSpotting],
      ['Law Application', score.lawApplication],
      ['Case Law Usage', score.caseLawUsage],
      ['Legal Reasoning', score.overallLegalReasoning],
      ['Argument Quality', score.argumentQuality],
      ['Argument Strength', score.argumentStrength],
      ['Critical Thinking', score.criticalThinking],
      ['Professional Writing', score.professionalWriting],
    ] as const
  }, [analysis])

  const authHeaders = useCallback(async () => {
    const token = await getToken()
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }
  }, [getToken])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/legal-intelligence/case-reasoning-simulator/history`, {
        headers: await authHeaders(),
      })
      if (response.ok) {
        setHistory(await response.json())
      }
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    void Promise.resolve().then(loadHistory)
    return () => abortRef.current?.abort()
  }, [loadHistory])

  const validateInputs = () => {
    if (!studentReasoning.trim()) return 'Please write your answer before submitting.'
    if (studentReasoning.trim().length < 40) return 'Please add a fuller answer attempt (minimum 40 characters) before submitting.'
    return ''
  }

  // Submission handler
  const handleAnalyze = async () => {
    if (loading) return
    const validationMessage = validateInputs()
    if (validationMessage) {
      setError(validationMessage)
      return
    }

    setTimerActive(false) // Stop timer
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError('')
    setNotice('')

    // Build the query string for custom/preset cases
    const targetCaseName = selectedCaseId === 'custom' ? customCaseName : LANDMARK_CASES.find(c => c.id === selectedCaseId)?.name || 'Custom Case'
    const caseNameOrProblemToSend = `Case: ${targetCaseName}\nDifficulty: ${difficulty}\nQuestion Type: ${questionType}\nFactual Scenario: ${activeQuestion.scenario}\nPractice Question: ${activeQuestion.question}`

    try {
      const response = await fetch(`${API_BASE_URL}/legal-intelligence/case-reasoning-simulator/analyze`, {
        method: 'POST',
        headers: await authHeaders(),
        signal: controller.signal,
        body: JSON.stringify({ caseNameOrProblem: caseNameOrProblemToSend, studentReasoning }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.message || 'Analysis request failed.')
      
      setAnalysis(data)
      setReportMode('analysis')
      setNotice('Submission Complete! Your practice attempt has been evaluated.')
      setStep('submitted')
      await loadHistory()
    } catch (err: unknown) {
      if (!isAbortError(err)) {
        setError(getErrorMessage(err, 'Error communicating with the Case Law Practice Lab evaluation system.'))
        setTimerActive(true) // Resume timer if failed
      }
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  const parseReopenedAttempt = (fullText: string) => {
    if (!fullText) return { name: '', scenario: '', question: '' }
    if (fullText.includes('Case: ') && fullText.includes('Question Type: ')) {
      const caseMatch = fullText.match(/Case:\s*(.+)\n/)
      const scenarioMatch = fullText.match(/Factual Scenario:\s*([\s\S]+?)\nPractice Question:/)
      const questionMatch = fullText.match(/Practice Question:\s*([\s\S]+)$/)
      
      const name = caseMatch ? caseMatch[1].trim() : fullText
      const scenario = scenarioMatch ? scenarioMatch[1].trim() : ''
      const question = questionMatch ? questionMatch[1].trim() : ''
      return { name, scenario, question }
    }
    return { name: fullText, scenario: '', question: '' }
  }

  const reopenAttempt = async (id: string) => {
    setError('')
    setNotice('')
    setShowHistoryModal(false)
    try {
      const response = await fetch(`${API_BASE_URL}/legal-intelligence/case-reasoning-simulator/history/${id}`, {
        headers: await authHeaders(),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.message || 'Unable to reopen this analysis.')
      
      const parsed = parseReopenedAttempt(data.caseNameOrProblem || '')
      const found = LANDMARK_CASES.find(c => c.name.toLowerCase().includes(parsed.name.toLowerCase()))
      
      setSelectedCaseId(found ? found.id : 'custom')
      if (!found) setCustomCaseName(parsed.name)
      
      setCaseNameOrProblem(data.caseNameOrProblem || '')
      setStudentReasoning(data.studentReasoning || '')
      setAnalysis(data.report)
      
      setActiveQuestion({
        scenario: parsed.scenario || 'Previous attempt review.',
        question: parsed.question || 'See the analysis report and comparison details below.'
      })
      
      setStep('submitted')
      setNotice('Previous analysis reopened.')
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to reopen this analysis.'))
    }
  }

  const saveAnalysis = async () => {
    if (!analysis?.attemptId) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/legal-intelligence/case-reasoning-simulator/history/${analysis.attemptId}/save`, {
        method: 'PATCH',
        headers: await authHeaders(),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.message || 'Unable to save analysis.')
      setAnalysis({ ...analysis, status: 'saved' })
      setNotice('Practice attempt saved successfully.')
      await loadHistory()
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to save analysis.'))
    } finally {
      setSaving(false)
    }
  }

  const handleStartPractice = () => {
    setCustomCaseNameError('')
    setCustomScenarioInputError('')
    setCustomQuestionInputError('')

    let hasErrors = false

    if (selectedCaseId === 'custom') {
      if (!customCaseName.trim()) {
        setCustomCaseNameError('Case or dispute name is required.')
        hasErrors = true
      }
      if (!customScenarioInput.trim()) {
        setCustomScenarioInputError('Factual scenario is required.')
        hasErrors = true
      }
      if (!customQuestionInput.trim()) {
        setCustomQuestionInputError('Specific practice question is required.')
        hasErrors = true
      }
    }

    if (hasErrors) {
      setError('Please fill in all required custom case fields.')
      return
    }

    setError('')
    // Timer setup
    let mins = 15
    if (timerOption === 'Custom') {
      const parsed = parseInt(customTimerValue, 10)
      if (Number.isNaN(parsed) || parsed <= 0) {
        setError('Please enter a valid number of minutes.')
        return
      }
      mins = parsed
    } else {
      mins = parseInt(timerOption.split(' ')[0], 10)
    }

    const totalSeconds = mins * 60
    setTimeLeft(totalSeconds)
    setInitialTimeLimit(totalSeconds)
    setTimerActive(true)

    // Load scenario & question
    const quest = getScenarioAndQuestion(selectedCaseId, questionType)
    setActiveQuestion(quest)

    // Load draft if exists
    const savedDraft = localStorage.getItem(`crs_draft_${selectedCaseId}_${questionType}`)
    if (savedDraft) {
      setStudentReasoning(savedDraft)
      setHistoryStack([savedDraft])
      setHistoryPointer(0)
    } else {
      setStudentReasoning('')
      setHistoryStack([''])
      setHistoryPointer(0)
    }
    setDraftSavedAt(null)
    setIsTimeUp(false)
    setAutosaveStatus('saved')
    setReviewModeTab('student')

    // Legacy context binding
    setCaseNameOrProblem(selectedCaseId === 'custom' ? customCaseName : LANDMARK_CASES.find(c => c.id === selectedCaseId)?.name || '')

    setStep('practice')
  }

  const handleSaveDraft = () => {
    localStorage.setItem(`crs_draft_${selectedCaseId}_${questionType}`, studentReasoning)
    setDraftSavedAt(new Date())
    setAutosaveStatus('saved')
  }

  const insertFormatting = (type: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const selected = text.substring(start, end)
    
    let replacement = ''
    let cursorOffset = 0
    
    switch (type) {
      case 'bold':
        replacement = `**${selected || 'bold text'}**`
        cursorOffset = selected ? 0 : 2
        break
      case 'italic':
        replacement = `*${selected || 'italic text'}*`
        cursorOffset = selected ? 0 : 1
        break
      case 'underline':
        replacement = `<u>${selected || 'underlined text'}</u>`
        cursorOffset = selected ? 0 : 4
        break
      case 'heading':
        replacement = `\n### ${selected || 'Heading'}\n`
        cursorOffset = selected ? 0 : 1
        break
      case 'bullet':
        replacement = `\n- ${selected || 'List item'}`
        break
      case 'number':
        replacement = `\n1. ${selected || 'List item'}`
        break
      case 'quote':
        replacement = `\n> ${selected || 'Quoted text'}\n`
        break
      default:
        return
    }
    
    const newText = text.substring(0, start) + replacement + text.substring(end)
    setStudentReasoning(newText)
    
    // Manage history stack
    setHistoryStack(prev => {
      const next = prev.slice(0, historyPointer + 1)
      next.push(newText)
      setHistoryPointer(next.length - 1)
      return next
    })
    
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + replacement.length - cursorOffset
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const handleUndo = () => {
    if (historyPointer > 0) {
      isUndoRedoAction.current = true
      const nextPointer = historyPointer - 1
      setHistoryPointer(nextPointer)
      setStudentReasoning(historyStack[nextPointer])
    }
  }

  const handleRedo = () => {
    if (historyPointer < historyStack.length - 1) {
      isUndoRedoAction.current = true
      const nextPointer = historyPointer + 1
      setHistoryPointer(nextPointer)
      setStudentReasoning(historyStack[nextPointer])
    }
  }

  const handleClearAnswer = () => {
    const confirm = window.confirm("Clear your entire answer?")
    if (confirm) {
      setStudentReasoning('')
      localStorage.removeItem(`crs_draft_${selectedCaseId}_${questionType}`)
      setAutosaveStatus('saved')
      setHistoryStack([''])
      setHistoryPointer(0)
    }
  }

  // Auto-save effect
  useEffect(() => {
    if (step === 'practice' && selectedCaseId && studentReasoning.trim().length > 0) {
      setAutosaveStatus('saving')
      const delayTimer = setTimeout(() => {
        localStorage.setItem(`crs_draft_${selectedCaseId}_${questionType}`, studentReasoning)
        setAutosaveStatus('saved')
      }, 1500)
      return () => clearTimeout(delayTimer)
    }
  }, [studentReasoning, step, selectedCaseId, questionType])

  // History tracking effect
  useEffect(() => {
    if (step !== 'practice') return
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false
      return
    }
    const handler = setTimeout(() => {
      setHistoryStack(prev => {
        if (prev[historyPointer] === studentReasoning) return prev
        const next = prev.slice(0, historyPointer + 1)
        next.push(studentReasoning)
        setHistoryPointer(next.length - 1)
        return next
      })
    }, 800)
    return () => clearTimeout(handler)
  }, [studentReasoning, step])

  const handleEndPractice = () => {
    const confirm = window.confirm('Are you sure you want to end this practice session? Your progress will not be saved.')
    if (confirm) {
      setTimerActive(false)
      setTimeLeft(0)
      setStep('select')
      setStudentReasoning('')
      setAnalysis(null)
      setError('')
      setNotice('')
    }
  }

  const handleRandomCase = () => {
    const idx = Math.floor(Math.random() * LANDMARK_CASES.length)
    const c = LANDMARK_CASES[idx]
    setSelectedCaseId(c.id)
    setDifficulty(c.difficulty as 'Easy' | 'Medium' | 'Hard')
    setStep('config')
  }

  const resetSimulator = () => {
    abortRef.current?.abort()
    setSelectedCaseId('')
    setCustomCaseName('')
    setCustomScenarioInput('')
    setCustomQuestionInput('')
    setCustomCaseNameError('')
    setCustomScenarioInputError('')
    setCustomQuestionInputError('')
    setStudentReasoning('')
    setAnalysis(null)
    setReviewModeTab('student')
    setStep('select')
    setError('')
    setNotice('')
    setLoading(false)
    setTimerActive(false)
    setTimeLeft(0)
  }

  const filteredCases = useMemo(() => {
    return LANDMARK_CASES.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.summary.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = selectedCategory === 'All' || c.area === selectedCategory || c.subArea.includes(selectedCategory)
      
      const matchesDifficulty = selectedDifficulty === 'All' || 
                                c.difficulty.toLowerCase() === selectedDifficulty.toLowerCase() ||
                                (selectedDifficulty === 'Intermediate' && c.difficulty === 'Medium') ||
                                (selectedDifficulty === 'Beginner' && c.difficulty.toLowerCase().includes('beginner')) ||
                                (selectedDifficulty === 'Intermediate' && c.difficulty.toLowerCase().includes('medium'))
                                
      return matchesSearch && matchesCategory && matchesDifficulty
    })
  }, [selectedCategory, searchQuery, selectedDifficulty])

  // File download exporters
  const downloadJSON = () => {
    if (!analysis) return
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `LEGATRIXON_Lab_Report_${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const downloadTextFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const downloadMistakeAnalysis = () => {
    if (!analysis) return
    const lines = [
      `LEGATRIXON — Case Law Practice Lab Mistake Analysis`,
      `Case: ${analysis.caseNameOrProblem}`,
      `Date: ${formatDate(analysis.createdAt)}`,
      `Score: ${analysis.sections.performanceScore.finalScore}/100 (${analysis.sections.performanceScore.grade})`,
      '',
      '=== MISTAKES IDENTIFIED ===',
      ...analysis.sections.mistakes.map((m, i) => `${i + 1}. ${m}`),
      '',
      '=== WHAT TO IMPROVE ===',
      ...analysis.sections.learningRecommendations.whatToImprove.map((m, i) => `${i + 1}. ${m}`),
      '',
      "=== PROFESSOR'S COMMENTS ===",
      analysis.professorComments,
    ]
    downloadTextFile(`LEGATRIXON_Mistakes_${Date.now()}.txt`, lines.join('\n'))
  }

  const downloadProfessionalSolution = () => {
    if (!analysis) return
    const lines = [
      `LEGATRIXON — Case Law Practice Lab Model Solution`,
      `Case: ${analysis.caseNameOrProblem}`,
      `Date: ${formatDate(analysis.createdAt)}`,
      '',
      '=== PROFESSIONAL SOLUTION ===',
      analysis.sections.professionalSolution,
      '',
      '=== EXAM-READY ANSWER ===',
      analysis.sections.bestCaseReport.examReadyAnswer,
      '',
      '=== LEGAL PRINCIPLE ===',
      analysis.sections.bestCaseReport.legalPrinciple,
    ]
    downloadTextFile(`LEGATRIXON_Model_Solution_${Date.now()}.txt`, lines.join('\n'))
  }

  const downloadLearningNotes = () => {
    if (!analysis) return
    const rec = analysis.sections.learningRecommendations
    const simple = analysis.sections.simplifiedExplanation
    const lines = [
      `LEGATRIXON — Learning Notes`,
      `Case: ${analysis.caseNameOrProblem}`,
      `Date: ${formatDate(analysis.createdAt)}`,
      '',
      '=== WHAT YOU DID WELL ===',
      ...rec.whatStudentDidWell.map((m, i) => `${i + 1}. ${m}`),
      '',
      '=== WHAT TO IMPROVE ===',
      ...rec.whatToImprove.map((m, i) => `${i + 1}. ${m}`),
      '',
      '=== BARE ACTS TO REVISE ===',
      ...rec.relatedBareActs.map((m, i) => `${i + 1}. ${m}`),
      '',
      '=== SECTIONS TO STUDY ===',
      ...rec.relatedSections.map((m, i) => `${i + 1}. ${m}`),
      '',
      '=== CASES TO READ ===',
      ...rec.relatedCases.map((m, i) => `${i + 1}. ${m}`),
      '',
      '=== EXAM TIPS ===',
      simple.examTips,
      '',
      '=== RATIO DECIDENDI ===',
      simple.ratiodecidendi,
      '',
      '=== FLASHCARDS ===',
      ...rec.relatedFlashcards.map((m, i) => `${i + 1}. ${m}`),
      '',
      '=== RESEARCH TOPICS ===',
      ...rec.relatedResearchTopics.map((m, i) => `${i + 1}. ${m}`),
    ]
    downloadTextFile(`LEGATRIXON_Learning_Notes_${Date.now()}.txt`, lines.join('\n'))
  }

  const handleExportPDF = async () => {
    if (!analysis) return
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const margin = 48
      const width = 500
      let y = 54
      const addPageIfNeeded = (height = 80) => {
        if (y + height > 780) {
          doc.addPage()
          y = 54
        }
      }
      const writeBlock = (title: string, body: string | string[]) => {
        addPageIfNeeded(90)
        doc.setFont('Helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(31, 41, 55)
        doc.text(title, margin, y)
        y += 16
        doc.setFont('Helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(75, 85, 99)
        const content = Array.isArray(body) ? body.map(item => `- ${item}`).join('\n') : body
        const lines = doc.splitTextToSize(content || 'No details returned.', width)
        doc.text(lines, margin, y)
        y += lines.length * 12 + 18
      }

      doc.setFont('Helvetica', 'bold')
      doc.setFontSize(19)
      doc.setTextColor(17, 24, 39)
      doc.text('LEGATRIXON Case Law Practice Lab Evaluation', margin, y)
      y += 20
      doc.setFont('Helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(107, 114, 128)
      doc.text(`Case/Problem: ${analysis.caseNameOrProblem}`, margin, y)
      y += 14
      doc.text(`Generated: ${formatDate(analysis.createdAt)} | Final Score: ${analysis.sections.performanceScore.finalScore}/100 (Grade: ${analysis.sections.performanceScore.grade})`, margin, y)
      y += 22

      const ov = analysis.sections.caseOverview
      writeBlock('1. Case Overview', `Area of Law: ${ov.areaOfLaw}\nNature of Dispute: ${ov.natureOfDispute}\nKey Legal Issue: ${ov.keyLegalIssue}\nDifficulty: ${ov.difficultyLevel}`)

      sectionLabels.forEach(({ key, title }) => {
        const section = analysis.sections[key]
        writeBlock(title, `${section.summary}\n\nStrengths:\n${section.strengths.map(i => `- ${i}`).join('\n')}\n\nGaps:\n${section.gaps.map(i => `- ${i}`).join('\n')}\n\nSuggestions:\n${section.suggestions.map(i => `- ${i}`).join('\n')}`)
      })

      writeBlock('8. Mistake Analysis', analysis.sections.mistakes)
      writeBlock('9. AI Simplified Explanation', simplifiedExplanationLabels.map(({ key, label }) => `${label}: ${analysis.sections.simplifiedExplanation[key]}`).join('\n\n'))
      writeBlock('10. Professional Solution', analysis.sections.professionalSolution)
      writeBlock('11. Learning Feedback', [
        'What You Did Well:', ...analysis.sections.learningRecommendations.whatStudentDidWell,
        'What to Improve:', ...analysis.sections.learningRecommendations.whatToImprove,
        'Exam Tips:', analysis.sections.simplifiedExplanation.examTips,
      ])
      writeBlock('12. Performance Scorecard', scoreRows.map(([label, value]) => `${label}: ${value}/100`).concat(`Final Score: ${analysis.sections.performanceScore.finalScore}/100 | Grade: ${analysis.sections.performanceScore.grade}`))
      writeBlock("Professor's Comments", analysis.professorComments)
      doc.save('LEGATRIXON_Case_Law_Practice_Report.pdf')
    } catch {
      setError('Error exporting PDF report.')
    }
  }

  const toggleSection = (key: string) => {
    setExpandedSections(current => ({ ...current, [key]: !current[key] }))
  }

  // Active step values for progress path
  const currentStepNum = useMemo(() => {
    if (step === 'select' || step === 'config') return 1
    if (step === 'practice') return 2
    return 3
  }, [step])

  const wordCount = useMemo(() => {
    return studentReasoning.trim().split(/\s+/).filter(Boolean).length
  }, [studentReasoning])

  const getMistakeAnalysisData = () => {
    if (!analysis) return [];
    
    return [
      {
        area: "1. Issue Identification",
        student: studentReasoning.toLowerCase().includes('whether') ? "Framed specific issues in the answer." : "Did not frame issues as precise questions.",
        problem: analysis.sections.issueIdentification.gaps.join(' • ') || "Failing to frame the precise question limits legal clarity.",
        solution: analysis.sections.issueIdentification.suggestions.join(' • ') || "Frame issues clearly beginning with 'Whether...', defining the parties and the specific legal rules challenged."
      },
      {
        area: "2. Legal Accuracy",
        student: "Provisions and statutes referenced in your answer.",
        problem: analysis.sections.applicableLaw.gaps.join(' • ') || "Missing or misstated governing provisions/sections relevant to this case.",
        solution: analysis.sections.applicableLaw.suggestions.join(' • ') || "Cite the exact sections/articles of the governing act (e.g. Article 368, Section 125 CrPC) to establish the statutory foundation."
      },
      {
        area: "3. Application of Law",
        student: "Connecting rules to the hypothetical facts of the scenario.",
        problem: analysis.sections.legalReasoning.gaps.join(' • ') || "Failed to fully apply the legal tests or constituent rules to the hypothetical facts.",
        solution: analysis.sections.legalReasoning.suggestions.join(' @ ') || "Use the IRAC method. Take each element of the legal test, pair it directly with a fact from the scenario, and explain the legal outcome."
      },
      {
        area: "4. Use of Precedent",
        student: "Reference to landmark judgments and judicial observations.",
        problem: analysis.sections.caseLawAnalysis.gaps.join(' • ') || "Did not sufficiently ground the reasoning in the ratio decidendi of the landmark case.",
        solution: analysis.sections.caseLawAnalysis.suggestions.join(' • ') || "Identify the controlling precedent. Explain the ratio decidendi of that case and argue how the present hypothetical facts align with or distinguish from it."
      },
      {
        area: "5. Reasoning",
        student: "Logical structure and depth of the legal argument.",
        problem: analysis.sections.legalReasoning.gaps.slice(0, 2).join(' • ') || "The arguments are stated as absolute conclusions without supporting logic.",
        solution: "Analyze the arguments of both the petitioner and the respondent objectively. Answer the strongest points of the opposing counsel before concluding."
      },
      {
        area: "6. Conclusion",
        student: "The final holding and legal remedy proposed.",
        problem: "The conclusion is derived from generic instincts rather than statutory and judicial rules.",
        solution: "Ensure the conclusion is a direct, logical consequence of the rule application. Restate the final remedy clearly in line with the landmark precedent."
      }
    ];
  };

  return (
    <div className={`crs-container crs-${theme || 'dark'}`}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}><DemoUsageBadge feature="case_law_reasoning" /></div>
      
      {/* 3-Stage Progress Path */}
      <div className="crs-progress-path">
        <div className={`crs-progress-step ${currentStepNum === 1 ? 'active' : ''}`}>
          <span className="crs-step-num">①</span> Select Case
        </div>
        <div className="crs-progress-line"></div>
        <div className={`crs-progress-step ${currentStepNum === 2 ? 'active' : ''}`}>
          <span className="crs-step-num">②</span> Practice
        </div>
        <div className="crs-progress-line"></div>
        <div className={`crs-progress-step ${currentStepNum === 3 ? 'active' : ''}`}>
          <span className="crs-step-num">③</span> Review
        </div>
      </div>

      {/* Lab Header */}
      <div className="crs-header">
        <div>
          <span className="crs-eyebrow"><Scale size={14} /> Legatrixon Academy</span>
          <h2>Case Law Practice Lab</h2>
          <p>Choose a case. Face the facts. Build your legal reasoning.</p>
        </div>
        <div className="crs-header-actions">
          <button type="button" className="crs-secondary-btn" onClick={() => setShowHistoryModal(true)}>
            <History size={16} /> Practice History ({history.length})
          </button>
        </div>
      </div>

      {/* Messages */}
      {(error || notice) && (
        <div className={`crs-message ${error ? 'error' : 'success'}`}>
          {error ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          <span>{error || notice}</span>
          {error && /upgrade|limit|sample/i.test(error) && <a href="/pricing">View Plans</a>}
          <button type="button" className="crs-message-close" onClick={() => { setError(''); setNotice(''); }}>×</button>
        </div>
      )}

      {/* Main Workspace + Chatbot Grid */}
      <div className="crs-main-grid">
        <div className="crs-workspace-column">
          
          {/* STEP 1: Case Selection */}
          {step === 'select' && (
            <section className="crs-step-card">
              <div className="crs-panel-title">
                <FileText size={18} />
                <div>
                  <h3>Choose a Case to Practice</h3>
                  <p>Select a landmark case and test your understanding through a realistic legal problem.</p>
                </div>
              </div>

              {/* Filters & Search Row */}
              <div className="crs-search-filter-container">
                <div className="crs-search-wrap">
                  <Search size={16} className="crs-search-icon" />
                  <input
                    type="text"
                    className="crs-search-input"
                    placeholder="Search by case name, key issue or area..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                <button type="button" className="crs-action-btn crs-random-btn" onClick={handleRandomCase}>
                  <Sparkles size={16} /> Surprise Me (Random Case)
                </button>
              </div>

              <div className="crs-categories-row">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={`crs-category-tab ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="crs-categories-row" style={{ marginTop: '8px', borderTop: '1px solid rgba(212, 175, 55, 0.15)', paddingTop: '8px' }}>
                <span className="crs-difficulty-label" style={{ fontSize: '0.78rem', fontWeight: 800, color: '#d4af37', alignSelf: 'center', marginRight: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Difficulty:</span>
                {['All', 'Beginner', 'Intermediate', 'Advanced'].map(diff => (
                  <button
                    key={diff}
                    type="button"
                    className={`crs-category-tab ${selectedDifficulty === diff ? 'active' : ''}`}
                    onClick={() => setSelectedDifficulty(diff)}
                  >
                    {diff}
                  </button>
                ))}
              </div>

              {/* Landmark Cases Grid */}
              <div className="crs-cases-grid">
                {filteredCases.map(c => (
                  <div key={c.id} className="crs-case-item-card">
                    <div className="crs-case-item-header">
                      <h4>{c.name}</h4>
                      <span className={`crs-difficulty-tag ${c.difficulty.toLowerCase()}`}>
                        {c.difficulty}
                      </span>
                    </div>
                    <p className="crs-case-item-court">{c.court} • {c.year}</p>
                    <p className="crs-case-item-summary">{c.summary}</p>
                    <div className="crs-case-item-meta">
                      <span className="crs-case-item-area">{c.area}</span>
                      <button
                        type="button"
                        className="crs-action-btn compact"
                        onClick={() => {
                          setSelectedCaseId(c.id);
                          setDifficulty(c.difficulty as 'Easy' | 'Medium' | 'Hard');
                          setStep('config');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Practice Case
                      </button>
                    </div>
                  </div>
                ))}

                {/* Custom Case Card */}
                <div className="crs-case-item-card custom-case-card-opt">
                  <div className="crs-case-item-header">
                    <h4>Custom Legal Dispute</h4>
                    <span className="crs-difficulty-tag custom">Custom</span>
                  </div>
                  <p className="crs-case-item-court">Your Choice • Current Year</p>
                  <p className="crs-case-item-summary">Input your own case details, legal problem, or custom essay question to practice reasoning under the timer.</p>
                  <div className="crs-case-item-meta">
                    <span className="crs-case-item-area">Any Legal Field</span>
                    <button
                      type="button"
                      className="crs-secondary-btn compact"
                      onClick={() => {
                        setSelectedCaseId('custom');
                        setDifficulty('Medium');
                        setStep('config');
                        setCustomCaseNameError('');
                        setCustomScenarioInputError('');
                        setCustomQuestionInputError('');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Practice Custom
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* STEP 1.5: Practice Configuration Panel */}
          {step === 'config' && (
            <section className="crs-step-card">
              <div className="crs-panel-title">
                <Sliders size={18} />
                <div>
                  <h3>Set Up Your Practice</h3>
                  <p>Configure the exam constraints and question archetype for the selected case.</p>
                </div>
              </div>

              <div className="crs-config-details-banner">
                <div>
                  <span className="crs-config-label">Target Case</span>
                  <h4>{selectedCaseId === 'custom' ? 'Custom Scenario' : LANDMARK_CASES.find(c => c.id === selectedCaseId)?.name}</h4>
                </div>
                <button type="button" className="crs-text-btn" onClick={() => setStep('select')}>
                  <ArrowLeft size={14} /> Change Case
                </button>
              </div>

              {selectedCaseId === 'custom' && (
                <div className="crs-custom-fields-group">
                  <div className="crs-input-group">
                    <label htmlFor="custom-case-name" className="crs-label">Case or Dispute Name</label>
                    <input
                      id="custom-case-name"
                      type="text"
                      className={`crs-input-text ${customCaseNameError ? 'has-error' : ''}`}
                      placeholder="e.g. State of Madras v. Champakam Dorairajan"
                      value={customCaseName}
                      onChange={e => {
                        setCustomCaseName(e.target.value)
                        if (e.target.value.trim()) setCustomCaseNameError('')
                      }}
                    />
                    {customCaseNameError && <span className="crs-input-error-msg">{customCaseNameError}</span>}
                  </div>
                  <div className="crs-input-group">
                    <label htmlFor="custom-scenario-input" className="crs-label">Factual Scenario</label>
                    <textarea
                      id="custom-scenario-input"
                      className={`crs-textarea custom-box ${customScenarioInputError ? 'has-error' : ''}`}
                      placeholder="Present the material facts of the legal problem here..."
                      value={customScenarioInput}
                      onChange={e => {
                        setCustomScenarioInput(e.target.value)
                        if (e.target.value.trim()) setCustomScenarioInputError('')
                      }}
                    />
                    {customScenarioInputError && <span className="crs-input-error-msg">{customScenarioInputError}</span>}
                  </div>
                  <div className="crs-input-group">
                    <label htmlFor="custom-question-input" className="crs-label">Specific Practice Question</label>
                    <textarea
                      id="custom-question-input"
                      className={`crs-textarea custom-box ${customQuestionInputError ? 'has-error' : ''}`}
                      placeholder="Enter the specific exam question or legal problem the student must analyse..."
                      value={customQuestionInput}
                      onChange={e => {
                        setCustomQuestionInput(e.target.value)
                        if (e.target.value.trim()) setCustomQuestionInputError('')
                      }}
                    />
                    {customQuestionInputError && <span className="crs-input-error-msg">{customQuestionInputError}</span>}
                  </div>
                </div>
              )}

              <div className="crs-config-grid">
                <div className="crs-config-group">
                  <span className="crs-label">Difficulty Level</span>
                  <div className="crs-radio-toggle-row">
                    {(['Easy', 'Medium', 'Hard'] as const).map(d => (
                      <button
                        key={d}
                        type="button"
                        className={`crs-toggle-pill ${difficulty === d ? 'active' : ''}`}
                        onClick={() => setDifficulty(d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="crs-config-group">
                  <span className="crs-label">Question Archetype</span>
                  <div className="crs-radio-toggle-row wrap">
                    {(['Case Analysis', 'Issue Spotting', 'Judgment Analysis', 'Application Based'] as const).map(q => (
                      <button
                        key={q}
                        type="button"
                        className={`crs-toggle-pill ${questionType === q ? 'active' : ''}`}
                        onClick={() => setQuestionType(q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="crs-config-group">
                  <span className="crs-label">Session Timer</span>
                  <div className="crs-radio-toggle-row wrap">
                    {TIMER_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        className={`crs-toggle-pill ${timerOption === opt ? 'active' : ''}`}
                        onClick={() => setTimerOption(opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  {timerOption === 'Custom' && (
                    <div className="crs-custom-timer-field">
                      <input
                        type="number"
                        className="crs-input-text compact-input"
                        placeholder="Minutes"
                        min="1"
                        max="240"
                        value={customTimerValue}
                        onChange={e => setCustomTimerValue(e.target.value)}
                      />
                      <span className="crs-input-hint">minutes</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="crs-action-row" style={{ marginTop: '24px' }}>
                <button type="button" className="crs-action-btn large-btn" onClick={handleStartPractice}>
                  <PlayIcon /> Start Practice
                </button>
                <button type="button" className="crs-secondary-btn" onClick={() => setStep('select')}>
                  Back
                </button>
              </div>
            </section>
          )}

          {/* STEP 2: Active Exam/Practice Mode */}
          {step === 'practice' && (
            <section className="crs-step-card practice-mode-active">
              
              {/* Sticky Timer Banner */}
              <div className={`crs-timer-sticky ${timeLeft <= 120 ? 'timer-urgent' : ''}`}>
                <div className="crs-timer-wrapper">
                  <Clock size={18} className={timeLeft <= 120 ? 'timer-icon-alert' : ''} />
                  <span className="crs-timer-val">{formatTimeLeft(timeLeft)}</span>
                  <span className="crs-timer-lbl">REMAINING</span>
                </div>
                <div className="crs-timer-meta">
                  <span>{questionType}</span>
                  <span className="crs-divider-pipe">|</span>
                  <span>Difficulty: {difficulty}</span>
                </div>
              </div>

              <div className="crs-practice-heading-area">
                <span className="crs-eyebrow">ACTIVE PRACTICE</span>
                <h3>{selectedCaseId === 'custom' ? customCaseName : LANDMARK_CASES.find(c => c.id === selectedCaseId)?.name}</h3>
              </div>

              {/* Scenario Box */}
              <div className="crs-scenario-container">
                <h5>FACTUAL SCENARIO</h5>
                <p className="crs-scenario-text">{activeQuestion.scenario}</p>
                <div className="crs-question-box">
                  <strong>QUESTION:</strong>
                  <p>{activeQuestion.question}</p>
                </div>
              </div>

              {/* Redesigned Professional Legal Examination Answer Sheet */}
              <div className="crs-legal-editor-wrapper" style={{ marginTop: '28px', border: '1px solid var(--line)', borderRadius: '12px', background: '#080d1a', padding: '24px', position: 'relative' }}>
                
                {/* Header */}
                <div className="crs-editor-container-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div className="crs-editor-header-left">
                    <h4 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--gold)', fontWeight: 800, letterSpacing: '0.05em' }}>YOUR LEGAL ANSWER</h4>
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-soft)' }}>
                      Write your answer as you would in a law-school examination.
                    </p>
                    <div style={{ marginTop: '10px', fontSize: '0.82rem', display: 'flex', flexWrap: 'wrap', gap: '16px', color: 'var(--text-soft)' }}>
                      <span><strong>Case:</strong> {selectedCaseId === 'custom' ? customCaseName : LANDMARK_CASES.find(c => c.id === selectedCaseId)?.name}</span>
                      <span><strong>Question Type:</strong> {questionType}</span>
                    </div>
                  </div>
                  <div className="crs-editor-header-right" style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" className="crs-secondary-btn compact" onClick={handleSaveDraft} disabled={isTimeUp || loading}>
                      Save Draft
                    </button>
                    <button type="button" className="crs-secondary-btn compact" onClick={() => setShowStructureGuide(!showStructureGuide)}>
                      {showStructureGuide ? 'Hide Structure Guide' : 'Show Structure Guide'}
                    </button>
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid rgba(245, 193, 79, 0.15)', margin: '18px 0' }} />

                {/* Collapsible Answer Structure Guide */}
                {showStructureGuide && (
                  <div className="crs-editor-structure-guide" style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px dashed rgba(245, 193, 79, 0.25)', borderRadius: '8px', padding: '16px', marginBottom: '18px' }}>
                    <div className="crs-structure-guide-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--gold)', letterSpacing: '0.05em' }}>ANSWER STRUCTURE GUIDE</span>
                      <button type="button" className="crs-text-btn" style={{ fontSize: '0.78rem', color: 'var(--text-soft)', border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => setShowStructureGuide(false)}>
                        [ Hide Structure Guide ]
                      </button>
                    </div>
                    <div className="crs-structure-guide-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                      {[
                        { num: '01', name: 'Material Facts' },
                        { num: '02', name: 'Legal Issues' },
                        { num: '03', name: 'Applicable Law' },
                        { num: '04', name: 'Arguments' },
                        { num: '05', name: 'Legal Analysis' },
                        { num: '06', name: 'Counter-Arguments' },
                        { num: '07', name: 'Conclusion' }
                      ].map(item => (
                        <div key={item.num} className="crs-structure-guide-item" style={{ display: 'flex', flexDirection: 'column', padding: '8px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                          <span className="crs-guide-num" style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--gold)', opacity: 0.8 }}>{item.num}</span>
                          <span className="crs-guide-name" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', marginTop: '2px' }}>{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Minimal Formatting Toolbar */}
                <div className="crs-editor-toolbar" style={{ display: 'flex', gap: '6px', padding: '8px 12px', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--line)', borderBottom: 'none', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" className="crs-toolbar-btn" style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '4px 10px', fontSize: '0.85rem', fontWeight: 800 }} title="Bold" onClick={() => insertFormatting('bold')} disabled={isTimeUp || loading}>B</button>
                  <button type="button" className="crs-toolbar-btn" style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '4px 10px', fontSize: '0.85rem', fontStyle: 'italic' }} title="Italic" onClick={() => insertFormatting('italic')} disabled={isTimeUp || loading}>I</button>
                  <button type="button" className="crs-toolbar-btn" style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '4px 10px', fontSize: '0.85rem', textDecoration: 'underline' }} title="Underline" onClick={() => insertFormatting('underline')} disabled={isTimeUp || loading}>U</button>
                  <span style={{ color: 'var(--line)', margin: '0 4px' }}>|</span>
                  <button type="button" className="crs-toolbar-btn" style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '4px 8px', fontSize: '0.85rem', fontWeight: 700 }} title="Heading" onClick={() => insertFormatting('heading')} disabled={isTimeUp || loading}>H</button>
                  <button type="button" className="crs-toolbar-btn" style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '4px 8px', fontSize: '0.85rem' }} title="Bullet List" onClick={() => insertFormatting('bullet')} disabled={isTimeUp || loading}>•</button>
                  <button type="button" className="crs-toolbar-btn" style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '4px 8px', fontSize: '0.85rem' }} title="Numbered List" onClick={() => insertFormatting('number')} disabled={isTimeUp || loading}>1.</button>
                  <button type="button" className="crs-toolbar-btn" style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '4px 8px', fontSize: '0.85rem' }} title="Blockquote" onClick={() => insertFormatting('quote')} disabled={isTimeUp || loading}>Quote</button>
                  <span style={{ color: 'var(--line)', margin: '0 4px' }}>|</span>
                  <button type="button" className="crs-toolbar-btn" style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '4px 8px', fontSize: '0.8rem', opacity: historyPointer <= 0 ? 0.4 : 1 }} title="Undo" onClick={handleUndo} disabled={historyPointer <= 0 || isTimeUp || loading}>Undo</button>
                  <button type="button" className="crs-toolbar-btn" style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '4px 8px', fontSize: '0.8rem', opacity: historyPointer >= historyStack.length - 1 ? 0.4 : 1 }} title="Redo" onClick={handleRedo} disabled={historyPointer >= historyStack.length - 1 || isTimeUp || loading}>Redo</button>
                </div>

                {/* Actual Writing Area Sheet */}
                <div className="crs-editor-sheet-container" style={{ position: 'relative', width: '100%', minHeight: '520px', background: '#060a14', border: '1px solid var(--line)', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
                  
                  {/* Empty state centered overlay */}
                  {!studentReasoning && !editorFocused && (
                    <div className="crs-editor-empty-state" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', width: '80%', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                      <span className="crs-empty-state-title" style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gold)', opacity: 0.9 }}>
                        Your legal answer starts here.
                      </span>
                      <span className="crs-empty-state-subtitle" style={{ fontSize: '0.85rem', color: 'var(--text-soft)', lineHeight: 1.5, opacity: 0.8 }}>
                        Build your response like a law student:<br />
                        identify the issue → state the law → apply the precedent → conclude.
                      </span>
                    </div>
                  )}

                  <textarea
                    ref={textareaRef}
                    id="student-answer-editor"
                    className="crs-textarea legal-exam-editor"
                    style={{
                      width: '100%',
                      minHeight: '520px',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--text)',
                      fontFamily: 'inherit',
                      fontSize: '16px',
                      lineHeight: '1.75',
                      padding: '24px',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Start writing your legal analysis... Identify the issues, apply the relevant law, analyse the precedent, and reach a reasoned conclusion."
                    value={studentReasoning}
                    onChange={e => setStudentReasoning(e.target.value)}
                    onFocus={() => setEditorFocused(true)}
                    onBlur={() => setEditorFocused(false)}
                    disabled={isTimeUp || loading}
                  />
                </div>

                {/* Bottom Stats & Actions Area */}
                <div className="crs-editor-bottom-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '14px' }}>
                  <div className="crs-editor-bottom-left" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-soft)' }}>
                    <span>Words: <strong>{wordCount}</strong></span>
                    <span style={{ opacity: 0.4 }}>|</span>
                    <span>Characters: <strong>{studentReasoning.length}</strong></span>
                    <span style={{ opacity: 0.4 }}>|</span>
                    <span style={{ color: 'var(--gold)' }}>
                      {difficulty === 'Advanced' ? 'Recommended: 800-1200 words' : difficulty === 'Medium' || difficulty === 'Intermediate' ? 'Recommended: 600-900 words' : 'Recommended: 400-600 words'}
                    </span>
                    <span style={{ opacity: 0.4 }}>|</span>
                    <span style={{ color: wordCount >= 200 ? 'var(--ok)' : '#ffab00', fontWeight: 'bold' }}>
                      {wordCount >= 200 ? 'Good answer length' : 'Keep developing your legal reasoning.'}
                    </span>
                    <span style={{ opacity: 0.4 }}>|</span>
                    <span style={{ fontStyle: 'italic', color: autosaveStatus === 'saving' ? 'var(--gold)' : 'var(--text-soft)' }}>
                      {autosaveStatus === 'saving' ? 'Saving...' : 'Saved just now'}
                    </span>
                  </div>

                  <div className="crs-editor-bottom-right" style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" className="crs-secondary-btn" onClick={handleSaveDraft} disabled={isTimeUp || loading} style={{ border: '1px solid var(--line)', background: 'transparent' }}>
                      Save Draft
                    </button>
                    <button type="button" className="crs-secondary-btn" onClick={handleClearAnswer} disabled={isTimeUp || loading} style={{ color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.25)', background: 'transparent' }}>
                      Clear Answer
                    </button>
                    <button type="button" className="crs-action-btn submit-exam-btn" onClick={handleAnalyze} disabled={loading} style={{ background: 'var(--gold)', color: 'var(--bg)', fontWeight: 'bold', border: '1px solid var(--gold)' }}>
                      {loading ? <RotateCcw size={16} className="crs-spin" style={{ marginRight: '6px' }} /> : <CheckCircle size={16} style={{ marginRight: '6px' }} />}
                      {loading ? 'Evaluating...' : isTimeUp ? 'Submit Locked Answer' : 'Submit Answer'}
                    </button>
                  </div>
                </div>

              </div>
            </section>
          )}

          {/* STEP 3: Submitted & Choice Screen */}
          {step === 'submitted' && analysis && (
            <section className="crs-step-card evaluation-summary-card">
              <div className="crs-summary-banner">
                <CheckCircle size={40} className="crs-success-icon-giant" />
                <div>
                  <span className="crs-eyebrow">STAGE 3</span>
                  <h3>Practice Complete</h3>
                  <p>Your attempt has been submitted and reviewed by the AI Professor.</p>
                </div>
              </div>

              {/* Performance Scores Row */}
              <div className="crs-score-hero-summary">
                <div className="crs-score-stat-group">
                  <div className="crs-score-badge-circle">
                    <span className="crs-circle-score-val">{analysis.sections.performanceScore.finalScore}</span>
                    <span className="crs-circle-score-lbl">Score</span>
                  </div>
                  <div className="crs-score-badge-circle grade-circle">
                    <span className="crs-circle-score-val">{analysis.sections.performanceScore.grade}</span>
                    <span className="crs-circle-score-lbl">Grade</span>
                  </div>
                </div>
                <div className="crs-exam-stats-details">
                  <div className="crs-exam-stat-item">
                    <span className="crs-stat-label">Words Written</span>
                    <strong className="crs-stat-val">{wordCount}</strong>
                  </div>
                  <div className="crs-exam-stat-item">
                    <span className="crs-stat-label">Time Limit Set</span>
                    <strong className="crs-stat-val">
                      {timerOption === 'Custom' ? `${customTimerValue} min` : timerOption}
                    </strong>
                  </div>
                  <div className="crs-exam-stat-item font-gold">
                    <span className="crs-stat-label">Feedback Verdict</span>
                    <strong className="crs-stat-val font-gold">{analysis.sections.performanceScore.finalScore >= 75 ? 'Pass with Honors' : 'Completed'}</strong>
                  </div>
                </div>
              </div>

              {/* Professor comments */}
              <div className="crs-professor-verdict-box">
                <h5><TrendingUp size={16} /> PROFESSOR'S FEEDBACK</h5>
                <p>"{analysis.professorComments}"</p>
              </div>

              {/* Review Option Choices */}
              <div className="crs-review-options-grid">
                <div className="crs-review-option-card">
                  <div className="crs-option-icon-wrap"><Sparkles size={20} /></div>
                  <h4>⚡ QUICK ANSWER</h4>
                  <p>See the complete model answer, primary legal ratios, and final conclusions in one consolidated view.</p>
                  <button
                    type="button"
                    className="crs-action-btn"
                    onClick={() => {
                      setStep('review-quick');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    View Quick Answer
                  </button>
                </div>

                <div className="crs-review-option-card">
                  <div className="crs-option-icon-wrap"><GraduationCap size={20} /></div>
                  <h4>🧠 STEP-BY-STEP REVIEW</h4>
                  <p>Learn how the answer is structured. Work through facts, issues, laws, arguments, and conclusions step-by-step.</p>
                  <button
                    type="button"
                    className="crs-secondary-btn"
                    style={{ borderColor: 'var(--gold)' }}
                    onClick={() => {
                      setStep('review-step');
                      setReviewStepIndex(0);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Start Step-by-Step Review
                  </button>
                </div>
              </div>

              <div className="crs-action-row" style={{ marginTop: '28px', borderTop: '1px solid var(--line)', paddingTop: '18px' }}>
                <button type="button" className="crs-secondary-btn" onClick={resetSimulator}>
                  Practice Another Case
                </button>
              </div>
            </section>
          )}

          {/* STEP 3.A: Quick Review Mode */}
          {step === 'review-quick' && analysis && (
            <section className="crs-step-card quick-review-card">
              <div className="crs-review-header-row">
                <button type="button" className="crs-text-btn" onClick={() => setStep('submitted')}>
                  <ArrowLeft size={16} /> Back to Summary
                </button>
                <h3>Model Answer Review</h3>
              </div>

              {/* Exporters Row */}
              <div className="crs-export-row" style={{ marginBottom: '18px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button type="button" className="crs-secondary-btn" onClick={() => setReviewModeTab('model')}>
                  <Sparkles size={14} style={{ marginRight: '6px' }} /> AI Model Solution
                </button>
                <button type="button" className="crs-secondary-btn" onClick={() => setReviewModeTab('mistakes')}>
                  <AlertTriangle size={14} style={{ marginRight: '6px' }} /> Mistake Analysis
                </button>
                <button type="button" className="crs-secondary-btn" onClick={handleExportPDF}>
                  <Download size={14} style={{ marginRight: '6px' }} /> Export PDF
                </button>
                <button type="button" className="crs-secondary-btn" onClick={saveAnalysis} disabled={saving || analysis.status === 'saved'}>
                  <Save size={14} style={{ marginRight: '6px' }} /> {analysis.status === 'saved' ? 'Saved' : saving ? 'Saving...' : 'Save Attempt'}
                </button>
              </div>

              {/* Segmented Control */}
              <div className="crs-segmented-control" style={{ marginBottom: '20px' }}>
                <button type="button" className={`crs-segmented-btn ${reviewModeTab === 'student' ? 'active' : ''}`} onClick={() => setReviewModeTab('student')}>
                  YOUR ANSWER REVIEW
                </button>
                <button type="button" className={`crs-segmented-btn ${reviewModeTab === 'mistakes' ? 'active' : ''}`} onClick={() => setReviewModeTab('mistakes')}>
                  MISTAKE ANALYSIS
                </button>
                <button type="button" className={`crs-segmented-btn ${reviewModeTab === 'model' ? 'active' : ''}`} onClick={() => setReviewModeTab('model')}>
                  AI MODEL SOLUTION
                </button>
              </div>

              {/* Tab selector between analysis and case reports */}
              <div className="crs-report-switch" style={{ marginBottom: '20px' }}>
                <button type="button" className={`crs-report-mode-btn ${reportMode === 'analysis' ? 'active' : ''}`} onClick={() => setReportMode('analysis')}>
                  AI Assessment Report
                </button>
                <button type="button" className={`crs-report-mode-btn ${reportMode === 'case' ? 'active' : ''}`} onClick={() => setReportMode('case')}>
                  Landmark Case Analysis
                </button>
              </div>

              {reportMode === 'analysis' && reviewModeTab === 'student' && (
                <div className="crs-quick-review-layout">
                  {/* KEY TAKEAWAY FOR EXAMS */}
                  <div className="crs-takeaway-banner" style={{ marginBottom: '20px' }}>
                    <h5>KEY TAKEAWAY FOR EXAMS</h5>
                    <p>{analysis.sections.simplifiedExplanation.examTips}</p>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--gold)', fontWeight: 850, letterSpacing: '0.04em', textTransform: 'uppercase' }}>YOUR ANSWER REVIEW</h4>
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-soft)', fontStyle: 'italic' }}>"Review your reasoning, identify gaps, and understand where your answer can improve."</p>
                  </div>

                  {/* YOUR SUBMITTED ANSWER */}
                  <article className="crs-student-answer-section" style={{ marginTop: '20px', border: '1px solid var(--line)', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.15)', padding: '24px' }}>
                    <h4 style={{ margin: '0 0 12px', fontSize: '1.1rem', color: 'var(--gold)', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>YOUR SUBMITTED ANSWER</h4>
                    <div style={{ fontSize: '0.92rem', lineHeight: '1.6', color: 'var(--text-soft)', whiteSpace: 'pre-wrap', fontStyle: 'italic', background: 'rgba(0,0,0,0.1)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                      "{studentReasoning}"
                    </div>
                  </article>

                  {/* PROFESSOR'S REVIEW */}
                  <article className="crs-professor-review-section" style={{ marginTop: '24px' }}>
                    <h4 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: 'var(--gold)', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>PROFESSOR'S REVIEW</h4>
                    <div className="crs-comparison-card-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                      <div className="crs-comparison-box correct-box" style={{ padding: '16px', border: '1px solid rgba(52, 211, 153, 0.25)', background: 'rgba(16, 185, 129, 0.02)', borderRadius: '8px' }}>
                        <div className="crs-comp-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 800, fontSize: '0.85rem', borderBottom: '1px solid var(--line)', paddingBottom: '8px', marginBottom: '10px' }}>
                          <Check size={16} /> Correct Concepts Identified
                        </div>
                        <ul className="crs-bullet-list" style={{ margin: 0, paddingLeft: '18px', fontSize: '0.84rem', lineHeight: '1.5', color: 'var(--text-soft)' }}>
                          {analysis.sections.understandingOfFacts.strengths.concat(
                            analysis.sections.issueIdentification.strengths,
                            analysis.sections.applicableLaw.strengths
                          ).map((s, idx) => (
                            <li key={idx} style={{ marginBottom: '6px' }}>{s}</li>
                          ))}
                          {analysis.sections.understandingOfFacts.strengths.length === 0 && <li>No specific concepts identified in strengths.</li>}
                        </ul>
                      </div>

                      <div className="crs-comparison-box missing-box" style={{ padding: '16px', border: '1px solid rgba(251, 146, 60, 0.25)', background: 'rgba(249, 115, 22, 0.02)', borderRadius: '8px' }}>
                        <div className="crs-comp-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fb923c', fontWeight: 800, fontSize: '0.85rem', borderBottom: '1px solid var(--line)', paddingBottom: '8px', marginBottom: '10px' }}>
                          <AlertTriangle size={16} /> Missing Concepts / Gaps
                        </div>
                        <ul className="crs-bullet-list" style={{ margin: 0, paddingLeft: '18px', fontSize: '0.84rem', lineHeight: '1.5', color: 'var(--text-soft)' }}>
                          {analysis.sections.understandingOfFacts.gaps.concat(
                            analysis.sections.issueIdentification.gaps,
                            analysis.sections.applicableLaw.gaps
                          ).map((g, idx) => (
                            <li key={idx} style={{ marginBottom: '6px' }}>{g}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="crs-comparison-box incorrect-box" style={{ padding: '16px', border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.02)', borderRadius: '8px' }}>
                        <div className="crs-comp-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontWeight: 800, fontSize: '0.85rem', borderBottom: '1px solid var(--line)', paddingBottom: '8px', marginBottom: '10px' }}>
                          <X size={16} /> Incorrect Reasoning
                        </div>
                        <ul className="crs-bullet-list" style={{ margin: 0, paddingLeft: '18px', fontSize: '0.84rem', lineHeight: '1.5', color: 'var(--text-soft)' }}>
                          {analysis.sections.mistakes.map((m, idx) => (
                            <li key={idx} style={{ marginBottom: '6px' }}>{m}</li>
                          ))}
                          {analysis.sections.mistakes.length === 0 && <li>No significant logical errors detected.</li>}
                        </ul>
                      </div>

                      <div className="crs-comparison-box improve-box" style={{ padding: '16px', border: '1px solid rgba(245, 193, 79, 0.25)', background: 'rgba(245, 193, 79, 0.02)', borderRadius: '8px' }}>
                        <div className="crs-comp-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--gold)', fontWeight: 800, fontSize: '0.85rem', borderBottom: '1px solid var(--line)', paddingBottom: '8px', marginBottom: '10px' }}>
                          <Sparkles size={16} /> Areas to Improve
                        </div>
                        <ul className="crs-bullet-list" style={{ margin: 0, paddingLeft: '18px', fontSize: '0.84rem', lineHeight: '1.5', color: 'var(--text-soft)' }}>
                          {analysis.sections.learningRecommendations.whatToImprove.map((w, idx) => (
                            <li key={idx} style={{ marginBottom: '6px' }}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </article>

                  {/* EXAM MISTAKES & MISCONCEPTIONS */}
                  {analysis.sections.mistakes.length > 0 && (
                    <article className="crs-mistakes-block-quick" style={{ marginTop: '24px' }}>
                      <h4 style={{ margin: '0 0 12px', fontSize: '1.1rem', color: '#f87171', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>EXAM MISTAKES & MISCONCEPTIONS</h4>
                      <ul className="crs-bullet-mistakes" style={{ margin: 0, paddingLeft: '18px', fontSize: '0.88rem', color: '#f87171', lineHeight: '1.5' }}>
                        {analysis.sections.mistakes.map((m, idx) => (
                          <li key={idx} style={{ marginBottom: '6px' }}>{m}</li>
                        ))}
                      </ul>
                    </article>
                  )}

                  {/* FINAL TAKEAWAY */}
                  <article className="crs-final-takeaway" style={{ marginTop: '24px', borderTop: '1px dashed var(--line)', paddingTop: '20px' }}>
                    <h5 style={{ margin: '0 0 6px', fontSize: '0.9rem', color: 'var(--gold)', fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' }}>FINAL TAKEAWAY</h5>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>"What should you remember from this case?"</p>
                    <div style={{ background: 'rgba(245, 193, 79, 0.03)', border: '1px solid rgba(245, 193, 79, 0.15)', borderRadius: '8px', padding: '16px' }}>
                      <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: '1.55', color: 'var(--text)' }}>
                        <strong>Core Principle:</strong> {analysis.sections.bestCaseReport.legalPrinciple}
                      </p>
                      <p style={{ margin: '10px 0 0 0', fontSize: '0.92rem', lineHeight: '1.55', color: 'var(--text-soft)' }}>
                        <strong>Practical Application:</strong> {analysis.sections.simplifiedExplanation.practicalApplication}
                      </p>
                    </div>
                  </article>
                </div>
              )}

              {reportMode === 'analysis' && reviewModeTab === 'mistakes' && (
                <div className="crs-quick-review-layout">
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: 0, fontSize: '1.2rem', color: '#f87171', fontWeight: 850, letterSpacing: '0.04em', textTransform: 'uppercase' }}>MISTAKE ANALYSIS</h4>
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-soft)', fontStyle: 'italic' }}>"Analyze specific gaps in your legal reasoning across core practice areas."</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {getMistakeAnalysisData().map((item, idx) => (
                      <div key={idx} style={{ border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.015)', padding: '20px' }}>
                        <h5 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 850, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{item.area}</h5>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div>
                            <strong style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>WHAT YOU WROTE</strong>
                            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text)', fontStyle: 'italic' }}>"{item.student}"</p>
                          </div>
                          <div style={{ borderLeft: '3px solid #f87171', paddingLeft: '12px', margin: '4px 0' }}>
                            <strong style={{ display: 'block', fontSize: '0.72rem', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>PROBLEM / WHY IT IS A PROBLEM</strong>
                            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-soft)' }}>{item.problem || "No major issues noted in this category."}</p>
                          </div>
                          <div style={{ borderLeft: '3px solid var(--gold)', paddingLeft: '12px', margin: '4px 0' }}>
                            <strong style={{ display: 'block', fontSize: '0.72rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>BETTER APPROACH / HOW TO IMPROVE IT</strong>
                            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text)' }}>{item.solution}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reportMode === 'analysis' && reviewModeTab === 'model' && (
                <div className="crs-quick-review-layout">
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--gold)', fontWeight: 850, letterSpacing: '0.04em', textTransform: 'uppercase' }}>AI MODEL SOLUTION</h4>
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-soft)', fontStyle: 'italic' }}>"How a lawyer would answer this problem"</p>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--line)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase' }}>CASE</span>
                    <h5 style={{ margin: '2px 0 10px', fontSize: '1.05rem', color: 'var(--gold)', fontWeight: 800 }}>{selectedCaseId === 'custom' ? customCaseName : LANDMARK_CASES.find(c => c.id === selectedCaseId)?.name}</h5>
                    
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-soft)', textTransform: 'uppercase' }}>PRACTICE QUESTION</span>
                    <p style={{ margin: '2px 0 0', fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--text)' }}>{activeQuestion.question}</p>
                  </div>

                  <article className="crs-model-answer-section" style={{ border: '1px solid var(--line)', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.015)', padding: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {[
                        { label: 'ISSUE', content: analysis.sections.modelLegalAnswer?.issue },
                        { label: 'MATERIAL FACTS AND ASSUMPTIONS', content: analysis.sections.modelLegalAnswer?.materialFacts },
                        { label: 'LEGAL FRAMEWORK', content: analysis.sections.modelLegalAnswer?.legalFramework },
                        { label: 'APPLICATION OF PRECEDENT', content: analysis.sections.modelLegalAnswer?.precedentApplication },
                        { label: 'PETITIONER\'S CASE', content: analysis.sections.modelLegalAnswer?.petitionerCase },
                        { label: 'RESPONDENT\'S CASE', content: analysis.sections.modelLegalAnswer?.respondentCase },
                        { label: 'REBUTTAL AND COUNTER-ARGUMENT', content: analysis.sections.modelLegalAnswer?.rebuttal },
                        { label: 'LIKELY JUDICIAL APPROACH', content: analysis.sections.modelLegalAnswer?.likelyJudicialApproach },
                        { label: 'CONCLUSION', content: analysis.sections.modelLegalAnswer?.conclusion },
                        ...(analysis.sections.modelLegalAnswer?.remedyRelief ? [{ label: 'REMEDY / RELIEF', content: analysis.sections.modelLegalAnswer.remedyRelief }] : []),
                        { label: 'EXAM TAKEAWAY', content: analysis.sections.modelLegalAnswer?.examTakeaway }
                      ].map((sec, i) => (
                        <div key={i} style={{ borderLeft: '3px solid var(--gold)', paddingLeft: '14px', margin: '4px 0' }}>
                          <strong style={{ display: 'block', fontSize: '0.78rem', color: 'var(--gold)', letterSpacing: '0.05em', marginBottom: '4px' }}>{sec.label}</strong>
                          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.55', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{sec.content || 'Not evaluated.'}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              )}

              {reportMode === 'case' && (
                <div className="crs-case-report-view">
                  <div className="crs-case-report-hero">
                    <div>
                      <span className="crs-eyebrow"><FileText size={14} /> AI Case Report</span>
                      <h4>{analysis.sections.bestCaseReport.title}</h4>
                      <p>{analysis.sections.bestCaseReport.introduction}</p>
                    </div>
                    <div className="crs-model-grade">
                      <span>Excellent</span>
                      <small>Target Quality</small>
                    </div>
                  </div>

                  <article className="crs-report-card professional">
                    <div className="crs-case-section-head" style={{ padding: '12px' }}><span>Exam-Ready Best Answer</span></div>
                    <div className="crs-model-box" style={{ margin: '12px' }}>{analysis.sections.bestCaseReport.examReadyAnswer}</div>
                  </article>

                  <div className="crs-case-analysis-grid">
                    <article className="crs-case-analysis-card"><h4>Material Facts</h4><ul>{renderList(analysis.sections.bestCaseReport.facts)}</ul></article>
                    <article className="crs-case-analysis-card"><h4>Issues</h4><ul>{renderList(analysis.sections.bestCaseReport.issues)}</ul></article>
                    <article className="crs-case-analysis-card"><h4>Applicable Law</h4><ul>{renderList(analysis.sections.bestCaseReport.applicableLaw)}</ul></article>
                    <article className="crs-case-analysis-card"><h4>Case Law</h4><ul>{renderList(analysis.sections.bestCaseReport.caseLaw)}</ul></article>
                  </div>

                  <article className="crs-report-card professional">
                    <div className="crs-case-section-head" style={{ padding: '12px' }}><span>AI's Own Case Analysis</span></div>
                    <div className="crs-model-box" style={{ margin: '12px' }}>{analysis.sections.bestCaseReport.analysis}</div>
                  </article>

                  <div className="crs-case-report-grid">
                    <article className="crs-report-card learning" style={{ padding: '12px' }}>
                      <div className="crs-case-section-head"><span>Counter Arguments</span></div>
                      <ul className="crs-case-result-list">{renderList(analysis.sections.bestCaseReport.counterArguments)}</ul>
                    </article>

                    <article className="crs-report-card score-summary" style={{ padding: '12px' }}>
                      <div className="crs-score-summary-head"><TrendingUp size={18} /><span>Conclusion and Legal Principle</span></div>
                      <div className="crs-case-principle-box">
                        <h4>Conclusion</h4>
                        <p>{analysis.sections.bestCaseReport.conclusion}</p>
                        <h4>Legal Principle</h4>
                        <p>{analysis.sections.bestCaseReport.legalPrinciple}</p>
                        <h4>Ratio Decidendi</h4>
                        <p>{analysis.sections.simplifiedExplanation.ratiodecidendi}</p>
                      </div>
                    </article>
                  </div>
                </div>
              )}

              <div className="crs-action-row" style={{ marginTop: '24px', borderTop: '1px solid var(--line)', paddingTop: '18px' }}>
                <button type="button" className="crs-secondary-btn" onClick={() => setStep('submitted')}>
                  Back
                </button>
                <button type="button" className="crs-secondary-btn" onClick={resetSimulator}>
                  Practice Another Case
                </button>
              </div>
            </section>
          )}

          {/* STEP 3.B: Step-by-Step Interactive Review Mode */}
          {step === 'review-step' && analysis && (
            <section className="crs-step-card step-review-card">
              <div className="crs-review-header-row">
                <button type="button" className="crs-text-btn" onClick={() => setStep('submitted')}>
                  <ArrowLeft size={16} /> Back to Summary
                </button>
                <h3>Step-by-Step Learning Walkthrough</h3>
              </div>

              {/* Step indicator path */}
              <div className="crs-review-step-tracker" style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '4px', overflowX: 'auto', paddingBottom: '8px' }}>
                {['Facts', 'Issues', 'Law', 'Principle', 'Arguments', 'Application', 'Court Reasoning', 'Conclusion', 'Takeaway'].map((stName, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`crs-review-step-bubble ${reviewStepIndex === idx ? 'active' : ''} ${reviewStepIndex > idx ? 'completed' : ''}`}
                    onClick={() => setReviewStepIndex(idx)}
                    style={{ minWidth: '70px', padding: '4px 2px' }}
                  >
                    <span className="crs-bubble-num">{idx + 1}</span>
                    <span className="crs-bubble-lbl" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', display: 'block' }}>{stName}</span>
                  </button>
                ))}
              </div>

              {/* Grid content comparison */}
              <div className="crs-step-grid-content">
                
                {/* Left Side: Ideal Model Solution for Step */}
                <div className="crs-step-column model-step-column">
                  <div className="crs-step-card-header model-hl">
                    <Sparkles size={16} />
                    <h4>Ideal Model Solution</h4>
                  </div>
                  <div className="crs-step-body-content">
                    {reviewStepIndex === 0 && (
                      <div className="crs-step-subtext">
                        <h5>Material Facts</h5>
                        <p>{analysis.sections.understandingOfFacts.summary}</p>
                        <h6 style={{ marginTop: '12px', color: 'var(--gold)' }}>Key Operative Facts:</h6>
                        <ul className="crs-bullet-list">
                          {analysis.sections.bestCaseReport.facts.map((f, i) => <li key={i}>{f}</li>)}
                        </ul>
                      </div>
                    )}
                    {reviewStepIndex === 1 && (
                      <div className="crs-step-subtext">
                        <h5>Framed Legal Issues</h5>
                        <p>{analysis.sections.issueIdentification.summary}</p>
                        <h6 style={{ marginTop: '12px', color: 'var(--gold)' }}>Framed Issues:</h6>
                        <ul className="crs-bullet-list">
                          {analysis.sections.bestCaseReport.issues.map((f, i) => <li key={i}>{f}</li>)}
                        </ul>
                      </div>
                    )}
                    {reviewStepIndex === 2 && (
                      <div className="crs-step-subtext">
                        <h5>Governing Laws & Provisions</h5>
                        <p>{analysis.sections.applicableLaw.summary}</p>
                        <h6 style={{ marginTop: '12px', color: 'var(--gold)' }}>Core Authorities & Provisions:</h6>
                        <ul className="crs-bullet-list">
                          {analysis.sections.bestCaseReport.applicableLaw.map((f, i) => <li key={i}>{f}</li>)}
                        </ul>
                      </div>
                    )}
                    {reviewStepIndex === 3 && (
                      <div className="crs-step-subtext">
                        <h5>Relevant Case Principle</h5>
                        <p>{analysis.sections.caseLawAnalysis.summary}</p>
                        <h6 style={{ marginTop: '12px', color: 'var(--gold)' }}>Precedent Rule / Doctrine:</h6>
                        <div className="crs-model-answer-block compact" style={{ fontSize: '0.82rem' }}>
                          <strong>Legal Principle:</strong> {analysis.sections.bestCaseReport.legalPrinciple}
                        </div>
                      </div>
                    )}
                    {reviewStepIndex === 4 && (
                      <div className="crs-step-subtext">
                        <h5>Arguments of Both Parties</h5>
                        <p>{analysis.sections.legalReasoning.summary}</p>
                        <h6 style={{ marginTop: '12px', color: 'var(--gold)' }}>Counter Arguments:</h6>
                        <ul className="crs-bullet-list">
                          {analysis.sections.bestCaseReport.counterArguments.map((f, i) => <li key={i}>{f}</li>)}
                        </ul>
                      </div>
                    )}
                    {reviewStepIndex === 5 && (
                      <div className="crs-step-subtext">
                        <h5>Application of Law</h5>
                        <p>{analysis.sections.legalReasoning.summary}</p>
                        <h6 style={{ marginTop: '12px', color: 'var(--gold)' }}>Judicial Application Logic:</h6>
                        <div className="crs-model-answer-block compact" style={{ fontSize: '0.82rem' }}>
                          {analysis.sections.bestCaseReport.analysis}
                        </div>
                      </div>
                    )}
                    {reviewStepIndex === 6 && (
                      <div className="crs-step-subtext">
                        <h5>Court's Reasoning</h5>
                        <p>{analysis.sections.simplifiedExplanation.courtReasoning}</p>
                        <h6 style={{ marginTop: '12px', color: 'var(--gold)' }}>Ratio Decidendi:</h6>
                        <p style={{ fontStyle: 'italic', fontSize: '0.86rem', color: 'var(--text-muted)' }}>{analysis.sections.simplifiedExplanation.ratiodecidendi}</p>
                      </div>
                    )}
                    {reviewStepIndex === 7 && (
                      <div className="crs-step-subtext">
                        <h5>Conclusion / Holding</h5>
                        <div className="crs-verdict-summary-item">
                          <strong>Holding:</strong>
                          <p>{analysis.sections.bestCaseReport.conclusion}</p>
                        </div>
                        <div className="crs-verdict-summary-item" style={{ marginTop: '12px' }}>
                          <strong>Final Decision:</strong>
                          <p>{analysis.sections.simplifiedExplanation.decision}</p>
                        </div>
                      </div>
                    )}
                    {reviewStepIndex === 8 && (
                      <div className="crs-step-subtext">
                        <h5>Exam Takeaway</h5>
                        <div className="crs-verdict-summary-item">
                          <strong>Exam Strategy & Tips:</strong>
                          <p>{analysis.sections.simplifiedExplanation.examTips}</p>
                        </div>
                        <div className="crs-verdict-summary-item" style={{ marginTop: '12px' }}>
                          <strong>Real-Life Practical Application:</strong>
                          <p>{analysis.sections.simplifiedExplanation.practicalApplication}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: Student Answer & Grading Feedback */}
                <div className="crs-step-column student-step-column">
                  <div className="crs-step-card-header student-hl">
                    <Scale size={16} />
                    <h4>Compare with Your Answer</h4>
                  </div>
                  
                  <div className="crs-step-body-content flex-column-layout">
                    
                    {/* Student text block */}
                    <div className="crs-student-written-box">
                      <div className="crs-student-written-label">Your Submitted Draft</div>
                      <p className="crs-student-written-text">"{studentReasoning}"</p>
                    </div>

                    {/* Professor Review bullets for this step */}
                    <div className="crs-prof-feedback-points-box">
                      
                      {reviewStepIndex === 0 && (
                        <>
                          <div className="crs-feedback-header-line">Facts Assessment</div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill strengths-pill">Strengths:</div>
                            <ul>{renderList(analysis.sections.understandingOfFacts.strengths)}</ul>
                          </div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill gaps-pill">Gaps Identified:</div>
                            <ul>{renderList(analysis.sections.understandingOfFacts.gaps)}</ul>
                          </div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill suggestions-pill">Suggestions:</div>
                            <ul>{renderList(analysis.sections.understandingOfFacts.suggestions)}</ul>
                          </div>
                        </>
                      )}

                      {reviewStepIndex === 1 && (
                        <>
                          <div className="crs-feedback-header-line">Issues Assessment</div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill strengths-pill">Strengths:</div>
                            <ul>{renderList(analysis.sections.issueIdentification.strengths)}</ul>
                          </div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill gaps-pill">Gaps Identified:</div>
                            <ul>{renderList(analysis.sections.issueIdentification.gaps)}</ul>
                          </div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill suggestions-pill">Suggestions:</div>
                            <ul>{renderList(analysis.sections.issueIdentification.suggestions)}</ul>
                          </div>
                        </>
                      )}

                      {reviewStepIndex === 2 && (
                        <>
                          <div className="crs-feedback-header-line">Statutes & Law Citing</div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill strengths-pill">Strengths:</div>
                            <ul>{renderList(analysis.sections.applicableLaw.strengths)}</ul>
                          </div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill gaps-pill">Gaps Identified:</div>
                            <ul>{renderList(analysis.sections.applicableLaw.gaps)}</ul>
                          </div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill suggestions-pill">Suggestions:</div>
                            <ul>{renderList(analysis.sections.applicableLaw.suggestions)}</ul>
                          </div>
                        </>
                      )}

                      {reviewStepIndex === 3 && (
                        <>
                          <div className="crs-feedback-header-line">Case Law Assessment</div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill strengths-pill">Strengths:</div>
                            <ul>{renderList(analysis.sections.caseLawAnalysis.strengths)}</ul>
                          </div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill gaps-pill">Gaps Identified:</div>
                            <ul>{renderList(analysis.sections.caseLawAnalysis.gaps)}</ul>
                          </div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill suggestions-pill">Suggestions:</div>
                            <ul>{renderList(analysis.sections.caseLawAnalysis.suggestions)}</ul>
                          </div>
                        </>
                      )}

                      {reviewStepIndex === 4 && (
                        <>
                          <div className="crs-feedback-header-line">Arguments Analysis</div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill strengths-pill">Strengths:</div>
                            <ul>{renderList(analysis.sections.legalReasoning.strengths)}</ul>
                          </div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill gaps-pill">Gaps Identified:</div>
                            <ul>{renderList(analysis.sections.legalReasoning.gaps)}</ul>
                          </div>
                        </>
                      )}

                      {reviewStepIndex === 5 && (
                        <>
                          <div className="crs-feedback-header-line">Application & Reasoning</div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill suggestions-pill">Suggestions:</div>
                            <ul>{renderList(analysis.sections.legalReasoning.suggestions)}</ul>
                          </div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill suggestions-pill">Bare Acts to Read:</div>
                            <ul>{renderList(analysis.sections.learningRecommendations.relatedBareActs)}</ul>
                          </div>
                        </>
                      )}

                      {reviewStepIndex === 6 && (
                        <>
                          <div className="crs-feedback-header-line">Precedents & Judgments</div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill suggestions-pill">Related Cases:</div>
                            <ul>{renderList(analysis.sections.learningRecommendations.relatedCases)}</ul>
                          </div>
                        </>
                      )}

                      {reviewStepIndex === 7 && (
                        <>
                          <div className="crs-feedback-header-line">Conclusion & Mistakes</div>
                          {analysis.sections.mistakes.length > 0 ? (
                            <div className="crs-feedback-pill-row">
                              <div className="crs-pill gaps-pill">Mistakes Spotted:</div>
                              <ul style={{ color: '#f87171' }}>{renderList(analysis.sections.mistakes)}</ul>
                            </div>
                          ) : (
                            <div className="crs-feedback-pill-row">
                              <div className="crs-pill strengths-pill">Outcome:</div>
                              <p style={{ margin: '8px 0', fontSize: '0.86rem' }}>Excellent holding. No critical errors flagged in the conclusion block.</p>
                            </div>
                          )}
                        </>
                      )}

                      {reviewStepIndex === 8 && (
                        <>
                          <div className="crs-feedback-header-line">Recommendations & Practice</div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill suggestions-pill">What to Improve:</div>
                            <ul>{renderList(analysis.sections.learningRecommendations.whatToImprove)}</ul>
                          </div>
                          <div className="crs-feedback-pill-row">
                            <div className="crs-pill strengths-pill">What You Did Well:</div>
                            <ul>{renderList(analysis.sections.learningRecommendations.whatStudentDidWell)}</ul>
                          </div>
                        </>
                      )}

                    </div>
                  </div>
                </div>

              </div>

              {/* Step Navigation */}
              <div className="crs-action-row" style={{ marginTop: '24px', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  className="crs-secondary-btn"
                  disabled={reviewStepIndex === 0}
                  onClick={() => setReviewStepIndex(prev => prev - 1)}
                >
                  <ChevronLeft size={16} /> Previous Step
                </button>
                
                {reviewStepIndex < 8 ? (
                  <button
                    type="button"
                    className="crs-action-btn"
                    onClick={() => setReviewStepIndex(prev => prev + 1)}
                  >
                    Next Step <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="crs-action-btn finish-step-btn"
                    onClick={() => setStep('submitted')}
                  >
                    Finish Review
                  </button>
                )}
              </div>
            </section>
          )}

        </div>

        {/* Permanent AI Chat Panel */}
        <LegatrixonCaseAI
          selectedCaseId={selectedCaseId}
          customCaseName={customCaseName}
          chatMessages={chatMessages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          chatLoading={chatLoading}
          sendChatMessage={sendChatMessage}
          step={step}
        />
      </div>

      {/* Loading overlay during evaluation */}
      {loading && (
        <div className="crs-loader">
          <div className="crs-loader-orbit"><Sparkles size={24} /></div>
          <h4>AI Professor evaluation in progress</h4>
          <p>Evaluating factual arguments, issue framing, citations, legal reasoning quality, writing structure, and scoring metrics...</p>
        </div>
      )}

      {/* SLEEK HISTORY MODAL */}
      {showHistoryModal && (
        <div className="crs-modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="crs-modal-container" onClick={e => e.stopPropagation()}>
            <div className="crs-modal-header">
              <h3><History size={18} /> Practice Attempt History</h3>
              <button type="button" className="crs-modal-close" onClick={() => setShowHistoryModal(false)}>×</button>
            </div>
            
            <div className="crs-modal-body">
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '24px' }}>
                  <RotateCcw size={20} className="crs-spin" style={{ color: 'var(--gold)' }} />
                  <p style={{ marginTop: '8px', color: 'var(--text-soft)' }}>Loading history items...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="crs-empty-history">
                  <p>You haven't completed any practice attempts yet. Select a case above to get started!</p>
                </div>
              ) : (
                <div className="crs-modal-history-list">
                  {history.map(item => (
                    <div key={item.id} className="crs-modal-history-row" onClick={() => reopenAttempt(item.id)}>
                      <div className="crs-history-row-main">
                        <h5>{parseReopenedAttempt(item.caseName).name}</h5>
                        <span>Attempted: {formatDate(item.date)}</span>
                      </div>
                      <div className="crs-history-row-score">
                        <span className="score-num">{item.score}%</span>
                        <span className="score-lbl">Score</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '4px' }}>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

interface LegatrixonCaseAIProps {
  selectedCaseId: string
  customCaseName: string
  chatMessages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>
  chatInput: string
  setChatInput: React.Dispatch<React.SetStateAction<string>>
  chatLoading: boolean
  sendChatMessage: (text: string, customDisplay?: string) => Promise<void>
  step: string
}

function LegatrixonCaseAI({
  selectedCaseId,
  customCaseName,
  chatMessages,
  chatInput,
  setChatInput,
  chatLoading,
  sendChatMessage,
  step
}: LegatrixonCaseAIProps) {
  const chatEndRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const activeCase = LANDMARK_CASES.find(c => c.id === selectedCaseId)
  const activeCaseName = activeCase ? activeCase.name : customCaseName || 'No case selected'
  const activeCaseCourt = activeCase ? activeCase.court : (customCaseName ? 'Custom Dispute' : '')
  const activeCaseYear = activeCase ? activeCase.year : ''

  return (
    <aside className="crs-chatbot-card">
      <div className="crs-chat-header">
        <div className="crs-chat-header-info">
          <img src="/Legatrixon logo.jpg" alt="LEGATRIXON" className="crs-chat-logo-header" />
          <div>
            <h3>LEGATRIXON AI</h3>
            <p>Case Law Assistant</p>
          </div>
        </div>
        <div className="crs-chat-status-indicator">
          <span className="crs-status-dot-green">●</span> Online
        </div>
      </div>

      <div className="crs-chat-body">
        <div className="crs-chat-messages">
          {/* Welcome Message Box */}
          <div className="crs-chat-bubble assistant initial-welcome-box">
            <p className="crs-chat-p">Hi! I'm LEGATRIXON AI. I can help you understand this case, summarize the judgment, identify the legal issues, explain the court's reasoning, and help you prepare for practice.</p>
          </div>

          {/* Current Case Context Box */}
          {(selectedCaseId || customCaseName.trim()) && (
            <div className="crs-chat-context-card">
              <div className="crs-context-card-lbl">CURRENT CASE</div>
              <div className="crs-context-card-name">{activeCaseName}</div>
              {activeCaseCourt && (
                <div className="crs-context-card-meta">
                  {activeCaseCourt} {activeCaseYear ? `• ${activeCaseYear}` : ''}
                </div>
              )}
            </div>
          )}

          {/* Quick Action Suggestion Buttons */}
          {chatMessages.length <= 1 && (
            <div className="crs-chat-quick-actions-grid">
              <button
                type="button"
                className="crs-chat-quick-btn"
                onClick={() => sendChatMessage("Summarize the case and its core holdings.", "Summarize Case")}
              >
                Summarize Case
              </button>
              <button
                type="button"
                className="crs-chat-quick-btn"
                onClick={() => sendChatMessage("What are the key legal issues / questions of law in this case?", "Key Legal Issues")}
              >
                Key Legal Issues
              </button>
              <button
                type="button"
                className="crs-chat-quick-btn"
                onClick={() => sendChatMessage("Explain the court's detailed reasoning / ratio decidendi.", "Court's Reasoning")}
              >
                Court's Reasoning
              </button>
              <button
                type="button"
                className="crs-chat-quick-btn"
                onClick={() => sendChatMessage("How should I prepare for an exam or practice simulation on this case?", "Exam Preparation")}
              >
                Exam Preparation
              </button>
            </div>
          )}

          {/* Chat Messages Log */}
          {chatMessages.length > 1 && chatMessages.slice(1).map(msg => (
            <div key={msg.id} className={`crs-chat-bubble-wrap ${msg.role}`}>
              <div className={`crs-chat-bubble ${msg.role}`}>
                {msg.role === 'user' ? msg.content : renderChatMarkdown(msg.content)}
              </div>
            </div>
          ))}

          {chatLoading && (
            <div className="crs-chat-bubble-wrap assistant">
              <div className="crs-chat-bubble assistant thinking">
                <span className="crs-dot"></span>
                <span className="crs-dot"></span>
                <span className="crs-dot"></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      <div className="crs-chat-input-area">
        <textarea
          rows={1}
          className="crs-chat-input"
          placeholder="Ask about this case..."
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (chatInput.trim() && !chatLoading) {
                sendChatMessage(chatInput)
              }
            }
          }}
          disabled={chatLoading}
        />
        <button
          type="button"
          className="crs-chat-send-btn"
          onClick={() => {
            if (chatInput.trim() && !chatLoading) {
              sendChatMessage(chatInput)
            }
          }}
          disabled={!chatInput.trim() || chatLoading}
        >
          <Send size={16} />
        </button>
      </div>
    </aside>
  )
}
