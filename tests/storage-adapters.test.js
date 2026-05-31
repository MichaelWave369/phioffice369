import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBrowserStorageAdapter,
  createLocalStorageAdapter,
  createMemoryStorageAdapter,
  createStorageRecord,
  detectStorageBackend,
  isEmergencyBackupStorageKey,
  isPhiOfficeStorageKey,
  shouldIncludeInWorkspaceSnapshot,
} from '../apps/web/src/lib/storageAdapters.js';
import {
  createWorkspaceBackupPayloadFromAdapter,
  restoreWorkspaceBackupPayloadWithAdapter,
  WORKSPACE_BACKUP_SCHEMA,
} from '../apps/web/src/lib/emergencyBackups.js';

function createFakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    key(index) {
      return Array.from(map.keys())[index] ?? null;
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    toObject() {
      return Object.fromEntries(map.entries());
    },
  };
}

test('storage key helpers classify PhiOffice and emergency backup keys', () => {
  assert.equal(isPhiOfficeStorageKey('phioffice369:phiwrite:test'), true);
  assert.equal(isPhiOfficeStorageKey('other:key'), false);
  assert.equal(isEmergencyBackupStorageKey('phioffice369:emergency_backup:now'), true);
  assert.equal(shouldIncludeInWorkspaceSnapshot('phioffice369:phiwrite:test'), true);
  assert.equal(shouldIncludeInWorkspaceSnapshot('phioffice369:emergency_backup:now'), false);
  assert.equal(shouldIncludeInWorkspaceSnapshot('phioffice369:emergency_backup:now', { includeEmergencyBackups: true }), true);
});

test('createStorageRecord normalizes value shape', () => {
  const record = createStorageRecord('key', 369);

  assert.equal(record.key, 'key');
  assert.equal(record.value, '369');
  assert.equal(typeof record.updatedAt, 'string');
});

test('memory storage adapter supports async storage operations', async () => {
  const adapter = createMemoryStorageAdapter({ 'phioffice369:phiwrite:test': 'doc' });

  assert.equal(await adapter.isAvailable(), true);
  assert.equal(await adapter.getItem('phioffice369:phiwrite:test'), 'doc');
  await adapter.setItem('phioffice369:phideck:test', 'deck');
  assert.deepEqual(await adapter.entries({ prefix: 'phioffice369:' }), [
    ['phioffice369:phiwrite:test', 'doc'],
    ['phioffice369:phideck:test', 'deck'],
  ]);
  assert.deepEqual(await adapter.workspaceSnapshot(), [
    ['phioffice369:phiwrite:test', 'doc'],
    ['phioffice369:phideck:test', 'deck'],
  ]);
  await adapter.removeItem('phioffice369:phiwrite:test');
  assert.equal(await adapter.getItem('phioffice369:phiwrite:test'), null);
});

test('localStorage adapter filters emergency backups from workspace snapshots', async () => {
  const storage = createFakeStorage({
    'phioffice369:phiwrite:test': 'doc',
    'phioffice369:emergency_backup:old': 'backup',
    'other:key': 'ignore',
  });
  const adapter = createLocalStorageAdapter(storage);

  assert.deepEqual(await adapter.workspaceSnapshot(), [['phioffice369:phiwrite:test', 'doc']]);
  assert.deepEqual(await adapter.entries({ prefix: 'phioffice369:', includeEmergencyBackups: false }), [['phioffice369:phiwrite:test', 'doc']]);
});

test('browser adapter falls back from future indexedDB detection to localStorage adapter for now', async () => {
  const storage = createFakeStorage({ 'phioffice369:phigrid:test': 'grid' });

  assert.equal(detectStorageBackend({ indexedDB: {}, localStorage: storage }), 'indexedDB');
  assert.equal(detectStorageBackend({ localStorage: storage }), 'localStorage');
  assert.equal(detectStorageBackend({}), 'memory');

  const adapter = createBrowserStorageAdapter({ indexedDB: {}, localStorage: storage });
  assert.equal(adapter.id, 'localStorage');
  assert.deepEqual(await adapter.workspaceSnapshot(), [['phioffice369:phigrid:test', 'grid']]);
});

test('workspace backups can use async storage adapters', async () => {
  const source = createMemoryStorageAdapter({
    'phioffice369:phiwrite:test': '{"title":"Doc"}',
    'phioffice369:emergency_backup:old': '{"skip":true}',
  });
  const payload = await createWorkspaceBackupPayloadFromAdapter({
    adapter: source,
    manifest: { schema: 'phioffice369.project_manifest.v0.1' },
    source: 'adapter-test',
  });
  const target = createMemoryStorageAdapter();
  const restore = await restoreWorkspaceBackupPayloadWithAdapter(payload, target);

  assert.equal(payload.schema, WORKSPACE_BACKUP_SCHEMA);
  assert.equal(payload.source, 'adapter-test');
  assert.deepEqual(payload.storageSnapshot, [['phioffice369:phiwrite:test', '{"title":"Doc"}']]);
  assert.deepEqual(restore, { ok: true, restored: 1, reason: null });
  assert.equal(await target.getItem('phioffice369:phiwrite:test'), '{"title":"Doc"}');
});
