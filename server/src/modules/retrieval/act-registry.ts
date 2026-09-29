export interface ActRegistryEntry {
  actId: string;
  officialName: string;
  shortName: string;
  aliases: string[];
  year?: number;
  status: 'active' | 'repealed' | 'legacy';
}

const REGISTRY: ActRegistryEntry[] = [
  {
    actId: 'bharatiya_nyaya_sanhita_2023',
    officialName: 'Bharatiya Nyaya Sanhita, 2023',
    shortName: 'BNS',
    aliases: ['bns', 'b.n.s.', 'b.n.s', 'bharatiya nyaya sanhita', 'bharatiya nyaya sanhita 2023', 'nyaya sanhita', 'bns 2023'],
    year: 2023,
    status: 'active',
  },
  {
    actId: 'bharatiya_nagarik_suraksha_sanhita_2023',
    officialName: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    shortName: 'BNSS',
    aliases: ['bnss', 'b.n.s.s.', 'b.n.s.s', 'bharatiya nagarik suraksha sanhita', 'bharatiya nagarik suraksha', 'nagarik suraksha sanhita', 'bnss 2023'],
    year: 2023,
    status: 'active',
  },
  {
    actId: 'bharatiya_sakshya_adhiniyam_2023',
    officialName: 'Bharatiya Sakshya Adhiniyam, 2023',
    shortName: 'BSA',
    aliases: ['bsa', 'b.s.a.', 'b.s.a', 'bharatiya sakshya adhiniyam', 'bharatiya sakshya', 'sakshya adhiniyam', 'bsa 2023'],
    year: 2023,
    status: 'active',
  },
  {
    actId: 'constitution_of_india',
    officialName: 'Constitution of India',
    shortName: 'Constitution',
    aliases: ['constitution', 'constitution of india', 'indian constitution', 'coi', 'const of india'],
    year: 1950,
    status: 'active',
  },
  {
    actId: 'indian_contract_act_1872',
    officialName: 'Indian Contract Act, 1872',
    shortName: 'Indian Contract Act',
    aliases: ['ica', 'contract act', 'indian contract act', 'indian contract act 1872', 'contract act 1872'],
    year: 1872,
    status: 'active',
  },
  {
    actId: 'indian_penal_code_1860',
    officialName: 'Indian Penal Code, 1860',
    shortName: 'IPC',
    aliases: ['ipc', 'i.p.c.', 'i.p.c', 'indian penal code', 'indian penal code 1860', 'penal code'],
    year: 1860,
    status: 'legacy',
  },
  {
    actId: 'code_of_criminal_procedure_1973',
    officialName: 'Code of Criminal Procedure, 1973',
    shortName: 'CrPC',
    aliases: ['crpc', 'cr.p.c', 'cr.p.c.', 'code of criminal procedure', 'criminal procedure code', 'crpc 1973'],
    year: 1973,
    status: 'legacy',
  },
  {
    actId: 'code_of_civil_procedure_1908',
    officialName: 'Code of Civil Procedure, 1908',
    shortName: 'CPC',
    aliases: ['cpc', 'c.p.c.', 'c.p.c', 'code of civil procedure', 'civil procedure code', 'cpc 1908'],
    year: 1908,
    status: 'active',
  },
  {
    actId: 'companies_act_2013',
    officialName: 'Companies Act, 2013',
    shortName: 'Companies Act',
    aliases: ['companies act', 'companies', 'companies act 2013', 'company law'],
    year: 2013,
    status: 'active',
  },
  {
    actId: 'limitation_act_1963',
    officialName: 'Limitation Act, 1963',
    shortName: 'Limitation Act',
    aliases: ['limitation act', 'limitation act 1963'],
    year: 1963,
    status: 'active',
  },
  {
    actId: 'specific_relief_act_1963',
    officialName: 'Specific Relief Act, 1963',
    shortName: 'Specific Relief Act',
    aliases: ['specific relief act', 'specific relief act 1963'],
    year: 1963,
    status: 'active',
  },
  {
    actId: 'transfer_of_property_act_1882',
    officialName: 'Transfer of Property Act, 1882',
    shortName: 'TPA',
    aliases: ['tpa', 'transfer of property act', 'tpa 1882'],
    year: 1882,
    status: 'active',
  },
  {
    actId: 'consumer_protection_act_2019',
    officialName: 'Consumer Protection Act, 2019',
    shortName: 'Consumer Protection Act',
    aliases: ['consumer protection act', 'consumer protection act 2019'],
    year: 2019,
    status: 'active',
  },
  {
    actId: 'information_technology_act_2000',
    officialName: 'Information Technology Act, 2000',
    shortName: 'IT Act',
    aliases: ['information technology act', 'it act 2000', 'it act'],
    year: 2000,
    status: 'active',
  },
  {
    actId: 'arbitration_and_conciliation_act_1996',
    officialName: 'Arbitration and Conciliation Act, 1996',
    shortName: 'Arbitration Act',
    aliases: ['arbitration act', 'arbitration and conciliation act', 'arbitration act 1996'],
    year: 1996,
    status: 'active',
  },
  {
    actId: 'negotiable_instruments_act_1881',
    officialName: 'Negotiable Instruments Act, 1881',
    shortName: 'NI Act',
    aliases: ['negotiable instruments act', 'ni act', 'ni act 1881'],
    year: 1881,
    status: 'active',
  },
];

export class ActRegistry {
  static all(): ActRegistryEntry[] {
    return REGISTRY;
  }

  static resolve(query: string): ActRegistryEntry | null {
    const normalizedQuery = normalize(query);
    for (const entry of REGISTRY) {
      const candidates = [entry.officialName, entry.shortName, ...entry.aliases].map(normalize);
      if (candidates.some((candidate) => candidate && new RegExp(`\\b${escapeRegex(candidate)}\\b`).test(normalizedQuery))) {
        return entry;
      }
    }
    return null;
  }

  static resolveByName(name: string): ActRegistryEntry {
    return this.resolve(name) ?? {
      actId: this.normalizeActId(name) || 'unknown_act',
      officialName: name,
      shortName: name,
      aliases: [name],
      year: extractYear(name),
      status: 'active',
    };
  }

  static normalizeActId(value: string): string {
    return normalize(value).replace(/\s+/g, '_');
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractYear(value: string): number | undefined {
  const match = value.match(/\b(18|19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
