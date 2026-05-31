import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVaultScanSourcePreference,
  getRequestedVaultScanSource,
  loadVaultScanSourcePreference,
  parseVaultScanSourcePreference,
  resetVaultScanSourcePreference,
  storeVaultScanSourcePreference,
  VAULT_SCAN_SOURCE_PREFERENCE_KEY,
  VAULT_SCAN_SOURCE_PREFERENCE_SCHEMA,
} from '../apps/web/src/lib/vaultScanSourcePreference.js';
import { VAULT_SCAN_SOURCE_ASYNC, VAULT_SCAN_SOURCE_SYNC } from '../apps/web/src/lib/vaultVisibleScanPolicy.js';

function createFakeStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

test('createVaultScanSourcePreference creates versioned normalized preferences', () => {
  const preference = createVaultScanSourcePreference({ requestedSource: VAULT_SCAN_SOURCE_ASYNC, reason: 'test' });
  const fallback = createVaultScanSourcePreference({ requestedSource: 'unknown' });

  assert.equal(preference.schema, VAULT_SCAN_SOURCE_PREFERENCE_SCHEMA);
  assert.equal(preference.requestedSource, VAULT_SCAN_SOURCE_ASYNC);
  assert.equal(preference.reason, 'test');
  assert.equal(fallback.requestedSource, VAULT_SCAN_SOURCE_SYNC);
});

test('parseVaultScanSourcePreference parses valid preferences and rejects invalid values', () => {
  const preference = createVaultScanSourcePreference({ requestedSource: VAULT_SCAN_SOURCE_ASYNC });

  assert.equal(parseVaultScanSourcePreference(JSON.stringify(preference)).requestedSource, VAULT_SCAN_SOURCE_ASYNC);
  assert.equal(parseVaultScanSourcePreference('{bad json'), null);
  assert.equal(parseVaultScanSourcePreference(JSON.stringify({ schema: 'wrong' })), null);
});

test('vault scan source preference storage helpers load store reset and default safely', () => {
  const storage = createFakeStorage();
  const preference = createVaultScanSourcePreference({ requestedSource: VAULT_SCAN_SOURCE_ASYNC });

  assert.equal(getRequestedVaultScanSource(storage), VAULT_SCAN_SOURCE_SYNC);
  assert.equal(storeVaultScanSourcePreference(storage, preference), true);
  assert.equal(loadVaultScanSourcePreference(storage).requestedSource, VAULT_SCAN_SOURCE_ASYNC);
  assert.equal(getRequestedVaultScanSource(storage), VAULT_SCAN_SOURCE_ASYNC);
  assert.equal(storage.getItem(VAULT_SCAN_SOURCE_PREFERENCE_KEY), JSON.stringify(preference));
  assert.equal(resetVaultScanSourcePreference(storage), true);
  assert.equal(loadVaultScanSourcePreference(storage), null);
});
