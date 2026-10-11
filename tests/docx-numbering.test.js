import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePhiWritePrintBlocks, renderPhiWritePrintBlocksHtml } from '../apps/web/src/lib/phiwritePrint.js';
import { renderDocxBlocksAsMarkdown } from '../apps/web/src/lib/docxImport.js';
import { buildPhiWriteDocx, zipStoredDocxParts } from '../apps/web/src/lib/docxExport.js';
import { extractDocxPackage, extractDocxXml } from '../apps/web/src/lib/docxZip.js';

test('PhiWrite Markdown parser preserves the numeric start of ordered lists', () => {
  const blocks = parsePhiWritePrintBlocks('3. First step\n4. Second step\n\n- Bullet note');
  assert.equal(blocks[0].kind, 'list');
  assert.equal(blocks[0].listType, 'ol');
  assert.equal(blocks[0].start, 3);
  assert.deepEqual(blocks[0].items, ['First step', 'Second step']);
  assert.equal(blocks[1].listType, 'ul');
  const html = renderPhiWritePrintBlocksHtml(blocks);
  assert.match(html, /<ol start="3"><li>First step<\/li><li>Second step<\/li><\/ol>/);
  assert.match(html, /<ul><li>Bullet note<\/li><\/ul>/);
});

test('Word-to-Markdown renderer joins related numbered items without blank lines', () => {
  const markdown = renderDocxBlocksAsMarkdown([
    { kind: 'heading', text: 'Procedure', level: 2 },
    { kind: 'list', text: 'First', listType: 'ol', number: 3, group: 'num-7-level-0' },
    { kind: 'list', text: 'Second', listType: 'ol', number: 4, group: 'num-7-level-0' },
    { kind: 'paragraph', text: 'Note' },
    { kind: 'list', text: 'Third', listType: 'ol', number: 5, group: 'num-7-level-0' },
    { kind: 'list', text: 'Bullet', listType: 'ul', group: 'num-8-level-0' },
  ]);
  assert.equal(markdown, '## Procedure\n\n3. First\n4. Second\n\nNote\n\n5. Third\n\n- Bullet');
  const parsed = parsePhiWritePrintBlocks(markdown);
  assert.deepEqual(parsed.map(x => x.kind), ['heading', 'list', 'paragraph', 'list', 'list']);
  assert.equal(parsed[1].start, 3);
  assert.equal(parsed[3].start, 5);
});

test('DOCX XML export creates separate ordered-list definitions and start overrides', async () => {
  const source = '3. Step A\n4. Step B\n\n- Other\n\n1. Fresh list';
  const { bytes } = buildPhiWriteDocx({ title: 'Numbered plan', content: source });
  const { documentXml, numberingXml } = await extractDocxPackage(bytes);
  assert.match(numberingXml, /<w:abstractNum w:abstractNumId="1">/);
  assert.match(numberingXml, /<w:numFmt w:val="decimal"\/>/);
  assert.match(numberingXml, /<w:numFmt w:val="bullet"\/>/);
  assert.match(numberingXml, /<w:num w:numId="2"><w:abstractNumId w:val="1"\/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="3"\/>/);
  assert.match(numberingXml, /<w:num w:numId="3"><w:abstractNumId w:val="1"\/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"\/>/);
  assert.equal((documentXml.match(/<w:numId w:val="2"/g) ?? []).length, 2);
  assert.equal((documentXml.match(/<w:numId w:val="3"/g) ?? []).length, 1);
  assert.equal((documentXml.match(/<w:numId w:val="1"/g) ?? []).length, 1);
});

test('Word exporter does not change legacy simple bullet and numbered list shapes', async () => {
  const { bytes } = buildPhiWriteDocx({title:'Test', content:'- Bullet\n\n1. Numbered'});
  const { numberingXml } = await extractDocxPackage(bytes);
  assert.match(numberingXml, /<w:num w:numId="1"><w:abstractNumId w:val="0"\/>/);
  assert.match(numberingXml, /<w:num w:numId="2"><w:abstractNumId w:val="1"\/>/);
});

test('DOCX ZIP reader rejects numbering definitions with unsafe XML entities', async () => {
  const bytes = zipStoredDocxParts([
    ['[Content_Types].xml', '<Types>application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml</Types>'],
    ['word/document.xml', '<?xml version="1.0"?><w:document/>'],
    ['word/numbering.xml', '<!DOCTYPE x [<!ENTITY leak SYSTEM "file:///secret">]><w:numbering/>'],
  ]);
  await assert.rejects(() => extractDocxPackage(bytes), /DOCTYPE/);
});

test('DOCX ZIP reader enforces a separate strict numbering XML size budget', async () => {
  const bytes = zipStoredDocxParts([
    ['[Content_Types].xml', '<Types>application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml</Types>'],
    ['word/document.xml', '<?xml version="1.0"?><w:document/>'],
    ['word/numbering.xml', ' '.repeat(1024 * 1024 + 1)],
  ]);
  await assert.rejects(() => extractDocxPackage(bytes), /XML entry exceeds the preview limit/);
});

test('standalone document renderer escapes list content and treats list number as numeric only', () => {
  const blocks = parsePhiWritePrintBlocks('9. <img src=x onerror=evil()>');
  const html = renderPhiWritePrintBlocksHtml(blocks);
  assert.match(html, /<ol start="9">/);
  assert.match(html, /&lt;img src=x onerror=evil\(\)&gt;/);
  assert.doesNotMatch(html, /<img/);
});
