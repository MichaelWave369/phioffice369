import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhiWriteHtmlDocument,
  escapePhiWriteHtml,
  parsePhiWritePrintBlocks,
  renderPhiWritePrintBlocksHtml,
} from '../apps/web/src/lib/phiwritePrint.js';

test('print parser handles headings, paragraphs, both list types, quotes and code fences', () => {
  const input = [
    '# Heading',
    '',
    'First paragraph',
    'second line',
    '',
    '- Point one',
    '- Point two',
    '',
    '1. Item one',
    '2. Item two',
    '',
    '> Private quote',
    '> second line',
    '',
    '~~~js',
    'const message = "<script>";',
    '~~~',
  ].join('\n');
  const blocks = parsePhiWritePrintBlocks(input);
  assert.deepEqual(blocks.map((block) => block.kind), [
    'heading', 'paragraph', 'list', 'list', 'quote', 'code',
  ]);
  assert.equal(blocks[0].level, 1);
  assert.equal(blocks[1].text, 'First paragraph\nsecond line');
  assert.deepEqual(blocks[2].items, ['Point one', 'Point two']);
  assert.equal(blocks[3].listType, 'ol');
  assert.equal(blocks[4].text, 'Private quote\nsecond line');
  assert.equal(blocks[5].text, 'const message = "<script>";');
});

test('print parser preserves user text and does not silently turn inline markup into HTML', () => {
  const blocks = parsePhiWritePrintBlocks('**bold** [link](https://example.invalid)\r\nline two');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].text, '**bold** [link](https://example.invalid)\nline two');
});

test('HTML exporter escapes document title, trust label, and untrusted draft content', () => {
  const html = buildPhiWriteHtmlDocument({
    title: '<script>alert("title")</script>',
    trustLabel: 'Private "data" & <unsafe>',
    content: '# <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n\n- <a href=x>Test</a>',
  });
  assert.match(html, /&lt;script&gt;alert\(&quot;title&quot;\)&lt;\/script&gt;/);
  assert.match(html, /Private &quot;data&quot; &amp; &lt;unsafe&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<script[\s>]/i);
  assert.doesNotMatch(html, /<img[\s>]/i);
  assert.doesNotMatch(html, /<a[\s>]/i);
  assert.match(html, /<h2>&lt;img/);
});

test('standalone HTML includes real printable document structure and no remote assets', () => {
  const html = buildPhiWriteHtmlDocument({ title: 'Local Notes', content: '## Agenda\n\n- One\n- Two' });
  assert.match(html, /<!doctype html>/);
  assert.match(html, /<title>Local Notes<\/title>/);
  assert.match(html, /<h1>Local Notes<\/h1>/);
  assert.match(html, /<h3>Agenda<\/h3>/);
  assert.match(html, /<ul><li>One<\/li><li>Two<\/li><\/ul>/);
  assert.match(html, /@media print/);
  assert.doesNotMatch(html, /<script[\s>]|<link[\s>]/i);
});

test('HTML escaping and print block renderer preserve special characters safely', () => {
  assert.equal(escapePhiWriteHtml('&<>"\''), '&amp;&lt;&gt;&quot;&#39;');
  const html = renderPhiWritePrintBlocksHtml([
    { kind: 'paragraph', text: 'Hello <world> & friends' },
    { kind: 'code', text: 'if (x < 2) {}' },
    { kind: 'quote', text: 'Untrusted "quotation"' },
  ]);
  assert.match(html, /Hello &lt;world&gt; &amp; friends/);
  assert.match(html, /<pre><code>if \(x &lt; 2\) \{\}<\/code><\/pre>/);
  assert.match(html, /<blockquote>Untrusted &quot;quotation&quot;<\/blockquote>/);
});

test('empty documents export without error', () => {
  assert.deepEqual(parsePhiWritePrintBlocks(''), []);
  const html = buildPhiWriteHtmlDocument({ title: '', content: '' });
  assert.match(html, /<body><main>/);
});
