import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStorageStatusSummary,
  getStorageStatus,
  getStorageStatusMessage,
} from '../apps/web/src/lib/storageDiagnostics.js';

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
  };
}

test('createStorageStatusSummary reports snapshot counts and migration state', () => {
  const status = createStorageStatusSummary({
    detectedBackend: 'indexedDB',
    activeAdapterId: 'localStorage',
    available: true,
    snapshot: [['phioffice369:phiwrite:test', '{}']],
  });

  assert.equal(status.schema, 'phioffice369.storage_status.v0.1');
  assert.equal(status.snapshotCount, 1);
  assert.equal(status.migrationState, 'indexedDB-detected-localStorage-compat');
  assert.equal(status.readyForIndexedDbMigration, true);
});

test('getStorageStatus uses browser adapter and excludes emergency backups', async () => {
  const storage = createFakeStorage({
    'phioffice369:phiwrite:test': '{"title":"Doc"}',
    'phioffice369:emergency_backup:old': '{"skip":true}',
  });
  const status = await getStorageStatus({ indexedDB: {}, localStorage: storage });

  assert.equal(status.detectedBackend, 'indexedDB');
  assert.equal(status.activeAdapterId, 'localStorage');
  assert.equal(status.available, true);
  assert.equal(status.snapshotCount, 1);
});

test('getStorageStatusMessage explains active storage state', () => {
  assert.match(getStorageStatusMessage({ available: false }), /unavailable/);
  assert.match(getStorageStatusMessage({ available: true, migrationState: 'indexedDB-detected-localStorage-compat' }), /IndexedDB is available/);
  assert.match(getStorageStatusMessage({ available: true, activeAdapterId: 'localStorage' }), /localStorage adapter/);
  assert.match(getStorageStatusMessage({ available: true, activeAdapterId: 'memory' }), /memory storage fallback/);
});
