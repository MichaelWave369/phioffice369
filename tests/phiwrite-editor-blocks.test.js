import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPhiWriteBlockSelection, PHIWRITE_BLOCK_ACTIONS,
} from '../apps/web/src/lib/phiwriteEditorBlocks.js';
import { parsePhiWritePrintBlocks, renderPhiWritePrintBlocksHtml } from '../apps/web/src/lib/phiwritePrint.js';
import { buildPhiWriteDocx } from '../apps/web/src/lib/docxExport.js';
import { extractDocxPackage } from '../apps/web/src/lib/docxZip.js';

function edit(source, fragment, action) {
  const start = source.indexOf(fragment);
  assert.ok(start >= 0, 'missing test fixture');
  return formatPhiWriteBlockSelection(source, start, start + fragment.length, action);
}

test('headings 1–3 convert only the cursor line and map to real print headings', () => {
  for (const level of [1, 2, 3]) {
    const source = 'First paragraph\nSecond paragraph\nThird paragraph';
    const result = formatPhiWriteBlockSelection(source, 22, 22, 'h' + level);
    assert.equal(result.content, 'First paragraph\n' + '#'.repeat(level) + ' Second paragraph\nThird paragraph');
    const parsed = parsePhiWritePrintBlocks(result.content);
    assert.equal(parsed[1].kind, 'heading');
    assert.equal(parsed[1].level, level);
    assert.equal(parsed[1].text, 'Second paragraph');
  }
});

test('same heading toggles off and switching heading level replaces prefix', () => {
  const source = '## Existing heading\n\nOther paragraph';
  const updated = edit(source, 'Existing', 'h3');
  assert.equal(updated.content, '### Existing heading\n\nOther paragraph');
  const toggled = edit(updated.content, 'Existing', 'h3');
  assert.equal(toggled.content, 'Existing heading\n\nOther paragraph');
});

test('bold and safe inline links inside a heading survive conversion and print', () => {
  const source = '**Check** [manual](https://example.org/docs)';
  const result = edit(source, 'Check', 'h2');
  assert.equal(result.content, '## ' + source);
  const html = renderPhiWritePrintBlocksHtml(parsePhiWritePrintBlocks(result.content));
  assert.match(html, /<h3><strong>Check<\/strong> <a href="https:\/\/example.org\/docs"/);
});

test('collapsed caret stays inside paragraph text after adding and removing heading marker', () => {
  const first = formatPhiWriteBlockSelection('Review item', 6, 6, 'h2');
  assert.equal(first.content, '## Review item');
  assert.equal(first.selectionStart, 9);
  assert.equal(first.selectionEnd, 9);
  const undone = formatPhiWriteBlockSelection(first.content, 9, 9, 'h2');
  assert.equal(undone.content, 'Review item');
  assert.equal(undone.selectionStart, 6);
});

test('bullet list converts two physical lines and toggles both off', () => {
  const source = 'Before\nTask one\nTask two\nAfter';
  const converted = edit(source, 'Task one\nTask two', 'bullet');
  assert.equal(converted.content, 'Before\n- Task one\n- Task two\nAfter');
  assert.equal(converted.content.slice(converted.selectionStart, converted.selectionEnd), '- Task one\n- Task two');
  const undone = formatPhiWriteBlockSelection(converted.content,
    converted.selectionStart, converted.selectionEnd, 'bullet');
  assert.equal(undone.content, source);
});

test('numbered list converts selected plain lines to consecutive starts and switches to bullets', () => {
  const source = 'A. Verify cable\nB. Verify switch';
  const numbered = formatPhiWriteBlockSelection(source, 0, source.length, 'numbered');
  assert.equal(numbered.content, '1. A. Verify cable\n2. B. Verify switch');
  const bullet = formatPhiWriteBlockSelection(numbered.content, 0, numbered.content.length, 'bullet');
  assert.equal(bullet.content, '- A. Verify cable\n- B. Verify switch');
  const block = parsePhiWritePrintBlocks(bullet.content)[0];
  assert.equal(block.kind, 'list');
  assert.equal(block.listType, 'ul');
  assert.deepEqual(block.items, ['A. Verify cable', 'B. Verify switch']);
});

test('heading selection spanning more than one line is rejected unchanged', () => {
  const source = 'First\nSecond';
  const result = formatPhiWriteBlockSelection(source, 0, source.length, 'h1');
  assert.deepEqual(result, { content: source, changed: false, reason: 'multiline', selectionStart: 0, selectionEnd: source.length });
});

test('a range ending at the next line start formats only preceding line', () => {
  const source = 'Task one\nTask two';
  const result = formatPhiWriteBlockSelection(source, 0, 9, 'bullet');
  assert.equal(result.content, '- Task one\nTask two');
});

test('empty lines are never transformed into phantom list items', () => {
  const source = 'One\n\nTwo';
  const result = formatPhiWriteBlockSelection(source, 0, source.length, 'numbered');
  assert.equal(result.changed, false);
  assert.equal(result.reason, 'blank');
  assert.equal(result.content, source);
});

test('code fences and interior code lines are protected', () => {
  const source = 'Before\n```\nlet value = 1;\n```\nAfter';
  for (const fragment of ['```', 'let value = 1;']) {
    const result = edit(source, fragment, 'bullet');
    assert.equal(result.changed, false);
    assert.equal(result.reason, 'code');
    assert.equal(result.content, source);
  }
});

test('tables, blockquotes, indented code and nested lists refuse destructive prefix edits', () => {
  for (const source of [
    '| Name | Status |', '> Keep **notes**', '    console.log(1);', '  - Nested item',
  ]) {
    const result = formatPhiWriteBlockSelection(source, 0, source.length, 'h2');
    assert.equal(result.changed, false, source);
    assert.equal(result.reason, 'structured', source);
    assert.equal(result.content, source);
  }
});

test('mixed existing basic list markers convert without duplication', () => {
  const source = '- First\n2. Second\n+ Third';
  const result = formatPhiWriteBlockSelection(source, 0, source.length, 'numbered');
  assert.equal(result.content, '1. First\n2. Second\n3. Third');
  const lines = parsePhiWritePrintBlocks(result.content);
  assert.deepEqual(lines[0].items, ['First','Second','Third']);
  assert.equal(lines[0].start, 1);
});

test('numbered list and heading export genuine Word numbering and heading styles', async () => {
  const heading = formatPhiWriteBlockSelection('Checklist', 0, 9, 'h1');
  const list = formatPhiWriteBlockSelection('Inspect cable\nVerify port', 0, 25, 'numbered');
  const content = heading.content + '\n\n' + list.content;
  const docx = await extractDocxPackage(buildPhiWriteDocx({ title: 'Service checklist', content }).bytes);
  assert.match(docx.documentXml, /<w:pStyle w:val="Heading1"\/>/);
  assert.match(docx.documentXml, /<w:pStyle w:val="ListParagraph"\/>/);
  assert.match(docx.documentXml, /<w:numPr>/);
  assert.match(docx.numberingXml, /<w:numFmt w:val="decimal"\/>/);
});

test('literal user HTML remains escaped when converted into a heading', () => {
  const result = formatPhiWriteBlockSelection('<script>alert(1)</script>', 0, 25, 'h2');
  const html = renderPhiWritePrintBlocksHtml(parsePhiWritePrintBlocks(result.content));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('bounded actions, reversed offsets, and invalid operation handling', () => {
  assert.deepEqual(Object.keys(PHIWRITE_BLOCK_ACTIONS), ['h1','h2','h3','bullet','numbered']);
  assert.throws(() => formatPhiWriteBlockSelection('hello', 0, 5, 'execute'), RangeError);
  const reversed = formatPhiWriteBlockSelection('Alpha', 99, -10, 'bullet');
  assert.equal(reversed.content, '- Alpha');
  assert.ok(reversed.changed);
});
