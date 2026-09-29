import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { MentorCitation } from '../types/chat.types';

export function MarkdownRenderer({ content, citations = [] }: { content: string; citations?: MentorCitation[] }) {
  return (
    <div className="mentor-md">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>,
          code: ({ children, className }) => {
            const inline = !className;
            return inline ? <code>{children}</code> : <pre><code className={className}>{children}</code></pre>;
          },
          table: ({ children }) => <div className="mentor-table-wrap"><table>{children}</table></div>,
        }}
      >
        {content}
      </ReactMarkdown>
      {citations.length > 0 && (
        <ol className="mentor-citations" aria-label="Citations">
          {citations.map((citation, index) => (
            <li key={`${citation.label}-${index}`}>
              {citation.url ? <a href={citation.url} target="_blank" rel="noreferrer">{citation.label}</a> : citation.label}
              {citation.source && <span>{citation.source}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

