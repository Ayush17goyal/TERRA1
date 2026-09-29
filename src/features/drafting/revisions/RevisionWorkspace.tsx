import { Loader2, Send } from 'lucide-react';
import { useState } from 'react';

export function RevisionWorkspace({ loading, feedback, onSubmit }: { loading: boolean; feedback?: string; onSubmit(notes: string): void }) {
  const [notes, setNotes] = useState('');
  return (
    <section className="draft-revision-workspace" aria-label="Revision workspace">
      <header><strong>Revision Workspace</strong><span>Revise manually, then submit your revision notes.</span></header>
      <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What did you change, and which feedback did you address?" />
      <button type="button" onClick={() => { onSubmit(notes); setNotes(''); }} disabled={loading}>{loading ? <Loader2 size={14} className="spin" /> : <Send size={14} />}Submit revision</button>
      {feedback && <article><h4>Revision feedback</h4><p>{feedback}</p></article>}
    </section>
  );
}
