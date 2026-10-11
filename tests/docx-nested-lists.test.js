import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePhiWritePrintBlocks, renderPhiWritePrintBlocksHtml } from '../apps/web/src/lib/phiwritePrint.js';
import { renderDocxBlocksAsMarkdown } from '../apps/web/src/lib/docxImport.js';
import { buildPhiWriteDocx } from '../apps/web/src/lib/docxExport.js';
import { extractDocxPackage } from '../apps/web/src/lib/docxZip.js';

const nested = '2. Install router\n  - Label cables\n  - Verify ports\n3. Test link';

test('two-space nested Markdown builds a separate two-level list block', () => {
  const blocks = parsePhiWritePrintBlocks(nested);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, 'nested-list');
  assert.deepEqual(blocks[0].items, [
    { level: 0, listType: 'ol', text: 'Install router', number: 2 },
    { level: 1, listType: 'ul', text: 'Label cables' },
    { level: 1, listType: 'ul', text: 'Verify ports' },
    { level: 0, listType: 'ol', text: 'Test link', number: 3 },
  ]);
});

test('nested HTML has semantic list descendants under the parent li', () => {
  const html = renderPhiWritePrintBlocksHtml(parsePhiWritePrintBlocks(nested));
  assert.match(html, /<ol start="2"><li>Install router<ul><li>Label cables<\/li><li>Verify ports<\/li><\/ul><\/li><li>Test link<\/li><\/ol>/);
  assert.doesNotMatch(html, /<script>|onerror=/);
});

test('Word importer writes indented Markdown for related nested list levels', () => {
  const body = renderDocxBlocksAsMarkdown([
    { kind: 'list', text: 'Install router', listType: 'ol', number: 2, group: 'num-9-level-0', listRoot: 'num-9', listLevel: 0 },
    { kind: 'list', text: 'Label cables', listType: 'ul', group: 'num-9-level-1', listRoot: 'num-9', listLevel: 1 },
    { kind: 'list', text: 'Verify ports', listType: 'ul', group: 'num-9-level-1', listRoot: 'num-9', listLevel: 1 },
    { kind: 'list', text: 'Test link', listType: 'ol', number: 3, group: 'num-9-level-0', listRoot: 'num-9', listLevel: 0 },
  ]);
  assert.equal(body, nested);
  assert.equal(parsePhiWritePrintBlocks(body)[0].kind, 'nested-list');
});

test('mixed nested Markdown DOCX export includes two-level numbering XML', async () => {
  const { bytes } = buildPhiWriteDocx({ title: 'Field install', content: nested });
  const { documentXml, numberingXml } = await extractDocxPackage(bytes);
  assert.match(numberingXml, /<w:multiLevelType w:val="multilevel"\/>/);
  assert.match(numberingXml, /<w:abstractNum w:abstractNumId="2">/);
  assert.match(numberingXml, /<w:lvl w:ilvl="0">[\s\S]*?<w:numFmt w:val="decimal"/);
  assert.match(numberingXml, /<w:lvl w:ilvl="1">[\s\S]*?<w:numFmt w:val="bullet"/);
  assert.match(numberingXml, /<w:num w:numId="2"><w:abstractNumId w:val="2"\/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="2"\/>/);
  assert.equal((documentXml.match(/<w:ilvl w:val="1"\/>/g) ?? []).length, 2);
  assert.equal((documentXml.match(/<w:ilvl w:val="0"\/>/g) ?? []).length, 2);
  assert.equal((documentXml.match(/<w:numId w:val="2"\/>/g) ?? []).length, 4);
});

test('two-level lists do not accidentally interpret fenced code or script HTML', () => {
  const blocks = parsePhiWritePrintBlocks('~~~\n1. Setup\n  - dangerous\n~~~');
  assert.deepEqual(blocks.map(x => x.kind), ['code']);
  const text = '1. <script>alert(1)</script>\n  - **Safe**';
  const html = renderPhiWritePrintBlocksHtml(parsePhiWritePrintBlocks(text));
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<strong>Safe<\/strong>/);
});

test('legacy flat list shape and numbering remains intact', () => {
  const blocks = parsePhiWritePrintBlocks('- One\n- Two\n\n3. A\n4. B');
  assert.deepEqual(blocks.map(x => x.kind), ['list', 'list']);
  assert.deepEqual(blocks[0].items, ['One', 'Two']);
  assert.equal(blocks[1].start, 3);
});
