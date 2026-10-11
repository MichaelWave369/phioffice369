import test from 'node:test';
import assert from 'node:assert/strict';
import {
  safeExternalDocumentUrl, tokenizePhiWriteInline, inlineTokensToMarkdown,
} from '../apps/web/src/lib/phiwriteInline.js';
import { renderInlinePhiWriteHtml } from '../apps/web/src/lib/phiwritePrint.js';
import { buildPhiWriteDocx } from '../apps/web/src/lib/docxExport.js';
import { extractDocxPackage } from '../apps/web/src/lib/docxZip.js';

test('tiny formatting tokenizer preserves plain, bold, italic and safe links', () => {
  const tokens = tokenizePhiWriteInline('Hello **bold** plus *italic*, read [docs](https://example.org/docs).');
  assert.deepEqual(tokens, [
    { text: 'Hello ' },
    { text: 'bold', bold: true },
    { text: ' plus ' },
    { text: 'italic', italic: true },
    { text: ', read ' },
    { text: 'docs', href: 'https://example.org/docs' },
    { text: '.' },
  ]);
  assert.equal(inlineTokensToMarkdown(tokens),
    'Hello **bold** plus *italic*, read [docs](https://example.org/docs).');
});

test('document hyperlinks only allow http(s), no credentials or inline HTML injection', () => {
  for (const input of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,evil',
    'https://bob:password@example.org/', 'https://example.org/\nmalicious']) {
    assert.equal(safeExternalDocumentUrl(input), null);
  }
  assert.equal(safeExternalDocumentUrl('https://example.org/path'), 'https://example.org/path');
  const html = renderInlinePhiWriteHtml('Go [site](https://example.org/?x=1&y=2) and [bad](javascript:alert(1)) <script>alert(1)</script>');
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /href="https:\/\/example.org\/\?x=1&amp;y=2"/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('literal escaped Markdown punctuation remains literal', () => {
  const tokens = tokenizePhiWriteInline('Escaped \\*word\\* and \\[example\\]');
  assert.deepEqual(tokens, [{ text: 'Escaped *word* and [example]' }]);
  assert.equal(inlineTokensToMarkdown([{ text: 'A *literal* [name]' }]),
    'A \\*literal\\* \\[name\\]');
});

test('DOCX export writes real bold and italic Word runs and external hyperlink relationships', async () => {
  const { bytes } = buildPhiWriteDocx({
    title: 'Inline styles',
    content: 'Read **bold** and *italic*. [Source](https://example.org/docs)',
  });
  const { documentXml, relationshipsXml } = await extractDocxPackage(bytes);
  assert.match(documentXml, /<w:b\/>/);
  assert.match(documentXml, /<w:i\/>/);
  assert.match(documentXml, /<w:hyperlink r:id="rId3"/);
  assert.match(documentXml, /<w:t xml:space="preserve">Source<\/w:t>/);
  assert.match(relationshipsXml, /Id="rId3"/);
  assert.match(relationshipsXml, /Target="https:\/\/example.org\/docs"/);
  assert.match(relationshipsXml, /TargetMode="External"/);
});

test('DOCX export safely rejects unsafe link targets while retaining visible source text', async () => {
  const { documentXml, relationshipsXml } = await extractDocxPackage(buildPhiWriteDocx({
    title: 'Safe',
    content: 'See [click](javascript:alert(1)) and **<script>**',
  }).bytes);
  assert.doesNotMatch(documentXml, /<w:hyperlink/);
  assert.doesNotMatch(relationshipsXml, /TargetMode="External"/);
  assert.match(documentXml, /\[click\]\(javascript:alert\(1\)\)/);
  assert.match(documentXml, /&lt;script&gt;/);
  assert.doesNotMatch(documentXml, /<script>/);
});
