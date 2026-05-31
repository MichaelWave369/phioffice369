import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIndexedDbReadinessBlockers,
  createIndexedDbPilotPreference,
  createStorageBackendPreference,
  createStorageReadinessReport,
  readStorageBackendPreference,
  safeParseStoragePreference,
  STORAGE_BACKEND_PREFERENCE_KEY,
  STORAGE_READINESS_SCHEMA,
  writeStorageBackendPreference,
} from '../apps/web/src/lib/storageReadinessGate.js';

function createFakeStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
  };
}

const readyStorageStatus = {
  detectedBackend: 'indexedDB',
  activeAdapterId: 'localStorage',
  snapshotCount: 2,
  readyForIndexedDbMigration: true,
};

const passingVerification = {
  verified: true,
  sourceCount: 2,
  targetCount: 2,
  missingInTargetCount: 0,
  mismatchedCount: 0,
};

test('buildIndexedDbReadinessBlockers reports missing IndexedDB and verification blockers', () => {
  assert.deepEqual(buildIndexedDbReadinessBlockers({ storageStatus: null, verificationReport: null }), [
    'indexeddb_unavailable',
    'verification_missing',
  ]);

  assert.deepEqual(buildIndexedDbReadinessBlockers({
    storageStatus: readyStorageStatus,
    verificationReport: { ...passingVerification, verified: false, missingInTargetCount: 1, mismatchedCount: 1 },
  }), [
    'verification_not_passing',
    'missing_items_in_indexeddb',
    'mismatched_items_in_indexeddb',
  ]);
});

test('createStorageReadinessReport allows pilot only when IndexedDB is ready and verification passes', () => {
  const ready = createStorageReadinessReport({ storageStatus: readyStorageStatus, verificationReport: passingVerification });
  const blocked = createStorageReadinessReport({ storageStatus: { ...readyStorageStatus, readyForIndexedDbMigration: false }, verificationReport: passingVerification });

  assert.equal(ready.schema, STORAGE_READINESS_SCHEMA);
  assert.equal(ready.canEnableIndexedDbPilot, true);
  assert.deepEqual(ready.blockers, []);
  assert.equal(blocked.canEnableIndexedDbPilot, false);
  assert.deepEqual(blocked.blockers, ['indexeddb_unavailable']);
});

test('storage backend preferences can be created parsed read and written', () => {
  const storage = createFakeStorage();
  const preference = createStorageBackendPreference({ backend: 'localStorage', reason: 'default' });

  assert.equal(writeStorageBackendPreference(storage, preference), true);
  assert.deepEqual(readStorageBackendPreference(storage), preference);
  assert.deepEqual(safeParseStoragePreference(JSON.stringify(preference)), preference);
  assert.equal(safeParseStoragePreference('{bad json'), null);
  assert.equal(storage.getItem(STORAGE_BACKEND_PREFERENCE_KEY), JSON.stringify(preference));
});

test('createIndexedDbPilotPreference falls back to localStorage when readiness is blocked', () => {
  const ready = createStorageReadinessReport({ storageStatus: readyStorageStatus, verificationReport: passingVerification });
  const blocked = createStorageReadinessReport({ storageStatus: readyStorageStatus, verificationReport: null });
  const readyPreference = createIndexedDbPilotPreference(ready);
  const blockedPreference = createIndexedDbPilotPreference(blocked);

  assert.equal(readyPreference.backend, 'indexedDB-pilot');
  assert.equal(readyPreference.reason, 'verified_indexeddb_copy');
  assert.equal(blockedPreference.backend, 'localStorage');
  assert.equal(blockedPreference.reason, 'indexeddb_pilot_blocked');
});
