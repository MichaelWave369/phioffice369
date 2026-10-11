import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPipeTable, parsePipeTableAt } from '../apps/web/src/lib/simpleTables.js';
import { parsePhiWritePrintBlocks, renderPhiWritePrintBlocksHtml } from '../apps/web/src/lib/phiwritePrint.js';
import { buildPhiWriteDocx } from '../apps/web/src/lib/docxExport.js';
import { extractDocxPackage } from '../apps/web/src/lib/docxZip.js';

test('table cells render safe basic bold, italic, code and HTTPS links in HTML', () => {
  const source = '| Part | Status |\n| --- | --- |\n| Router | **READY** / *verified* / `ipconfig` / [docs](https://example.org/docs) |';
  const blocks = parsePhiWritePrintBlocks(source);
  assert.equal(blocks[0].kind, 'table');
  const html = renderPhiWritePrintBlocksHtml(blocks);
  assert.match(html, /<td><strong>READY<\/strong> \/ <em>verified<\/em> \/ <code>ipconfig<\/code> \/ <a href="https:\/\/example.org\/docs" target="_blank" rel="noopener noreferrer">docs<\/a><\/td>/);
});

test('table header cells retain accessible tags while supporting rich spans', () => {
  const source = '| **Part** | `Command` |\n| --- | --- |\n| Router | ping |';
  const html = renderPhiWritePrintBlocksHtml(parsePhiWritePrintBlocks(source));
  assert.match(html, /<th><strong>Part<\/strong><\/th>/);
  assert.match(html, /<th><code>Command<\/code><\/th>/);
  assert.match(html, /<tbody><tr><td>Router<\/td><td>ping<\/td><\/tr><\/tbody>/);
});

test('DOCX exports cell emphasis as real Word runs and safe external link relationships', async () => {
  const source = '| Part | Details |\n| --- | --- |\n| Router | **READY** / *verified* / `ipconfig` / [docs](https://example.org/docs) |';
  const { documentXml, relationshipsXml } = await extractDocxPackage(
    buildPhiWriteDocx({ title: 'Equipment', content: source }).bytes,
  );
  assert.match(documentXml, /<w:tbl>/);
  assert.match(documentXml, /<w:tc>[\s\S]*?<w:b\/>[\s\S]*?<w:t xml:space="preserve">READY<\/w:t>/);
  assert.match(documentXml, /<w:tc>[\s\S]*?<w:i\/>[\s\S]*?<w:t xml:space="preserve">verified<\/w:t>/);
  assert.match(documentXml, /<w:rStyle w:val="CodeChar"\/>/);
  assert.match(documentXml, /<w:hyperlink r:id="rId3"/);
  assert.match(relationshipsXml, /Target="https:\/\/example.org\/docs"/);
});

test('DOCX table keeps visually harmless Markdown-style literal words as literal runs', async () => {
  const source = '| Field | Text |\n| --- | --- |\n| Literal | \\*not bold\\* |\n| Pipe | A \\| B |';
  const { documentXml } = await extractDocxPackage(
    buildPhiWriteDocx({ title: 'Raw values', content: source }).bytes,
  );
  assert.match(documentXml, /<w:t xml:space="preserve">\*not bold\*<\/w:t>/);
  assert.match(documentXml, /<w:t xml:space="preserve">A \| B<\/w:t>/);
  assert.doesNotMatch(documentXml, /<w:b\/>/);
});

test('standalone print table escapes unsafe HTML and refuses executable links', () => {
  const source = '| **Field** | Value |\n| --- | --- |\n| dangerous | <script>alert(1)</script> / [click](javascript:alert(1)) |\n| safe | [docs](https://example.org) |';
  const html = renderPhiWritePrintBlocksHtml(parsePhiWritePrintBlocks(source));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>|href="javascript:/);
  assert.match(html, /href="https:\/\/example.org\/"/);
});

test('pipe table keeps escaped pipes with formatted cell text through parse/render', () => {
  const rows = [
    ['**Device**', 'Notes'],
    ['Router', '**READY** / A | B'],
    ['Switch', String.raw`\*literal\*`],
  ];
  const result = parsePipeTableAt(renderPipeTable(rows).split('\n'), 0);
  assert.deepEqual(result.rows, rows);
  const html = renderPhiWritePrintBlocksHtml([{ kind: 'table', rows: result.rows }]);
  assert.match(html, /<strong>READY<\/strong> \/ A \| B/);
  assert.match(html, /<td>\*literal\*<\/td>/);
});

test('existing plain cells still render as plain table cells', () => {
  const html = renderPhiWritePrintBlocksHtml(parsePhiWritePrintBlocks(
    '| Product | Price |\n| --- | --- |\n| Tea & biscuits | 12 |',
  ));
  assert.match(html, /<th>Product<\/th><th>Price<\/th>/);
  assert.match(html, /<td>Tea &amp; biscuits<\/td><td>12<\/td>/);
});
