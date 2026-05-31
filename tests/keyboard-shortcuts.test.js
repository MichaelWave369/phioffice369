import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTabShortcutIndex,
  isCommandLikeShortcut,
  isEditableElement,
  normalizeShortcutKey,
  shouldCloseOverlay,
  shouldFocusSearch,
  shouldOpenShortcutHelp,
} from '../apps/web/src/lib/keyboardShortcuts.js';

function element(tagName, extra = {}) {
  return { tagName, ...extra };
}

test('isEditableElement detects form and contenteditable targets', () => {
  assert.equal(isEditableElement(element('INPUT')), true);
  assert.equal(isEditableElement(element('textarea')), true);
  assert.equal(isEditableElement(element('select')), true);
  assert.equal(isEditableElement(element('div', { isContentEditable: true })), true);
  assert.equal(isEditableElement(element('button')), false);
});

test('normalizeShortcutKey lowercases keys and names space', () => {
  assert.equal(normalizeShortcutKey({ key: 'K' }), 'k');
  assert.equal(normalizeShortcutKey({ key: ' ' }), 'space');
});

test('isCommandLikeShortcut detects ctrl or meta', () => {
  assert.equal(isCommandLikeShortcut({ ctrlKey: true }), true);
  assert.equal(isCommandLikeShortcut({ metaKey: true }), true);
  assert.equal(isCommandLikeShortcut({}), false);
});

test('getTabShortcutIndex maps command number shortcuts to tab indexes', () => {
  assert.equal(getTabShortcutIndex({ ctrlKey: true, key: '1' }, 7), 0);
  assert.equal(getTabShortcutIndex({ metaKey: true, key: '7' }, 7), 6);
  assert.equal(getTabShortcutIndex({ ctrlKey: true, key: '8' }, 7), -1);
  assert.equal(getTabShortcutIndex({ key: '1' }, 7), -1);
});

test('shouldOpenShortcutHelp uses shift question mark outside editable elements', () => {
  assert.equal(shouldOpenShortcutHelp({ shiftKey: true, key: '?', target: element('div') }), true);
  assert.equal(shouldOpenShortcutHelp({ shiftKey: true, key: '?', target: element('input') }), false);
  assert.equal(shouldOpenShortcutHelp({ shiftKey: false, key: '?', target: element('div') }), false);
});

test('shouldFocusSearch detects command k', () => {
  assert.equal(shouldFocusSearch({ ctrlKey: true, key: 'k' }), true);
  assert.equal(shouldFocusSearch({ metaKey: true, key: 'K' }), true);
  assert.equal(shouldFocusSearch({ key: 'k' }), false);
});

test('shouldCloseOverlay detects escape', () => {
  assert.equal(shouldCloseOverlay({ key: 'Escape' }), true);
  assert.equal(shouldCloseOverlay({ key: 'Enter' }), false);
});
