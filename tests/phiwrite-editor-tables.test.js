import test from 'node:test';
import assert from 'node:assert/strict';
import {
  preparePhiWriteTableInsertion, insertPhiWriteTable, PHIWRITE_TABLE_LIMITS,
} from '../apps/web/src/lib/phiwriteEditorTables.js';
import { parsePhiWritePrintBlocks, renderPhiWritePrintBlocksHtml } from '../apps/web/src/lib/phiwritePrint.js';
import { parsePipeTableAt } from '../apps/web/src/lib/simpleTables.js';
import { buildPhiWriteDocx } from '../apps/web/src/lib/docxExport.js';
import { extractDocxPackage } from '../apps/web/src/lib/docxZip.js';

function make(source, offset, headers = ['Name', 'Status'], rows = [['Cable', 'Pass']]) {
  return insertPhiWriteTable(source,
    preparePhiWriteTableInsertion(source, offset, offset), headers, rows);
}

test('table insertion at an empty document creates a valid editable Markdown table', () => {
  const changed = make('', 0);
  assert.equal(changed.content, '| Name | Status |\n| --- | --- |\n| Cable | Pass |');
  assert.equal(changed.content.slice(changed.selectionStart, changed.selectionEnd), changed.content);
  assert.deepEqual(parsePhiWritePrintBlocks(changed.content), [{
    kind:'table', rows:[['Name','Status'],['Cable','Pass']],
  }]);
});

test('table between paragraphs has distinct blank-line boundaries and preserves originals', () => {
  const source = 'Before\n\nAfter';
  const result = make(source, 'Before\n'.length);
  assert.equal(result.content, 'Before\n\n| Name | Status |\n| --- | --- |\n| Cable | Pass |\n\nAfter');
  assert.deepEqual(parsePhiWritePrintBlocks(result.content).map((block) => block.kind),
    ['paragraph', 'table', 'paragraph']);
  assert.equal(result.content.slice(result.selectionStart,result.selectionEnd).startsWith('| Name'), true);
});

test('table at trailing empty line preserves prior paragraph and terminates as valid block', () => {
  const source = 'Before\n';
  const result = make(source, source.length);
  assert.equal(result.content, 'Before\n\n| Name | Status |\n| --- | --- |\n| Cable | Pass |');
});

test('only a collapsed selection inside an exactly empty physical line is eligible', () => {
  for (const [src, a, b, reason] of [
    ['Some text', 4, 4, 'line'],
    ['Some text', 0, 4, 'selection'],
    ['   ', 1, 1, 'line'],
    ['Before\nAfter', 7, 7, 'line'],
  ]) {
    const snapshot = preparePhiWriteTableInsertion(src,a,b);
    assert.equal(snapshot.reason,reason);
    const unchanged = insertPhiWriteTable(src,snapshot,['A','B'],[['1','2']]);
    assert.equal(unchanged.reason,reason);
    assert.equal(unchanged.content,src);
  }
});

test('blank line inside an active backtick or tilde code fence is protected', () => {
  for(const marker of ['```', '~~~']) {
    const source = 'Prefix\n' + marker + '\n\ncode\n' + marker + '\nSuffix';
    const cursor = source.indexOf('\n\n') + 1;
    const snapshot = preparePhiWriteTableInsertion(source,cursor,cursor);
    assert.equal(snapshot.reason,'code');
    assert.equal(insertPhiWriteTable(source,snapshot,['A','B'],[['1','2']]).changed,false);
  }
});

test('opening a table review never mutates the existing document', () => {
  const source = 'Before\n\nAfter';
  const snapshot = preparePhiWriteTableInsertion(source,7,7);
  assert.equal(snapshot.reason,null);
  assert.equal(snapshot.content,source);
  assert.equal(source,'Before\n\nAfter');
});

test('stale source change cannot be overwritten by a pending table review', () => {
  const original = 'Before\n\nAfter';
  const snapshot = preparePhiWriteTableInsertion(original,7,7);
  const newest = 'Before\n\nNew revision\n\nAfter';
  const result = insertPhiWriteTable(newest,snapshot,['A','B'],[['1','2']]);
  assert.equal(result.changed,false);
  assert.equal(result.reason,'stale');
  assert.equal(result.content,newest);
});

test('table enforces UI limits and rectangular cell shapes before mutation', () => {
  const source = '';
  const snapshot = preparePhiWriteTableInsertion(source,0,0);
  for (const [headers, rows] of [
    [['One'], [['x']]],
    [Array.from({length:9},(_,i)=>String(i)), [Array(9).fill('x')]],
    [['A','B'],[]],
    [['A','B'],Array.from({length:13},()=>['1','2'])],
    [['A','B'],[['one']]],
    [['A','B'],[['one','two','three']]],
  ]) {
    const result = insertPhiWriteTable(source,snapshot,headers,rows);
    assert.equal(result.changed,false);
    assert.equal(result.reason,'shape');
  }
  assert.deepEqual([PHIWRITE_TABLE_LIMITS.minColumns,PHIWRITE_TABLE_LIMITS.maxColumns,
    PHIWRITE_TABLE_LIMITS.minRows,PHIWRITE_TABLE_LIMITS.maxRows], [2,8,1,12]);
});

test('overlong/control/non-string cells are rejected before making changes', () => {
  const snapshot = preparePhiWriteTableInsertion('',0,0);
  for (const value of ['a'.repeat(161),'bad\ncell','bad\u0000cell',42]) {
    const result = insertPhiWriteTable('',snapshot,['A','B'],[[value,'ok']]);
    assert.equal(result.changed,false);
    assert.equal(result.reason,'cell');
  }
});

test('empty column heading uses a deterministic plain-text fallback', () => {
  const result = make('',0,['  ','Status'],[['X','Y']]);
  assert.equal(result.content.split('\n')[0],'| Column 1 | Status |');
});

test('literal pipes and backslashes are escaped and round-trip as text', () => {
  const result = make('',0,['Team | Unit','Path'],[['One | Two','C:\\temp']]);
  const table = parsePipeTableAt(result.content.split('\n'),0);
  assert.deepEqual(table.rows,[['Team | Unit','Path'],['One | Two','C:\\temp']]);
  assert.match(result.content,/Team \\\| Unit/);
  assert.match(result.content,/C:\\\\temp/);
});

test('table contents render safely as literal HTML escaped cells', () => {
  const result = make('',0,['<script>alert(1)</script>','Verified'],[['<img src=x onerror=bad()>','YES']]);
  const html = renderPhiWritePrintBlocksHtml(parsePhiWritePrintBlocks(result.content));
  assert.match(html,/<table>/);
  assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html,/&lt;img src=x onerror=bad\(\)&gt;/);
  assert.doesNotMatch(html,/<script>|<img/);
});

test('new table exports as a genuine Word table with first row header', async () => {
  const result = make('',0,['Connection','Status'],[['Port 01','Pass'],['Port 02','Fail']]);
  const parts = await extractDocxPackage(buildPhiWriteDocx({
    title:'Installation table',content:result.content,
  }).bytes);
  assert.match(parts.documentXml,/<w:tbl>/);
  assert.match(parts.documentXml,/<w:tblHeader w:val="true"\/>/);
  assert.match(parts.documentXml,/Connection/);
  assert.match(parts.documentXml,/Port 02/);
});

test('empty body cells do not remove rows, rendering an editable blank table', () => {
  const result = make('',0,['A','B'],[['',''],['','']]);
  const blocks = parsePhiWritePrintBlocks(result.content);
  assert.equal(blocks[0].rows.length,3);
  assert.deepEqual(blocks[0].rows[1],['','']);
});

test('oversized offsets clamp safely and invalid snapshots stay non-destructive', () => {
  assert.equal(make('',99).changed,true);
  const source='Before\n';
  assert.equal(preparePhiWriteTableInsertion(source,-100,-100).reason,'line');
  const forged = {content:source,position:1000,reason:null};
  assert.equal(insertPhiWriteTable(source,forged,['A','B'],[['1','2']]).changed,false);
});
