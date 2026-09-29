import { BrainCircuit, CheckCircle2, Database, Layers, Percent } from 'lucide-react';
import type { ManagedDocument } from '../types/document.types';

export function AiAnalysisPanel({ document }: { document?: ManagedDocument }) {
  if (!document) return <section className="documents-analysis"><strong>AI Analysis</strong><p>No document selected.</p></section>;
  const analysis = document.analysis;
  return (
    <section className="documents-analysis" aria-label="AI document analysis"><header><BrainCircuit size={16} /><strong>AI Analysis</strong></header><div className="analysis-metrics"><span><Percent size={14} />{Math.round(analysis.confidence * 100)}% confidence</span><span><Database size={14} />{analysis.indexedChunks} chunks</span><span><Layers size={14} />{analysis.classification.replace(/_/g, ' ')}</span></div><article><h4>Processing summary</h4><p>{analysis.processingSummary}</p></article><article><h4>Extracted legislative patterns</h4><div className="document-chip-row">{analysis.extractedPatterns.map((pattern) => <span key={pattern}>{pattern.replace(/_/g, ' ')}</span>)}</div></article><article><h4>Detected drafting components</h4><ul>{analysis.draftingComponents.map((item) => <li key={item}><CheckCircle2 size={13} />{item}</li>)}</ul></article>{analysis.errors.length > 0 && <article><h4>Extraction errors</h4><ul>{analysis.errors.map((error) => <li key={error}>{error}</li>)}</ul></article>}</section>
  );
}
