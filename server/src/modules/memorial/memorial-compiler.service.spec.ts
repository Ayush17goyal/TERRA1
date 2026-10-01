import { MemorialCompilerService } from './memorial-compiler.service';

describe('MemorialCompilerService cross-proposition isolation', () => {
  it('does not inject cyber-case facts or reliefs into a territorial boundary dispute', () => {
    const service = new MemorialCompilerService();
    const blueprint: any = {
      caseMetadata: {
        competitionName: 'Vox Anatolis Moot Court Competition, 2026',
        court: 'THE HONOURABLE SUPREME COURT OF INDRAVANA',
        jurisdiction: 'ORIGINAL JURISDICTION',
        jurisdictionProvision: 'ARTICLE 131 OF THE CONSTITUTION OF INDRAVANA',
        caseNumber: 'ORIGINAL SUIT NO. 1 OF 2026',
        petitionerName: 'STATE OF PRAGYAM', respondentName: 'STATE OF LUMIRA',
        petitionerLabel: 'PETITIONER', respondentLabel: 'RESPONDENT', teamCode: '', proceduralStage: 'Original suit',
      },
      facts: [
        { id: 'F1', text: 'Pragyam and Lumira are neighbouring States separated by a historically disputed boundary.', kind: 'background', status: 'admitted', materiality: 'high' },
        { id: 'F2', text: 'Colonial instruments were framed for revenue and forest administration rather than final political demarcation.', kind: 'event', status: 'admitted', materiality: 'high' },
      ],
      reliefs: [], lawsMentioned: [{ citation: 'Article 131 of the Constitution of Indravana', context: 'Original jurisdiction', sourceIds: ['P1'] }],
    };
    const graph: any = { burdens: ['The claimant must establish its asserted legal boundary.'] };
    const issues: any[] = [{ id: 'ISSUE_1', issue: 'WHETHER THE COLONIAL INSTRUMENTS CONCLUSIVELY FIXED THE INTER-STATE BOUNDARY?', subIssues: ['Text and legal effect'], factualAnchors: [], factIds: ['F1', 'F2'], legalAnchors: [], authorityQueries: [], burden: 'The claimant bears the burden.', reliefConsequence: '', targetWordCount: 900 }];
    const args: any[] = [{ issueId: 'ISSUE_1', side: 'respondent', thesis: 'The instruments did not conclusively determine the constitutional boundary.', roadmap: 'Their text, purpose, and subsequent practice must be assessed together.', rule: 'A boundary instrument must be construed in its historical and legal context.', authorities: [], application: '', subArguments: [{ heading: 'THE INSTRUMENTS WERE ADMINISTRATIVE', claim: 'Their object was limited.', rule: 'Purpose informs construction.', analysis: ['The proposition records their revenue and forest purpose.'], counterArgument: '', rebuttal: '', miniConclusion: 'They are not conclusive.', authorityIds: [], factIds: ['F2'] }], counterArgument: '', rebuttal: '', conclusion: 'The issue should be answered for Lumira.', factIds: ['F1', 'F2'], wordCount: 120 }];

    const result = service.compile('respondent', blueprint, graph, issues, [], args);
    const output = `${result.markdown}\n${result.sections.prayer}`;

    expect(output).toContain('INDRAVANA');
    expect(output).toContain('historically disputed boundary');
    expect(output).not.toMatch(/cyber|electronic evidence|foreign server|digital search|STATE OF INDIA/i);
  });

  it('uses claimant and tribunal terminology for an investment arbitration problem', () => {
    const service = new MemorialCompilerService();
    const blueprint: any = {
      caseMetadata: {
        competitionName: 'FDI Moot 2026', court: 'BEFORE THE ARBITRAL TRIBUNAL',
        jurisdiction: 'ARBITRAL JURISDICTION', jurisdictionProvision: 'THE APPLICABLE INVESTMENT AGREEMENT AND ARBITRATION RULES',
        caseNumber: '', petitionerName: 'GREENHYDRO PLC', respondentName: 'REPUBLIC OF EQUATORIANA',
        petitionerLabel: 'CLAIMANT', respondentLabel: 'RESPONDENT', teamCode: '', proceduralStage: 'Investor-State arbitration proceedings',
      },
      facts: [{ id: 'F1', text: 'The Claimant submitted a request for arbitration concerning the termination of the project agreement.', kind: 'procedural', status: 'admitted', materiality: 'high' }],
      reliefs: [], lawsMentioned: [],
    };
    const graph: any = { burdens: ['The Claimant bears the burden of establishing arbitral jurisdiction.'] };
    const issues: any[] = [{ id: 'ISSUE_1', issue: 'WHETHER THE TRIBUNAL HAS JURISDICTION?', subIssues: ['Consent'], factualAnchors: [], factIds: ['F1'], legalAnchors: [], authorityQueries: [], burden: 'The Claimant bears the burden.', reliefConsequence: '', targetWordCount: 900 }];
    const args: any[] = [{ issueId: 'ISSUE_1', side: 'petitioner', thesis: 'The Tribunal has jurisdiction.', roadmap: 'Consent and the treaty requirements are satisfied.', rule: 'Consent is required.', authorities: [], application: '', subArguments: [{ heading: 'CONSENT EXISTS', claim: 'Consent was given.', rule: 'Consent is required.', analysis: ['The applicable agreement records consent.'], counterArgument: '', rebuttal: '', miniConclusion: 'Jurisdiction exists.', authorityIds: [], factIds: ['F1'] }], counterArgument: '', rebuttal: '', conclusion: 'The Tribunal has jurisdiction.', factIds: ['F1'], wordCount: 80 }];

    const result = service.compile('petitioner', blueprint, graph, issues, [], args);

    expect(result.sections.jurisdiction).toMatch(/CLAIMANT.*arbitral jurisdiction.*Tribunal/i);
    expect(result.sections.prayer).toMatch(/CLAIMANT.*Hon'ble Tribunal/i);
    expect(result.sections.jurisdiction).not.toMatch(/constitutional jurisdiction|Hon'ble Court/i);
  });
});
