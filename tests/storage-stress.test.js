// Deterministic multi-format stress fixtures. No real user files or credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import {
  listTransactionalDrafts, migrateLegacyDraft, readTransactionalDraft, saveTransactionalDraft,
} from '../apps/web/src/lib/transactionalDraftStore.js';
import {
  createCompleteWorkspaceBackup, restoreCompleteWorkspaceBackup,
} from '../apps/web/src/lib/transactionalWorkspace.js';
import { prepareWorkspaceCopy } from '../apps/web/src/lib/workspaceFileCopy.js';
import { readWorkspaceRecord } from '../apps/web/src/lib/workspaceRecords.js';

const FILE_COUNT = 150;
const BACKUP_SCHEMA = 'phioffice369.workspace_backup.v0.1';
const digest = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

function recordFixture(index) {
  const type = ['phiwrite', 'phigrid', 'phideck'][index % 3];
  const key = 'phioffice369:' + type + ':file_stress_' + String(index).padStart(3, '0');
  const title = 'Stress fixture ' + String(index).padStart(3, '0');
  const common = { title, templateId: key.split(':').at(-1), sourceTemplateId: 'stress_source_' + type, activeLabelId: 'private' };
  let record;
  if (type === 'phiwrite') {
    record = { ...common, content: '# ' + title + '\n' + ('Unicode 369 • reversible text; <b>not HTML</b>\n').repeat(155) };
  } else if (type === 'phigrid') {
    record = { ...common, columns: ['Item', 'Value', 'Comment'], rows: Array.from({ length: 36 }, (_, row) => ({
      Item: 'row-' + index + '-' + row, Value: '=' + (index + row) + '+3',
      Comment: ('cell ' + row + ' — π ').repeat(10),
    })) };
  } else {
    record = { ...common, slides: Array.from({ length: 8 }, (_, slide) => ({
      id: 'slide_' + slide, title: title + ' slide ' + slide,
      bullets: Array.from({ length: 4 }, (_, line) => ('presentation ' + index + ':' + slide + ':' + line + ' ').repeat(16)),
      layout: slide === 0 ? 'cover' : 'content',
    })) };
  }
  return [key, JSON.stringify(record)];
}

function storageWith(entries = []) {
  const map = new Map(entries);
  return {
    get length() { return map.size; },
    key(index) { return [...map.keys()][index] ?? null; },
    getItem(key) { return map.get(key) ?? null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  };
}

async function useIndexedDB(factory, callback) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Object.defineProperty(globalThis, 'indexedDB', { value: factory, configurable: true });
  try {
    return await callback();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'indexedDB', previous);
    else delete globalThis.indexedDB;
  }
}

test('150 mixed files survive verified copies, revisions, conflict, full backup, clean restore and rollback', { timeout: 90000 }, async () => {
  const entries = Array.from({ length: FILE_COUNT }, (_, index) => recordFixture(index));
  const standard = storageWith(entries);
  const factory = new IDBFactory();
  const environment = { indexedDB: factory };

  await useIndexedDB(factory, async () => {
    const copies = [];
    for (const [key, raw] of entries) {
      const copied = await migrateLegacyDraft(key, standard, environment);
      copies.push(copied);
      assert.equal(standard.getItem(key), raw, 'Migration changed original bytes: ' + key);
      assert.equal(copied.revision, 1);
      assert.equal((await readTransactionalDraft(copied.key, environment)).record.title.includes('IndexedDB copy'), true);
    }
    assert.equal((await listTransactionalDrafts(environment)).length, FILE_COUNT);

    const first = copies[0];
    const originalCopy = await readTransactionalDraft(first.key, environment);
    const winningText = 'Winning committed revision.\n' + '3-6-9 '.repeat(600);
    const recoveryText = 'Competing tab content.\n' + 'unique '.repeat(600);
    const winner = await saveTransactionalDraft(first.key, 1, { ...originalCopy.record, content: winningText }, { environment });
    assert.equal(winner.revision, 2);
    const stale = await saveTransactionalDraft(first.key, 1, { ...originalCopy.record, content: recoveryText }, { environment, recoverConflict: true });
    assert.equal(stale.recoveredFrom, first.key);
    assert.equal((await readTransactionalDraft(first.key, environment)).record.content, winningText);
    assert.equal((await readTransactionalDraft(stale.key, environment)).record.content, recoveryText);

    const backup = await createCompleteWorkspaceBackup({ storage: standard, source: 'automated large-workspace rehearsal' });
    assert.equal(backup.schema, BACKUP_SCHEMA);
    assert.equal(backup.storageSnapshot.length, FILE_COUNT * 2 + 1);
    assert.equal(backup.transactionalRecovery, undefined);
    const snapshot = new Map(backup.storageSnapshot);
    assert.equal(snapshot.size, backup.storageSnapshot.length);
    for (const [key, raw] of entries) assert.equal(digest(snapshot.get(key)), digest(raw), 'Original snapshot mismatch: ' + key);

    // Model a new browser profile, with a fresh IndexedDB and empty standard storage.
    const restored = storageWith();
    await useIndexedDB(new IDBFactory(), async () => {
      const outcome = await restoreCompleteWorkspaceBackup(backup, restored);
      assert.equal(outcome.ok, true, outcome.reason);
      assert.equal(outcome.restored, backup.storageSnapshot.length);
      assert.equal(restored.length, backup.storageSnapshot.length);
      for (const [key, raw] of backup.storageSnapshot) {
        assert.equal(digest(restored.getItem(key)), digest(raw), 'Restore lost content: ' + key);
        assert.equal(readWorkspaceRecord(key, restored).state, 'saved');
      }
      const again = await restoreCompleteWorkspaceBackup(backup, restored);
      assert.equal(again.ok, true);
      assert.equal(again.unchanged, backup.storageSnapshot.length);
      assert.equal(again.restored, 0);

      const recoveredWinner = readWorkspaceRecord(first.key, restored).record;
      assert.equal(recoveredWinner.content, winningText);
      const rollback = prepareWorkspaceCopy(first.key, recoveredWinner, ' (standard copy)', 'stress_rollback_001');
      assert.equal(restored.getItem(rollback.key), null);
      restored.setItem(rollback.key, JSON.stringify(rollback.snapshot));
      assert.equal(readWorkspaceRecord(rollback.key, restored).record.content, winningText);
      assert.equal(restored.getItem(first.key), snapshot.get(first.key), 'Rollback overwrote source');
    });
  });
});

test('large restore preserves existing bytes on collision and resumes after a simulated storage quota failure', { timeout: 60000 }, async () => {
  const entries = Array.from({ length: FILE_COUNT }, (_, index) => recordFixture(index));
  const backup = { schema: BACKUP_SCHEMA, storageSnapshot: entries };
  const storage = storageWith();
  const write = storage.setItem.bind(storage);
  let permitted = 37;
  storage.setItem = (key, raw) => {
    if (permitted-- <= 0) throw new DOMException('Fixture capacity reached', 'QuotaExceededError');
    write(key, raw);
  };

  await useIndexedDB(new IDBFactory(), async () => {
    const partial = await restoreCompleteWorkspaceBackup(backup, storage);
    assert.equal(partial.ok, false);
    assert.equal(partial.restored, 37);
    assert.equal(storage.length, 37);
    for (const [key, raw] of entries.slice(0, 37)) assert.equal(storage.getItem(key), raw);

    storage.setItem = write;
    const retry = await restoreCompleteWorkspaceBackup(backup, storage);
    assert.equal(retry.ok, true, retry.reason);
    assert.equal(retry.unchanged, 37);
    assert.equal(retry.restored, FILE_COUNT - 37);
    assert.equal(storage.length, FILE_COUNT);

    const [collisionKey, oldRaw] = entries[0];
    const modified = JSON.stringify({ ...JSON.parse(oldRaw), title: 'Protected post-restore edit' });
    storage.setItem(collisionKey, modified);
    const replay = await restoreCompleteWorkspaceBackup(backup, storage);
    assert.equal(replay.ok, true);
    assert.equal(replay.conflicts, 1);
    assert.equal(replay.unchanged, FILE_COUNT - 1);
    assert.equal(replay.restored, 0);
    assert.equal(storage.getItem(collisionKey), modified, 'Replay overwrote a newer file');
  });
});
