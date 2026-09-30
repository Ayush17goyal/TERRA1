export type MemorialSide = 'petitioner' | 'respondent' | 'both';
export type MemorialDepth = 'standard' | 'deep' | 'exhaustive';
export type CitationStyle = 'bluebook' | 'oscola' | 'indian' | 'scc';
export type DossierParagraphCategory = 'fact' | 'law' | 'procedure' | 'issue' | 'relief' | 'annexure' | 'instruction' | 'concept_note' | 'organiser_material' | 'ambiguous';
export type DocumentSectionType = 'cover_or_brochure' | 'organiser_material' | 'concept_note' | 'competition_rules' | 'moot_proposition' | 'procedural_history' | 'issues' | 'clarifications' | 'annexure' | 'unknown';
export interface DossierPage {
    pageNo: number;
    text: string;
    headings: string[];
    tables: string[];
    footnotes: string[];
    sectionType?: DocumentSectionType;
    sectionConfidence?: number;
}
export interface DossierParagraph {
    id: string;
    pageNo: number;
    text: string;
    category: DossierParagraphCategory;
    sectionType?: DocumentSectionType;
}
export interface CaseDossier {
    id: string;
    sourceName: string;
    rawText: string;
    pages: DossierPage[];
    paragraphs: DossierParagraph[];
    timeline: {
        date: string;
        event: string;
        sourceParagraphId: string;
    }[];
    parties: {
        name: string;
        role: string;
        claims: string[];
        actions: string[];
    }[];
    legalTriggers: {
        text: string;
        possibleLawArea: string;
        sourceParagraphId: string;
    }[];
    propositionRules: {
        memorialRules: string[];
        pageLimits: string[];
        citationRules: string[];
        formattingRules: string[];
    };
    unresolvedQuestions: string[];
}
export interface PropositionFact {
    id: string;
    text: string;
    exactQuote: string;
    sourceIds: string[];
    kind: 'background' | 'event' | 'procedural' | 'evidence' | 'allegation' | 'finding' | 'relief' | 'other';
    status: 'admitted' | 'disputed' | 'alleged' | 'finding' | 'unclear';
    materiality: 'high' | 'medium' | 'low';
    confidence: number;
}
export interface PropositionBlueprint {
    documentSections: Array<{
        type: DocumentSectionType;
        pageStart: number;
        pageEnd: number;
        reason: string;
        confidence: number;
    }>;
    caseMetadata: {
        competitionName: string;
        court: string;
        jurisdiction: string;
        jurisdictionProvision: string;
        caseNumber: string;
        proceduralStage: string;
        petitionerLabel: string;
        respondentLabel: string;
        petitionerName: string;
        respondentName: string;
        teamCode: string;
    };
    parties: Array<{
        name: string;
        role: string;
        description: string;
        sourceIds: string[];
    }>;
    facts: PropositionFact[];
    timeline: Array<{
        date: string;
        event: string;
        factIds: string[];
        sourceIds: string[];
    }>;
    proceduralHistory: Array<{
        step: string;
        courtOrAuthority: string;
        result: string;
        sourceIds: string[];
    }>;
    evidenceInventory: Array<{
        id: string;
        item: string;
        source: string;
        collectionMethod: string;
        authenticityQuestion: string;
        chainOfCustodyQuestion: string;
        factIds: string[];
    }>;
    lawsMentioned: Array<{
        citation: string;
        context: string;
        sourceIds: string[];
    }>;
    explicitIssues: Array<{
        text: string;
        sourceIds: string[];
    }>;
    reliefs: Array<{
        text: string;
        side: 'petitioner' | 'respondent' | 'neutral';
        sourceIds: string[];
    }>;
    competitionRules: {
        petitionerCoverColor?: string;
        respondentCoverColor?: string;
        pageLimit?: string;
        wordLimit?: string;
        bodyFont?: string;
        footnoteFont?: string;
        lineSpacing?: string;
        citationStyle?: string;
        requiredSections: string[];
        otherRules: string[];
    };
    excludedContent: Array<{
        sourceId: string;
        reason: string;
    }>;
    unresolvedQuestions: string[];
    coverage: {
        totalParagraphs: number;
        classifiedParagraphs: number;
        usedAsCaseMaterial: number;
        excludedAsNonCaseMaterial: number;
        unresolved: number;
        coveragePercent: number;
    };
}
export interface CaseGraph {
    parties: PropositionBlueprint['parties'];
    facts: PropositionFact[];
    admittedFacts: string[];
    disputedFacts: string[];
    proceduralPosture: string[];
    claims: string[];
    legalTriggers: CaseDossier['legalTriggers'];
    reliefs: string[];
    burdens: string[];
    evidenceInventory: PropositionBlueprint['evidenceInventory'];
    sourceMap: Record<string, string>;
}
export interface IssueMatrixItem {
    id: string;
    issue: string;
    petitionerPosition: string;
    respondentPosition: string;
    subIssues: string[];
    legalTests: string[];
    factualAnchors: string[];
    factIds: string[];
    legalAnchors: string[];
    authorityQueries: string[];
    burden: string;
    reliefConsequence: string;
    targetWordCount: number;
}
export interface ResearchAuthority {
    id: string;
    type: 'constitution' | 'statute' | 'case' | 'report' | 'book' | 'article' | 'web';
    citation: string;
    proposition: string;
    ratioOrRule: string;
    sideUsefulness: 'petitioner' | 'respondent' | 'both';
    risk: string;
    issueId: string;
    confidence: number;
    verified: boolean;
    verificationSource: 'curated' | 'retrieval' | 'uploaded' | 'ai_suggestion';
    court?: string;
    year?: string;
    pinpoint?: string;
    relevanceReason?: string;
    sourceUrl?: string;
}
export interface ArgumentSubsection {
    heading: string;
    claim: string;
    rule: string;
    authorityIds: string[];
    factIds: string[];
    analysis: string[];
    counterArgument: string;
    rebuttal: string;
    miniConclusion: string;
}
export interface ArgumentBlock {
    issueId: string;
    side: Exclude<MemorialSide, 'both'>;
    thesis: string;
    roadmap: string;
    rule: string;
    authorities: ResearchAuthority[];
    application: string;
    subArguments: ArgumentSubsection[];
    counterArgument: string;
    rebuttal: string;
    conclusion: string;
    factIds: string[];
    wordCount: number;
}
export interface MemorialSectionSet {
    cover: string;
    tableOfContents: string;
    abbreviations: string;
    indexOfAuthorities: string;
    jurisdiction: string;
    statementOfFacts: string;
    issuesRaised: string;
    summaryOfArguments: string;
    argumentsAdvanced: string;
    prayer: string;
}
export interface MemorialRenderModel {
    metadata: {
        competitionName: string;
        court: string;
        jurisdictionLine: string;
        caseNumber: string;
        petitionerName: string;
        respondentName: string;
        petitionerLabel: string;
        respondentLabel: string;
        teamCode: string;
        side: Exclude<MemorialSide, 'both'>;
        coverColor: string;
    };
    abbreviations: Array<{
        abbreviation: string;
        fullForm: string;
    }>;
    authorityGroups: Array<{
        title: string;
        entries: Array<{
            citation: string;
            pinpoint?: string;
        }>;
    }>;
    jurisdictionParagraphs: string[];
    factParagraphs: string[];
    issues: Array<{
        id: string;
        label: string;
        text: string;
        subIssues: string[];
    }>;
    summaries: Array<{
        issueId: string;
        heading: string;
        paragraphs: string[];
    }>;
    arguments: Array<{
        issueId: string;
        heading: string;
        thesis: string;
        roadmap: string;
        subArguments: Array<{
            label: string;
            heading: string;
            paragraphs: string[];
            authorityIds: string[];
        }>;
        concludingParagraphs: string[];
    }>;
    authorities: ResearchAuthority[];
    prayerParagraphs: string[];
}
export interface MemorialQualityScore {
    total: number;
    structure: number;
    issueFraming: number;
    legalResearch: number;
    factApplication: number;
    counterArguments: number;
    formatting: number;
    citationQuality: number;
    sourceGrounding: number;
    sideConsistency: number;
    repetitionControl: number;
    warnings: string[];
    blockingErrors: string[];
    diagnostics: Record<string, number | string | boolean>;
}
export interface MemorialWorkflowOptions {
    side?: MemorialSide;
    depth?: MemorialDepth;
    citationStyle?: CitationStyle;
    preferredModel?: string;
    selectedSources?: string[];
    competitionRulesText?: string;
    maxPages?: number;
    maxWords?: number;
    qualityThreshold?: number;
    allowUnverifiedAuthorities?: boolean;
    userId?: string;
    revisionInstructions?: string[];
}
export interface MemorialWorkflowAudit {
    version: string;
    stages: Array<{
        stage: string;
        status: 'completed' | 'fallback' | 'warning' | 'failed';
        details: string;
        startedAt: string;
        completedAt: string;
    }>;
    warnings: string[];
}
export interface MemorialWorkflowResult {
    dossier: CaseDossier;
    blueprint: PropositionBlueprint;
    graph: CaseGraph;
    issues: IssueMatrixItem[];
    authorities: ResearchAuthority[];
    audit: MemorialWorkflowAudit;
    petitioner?: {
        arguments: ArgumentBlock[];
        sections: MemorialSectionSet;
        renderModel: MemorialRenderModel;
        quality: MemorialQualityScore;
        markdown: string;
    };
    respondent?: {
        arguments: ArgumentBlock[];
        sections: MemorialSectionSet;
        renderModel: MemorialRenderModel;
        quality: MemorialQualityScore;
        markdown: string;
    };
}
