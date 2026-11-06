import test from 'node:test';
import assert from 'node:assert/strict';
import { persistDraftSnapshot } from '../apps/web/src/lib/draftPersistence.js';

test('exit checkpoint preserves editable payload with a timestamp', () => {
  const saved = new Map();
  const storage = { setItem: (key, value) => saved.set(key, value) };
  const original = { templateId: 'example', title: 'Unsaved last keystroke', content: 'Draft text' };
  const result = persistDraftSnapshot('phioffice369:phiwrite:example', original, storage);
  assert.equal(result.ok, true);
  assert.equal(result.raw, saved.get('phioffice369:phiwrite:example'));
  const data = JSON.parse(saved.get('phioffice369:phiwrite:example'));
  assert.equal(data.content, 'Draft text');
  assert.equal(data.title, 'Unsaved last keystroke');
  assert.ok(!Number.isNaN(Date.parse(data.updatedAt)));
  assert.equal(original.updatedAt, undefined, 'caller payload is not mutated');
});

test('unavailable storage is reported as failure', () => {
  const result = persistDraftSnapshot('example', { title: 'Do not lose me' }, null);
  assert.equal(result.ok, false);
  assert.match(result.message, /Export a copy/);
});

test('storage quota and permission failures do not silently appear saved', () => {
  const storage = { setItem() { throw new Error('QuotaExceededError'); } };
  const result = persistDraftSnapshot('example', { title: 'Do not lose me' }, storage);
  assert.equal(result.ok, false);
  assert.match(result.message, /save failed/);
});

test('checkpoint refuses a stale writer without changing the newer record', () => {
  let raw = '{"content":"Old"}';
  const storage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
  const expected = raw;
  assert.equal(persistDraftSnapshot('example', { content: 'Edited in other tab' }, storage, expected).ok, true);
  assert.equal(persistDraftSnapshot('example', { content: 'Stale tab' }, storage, expected).ok, false);
  assert.equal(JSON.parse(raw).content, 'Edited in other tab');
});
