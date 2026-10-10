import { useMemo } from 'react';
import { parsePhiWritePrintBlocks } from '../lib/phiwritePrint.js';
import './PhiWritePrintDocument.css';

// React owns every text node. Never inject untrusted Markdown as HTML.
export default function PhiWritePrintDocument({ title, content, trustLabel }) {
  const blocks = useMemo(() => parsePhiWritePrintBlocks(content), [content]);
  return (
    <article className="phiwrite-print-page" aria-label="PhiWrite printable document">
      <header className="phiwrite-print-header">
        <h1>{title || 'Untitled'}</h1>
        <p>Trust label: {trustLabel}</p>
      </header>
      <div className="phiwrite-print-body">
        {blocks.map((block, index) => {
          if (block.kind === 'heading') {
            const Heading = 'h' + Math.max(2, Math.min(6, block.level + 1));
            return <Heading key={index}>{block.text}</Heading>;
          }
          if (block.kind === 'list') {
            const List = block.listType === 'ol' ? 'ol' : 'ul';
            return <List key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</List>;
          }
          if (block.kind === 'code') return <pre key={index}><code>{block.text}</code></pre>;
          if (block.kind === 'quote') return <blockquote key={index}>{block.text}</blockquote>;
          return <p key={index}>{block.text}</p>;
        })}
      </div>
    </article>
  );
}
