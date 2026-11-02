import test from 'node:test';
import assert from 'node:assert/strict';
import { persistDraftSnapshot } from '../apps/web/src/lib/draftPersistence.js';

test('exit checkpoint preserves editable payload with a timestamp', () => {
  const saved = new Map();
  const storage = { setItem: (key, value) => saved.set(key, value) };
  const original = { templateId: 'example', title: 'Unsaved last keystroke', content: 'Draft text' };
  assert.deepEqual(persistDraftSnapshot('phioffice369:phiwrite:example', original, storage), {
    ok: true, message: 'Saved locally',
  });
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
