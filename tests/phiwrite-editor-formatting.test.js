import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPhiWriteSelection, phiWriteShortcutForKey, PHIWRITE_FORMATS,
} from '../apps/web/src/lib/phiwriteEditorFormatting.js';
import { tokenizePhiWriteInline } from '../apps/web/src/lib/phiwriteInline.js';

test('all toolbar actions insert a supported inline span around selected plain text', () => {
  for (const [name, {marker}] of Object.entries(PHIWRITE_FORMATS)) {
    const source = 'alpha beta gamma';
    const result = formatPhiWriteSelection(source, 6, 10, name);
    assert.equal(result.content, 'alpha ' + marker + 'beta' + marker + ' gamma', name);
    assert.deepEqual([result.selectionStart, result.selectionEnd], [6 + marker.length, 10 + marker.length]);
    assert.equal(result.changed, true);
    const tokens = tokenizePhiWriteInline(result.content);
    const formatted = tokens.find((token) => token.text === 'beta');
    assert.equal(formatted?.[name === 'strike' ? 'strike' : name], true, name);
  }
});

test('toolbar toggles selected interior text and restores selection to original content', () => {
  const once = formatPhiWriteSelection('one two three', 4, 7, 'bold');
  assert.equal(once.content, 'one **two** three');
  const twice = formatPhiWriteSelection(once.content, once.selectionStart, once.selectionEnd, 'bold');
  assert.equal(twice.content, 'one two three');
  assert.deepEqual([twice.selectionStart, twice.selectionEnd], [4, 7]);
});

test('toolbar toggles when selection includes the actual surrounding markers', () => {
  const result = formatPhiWriteSelection('A ++underlined++ B', 2, 16, 'underline');
  assert.equal(result.content, 'A underlined B');
  assert.equal(result.selectionStart, 2);
  assert.equal(result.selectionEnd, 12);
});

test('collapsed selection inserts a selected descriptive placeholder, preserving text on either side', () => {
  for (const [name, {marker, placeholder}] of Object.entries(PHIWRITE_FORMATS)) {
    const result = formatPhiWriteSelection('abcXYZ', 3, 3, name);
    assert.equal(result.content, 'abc' + marker + placeholder + marker + 'XYZ', name);
    assert.equal(result.content.slice(result.selectionStart, result.selectionEnd), placeholder, name);
    assert.equal(result.selectionStart, 3 + marker.length);
  }
});

test('multiline selection is rejected without altering the document or selection', () => {
  const content = 'one\nmore words';
  const result = formatPhiWriteSelection(content, 0, 8, 'italic');
  assert.deepEqual(result, {
    content, selectionStart: 0, selectionEnd: 8, changed: false, reason: 'multiline',
  });
});

test('nested syntax is rejected instead of advertising unsupported compound markup', () => {
  const content = 'Review **bold** words, okay';
  const selected = '**bold**';
  const start = content.indexOf(selected);
  const result = formatPhiWriteSelection(content, start, start + selected.length, 'highlight');
  assert.equal(result.changed, false);
  assert.equal(result.reason, 'nested');
  assert.equal(result.content, content);
});

test('a selected literal backtick is not wrapped in an invalid single-backtick code span', () => {
  const source = 'paste a`b now';
  const from = source.indexOf('a`b');
  const result = formatPhiWriteSelection(source, from, from + 3, 'code');
  assert.equal(result.changed, false);
  assert.equal(result.reason, 'nested');
  assert.equal(result.content, source);
});

test('selection is clamped and reversed offsets are safe to process', () => {
  const result = formatPhiWriteSelection('hello', 500, -5, 'strike');
  assert.equal(result.content, '~~hello~~');
  assert.deepEqual([result.selectionStart, result.selectionEnd], [2, 7]);
});

test('editing never transforms raw HTML to executable markup', () => {
  const source = '<img src=x onerror=evil()>';
  const result = formatPhiWriteSelection(source, 0, source.length, 'highlight');
  assert.equal(result.content, '==' + source + '==');
  assert.equal(tokenizePhiWriteInline(result.content)[0].text, source);
  assert.equal(tokenizePhiWriteInline(result.content)[0].highlight, true);
});

test('unsupported actions throw rather than silently damaging content', () => {
  assert.throws(() => formatPhiWriteSelection('body', 0, 4, 'javascript'), RangeError);
});

test('Ctrl/Cmd B, I and U shortcuts map only with safe modifiers', () => {
  assert.equal(phiWriteShortcutForKey({key:'b',ctrlKey:true}), 'bold');
  assert.equal(phiWriteShortcutForKey({key:'I',metaKey:true}), 'italic');
  assert.equal(phiWriteShortcutForKey({key:'u',metaKey:true}), 'underline');
  assert.equal(phiWriteShortcutForKey({key:'b',altKey:true,ctrlKey:true}), null);
  assert.equal(phiWriteShortcutForKey({key:'b',shiftKey:true,ctrlKey:true}), null);
  assert.equal(phiWriteShortcutForKey({key:'s',ctrlKey:true}), null);
  assert.equal(phiWriteShortcutForKey({key:'b'}), null);
});
