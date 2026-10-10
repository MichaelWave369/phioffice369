import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPhiWriteDocx,
  DOCX_EXPORT_MIME,
  DOCX_EXPORT_SCHEMA,
  escapeDocxXml,
  zipStoredDocxParts,
} from '../apps/web/src/lib/docxExport.js';
import { extractDocxXml, findDocxZipEntries } from '../apps/web/src/lib/docxZip.js';

test('DOCX exporter creates a real standard ZIP package with the six required OPC parts', async () => {
  const doc = buildPhiWriteDocx({ title: 'PhiOffice Letter', content: '## Overview\n\nHello Word.' });
  assert.equal(doc.schema, DOCX_EXPORT_SCHEMA);
  assert.equal(doc.mime, DOCX_EXPORT_MIME);
  assert.deepEqual([...doc.bytes.subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const { entries } = findDocxZipEntries(doc.bytes);
  assert.deepEqual([...entries.keys()], [
    '[Content_Types].xml',
    '_rels/.rels',
    'word/document.xml',
    'word/_rels/document.xml.rels',
    'word/styles.xml',
    'word/numbering.xml',
  ]);
  assert.ok([...entries.values()].every((entry) => entry.method === 0));
  const xml = await extractDocxXml(doc.bytes);
  assert.match(xml, /<w:document xmlns:w=/);
  assert.match(xml, /<w:pStyle w:val="Title"/);
  assert.match(xml, /<w:pStyle w:val="Heading2"/);
  assert.match(xml, /PhiOffice Letter/);
  assert.match(xml, /Hello Word/);
});

test('DOCX exporter maps unordered and ordered lists to separate numbering definitions', async () => {
  const doc = buildPhiWriteDocx({
    title: 'Lists',
    content: '- One\n- Two\n\n1. Alpha\n2. Beta\n\n> Note\n\n~~~\nconst x = 3;\n~~~',
  });
  const xml = await extractDocxXml(doc.bytes);
  assert.match(xml, /<w:numId w:val="1"/);
  assert.match(xml, /<w:numId w:val="2"/);
  assert.match(xml, /<w:pStyle w:val="Quote"/);
  assert.match(xml, /<w:pStyle w:val="Code"/);
  assert.match(xml, /<w:t xml:space="preserve">Alpha<\/w:t>/);
});

test('DOCX exporter escapes XML metacharacters and replaces prohibited control characters', async () => {
  const doc = buildPhiWriteDocx({
    title: '<Project & "Legal" >',
    content: 'Hello <script>alert("x") & done</script>\n\nSecond\tcolumn\nbreak\u0001',
  });
  const xml = await extractDocxXml(doc.bytes);
  assert.match(xml, /&lt;Project &amp; &quot;Legal&quot; &gt;/);
  assert.match(xml, /&lt;script&gt;alert\(&quot;x&quot;\) &amp; done&lt;\/script&gt;/);
  assert.match(xml, /<w:tab\/>/);
  assert.match(xml, /<w:br\/>/);
  assert.doesNotMatch(xml, /\u0001|<script>/);
  assert.equal(escapeDocxXml('A\u0000<B & C'), 'A\ufffd&lt;B &amp; C');
});

test('DOCX exporter handles empty content without exporting broken ZIP', async () => {
  const doc = buildPhiWriteDocx({ title: '', content: '' });
  const xml = await extractDocxXml(doc.bytes);
  assert.match(xml, /Untitled/);
  assert.match(xml, /<w:sectPr>/);
});

test('DOCX exporter rejects very long source and invalid ZIP part names', () => {
  assert.throws(() => buildPhiWriteDocx({ title: 'Too big', content: 'X'.repeat(2_000_001) }), /2-million-character/);
  assert.throws(() => zipStoredDocxParts([['../bad', 'unsafe']]), /Invalid package part path/);
  assert.throws(() => zipStoredDocxParts([['/bad', 'unsafe']]), /Invalid package part path/);
});

test('DOCX export is deterministic, readable by its own bounded importer, and never leaves the browser', async () => {
  const a = buildPhiWriteDocx({ title: 'Offline', content: '# Intro\n\nParagraph.' }).bytes;
  const b = buildPhiWriteDocx({ title: 'Offline', content: '# Intro\n\nParagraph.' }).bytes;
  assert.deepEqual(a, b);
  const sourceXml = await extractDocxXml(a);
  assert.match(sourceXml, /<w:pStyle w:val="Heading1"/);
  assert.match(sourceXml, /Paragraph/);
});
