import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import {
  restoreBackupFileCopiesToIndexedDb,
} from '../apps/web/src/lib/transactionalWorkspace.js';
import {
  listTransactionalDrafts, readTransactionalDraft, restoreTransactionalDraftRaw,
} from '../apps/web/src/lib/transactionalDraftStore.js';

const write = JSON.stringify({ title: 'Portable letter', content: 'Original byte-accurate text π 369', activeLabelId: 'private' });
const grid = JSON.stringify({ title: 'Portable spreadsheet', columns: ['Item', 'Value'], rows: [{ Item: 'A', Value: '=3+6' }] });
const deck = JSON.stringify({ title: 'Portable presentation', slides: [{
  id: 'slide_01', title: 'Keep the pixels', bullets: ['One slide'],
  layout: 'image-left',
  image: {
    src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==',
    alt: 'Single pixel fixture',
  },
}] });
const snapshot = [
  ['phioffice369:phiwrite:file_portable_one', write],
  ['phioffice369:phigrid:file_portable_two', grid],
  ['phioffice369:phideck:file_portable_three', deck],
  ['phioffice369:artifact_metadata:file_portable_one', JSON.stringify({ tags: ['keep'], projectFolder: 'Work' })],
];
const backup = { schema: 'phioffice369.workspace_backup.v0.1', storageSnapshot: snapshot };
const environment = () => ({ indexedDB: new IDBFactory(), crypto: webcrypto });

function standardStore(entries = []) {
  const map = new Map(entries);
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => { throw new DOMException('Quota fixture refuses all writes', 'QuotaExceededError'); },
    snapshot: () => [...map],
    putForTest: (key, value) => map.set(key, value),
  };
}
const keys = (files) => files.map(({ key }) => key).sort();

test('explicit IndexedDB-only recovery survives zero standard-storage capacity and remains idempotent', async () => {
  const env = environment();
  const standard = standardStore([['phioffice369:phiwrite:file_existing', JSON.stringify({ content: 'Untouched' })]]);
  const original = standard.snapshot();
  const first = await restoreBackupFileCopiesToIndexedDb(backup, { storage: standard, environment: env });
  assert.deepEqual(first, { ok: true, restored: 3, unchanged: 0, conflicts: 0, ignored: 1, reason: null });
  assert.deepEqual(standard.snapshot(), original, 'Restore modified existing standard storage');
  const files = await listTransactionalDrafts(env);
  assert.equal(files.length, 3);
  assert.deepEqual(new Set(files.map(({ raw }) => raw)), new Set([write, grid, deck]));
  assert.ok(files.every(({ key, revision, record }) =>
    key.includes('file_tx_restore_') && revision === 1 && record));
  const second = await restoreBackupFileCopiesToIndexedDb(backup, { storage: standard, environment: env });
  assert.deepEqual(second, { ok: true, restored: 0, unchanged: 3, conflicts: 0, ignored: 1, reason: null });
  assert.deepEqual(keys(await listTransactionalDrafts(env)), keys(files));
});

test('a failed IndexedDB add stops safely and retry resumes without duplicating verified copies', async () => {
  const env = environment();
  const standard = standardStore();
  const add = IDBObjectStore.prototype.add;
  let calls = 0;
  IDBObjectStore.prototype.add = function (...args) {
    if (++calls === 2) throw new DOMException('Synthetic disk full', 'QuotaExceededError');
    return add.apply(this, args);
  };
  let first;
  try {
    first = await restoreBackupFileCopiesToIndexedDb(backup, { storage: standard, environment: env });
  } finally {
    IDBObjectStore.prototype.add = add;
  }
  assert.equal(first.ok, false);
  assert.equal(first.restored, 1);
  assert.match(first.reason, /QuotaExceededError/);
  const completed = await restoreBackupFileCopiesToIndexedDb(backup, { storage: standard, environment: env });
  assert.equal(completed.ok, true);
  assert.equal(completed.restored, 2);
  assert.equal(completed.unchanged, 1);
  assert.equal((await listTransactionalDrafts(env)).length, 3);
});

test('occupied local and transactional destination keys are preserved without replacement', async () => {
  const env = environment();
  const standard = standardStore();
  await restoreBackupFileCopiesToIndexedDb(backup, { storage: standard, environment: env });
  const existing = await listTransactionalDrafts(env);
  const target = existing.find(({ raw }) => raw === write);
  // First: same target in localStorage is always an explicit collision.
  standard.putForTest(target.key, 'Existing local document must remain');
  const collision = await restoreBackupFileCopiesToIndexedDb(backup, { storage: standard, environment: env });
  assert.equal(collision.conflicts, 1);
  assert.equal(collision.unchanged, 2);
  assert.equal(standard.getItem(target.key), 'Existing local document must remain');
  // Second: existing IndexedDB row with a different committed body is never overwritten.
  const independent = standardStore();
  const changed = JSON.stringify({ title: 'A newer edit', content: 'Do not replace' });
  const { requestToPromise, transactionDone } = await import('../apps/web/src/lib/indexedDbStorageAdapter.js');
  const { EDITOR_DB_NAME } = await import('../apps/web/src/lib/transactionalDraftStore.js');
  const db = await requestToPromise(env.indexedDB.open(EDITOR_DB_NAME, 1));
  const tx = db.transaction('files', 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore('files').put({ key: target.key, revision: 12, raw: changed });
  await done;
  db.close();
  const restored = await restoreBackupFileCopiesToIndexedDb(backup, { storage: independent, environment: env });
  assert.equal(restored.conflicts, 1);
  assert.equal(restored.unchanged, 2);
  const after = await readTransactionalDraft(target.key, env);
  assert.equal(after.revision, 12);
  assert.equal(after.raw, changed);
});

test('rejects damaged backups before any copy, does not touch malicious or external keys', async () => {
  const env = environment();
  const standard = standardStore();
  const tampered = { ...backup, storageSnapshot: [...snapshot, ['external:credential', 'secret']] };
  const result = await restoreBackupFileCopiesToIndexedDb(tampered, { storage: standard, environment: env });
  assert.equal(result.ok, false);
  assert.equal(result.restored, 0);
  assert.deepEqual(await listTransactionalDrafts(env), []);
  const duplicated = { ...backup, storageSnapshot: [...snapshot, snapshot[0]] };
  const dupResult = await restoreBackupFileCopiesToIndexedDb(duplicated, { storage: standard, environment: env });
  assert.equal(dupResult.ok, false);
  assert.deepEqual(await listTransactionalDrafts(env), []);
});

test('raw IndexedDB restore validates keys and retains the exact content and existing revision', async () => {
  const env = environment();
  await assert.rejects(restoreTransactionalDraftRaw('phioffice369:phiwrite:file_bad', write, env), /Only valid/);
  await assert.rejects(restoreTransactionalDraftRaw('phioffice369:phiwrite:file_tx_accepted', '{"bad":', env), /Only valid/);
  const target = 'phioffice369:phiwrite:file_tx_accepted';
  const restored = await restoreTransactionalDraftRaw(target, write, env);
  assert.deepEqual(restored, { status: 'restored', key: target });
  assert.equal((await readTransactionalDraft(target, env)).raw, write);
  assert.equal((await readTransactionalDraft(target, env)).revision, 1);
  assert.equal((await restoreTransactionalDraftRaw(target, write, env)).status, 'unchanged');
  assert.equal((await restoreTransactionalDraftRaw(target, JSON.stringify({ title: 'Different', content: 'Not same' }), env)).status, 'conflict');
  assert.equal((await readTransactionalDraft(target, env)).raw, write);
});
