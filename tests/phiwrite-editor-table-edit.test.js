import test from 'node:test';
import assert from 'node:assert/strict';
import {
  preparePhiWriteTableEdit, savePhiWriteTableEdit,
} from '../apps/web/src/lib/phiwriteEditorTableEdit.js';
import { parsePipeTableAt } from '../apps/web/src/lib/simpleTables.js';
import { parsePhiWritePrintBlocks, renderPhiWritePrintBlocksHtml } from '../apps/web/src/lib/phiwritePrint.js';
import { buildPhiWriteDocx } from '../apps/web/src/lib/docxExport.js';
import { extractDocxPackage } from '../apps/web/src/lib/docxZip.js';

const table = '| Name | Status |\n| --- | --- |\n| Cable | Pass |\n| Fiber | Pending |';
const source = 'Before\n\n' + table + '\n\nAfter';

function snapshot(value = source, start = source.indexOf('Cable') + 2, end = start) {
  return preparePhiWriteTableEdit(value, start, end);
}

test('caret inside an existing table discovers only that table and exposes editable cells', () => {
  const edit = snapshot();
  assert.equal(edit.reason, null);
  assert.equal(edit.start, source.indexOf('| Name'));
  assert.equal(edit.end, source.indexOf('| Fiber') + '| Fiber | Pending |'.length);
  assert.deepEqual(edit.headers, ['Name', 'Status']);
  assert.deepEqual(edit.rows, [['Cable', 'Pass'], ['Fiber', 'Pending']]);
  assert.equal(edit.content, source);
});

test('selection covering the full table qualifies without changing its source', () => {
  const start = source.indexOf('| Name');
  const selected = preparePhiWriteTableEdit(source, start, start + table.length);
  assert.equal(selected.reason, null);
  assert.equal(selected.content, source);
});

test('editing an existing cell preserves every byte outside the selected table', () => {
  const original = snapshot();
  const result = savePhiWriteTableEdit(source, original,
    ['Cable type', 'Status'], [['CAT6A', 'Pass'], ['Fiber', 'Certified']]);
  assert.equal(result.changed, true);
  assert.equal(result.reason, null);
  assert.equal(result.content,
    'Before\n\n| Cable type | Status |\n| --- | --- |\n| CAT6A | Pass |\n| Fiber | Certified |\n\nAfter');
  assert.equal(result.content.slice(result.selectionStart, result.selectionEnd).startsWith('| Cable type'), true);
});

test('cancel is a no-op, and stale snapshot cannot overwrite newly typed text', () => {
  const pending = snapshot();
  assert.equal(source, 'Before\n\n' + table + '\n\nAfter');
  const newer = source + '\nAdditional notes';
  const attempt = savePhiWriteTableEdit(newer, pending, pending.headers, pending.rows);
  assert.equal(attempt.changed, false);
  assert.equal(attempt.reason, 'stale');
  assert.equal(attempt.content, newer);
});

test('no table or partial unrelated selection cannot open an editor', () => {
  assert.equal(preparePhiWriteTableEdit('A normal paragraph', 3, 3).reason, 'table');
  const unrelated = preparePhiWriteTableEdit(source, 0, source.length);
  assert.equal(unrelated.reason, 'table');
  assert.equal(unrelated.content, source);
});

test('only the table under cursor is changed when two tables exist', () => {
  const full = table + '\n\nMiddle\n\n' + table;
  const found = preparePhiWriteTableEdit(full, full.lastIndexOf('Fiber'), full.lastIndexOf('Fiber'));
  const changed = savePhiWriteTableEdit(full, found, ['Name', 'Status'], [['Cable','Pass'], ['Fiber','Done']]);
  assert.equal(changed.changed, true);
  assert.ok(changed.content.startsWith(table + '\n\nMiddle\n\n'));
  assert.match(changed.content.slice(table.length), /\| Fiber \| Done \|/);
});

test('literal cell pipes and backslashes roundtrip to the same table parser', () => {
  const found = snapshot();
  const edited = savePhiWriteTableEdit(source, found,
    ['Cable | Type', 'Path'], [['C:\\ops', 'OK'], ['RJ45', 'One | Two']]);
  assert.equal(edited.changed, true);
  const parsed = parsePhiWritePrintBlocks(edited.content).find((block) => block.kind === 'table');
  assert.deepEqual(parsed.rows, [
    ['Cable | Type', 'Path'], ['C:\\ops', 'OK'], ['RJ45', 'One | Two'],
  ]);
});

test('styles and safe links inside table cells remain supported after edit', async () => {
  const found = snapshot();
  const edited = savePhiWriteTableEdit(source, found, found.headers, [
    ['**Cable**', '[Pass](https://example.org/report)'], ['Fiber', 'Ready'],
  ]);
  const html = renderPhiWritePrintBlocksHtml(parsePhiWritePrintBlocks(edited.content));
  assert.match(html, /<strong>Cable<\/strong>/);
  assert.match(html, /href="https:\/\/example.org\/report"/);
  const parts = await extractDocxPackage(buildPhiWriteDocx({
    title: 'Field test', content: edited.content,
  }).bytes);
  assert.match(parts.documentXml, /<w:tbl>/);
  assert.match(parts.documentXml, /<w:b\/>/);
  assert.match(parts.relationshipsXml, /https:\/\/example.org\/report/);
});

test('table cannot be recognized as editable inside fenced code', () => {
  for (const marker of ['```', '~~~']) {
    const text = marker + '\n' + table + '\n' + marker;
    const position = text.indexOf('Cable');
    assert.equal(preparePhiWriteTableEdit(text, position, position).reason, 'table');
  }
});

test('alignment indicators are preserved by refusing style-losing normalization', () => {
  const aligned = '| A | B |\n| :--- | ---: |\n| 1 | 2 |';
  const pending = preparePhiWriteTableEdit(aligned, aligned.indexOf('1'), aligned.indexOf('1'));
  assert.equal(pending.reason, 'alignment');
  assert.equal(savePhiWriteTableEdit(aligned, pending, ['A','B'],[['x','y']]).reason, 'alignment');
});

test('tables larger than the composer capacity are rejected, not truncated', () => {
  const columns = '| A | B | C | D | E | F | G | H | I |';
  const rule = '| --- | --- | --- | --- | --- | --- | --- | --- | --- |';
  const wide = columns + '\n' + rule + '\n| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |';
  const found = preparePhiWriteTableEdit(wide, wide.indexOf('1'), wide.indexOf('1'));
  assert.equal(found.reason, 'size');
  const many = table.split('\n').slice(0,2).concat(
    Array.from({length:13}, ()=>'| x | y |')).join('\n');
  assert.equal(preparePhiWriteTableEdit(many, many.indexOf('| x'), many.indexOf('| x')).reason, 'size');
});

test('untrusted raw HTML becomes escaped text after table edit', () => {
  const found = snapshot();
  const edited = savePhiWriteTableEdit(source, found,
    ['<script>evil()</script>', 'Status'], [['<img onerror=bad()>', 'OK'], ['Fiber','Done']]);
  assert.equal(edited.changed,true);
  const html = renderPhiWritePrintBlocksHtml(parsePhiWritePrintBlocks(edited.content));
  assert.match(html, /&lt;script&gt;evil\(\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img onerror=bad\(\)&gt;/);
  assert.doesNotMatch(html, /<script>|<img/);
});

test('reject changing table shape and invalid cell types or control characters', () => {
  const original = snapshot();
  const cases = [
    [['A'], original.rows, 'shape'],
    [['A','B'], [['one']], 'shape'],
    [['A','B'], [...original.rows, ['another','extra']], 'shape'],
    [['A','B'], [[42,'ok'], ['x','y']], 'cell'],
    [['A','B'], [['x\nnew','ok'], ['x','y']], 'cell'],
    [['A','B'], [['x'.repeat(161),'ok'], ['x','y']], 'cell'],
    [['A','B'], [['x','ok'], ['x','y\u0000']], 'cell'],
  ];
  for (const [headers, rows, reason] of cases) {
    const result = savePhiWriteTableEdit(source, original, headers, rows);
    assert.equal(result.reason, reason);
    assert.equal(result.content, source);
  }
});

test('empty headers refuse to overwrite an existing table', () => {
  const found = snapshot();
  const result = savePhiWriteTableEdit(source, found, ['', 'Status'], found.rows);
  assert.equal(result.reason,'header');
  assert.equal(result.changed,false);
});

test('unchanged canonical table does not claim a successful rewrite', () => {
  const found = snapshot();
  const result = savePhiWriteTableEdit(source, found, found.headers, found.rows);
  assert.equal(result.changed,false);
  assert.equal(result.reason,'unchanged');
});

test('CRLF source is not silently changed to LF by the table editor', () => {
  const crlf = source.replaceAll('\n','\r\n');
  const position = crlf.indexOf('Cable');
  assert.equal(preparePhiWriteTableEdit(crlf,position,position).reason,'lineEndings');
});

test('position clamping is safe and does not infer unrelated table ownership', () => {
  assert.equal(preparePhiWriteTableEdit(source, -100, -100).reason, 'table');
  assert.equal(preparePhiWriteTableEdit(source, 100000, 100000).reason, 'table');
  assert.equal(savePhiWriteTableEdit(source,null,['A','B'],[['x','y']]).reason,'stale');
});
