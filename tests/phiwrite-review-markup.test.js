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
import { renderPipeTable, parsePipeTableAt } from '../apps/web/src/lib/simpleTables.js';

test('strike and yellow highlight produce nonnested inline tokens with ordinary formatting', () => {
  const value = 'Review ~~obsolete~~ then ==important== and **bold** / *italic*';
  assert.deepEqual(tokenizePhiWriteInline(value), [
    { text: 'Review ' },
    { text: 'obsolete', strike: true },
    { text: ' then ' },
    { text: 'important', highlight: true },
    { text: ' and ' },
    { text: 'bold', bold: true },
    { text: ' / ' },
    { text: 'italic', italic: true },
  ]);
  assert.equal(inlineTokensToMarkdown(tokenizePhiWriteInline(value)), value);
});

test('literal escaped review delimiters do not become visual review markup', () => {
  const value = String.raw`\~\~not removed\~\~ and \=\=not highlighted\=\=`;
  assert.deepEqual(tokenizePhiWriteInline(value), [
    { text: '~~not removed~~ and ==not highlighted==' },
  ]);
  const escaped = escapeInlineMarkdownText('~~raw~~ ==raw==');
  assert.equal(escaped, String.raw`\~\~raw\~\~ \=\=raw\=\=`);
  const html = renderInlinePhiWriteHtml(value);
  assert.equal(html, '~~not removed~~ and ==not highlighted==');
});

test('inline code and unsupported multiline syntax retain precedence', () => {
  const tokens = tokenizePhiWriteInline('Use `~~literal~~ ==literal==`, and ~~removed~~');
  assert.deepEqual(tokens, [
    { text: 'Use ' },
    { text: '~~literal~~ ==literal==', code: true },
    { text: ', and ' },
    { text: 'removed', strike: true },
  ]);
  assert.deepEqual(tokenizePhiWriteInline('==not\nclosed=='), [
    { text: '==not\nclosed==' },
  ]);
  assert.deepEqual(tokenizePhiWriteInline('~~not\nclosed~~'), [
    { text: '~~not\nclosed~~' },
  ]);
});

test('standalone HTML renders semantic mark/del and never executes markup', () => {
  const source = '~~<script>alert(1)</script>~~ / ==<img onerror=evil()>==';
  const html = renderInlinePhiWriteHtml(source);
  assert.match(html, /<del>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/del>/);
  assert.match(html, /<mark>&lt;img onerror=evil\(\)&gt;<\/mark>/);
  assert.doesNotMatch(html, /<script>|<img/);
});

test('Word XML writes proper strikethrough and yellow highlight run properties', async () => {
  const { documentXml } = await extractDocxPackage(buildPhiWriteDocx({
    title: 'Review Notes',
    content: 'Review ~~retired~~ then ==verify==.',
  }).bytes);
  assert.match(documentXml, /<w:rPr><w:strike\/><\/w:rPr><w:t xml:space="preserve">retired<\/w:t>/);
  assert.match(documentXml, /<w:rPr><w:highlight w:val="yellow"\/><\/w:rPr><w:t xml:space="preserve">verify<\/w:t>/);
  assert.doesNotMatch(documentXml, /<w:highlight w:val="green"/);
});

test('table-cell markup and quotes retain consistent semantic review formatting', async () => {
  const source = '| **Item** | Status |\n| --- | --- |\n| Cable | ~~old~~ / ==new== |\n\n> ==Check again==';
  const blocks = parsePhiWritePrintBlocks(source);
  assert.deepEqual(blocks.map(x => x.kind), ['table', 'quote']);
  const html = renderPhiWritePrintBlocksHtml(blocks);
  assert.match(html, /<td><del>old<\/del> \/ <mark>new<\/mark><\/td>/);
  assert.match(html, /<blockquote><mark>Check again<\/mark><\/blockquote>/);
  const { documentXml } = await extractDocxPackage(buildPhiWriteDocx({
    title: 'Review Table', content: source,
  }).bytes);
  assert.match(documentXml, /<w:tbl>/);
  assert.match(documentXml, /<w:strike\/>/);
  assert.match(documentXml, /<w:highlight w:val="yellow"\/>/);
  assert.match(documentXml, /<w:pStyle w:val="Quote"\/>/);
});

test('review markup survives an escaped pipe in rectangular table cells', () => {
  const rows = [
    ['Asset', 'Status'],
    ['Cable | A', '~~old~~ / ==new=='],
  ];
  const encoded = renderPipeTable(rows);
  assert.deepEqual(parsePipeTableAt(encoded.split('\n'), 0).rows, rows);
  const html = renderPhiWritePrintBlocksHtml(parsePhiWritePrintBlocks(encoded));
  assert.match(html, /<del>old<\/del> \/ <mark>new<\/mark>/);
  assert.match(html, /Cable \| A/);
});

test('Markdown reserialization never incorrectly converts unsupported overlapping styles', () => {
  const text = inlineTokensToMarkdown([{ text: 'review', bold: true, highlight: true }]);
  assert.equal(text, '==review==');
  assert.deepEqual(tokenizePhiWriteInline(text), [{ text: 'review', highlight: true }]);
});
