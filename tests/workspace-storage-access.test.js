import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorkspaceStorageAudit,
  listStorageKeys,
  readStorageJson,
  readStorageValue,
  removeStorageValue,
  scanStorageEntries,
  scanStorageJsonEntries,
  WORKSPACE_STORAGE_ACCESS_SCHEMA,
  writeStorageJson,
  writeStorageValue,
} from '../apps/web/src/lib/workspaceStorageAccess.js';

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

test('workspace storage access reads writes and removes values', () => {
  const storage = createFakeStorage();

  assert.equal(writeStorageValue('phioffice369:phiwrite:test', 'doc', storage), true);
  assert.equal(readStorageValue('phioffice369:phiwrite:test', storage), 'doc');
  assert.equal(removeStorageValue('phioffice369:phiwrite:test', storage), true);
  assert.equal(readStorageValue('phioffice369:phiwrite:test', storage), null);
});

test('workspace storage access reads and writes JSON safely', () => {
  const storage = createFakeStorage();

  assert.equal(writeStorageJson('phioffice369:phigrid:test', { rows: [] }, storage), true);
  assert.deepEqual(readStorageJson('phioffice369:phigrid:test', storage), { rows: [] });
  storage.setItem('phioffice369:broken', '{bad json');
  assert.equal(readStorageJson('phioffice369:broken', storage), null);
});

test('scan helpers return prefix-filtered storage entries', () => {
  const storage = createFakeStorage({
    'phioffice369:phiwrite:test': '{"title":"Doc"}',
    'phioffice369:phigrid:test': '{"rows":[]}',
    'external:key': 'ignore',
  });

  assert.deepEqual(listStorageKeys(storage), [
    'phioffice369:phiwrite:test',
    'phioffice369:phigrid:test',
    'external:key',
  ]);
  assert.deepEqual(scanStorageEntries({ prefix: 'phioffice369:', storage }), [
    ['phioffice369:phiwrite:test', '{"title":"Doc"}'],
    ['phioffice369:phigrid:test', '{"rows":[]}'],
  ]);
  assert.deepEqual(scanStorageJsonEntries({ prefix: 'phioffice369:', storage }), [
    { key: 'phioffice369:phiwrite:test', value: { title: 'Doc' } },
    { key: 'phioffice369:phigrid:test', value: { rows: [] } },
  ]);
});

test('createWorkspaceStorageAudit classifies known and unknown PhiOffice keys', () => {
  const storage = createFakeStorage({
    'phioffice369:phiwrite:test': 'doc',
    'phioffice369:unknown:test': 'mystery',
    'external:key': 'ignore',
  });
  const audit = createWorkspaceStorageAudit({ storage });

  assert.equal(audit.schema, WORKSPACE_STORAGE_ACCESS_SCHEMA);
  assert.equal(audit.totalKeys, 2);
  assert.equal(audit.knownKeys, 1);
  assert.deepEqual(audit.unknownPhiOfficeKeys, ['phioffice369:unknown:test']);
});
