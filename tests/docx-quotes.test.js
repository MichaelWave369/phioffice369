import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePhiWritePrintBlocks, renderPhiWritePrintBlocksHtml, buildPhiWriteHtmlDocument,
} from '../apps/web/src/lib/phiwritePrint.js';
import { renderDocxBlocksAsMarkdown } from '../apps/web/src/lib/docxImport.js';
import { buildPhiWriteDocx } from '../apps/web/src/lib/docxExport.js';
import { extractDocxPackage } from '../apps/web/src/lib/docxZip.js';

test('Word Quote-style paragraphs become a contiguous Markdown blockquote', () => {
  const markdown = renderDocxBlocksAsMarkdown([
    { kind: 'heading', level: 2, text: 'Reference' },
    { kind: 'quote', text: 'Keep **receipts**' },
    { kind: 'quote', text: 'Ledger: [source](https://example.org/docs)\nVerify again' },
    { kind: 'paragraph', text: 'Ordinary notes' },
  ]);
  assert.equal(markdown, '## Reference\n\n> Keep **receipts**\n> Ledger: [source](https://example.org/docs)\n> Verify again\n\nOrdinary notes');
  const parsed = parsePhiWritePrintBlocks(markdown);
  assert.deepEqual(parsed.map((block) => block.kind), ['heading', 'quote', 'paragraph']);
  assert.equal(parsed[1].text, 'Keep **receipts**\nLedger: [source](https://example.org/docs)\nVerify again');
  const html = renderPhiWritePrintBlocksHtml(parsed);
  assert.match(html, /<blockquote>Keep <strong>receipts<\/strong>\nLedger: <a href="https:\/\/example.org\/docs"/);
  assert.match(html, /Verify again<\/blockquote>/);
});

test('Word quotation punctuation and Unicode survive without spurious escape slashes', () => {
  const input = ['> nested-looking quote', '# heading-looking quote', '3. list-looking quote', 'Café ∞'].join('\n');
  const markdown = renderDocxBlocksAsMarkdown([{ kind: 'quote', text: input }]);
  const block = parsePhiWritePrintBlocks(markdown)[0];
  assert.equal(block.kind, 'quote');
  assert.equal(block.text, input);
  assert.match(markdown, /^> > nested-looking quote/m);
  assert.match(markdown, /^> # heading-looking quote/m);
  assert.match(markdown, /^> 3\. list-looking quote/m);
});

test('Word quote text is always escaped in exported HTML, never interpreted as a tag', () => {
  const text = 'Real quote: <script>alert(1)</script> & <img onerror=evil()>';
  const markdown = renderDocxBlocksAsMarkdown([{kind:'quote', text}]);
  const html = buildPhiWriteHtmlDocument({ title: 'Quotation', content: markdown });
  assert.match(html, /<blockquote>Real quote: &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &lt;img onerror=evil\(\)&gt;<\/blockquote>/);
  assert.doesNotMatch(html, /<script>|<img/);
});

test('PhiWrite exports multiple quoted Markdown lines as genuine Word Quote style', async () => {
  const content = '> Keep **receipts**\n> [source](https://example.org/docs)\n> ipconfig /all';
  const { bytes } = buildPhiWriteDocx({ title: 'Quoted procedure', content });
  const { documentXml, stylesXml, relationshipsXml } = await extractDocxPackage(bytes);
  assert.match(documentXml, /<w:pStyle w:val="Quote"\/>/);
  assert.match(documentXml, /<w:b\/>/);
  assert.match(documentXml, /<w:br\/>/);
  assert.match(documentXml, /<w:hyperlink r:id="rId3"/);
  assert.match(stylesXml, /<w:style w:type="paragraph" w:styleId="Quote">/);
  assert.match(relationshipsXml, /Target="https:\/\/example.org\/docs"/);
});

test('ordinary paragraphs and consecutive quotations do not merge across a separator', () => {
  const markdown = renderDocxBlocksAsMarkdown([
    { kind:'quote', text:'First' },
    { kind:'paragraph', text:'Break' },
    { kind:'quote', text:'Second' },
    { kind:'quote', text:'Third' },
  ]);
  assert.equal(markdown, '> First\n\nBreak\n\n> Second\n> Third');
  assert.deepEqual(parsePhiWritePrintBlocks(markdown).map(x=>x.kind),
    ['quote','paragraph','quote']);
});

test('a quote marker inside a Word quote remains literal text, not a nested unsafe element', () => {
  const markdown = renderDocxBlocksAsMarkdown([{kind:'quote',text:'> quoted again'}]);
  const html = renderPhiWritePrintBlocksHtml(parsePhiWritePrintBlocks(markdown));
  assert.equal(html, '<blockquote>&gt; quoted again</blockquote>');
});
