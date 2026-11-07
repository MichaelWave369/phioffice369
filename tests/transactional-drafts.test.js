import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { requestToPromise, transactionDone } from '../apps/web/src/lib/indexedDbStorageAdapter.js';
import {
  EDITOR_DB_NAME, EDITOR_FILE_STORE, listTransactionalDrafts, migrateLegacyDraft,
  readTransactionalDraft, saveTransactionalDraft,
} from '../apps/web/src/lib/transactionalDraftStore.js';
import { createCompleteWorkspaceBackup, restoreCompleteWorkspaceBackup } from '../apps/web/src/lib/transactionalWorkspace.js';

const sourceKey = 'phioffice369:phiwrite:basic_project_spec';
const secondKey = 'phioffice369:phigrid:family_budget';
const original = JSON.stringify({
  title: 'Field notes', templateId: 'basic_project_spec', sourceTemplateId: 'basic_project_spec',
  content: 'Preserve exact text.\n', activeLabelId: 'private',
});
const second = JSON.stringify({ title: 'Budget', columns: ['A'], rows: [{ A: '=1+2' }] });
const storageWith = (entries) => {
  const records = new Map(entries);
  return {
    get length() { return records.size; },
    key: (index) => [...records.keys()][index] ?? null,
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  };
};

async function fixture() {
  const environment = { indexedDB: new IDBFactory() };
  const storage = storageWith([[sourceKey, original], [secondKey, second]]);
  const row = await migrateLegacyDraft(sourceKey, storage, environment);
  const saved = await readTransactionalDraft(row.key, environment);
  return { environment, storage, row, saved };
}

test('migration gives the verified draft copy its own revision and keeps the exact legacy source', async () => {
  const { storage, row, saved } = await fixture();
  assert.equal(storage.getItem(sourceKey), original);
  assert.equal(storage.getItem(row.key), null);
  assert.equal(saved.revision, 1);
  assert.equal(saved.record.content, JSON.parse(original).content);
  assert.equal(saved.record.activeLabelId, 'private');
  assert.equal(saved.record.sourceTemplateId, 'basic_project_spec');
  assert.equal(saved.record.copiedFrom, sourceKey);
});

test('a source changed during migration requires a fresh copy request', async () => {
  const environment = { indexedDB: new IDBFactory() };
  let reads = 0;
  const storage = { getItem: () => ++reads === 1 ? original : JSON.stringify({ content: 'New source version' }) };
  await assert.rejects(migrateLegacyDraft(sourceKey, storage, environment), /source changed/);
  assert.deepEqual(await listTransactionalDrafts(environment), []);
});

test('concurrent connections commit one winning revision and one intact conflict copy', async () => {
  const { row, saved, environment } = await fixture();
  const first = { ...saved.record, content: 'Editor A' };
  const second = { ...saved.record, content: 'Editor B' };
  const results = await Promise.all([
    saveTransactionalDraft(row.key, 1, first, { environment, recoverConflict: true }),
    saveTransactionalDraft(row.key, 1, second, { environment, recoverConflict: true }),
  ]);
  const copy = results.find(({ recoveredFrom }) => recoveredFrom);
  const winner = await readTransactionalDraft(row.key, environment);
  const recovered = await readTransactionalDraft(copy.key, environment);
  assert.equal(winner.revision, 2);
  assert.equal(recovered.revision, 1);
  assert.deepEqual(new Set([winner.record.content, recovered.record.content]), new Set(['Editor A', 'Editor B']));
  assert.equal(recovered.record.recoveredFrom, row.key);
  assert.equal((await listTransactionalDrafts(environment)).length, 2);
  const refused = await saveTransactionalDraft(row.key, 1, first, { environment });
  assert.deepEqual(refused, { ok: false, state: 'saved', revision: 2 });
});

test('a transaction interrupted after put never acknowledges or changes the committed revision', async () => {
  const { environment, row, saved } = await fixture();
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...args) {
    const request = put.apply(this, args);
    request.addEventListener('success', () => this.transaction.abort(), { once: true });
    return request;
  };
  try {
    await assert.rejects(saveTransactionalDraft(row.key, 1, { ...saved.record, content: 'Interrupted' }, { environment }));
  } finally {
    IDBObjectStore.prototype.put = put;
  }
  assert.equal((await readTransactionalDraft(row.key, environment)).raw, saved.raw);
  assert.equal((await readTransactionalDraft(row.key, environment)).revision, 1);
  const retry = await saveTransactionalDraft(row.key, 1, { ...saved.record, content: 'Retry' }, { environment });
  assert.equal(retry.revision, 2);
});

test('quota errors leave the previous revision available for retry and export', async () => {
  const { environment, row, saved } = await fixture();
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function () { throw new DOMException('Test quota', 'QuotaExceededError'); };
  try {
    await assert.rejects(saveTransactionalDraft(row.key, 1, { ...saved.record, content: 'Over quota' }, { environment }), {
      name: 'QuotaExceededError',
    });
  } finally {
    IDBObjectStore.prototype.put = put;
  }
  assert.equal((await readTransactionalDraft(row.key, environment)).raw, saved.raw);
});

test('an interrupted second migration leaves its source and all earlier verified copies intact', async () => {
  const { environment, storage, row } = await fixture();
  const add = IDBObjectStore.prototype.add;
  IDBObjectStore.prototype.add = function (...args) {
    const request = add.apply(this, args);
    request.addEventListener('success', () => this.transaction.abort(), { once: true });
    return request;
  };
  try {
    await assert.rejects(migrateLegacyDraft(secondKey, storage, environment));
  } finally {
    IDBObjectStore.prototype.add = add;
  }
  assert.equal(storage.getItem(secondKey), second);
  assert.deepEqual((await listTransactionalDrafts(environment)).map(({ key }) => key), [row.key]);
  const retry = await migrateLegacyDraft(secondKey, storage, environment);
  assert.deepEqual((await readTransactionalDraft(retry.key, environment)).record.rows, [{ A: '=1+2' }]);
});

test('damaged records are preserved while a valid editor snapshot can be recovered separately', async () => {
  const { environment, row, saved } = await fixture();
  const db = await requestToPromise(environment.indexedDB.open(EDITOR_DB_NAME, 1));
  const tx = db.transaction(EDITOR_FILE_STORE, 'readwrite');
  const done = transactionDone(tx);
  tx.objectStore(EDITOR_FILE_STORE).put({ key: row.key, revision: 1, raw: '{broken' });
  await done;
  db.close();
  assert.equal((await readTransactionalDraft(row.key, environment)).state, 'damaged');
  const recovered = await saveTransactionalDraft(row.key, 1, saved.record, { environment, recoverConflict: true });
  assert.equal(recovered.recoveredFrom, row.key);
  assert.equal((await readTransactionalDraft(row.key, environment)).raw, '{broken');
  assert.equal((await readTransactionalDraft(recovered.key, environment)).record.content, saved.record.content);
});

test('portable backup includes both stores and restore keeps active IndexedDB files', async () => {
  const { environment, row, storage, saved } = await fixture();
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Object.defineProperty(globalThis, 'indexedDB', { value: environment.indexedDB, configurable: true });
  try {
    const backup = await createCompleteWorkspaceBackup({ storage });
    assert.equal(new Map(backup.storageSnapshot).get(row.key), saved.raw);
    const changed = { ...backup, storageSnapshot: [[row.key, JSON.stringify({ content: 'Stale import' })]] };
    const result = await restoreCompleteWorkspaceBackup(changed, storage);
    assert.equal(result.conflicts, 1);
    assert.equal(storage.getItem(row.key), null);
    storage.setItem(row.key, JSON.stringify({ content: 'Legacy collision' }));
    const collisionBackup = await createCompleteWorkspaceBackup({ storage });
    assert.equal(new Map(collisionBackup.storageSnapshot).get(row.key), storage.getItem(row.key));
    assert.equal(collisionBackup.transactionalRecovery[0].raw, saved.raw);
  } finally {
    if (originalDescriptor) Object.defineProperty(globalThis, 'indexedDB', originalDescriptor);
    else delete globalThis.indexedDB;
  }
});
