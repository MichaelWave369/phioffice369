import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitPipeTableRow, renderPipeTable, parsePipeTableAt,
} from '../apps/web/src/lib/simpleTables.js';
import {
  parsePhiWritePrintBlocks, renderPhiWritePrintBlocksHtml,
} from '../apps/web/src/lib/phiwritePrint.js';
import { buildPhiWriteDocx } from '../apps/web/src/lib/docxExport.js';
import { extractDocxXml } from '../apps/web/src/lib/docxZip.js';

test('pipe table parsing retains Unicode and escaped pipes without interpreting HTML', () => {
  const lines = [
    '| Item | Details |',
    '| --- | :--- |',
    '| Café | A \\| B |',
    '| Dangerous | <script>alert(1)</script> |',
  ];
  const table = parsePipeTableAt(lines, 0);
  assert.deepEqual(table.rows, [
    ['Item', 'Details'],
    ['Café', 'A | B'],
    ['Dangerous', '<script>alert(1)</script>'],
  ]);
  assert.equal(table.nextIndex, 4);
  const html = renderPhiWritePrintBlocksHtml([{ kind: 'table', rows: table.rows }]);
  assert.match(html, /<table><thead>/);
  assert.match(html, /<th>Item<\/th>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('Word-style table values serialize to parseable rectangular Markdown', () => {
  const rows = [
    ['Name', 'Notes'],
    ['A | B', 'Back\\slash'],
    ['Café', '20 < 50 & ok'],
  ];
  const markdown = renderPipeTable(rows);
  assert.deepEqual(parsePipeTableAt(markdown.split('\n'), 0).rows, rows);
});

test('pipe tables require equal-width data, valid separators and bounded sizes', () => {
  assert.equal(parsePipeTableAt(['| One | Two |', '| -- | --- |'], 0), null);
  assert.equal(parsePipeTableAt(['| One | Two |', '| --- |'], 0), null);
  assert.throws(() => renderPipeTable([['one']]), /2–32/);
  assert.throws(() => renderPipeTable([['a', 'b'], ['c']]), /equal-width/);
  assert.throws(() => renderPipeTable([Array.from({length:33}, (_, n) => String(n))]), /2–32/);
});

test('PhiWrite print block parser recognizes a table after text and before a heading', () => {
  const markdown = 'Intro\n\n| Product | Amount |\n| --- | --- |\n| Tea | 12 |\n\n## Closing';
  const blocks = parsePhiWritePrintBlocks(markdown);
  assert.deepEqual(blocks.map((block) => block.kind), ['paragraph', 'table', 'heading']);
  assert.deepEqual(blocks[1].rows, [['Product', 'Amount'], ['Tea', '12']]);
});

test('PhiWrite exporter creates a native Word table with grid, heading row and cells', async () => {
  const source = '| Item | Amount |\n| --- | --- |\n| Tea | 12 |\n| Coffee | 20 |';
  const bytes = buildPhiWriteDocx({title:'Local invoice', content:source}).bytes;
  const xml = await extractDocxXml(bytes);
  assert.match(xml, /<w:tbl>/);
  assert.match(xml, /<w:tblGrid>/);
  assert.match(xml, /<w:tblHeader w:val="true"\/>/);
  assert.match(xml, /<w:tc>/);
  assert.match(xml, /<w:t xml:space="preserve">Tea<\/w:t>/);
  assert.equal((xml.match(/<w:tr>/g) || []).length, 3);
  assert.equal((xml.match(/<w:tc>/g) || []).length, 6);
});

test('cells with literal HTML-like text remain safe in export XML', async () => {
  const source = '| Field | Value |\n| --- | --- |\n| Safe | <img src=x onerror=evil()> |';
  const xml = await extractDocxXml(buildPhiWriteDocx({ title:'Safe table', content:source }).bytes);
  assert.match(xml, /&lt;img src=x onerror=evil\(\)&gt;/);
  assert.doesNotMatch(xml, /<img/);
});

test('simple Word-style table conversion never interprets code fences as tables', () => {
  const blocks = parsePhiWritePrintBlocks('~~~\n| A | B |\n| --- | --- |\n~~~');
  assert.deepEqual(blocks.map((block) => block.kind), ['code']);
});

test('splitPipeTableRow rejects unsupported outer syntax', () => {
  assert.equal(splitPipeTableRow('A | B'), null);
  assert.equal(splitPipeTableRow('| A | B'), null);
});
