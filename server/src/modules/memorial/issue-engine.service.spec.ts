import { IssueEngineService } from './issue-engine.service';

describe('IssueEngineService proposition-grounded fallback', () => {
  it('derives boundary and water issues without converting ordinary jurisdiction into cyber jurisdiction', async () => {
    const service = new IssueEngineService({ json: async () => { throw new Error('offline'); } } as any);
    const facts = [
      { id: 'F1', text: 'Pragyam and Lumira assert competing claims over an inter-State boundary corridor.', materiality: 'high' },
      { id: 'F2', text: 'Lumira argues that Article 3 reserves territorial alteration to Parliament.', materiality: 'high' },
      { id: 'F3', text: 'A river project is challenged while no tribunal under the Inter-State River Water Disputes Act has been constituted.', materiality: 'high' },
      { id: 'F4', text: 'The Supreme Court admitted the original suit under Article 131.', materiality: 'high' },
    ];
    const blueprint: any = {
      caseMetadata: {}, facts, explicitIssues: [], proceduralHistory: [], evidenceInventory: [],
      lawsMentioned: [{ citation: 'Article 131', context: 'Original jurisdiction' }, { citation: 'Inter-State River Water Disputes Act, 1956', context: 'Tribunal' }],
      parties: [], reliefs: [],
    };
    const graph: any = { facts, burdens: ['The claimant bears the burden of establishing jurisdiction and entitlement.'] };

    const result = await service.generate(graph, blueprint, { depth: 'standard' } as any);
    const joined = result.issues.map(issue => issue.issue).join(' ');

    expect(result.issues.length).toBeGreaterThanOrEqual(2);
    expect(joined).toMatch(/BOUNDARY|WATER DISPUTE|ORIGINAL JURISDICTION/);
    expect(joined).not.toMatch(/CYBER|FOREIGN-HOSTED|SERVER|CONVICTION|SENTENCE/);
  });
});
