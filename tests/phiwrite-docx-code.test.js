import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenizePhiWriteInline, inlineTokensToMarkdown, escapeInlineMarkdownText,
} from '../apps/web/src/lib/phiwriteInline.js';
import {
  parsePhiWritePrintBlocks, renderInlinePhiWriteHtml, renderPhiWritePrintBlocksHtml,
} from '../apps/web/src/lib/phiwritePrint.js';
import { buildPhiWriteDocx } from '../apps/web/src/lib/docxExport.js';
import { extractDocxPackage } from '../apps/web/src/lib/docxZip.js';
import { renderDocxBlocksAsMarkdown } from '../apps/web/src/lib/docxImport.js';

test('single-backtick code is parsed before inner Markdown syntax', () => {
  const value = 'Run `ipconfig /all` with `*literal* [link](https://example.com)` now';
  assert.deepEqual(tokenizePhiWriteInline(value), [
    { text: 'Run ' },
    { text: 'ipconfig /all', code: true },
    { text: ' with ' },
    { text: '*literal* [link](https://example.com)', code: true },
    { text: ' now' },
  ]);
  assert.equal(inlineTokensToMarkdown(tokenizePhiWriteInline(value)), value);
});

test('escaped code delimiters remain literal without emitting code elements', () => {
  assert.deepEqual(tokenizePhiWriteInline(String.raw`Escape \`literal\` now`), [
    { text: 'Escape `literal` now' },
  ]);
  assert.match(escapeInlineMarkdownText('A * [ ] \\ `'), /\\\*/);
  const html = renderInlinePhiWriteHtml(String.raw`Escape \`literal\` now`);
  assert.doesNotMatch(html, /<code>/);
  assert.match(html, /Escape `literal` now/);
});

test('safe HTML output uses inline code and escapes scripts rather than interpreting them', () => {
  const value = 'Try `<img onerror=alert(1)>` and **bold**';
  const html = renderInlinePhiWriteHtml(value);
  assert.match(html, /<code>&lt;img onerror=alert\(1\)&gt;<\/code>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /onerror="/);
});

test('genuine Word DOCX exports standalone CodeChar runs and monospace character style', async () => {
  const { bytes } = buildPhiWriteDocx({
    title: 'Commands',
    content: 'Run `ipconfig /all` and `ping 192.0.2.1`.',
  });
  const { documentXml, stylesXml } = await extractDocxPackage(bytes);
  assert.match(documentXml, /<w:rStyle w:val="CodeChar"\/>/);
  assert.match(documentXml, /<w:t xml:space="preserve">ipconfig \/all<\/w:t>/);
  assert.match(documentXml, /<w:t xml:space="preserve">ping 192\.0\.2\.1<\/w:t>/);
  assert.match(stylesXml, /<w:style w:type="character" w:styleId="CodeChar">/);
  assert.match(stylesXml, /<w:rFonts w:ascii="Consolas"/);
});

test('code blocks remain literal and export as Word Code style paragraphs', async () => {
  const markdown = '~~~\nping 192.0.2.1\ntracert example.org\n~~~';
  const blocks = parsePhiWritePrintBlocks(markdown);
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0], { kind: 'code', text: 'ping 192.0.2.1\ntracert example.org' });
  const { documentXml } = await extractDocxPackage(buildPhiWriteDocx({
    title: 'Terminal', content: markdown,
  }).bytes);
  assert.match(documentXml, /<w:pStyle w:val="Code"\/>/);
  assert.match(documentXml, /<w:br\/>/);
  assert.match(documentXml, /ping 192\.0\.2\.1/);
  assert.match(documentXml, /tracert example\.org/);
  const printHtml = renderPhiWritePrintBlocksHtml(blocks);
  assert.match(printHtml, /<pre><code>ping 192\.0\.2\.1\ntracert example\.org<\/code><\/pre>/);
});

test('Word code blocks become Markdown fences, preserving code characters', () => {
  const markdown = renderDocxBlocksAsMarkdown([
    { kind: 'heading', text: 'Commands', level: 1 },
    { kind: 'code', text: 'ipconfig /all\nping <router> && traceroute example.org' },
  ]);
  assert.equal(markdown,
    '# Commands\n\n~~~\nipconfig /all\nping <router> && traceroute example.org\n~~~');
  const blocks = parsePhiWritePrintBlocks(markdown);
  assert.equal(blocks[1].kind, 'code');
  assert.equal(blocks[1].text, 'ipconfig /all\nping <router> && traceroute example.org');
});

test('Word text imported as code without a backtick is plain and escaped', () => {
  assert.equal(inlineTokensToMarkdown([{ text: 'user *arg*', code: true }]),
    '`user *arg*`');
  const unsafeDelimiter = inlineTokensToMarkdown([{ text: 'name`flag', code: true }]);
  assert.doesNotMatch(unsafeDelimiter, /^`.*`$/);
  assert.match(unsafeDelimiter, /\\`/);
});

test('ordinary markdown and unsupported nested inline syntax still remain bounded', () => {
  assert.deepEqual(parsePhiWritePrintBlocks('~~~\n**do not bold**\n~~~')
    .map((block) => block.kind), ['code']);
  assert.equal(tokenizePhiWriteInline('`not closed').length, 1);
  assert.deepEqual(tokenizePhiWriteInline('`not closed'), [{ text: '`not closed' }]);
});
