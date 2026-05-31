import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectPhiOfficeStorageSnapshot,
  createEmergencyBackupPayload,
  createWorkspaceBackupPayload,
  EMERGENCY_BACKUP_PREFIX,
  errorToPlainObject,
  isWorkspaceBackupPayload,
  restoreEmergencyBackupPayload,
  restoreWorkspaceBackupPayload,
  storageKeys,
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
    toObject() {
      return Object.fromEntries(map.entries());
    },
  };
}

test('storageKeys supports Storage-like objects', () => {
  const storage = createFakeStorage({ a: '1', b: '2' });
  assert.deepEqual(storageKeys(storage), ['a', 'b']);
});

test('collectPhiOfficeStorageSnapshot captures only PhiOffice keys and skips emergency backups', () => {
  const storage = createFakeStorage({
    'phioffice369:phiwrite:test': '{"title":"Doc"}',
    [`${EMERGENCY_BACKUP_PREFIX}old`]: '{"schema":"backup"}',
    'other-app:key': 'ignore',
  });

  assert.deepEqual(collectPhiOfficeStorageSnapshot(storage), [
    ['phioffice369:phiwrite:test', '{"title":"Doc"}'],
  ]);
});

test('errorToPlainObject serializes safe error details', () => {
  const error = new Error('Boom');
  const plain = errorToPlainObject(error);

  assert.equal(plain.name, 'Error');
  assert.equal(plain.message, 'Boom');
  assert.equal(typeof plain.stack, 'string');
});

test('createEmergencyBackupPayload creates a versioned local backup snapshot', () => {
  const storage = createFakeStorage({ 'phioffice369:phigrid:test': '{"rows":[]}' });
  const payload = createEmergencyBackupPayload({
    error: new Error('Crash'),
    errorInfo: { componentStack: 'Component stack' },
    storage,
    source: 'test',
  });

  assert.equal(payload.schema, 'phioffice369.emergency_backup.v0.1');
  assert.equal(payload.source, 'test');
  assert.equal(payload.error.message, 'Crash');
  assert.equal(payload.componentStack, 'Component stack');
  assert.deepEqual(payload.storageSnapshot, [['phioffice369:phigrid:test', '{"rows":[]}']]);
});

test('createWorkspaceBackupPayload creates manual backups with manifest context', () => {
  const storage = createFakeStorage({
    'phioffice369:phiwrite:test': '{"title":"Doc"}',
    'phioffice369:phideck:test': '{"slides":[]}',
  });
  const manifest = { schema: 'phioffice369.project_manifest.v0.1', artifacts: [] };
  const payload = createWorkspaceBackupPayload({ storage, manifest, source: 'manual-test' });

  assert.equal(WORKSPACE_BACKUP_SCHEMA, 'phioffice369.workspace_backup.v0.1');
  assert.equal(payload.schema, WORKSPACE_BACKUP_SCHEMA);
  assert.equal(payload.source, 'manual-test');
  assert.deepEqual(payload.manifest, manifest);
  assert.deepEqual(payload.storageSnapshot, [
    ['phioffice369:phiwrite:test', '{"title":"Doc"}'],
    ['phioffice369:phideck:test', '{"slides":[]}'],
  ]);
});

test('isWorkspaceBackupPayload validates backup payload shape', () => {
  assert.equal(isWorkspaceBackupPayload({ schema: WORKSPACE_BACKUP_SCHEMA, storageSnapshot: [] }), true);
  assert.equal(isWorkspaceBackupPayload({ schema: WORKSPACE_BACKUP_SCHEMA }), false);
  assert.equal(isWorkspaceBackupPayload({ schema: 'other', storageSnapshot: [] }), false);
});

test('restoreEmergencyBackupPayload writes captured keys back to storage', () => {
  const storage = createFakeStorage();
  const restored = restoreEmergencyBackupPayload({
    storageSnapshot: [
      ['phioffice369:phiwrite:test', '{"title":"Recovered"}'],
      ['phioffice369:phideck:test', '{"slides":[]}'],
    ],
  }, storage);

  assert.equal(restored, 2);
  assert.deepEqual(storage.toObject(), {
    'phioffice369:phiwrite:test': '{"title":"Recovered"}',
    'phioffice369:phideck:test': '{"slides":[]}',
  });
});

test('restoreWorkspaceBackupPayload validates and restores workspace backup payloads', () => {
  const storage = createFakeStorage();
  const ok = restoreWorkspaceBackupPayload({
    schema: WORKSPACE_BACKUP_SCHEMA,
    storageSnapshot: [
      ['phioffice369:phiwrite:test', '{"title":"Recovered"}'],
      ['phioffice369:phigrid:test', '{"rows":[]}'],
    ],
  }, storage);
  const invalid = restoreWorkspaceBackupPayload({ schema: 'other', storageSnapshot: [] }, storage);

  assert.deepEqual(ok, { ok: true, restored: 2, reason: null });
  assert.equal(invalid.ok, false);
  assert.deepEqual(storage.toObject(), {
    'phioffice369:phiwrite:test': '{"title":"Recovered"}',
    'phioffice369:phigrid:test': '{"rows":[]}',
  });
});
