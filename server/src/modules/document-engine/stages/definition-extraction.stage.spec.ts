import { DefinitionExtractionStage } from './definition-extraction.stage';
import { SectionNode } from '../types/document-graph.types';

function section(text: string, hierarchyPath = 'Some Act > Section 3'): SectionNode {
  return { id: 's1', treeNodeId: 't1', hierarchyPath, sectionType: 'statutory_provision', text, confidence: 0.9, needsReview: false };
}

describe('DefinitionExtractionStage', () => {
  const stage = new DefinitionExtractionStage();

  it('extracts a statutory "X means Y" definition as document_wide when inside a Definitions section', () => {
    const s = section('"minor" means a person who has not completed eighteen years of age.', 'The Act > Definitions');
    const defs = stage.extract(s, 'bare_act');
    expect(defs).toHaveLength(1);
    expect(defs[0].term).toBe('minor');
    expect(defs[0].definitionType).toBe('statutory');
    expect(defs[0].scope).toBe('document_wide');
  });

  it('scopes a statutory definition found outside a Definitions section as local', () => {
    const s = section('"restriction" means any limitation imposed by law on the exercise of a right.', 'The Act > Article 19');
    const defs = stage.extract(s, 'bare_act');
    expect(defs[0].scope).toBe('local');
  });

  it('extracts a descriptive definition only for notes/textbook document types', () => {
    const s = section('Consideration is something of value given by both parties to a contract.');
    expect(stage.extract(s, 'notes').length).toBeGreaterThan(0);
    expect(stage.extract(s, 'bare_act')).toHaveLength(0);
  });
});
