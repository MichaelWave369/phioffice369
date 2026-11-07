import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLiveDraftRecoveryBackup,
  downloadLiveDraftRecoveryBackup,
  LIVE_DRAFT_BACKUP_MAX_BYTES,
} from '../apps/web/src/lib/liveDraftRecovery.js';
import { validateWorkspaceBackupImport } from '../apps/web/src/lib/vaultImportValidation.js';
import { restoreWorkspaceBackupPayload } from '../apps/web/src/lib/emergencyBackups.js';

const cases = [
  ['phioffice369:phiwrite:file_unsaved_write', {
    title: 'Unwritten notes', templateId: 'file_unsaved_write',
    content: 'The last keystroke: π=3-6-9\n<private>', activeLabelId: 'private',
  }],
  ['phioffice369:phigrid:file_unsaved_grid', {
    title: 'Unwritten grid', templateId: 'file_unsaved_grid',
    columns: ['Amount', 'Formula'], rows: [{ Amount: '7', Formula: '=3+6' }],
    activeLabelId: 'private',
  }],
  ['phioffice369:phideck:file_unsaved_deck', {
    title: 'Unwritten deck', templateId: 'file_unsaved_deck',
    slides: [{ id: 'slide-1', title: 'Unsaved pixels', bullets: ['Keep the newest slide'],
      image: { src: 'data:image/png;base64,abc', alt: 'synthetic image' } }],
    activeLabelId: 'private',
  }],
];

test('live emergency exports all three editor file types in the importable PhiVault backup format', () => {
  for (const [key, draft] of cases) {
    const before = JSON.stringify(draft);
    const recovered = createLiveDraftRecoveryBackup(key, draft, {
      now: new Date('2026-11-06T22:00:00.000Z'),
    });
    assert.equal(recovered.payload.storageSnapshot[0][0], key);
    assert.equal(recovered.payload.storageSnapshot.length, 1);
    assert.equal(recovered.payload.createdAt, '2026-11-06T22:00:00.000Z');
    assert.equal(validateWorkspaceBackupImport(JSON.parse(recovered.json)).ok, true);
    assert.equal(JSON.parse(recovered.payload.storageSnapshot[0][1]).title, draft.title);
    assert.equal(JSON.parse(recovered.payload.storageSnapshot[0][1]).updatedAt, '2026-11-06T22:00:00.000Z');
    assert.equal(recovered.byteLength, new TextEncoder().encode(recovered.json).byteLength);
    assert.ok(recovered.byteLength < LIVE_DRAFT_BACKUP_MAX_BYTES);
    assert.match(recovered.filename, /^phioffice369-(write|grid|deck)-file_unsaved_.*-recovery-20261106T220000Z\.json$/);
    assert.equal(JSON.stringify(draft), before, 'Export mutated the editable draft');
    const restored = new Map();
    const storage = {
      getItem: (k) => restored.get(k) ?? null,
      setItem: (k, v) => restored.set(k, v),
    };
    const result = restoreWorkspaceBackupPayload(JSON.parse(recovered.json), storage);
    assert.equal(result.ok, true);
    assert.equal(result.restored, 1);
    assert.equal(JSON.parse(restored.get(key)).title, draft.title);
    assert.equal(JSON.parse(restored.get(key)).content, draft.content);
  }
});

test('export does not overwrite an existing local file when imported; conflicting files are retained', () => {
  const [key, draft] = cases[0];
  const payload = createLiveDraftRecoveryBackup(key, draft).payload;
  const existing = '{"title":"A newer local version","content":"keep me"}';
  let current = existing;
  const storage = { getItem: () => current, setItem: (_k, value) => { current = value; } };
  const result = restoreWorkspaceBackupPayload(payload, storage);
  assert.equal(result.ok, true);
  assert.equal(result.conflicts, 1);
  assert.equal(result.restored, 0);
  assert.equal(current, existing);
});

test('invalid keys, invalid records and invalid timestamps cannot create misleading recovery backups', () => {
  const [key, draft] = cases[0];
  assert.throws(() => createLiveDraftRecoveryBackup('external:credentials', draft), /Only a valid/);
  assert.throws(() => createLiveDraftRecoveryBackup(key, { content: 369 }), /Only a valid/);
  assert.throws(() => createLiveDraftRecoveryBackup(key, draft, { now: new Date(NaN) }), /timestamp/);
  assert.throws(() => createLiveDraftRecoveryBackup(key, draft, { maxBytes: 32 }), /32 MiB/);
  assert.deepEqual(draft, cases[0][1]);
});

test('download works without reading or writing browser storage, with cleanup of download URL', () => {
  const calls = [];
  const fakeLink = { href: '', download: '', click() { calls.push(['click', this.download]); },
    remove() { calls.push(['remove']); } };
  const fakeDocument = {
    createElement(type) { assert.equal(type, 'a'); return fakeLink; },
    body: { appendChild(link) { assert.equal(link, fakeLink); calls.push(['append']); } },
  };
  const fakeUrl = {
    createObjectURL(blob) {
      assert.equal(blob.type, 'application/json;charset=utf-8');
      calls.push(['url']);
      return 'blob:synthetic-recovery';
    },
    revokeObjectURL(url) { assert.equal(url, 'blob:synthetic-recovery'); calls.push(['revoke']); },
  };
  const [key, draft] = cases[1];
  const result = downloadLiveDraftRecoveryBackup(key, draft, {
    documentRef: fakeDocument, urlApi: fakeUrl,
  });
  assert.match(result.filename, /grid/);
  assert.deepEqual(calls.map(([op]) => op), ['url', 'append', 'click', 'remove', 'revoke']);
});

test('a failed browser download click still revokes the object URL', () => {
  let removed = false, revoked = false;
  const link = { click() { throw new Error('Browser denied download'); },
    remove() { removed = true; } };
  const fakeDocument = {
    createElement: () => link,
    body: { appendChild: () => {} },
  };
  const fakeUrl = {
    createObjectURL: () => 'blob:failure',
    revokeObjectURL: () => { revoked = true; },
  };
  const [key, draft] = cases[0];
  assert.throws(() => downloadLiveDraftRecoveryBackup(key, draft, {
    documentRef: fakeDocument, urlApi: fakeUrl,
  }), /Browser denied/);
  assert.ok(removed && revoked);
});
