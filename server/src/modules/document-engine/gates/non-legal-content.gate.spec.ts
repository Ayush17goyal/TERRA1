import { NonLegalContentGate } from './non-legal-content.gate';
import { BARE_ACT_TEXT, NON_LEGAL_TEXT } from '../__fixtures__/sample-inputs';
import { DocumentTree } from '../types/document-graph.types';

const bareActTree: DocumentTree = { documentType: 'bare_act', documentTypeConfidence: 0.8, root: [] };
const unknownTree: DocumentTree = { documentType: 'unknown', documentTypeConfidence: 0.1, root: [] };

describe('NonLegalContentGate', () => {
  const gate = new NonLegalContentGate();

  it('passes a legal-keyword-dense document', () => {
    const result = gate.check(BARE_ACT_TEXT, bareActTree);
    expect(result.passed).toBe(true);
  });

  it('fails a low-density, unclassified document', () => {
    const result = gate.check(NON_LEGAL_TEXT, unknownTree);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('non_legal_content_suspected');
  });
});
