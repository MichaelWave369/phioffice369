import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHIWRITE_SPECIAL_BLOCKS, formatPhiWriteSpecialBlock,
} from '../apps/web/src/lib/phiwriteEditorSpecialBlocks.js';
import {
  parsePhiWritePrintBlocks, renderPhiWritePrintBlocksHtml,
} from '../apps/web/src/lib/phiwritePrint.js';
import { buildPhiWriteDocx } from '../apps/web/src/lib/docxExport.js';
import { extractDocxPackage } from '../apps/web/src/lib/docxZip.js';

function convert(source, fragment, action) {
  const start = source.indexOf(fragment);
  assert.ok(start >= 0, 'fixture fragment not found');
  return formatPhiWriteSpecialBlock(source, start, start + fragment.length, action);
}

test('quote toolbar transforms only the selected physical line and preserves inline formatting', () => {
  const source = 'Before\nKeep **receipts** and [sources](https://example.org/docs)\nAfter';
  const result = convert(source, 'Keep **receipts** and [sources](https://example.org/docs)', 'quote');
  assert.equal(result.content, source.replace('Keep', '> Keep'));
  assert.equal(result.content.slice(result.selectionStart, result.selectionEnd),
    '> Keep **receipts** and [sources](https://example.org/docs)');
  const html = renderPhiWritePrintBlocksHtml(parsePhiWritePrintBlocks(result.content));
  assert.match(html, /<blockquote>Keep <strong>receipts<\/strong> and <a href="https:\/\/example.org\/docs"/);
});

test('quote action toggles entire selected group without dropping user text', () => {
  const source = 'Quote this\nAnd that';
  const once = formatPhiWriteSpecialBlock(source, 0, source.length, 'quote');
  assert.equal(once.content, '> Quote this\n> And that');
  const twice = formatPhiWriteSpecialBlock(once.content, once.selectionStart, once.selectionEnd, 'quote');
  assert.equal(twice.content, source);
  assert.equal(twice.content.slice(twice.selectionStart, twice.selectionEnd), source);
});

test('quote toggle protects against mixed quoted and unquoted selections', () => {
  const source = '> Already quoted\nNot quoted';
  const result = formatPhiWriteSpecialBlock(source, 0, source.length, 'quote');
  assert.equal(result.changed, false);
  assert.equal(result.reason, 'structured');
  assert.equal(result.content, source);
});

test('quote caret remains within text after toggling', () => {
  const first = formatPhiWriteSpecialBlock('Keep receipts', 6, 6, 'quote');
  assert.equal(first.content, '> Keep receipts');
  assert.equal(first.selectionStart, 8);
  const removed = formatPhiWriteSpecialBlock(first.content, 8, 8, 'quote');
  assert.equal(removed.content, 'Keep receipts');
  assert.equal(removed.selectionStart, 6);
});

test('three-tilde code fences preserve adjacent lines and have clean roundtrip undo', () => {
  const source = 'Before\nconst answer = 42;\nAfter';
  const once = convert(source, 'const answer = 42;', 'codeblock');
  assert.equal(once.content, 'Before\n~~~\nconst answer = 42;\n~~~\nAfter');
  assert.equal(once.content.slice(once.selectionStart, once.selectionEnd), 'const answer = 42;');
  assert.deepEqual(parsePhiWritePrintBlocks(once.content).map((block) => block.kind),
    ['paragraph', 'code', 'paragraph']);
  const twice = formatPhiWriteSpecialBlock(once.content,
    once.selectionStart, once.selectionEnd, 'codeblock');
  assert.equal(twice.content, source);
});

test('multiline code block uses literal code, not nested Markdown formatting', () => {
  const source = 'const x = "**not bold**";\nconst y = 5;';
  const result = formatPhiWriteSpecialBlock(source, 0, source.length, 'codeblock');
  assert.equal(result.content, '~~~\n' + source + '\n~~~');
  const html = renderPhiWritePrintBlocksHtml(parsePhiWritePrintBlocks(result.content));
  assert.match(html, /<pre><code>const x = &quot;\*\*not bold\*\*&quot;;\nconst y = 5;<\/code><\/pre>/);
  assert.doesNotMatch(html, /<strong>/);
  const restored = formatPhiWriteSpecialBlock(result.content, result.selectionStart,
    result.selectionEnd, 'codeblock');
  assert.equal(restored.content, source);
});

test('code action at collapsed caret preserves absolute text position through toggle', () => {
  const source = 'run diagnostic';
  const first = formatPhiWriteSpecialBlock(source, 4, 4, 'codeblock');
  assert.equal(first.content, '~~~\nrun diagnostic\n~~~');
  assert.equal(first.selectionStart, 8);
  const removed = formatPhiWriteSpecialBlock(first.content, 8, 8, 'codeblock');
  assert.equal(removed.content, source);
  assert.equal(removed.selectionStart, 4);
});

test('refuse edits to an existing fenced region unless exact wrapper is selected', () => {
  const source = '~~~\nline one\nline two\n~~~';
  const result = convert(source, 'line one', 'codeblock');
  assert.equal(result.changed, false);
  assert.equal(result.reason, 'code');
  const quote = convert(source, 'line two', 'quote');
  assert.equal(quote.changed, false);
  assert.equal(quote.reason, 'code');
});

test('refuse fence delimiters inside selected content to avoid false code closure', () => {
  for (const source of ['~~~', '~~~~', '```', '~~~not a delimiter']) {
    const result = formatPhiWriteSpecialBlock(source, 0, source.length, 'codeblock');
    assert.equal(result.changed, false, source);
    assert.equal(result.reason, 'code', source);
  }
});

test('structured headings, list items, tables, and blockquotes are not silently rewritten', () => {
  for (const source of ['## Heading', '- Bullet', '2. Numbered',
    '> Quotation', '| Field | Value |', '    indented code']) {
    for (const action of ['quote', 'codeblock']) {
      const result = formatPhiWriteSpecialBlock(source, 0, source.length, action);
      if (source.startsWith('> ') && action === 'quote') {
        assert.equal(result.content, 'Quotation');
      } else {
        assert.equal(result.changed, false, source + ':' + action);
        assert.equal(result.reason, 'structured', source + ':' + action);
      }
    }
  }
});

test('blank lines, excessive selections, and selection ending at next-line boundary are bounded', () => {
  assert.equal(formatPhiWriteSpecialBlock('One\n\nTwo', 0, 8, 'quote').reason, 'blank');
  const long = Array.from({ length: 101 }, (_, i) => 'line ' + i).join('\n');
  assert.equal(formatPhiWriteSpecialBlock(long, 0, long.length, 'codeblock').reason, 'blank');
  assert.equal(formatPhiWriteSpecialBlock('One\nTwo', 0, 4, 'quote').content, '> One\nTwo');
});

test('code and quote blocks export native Word paragraph styles', async () => {
  const quote = formatPhiWriteSpecialBlock('Keep **receipts**', 0, 17, 'quote').content;
  const code = formatPhiWriteSpecialBlock('ping 192.0.2.1', 0, 14, 'codeblock').content;
  const { documentXml } = await extractDocxPackage(buildPhiWriteDocx({
    title: 'Field log', content: quote + '\n\n' + code,
  }).bytes);
  assert.match(documentXml, /<w:pStyle w:val="Quote"\/>/);
  assert.match(documentXml, /<w:pStyle w:val="Code"\/>/);
  assert.match(documentXml, /<w:b\/>/);
  assert.match(documentXml, /ping 192\.0\.2\.1/);
});

test('literal raw HTML in quotes and fenced blocks is escaped in standalone preview', () => {
  const quote = formatPhiWriteSpecialBlock('<script>bad()</script>', 0, 22, 'quote');
  const code = formatPhiWriteSpecialBlock('<img src=x onerror=evil()>', 0, 26, 'codeblock');
  const html = renderPhiWritePrintBlocksHtml(parsePhiWritePrintBlocks(quote.content + '\n\n' + code.content));
  assert.match(html, /&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=evil\(\)&gt;/);
  assert.doesNotMatch(html, /<script>|<img/);
});

test('unsupported special block action and reversed offsets fail safely', () => {
  assert.deepEqual(Object.keys(PHIWRITE_SPECIAL_BLOCKS), ['quote', 'codeblock']);
  assert.throws(() => formatPhiWriteSpecialBlock('text', 0, 4, 'eval'), RangeError);
  assert.equal(formatPhiWriteSpecialBlock('Review', 100, -10, 'quote').content, '> Review');
});
