import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectPhiOfficeStorageSnapshot,
  createEmergencyBackupPayload,
  createWorkspaceBackupPayload,
  EMERGENCY_BACKUP_PREFIX,
  errorToPlainObject,
  isWorkspaceBackupPayload,
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

const docKey = 'phioffice369:phiwrite:test';
const gridKey = 'phioffice369:phigrid:test';
const doc = '{"title":"Recovered","content":"Original text"}';
const grid = '{"columns":["Item"],"rows":[]}';
const backup = (storageSnapshot) => ({ schema: WORKSPACE_BACKUP_SCHEMA, storageSnapshot });

test('workspace restore adds missing records and reports conflicts, identical items and ignored controls', () => {
  const storage = createFakeStorage({ [docKey]: '{"content":"New work"}' });
  const input = backup([[docKey, doc], [gridKey, grid], ['phioffice369:onboarding_seen', 'true']]);
  assert.deepEqual(restoreWorkspaceBackupPayload(input, storage), {
    ok: true, restored: 1, conflicts: 1, unchanged: 0, ignored: 1, reason: null,
  });
  assert.deepEqual(restoreWorkspaceBackupPayload(input, storage), {
    ok: true, restored: 0, conflicts: 1, unchanged: 1, ignored: 1, reason: null,
  });
  assert.deepEqual(storage.toObject(), { [docKey]: '{"content":"New work"}', [gridKey]: grid });
});

test('restore rejects corrupt, external and duplicate snapshot entries before writing', () => {
  for (const entries of [
    [[docKey, doc], [gridKey, '{"rows":[null]}']],
    [[docKey, doc], ['another-app:account', 'value']],
    [[docKey, doc], [docKey, doc]],
  ]) {
    const storage = createFakeStorage();
    const result = restoreWorkspaceBackupPayload(backup(entries), storage);
    assert.equal(result.ok, false);
    assert.deepEqual(storage.toObject(), {});
  }
});

test('quota failure reports actual progress and a retry resumes with remaining items', () => {
  const storage = createFakeStorage();
  const input = backup([[docKey, doc], [gridKey, grid]]);
  const normalWrite = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === gridKey) throw new Error('QuotaExceededError');
    normalWrite(key, value);
  };
  const result = restoreWorkspaceBackupPayload(input, storage);
  assert.equal(result.ok, false);
  assert.equal(result.restored, 1);
  assert.deepEqual(storage.toObject(), { [docKey]: doc });
  storage.setItem = normalWrite;
  const retry = restoreWorkspaceBackupPayload(input, storage);
  assert.equal(retry.unchanged, 1);
  assert.equal(retry.restored, 1);
});
