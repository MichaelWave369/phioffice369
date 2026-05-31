import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVaultScanSwitchBlockers,
  createVaultScanSwitchReport,
  summarizeVaultScanSwitchReport,
  VAULT_SCAN_SWITCH_GATE_SCHEMA,
} from '../apps/web/src/lib/vaultScanSwitchGate.js';

const availableAsync = {
  adapterId: 'localStorage',
  available: true,
};

const passingParity = {
  parity: true,
  syncCount: 2,
  asyncCount: 2,
  missingInAsyncCount: 0,
  extraInAsyncCount: 0,
};

const matchingPreference = {
  activeMatchesPreference: true,
};

test('buildVaultScanSwitchBlockers reports missing async and parity blockers', () => {
  assert.deepEqual(buildVaultScanSwitchBlockers(), [
    'async_runtime_unavailable',
    'registry_parity_missing',
  ]);
});

test('buildVaultScanSwitchBlockers reports parity and preference mismatch blockers', () => {
  const blockers = buildVaultScanSwitchBlockers({
    workspaceAsyncStatus: availableAsync,
    registryParityReport: {
      parity: false,
      missingInAsyncCount: 1,
      extraInAsyncCount: 1,
    },
    storagePreferenceStatus: { activeMatchesPreference: false },
  });

  assert.deepEqual(blockers, [
    'registry_parity_not_passing',
    'sync_items_missing_from_async_registry',
    'extra_async_registry_items',
    'storage_preference_mismatch',
  ]);
});

test('createVaultScanSwitchReport allows async vault scan only when all gates pass', () => {
  const report = createVaultScanSwitchReport({
    workspaceAsyncStatus: availableAsync,
    registryParityReport: passingParity,
    storagePreferenceStatus: matchingPreference,
  });

  assert.equal(report.schema, VAULT_SCAN_SWITCH_GATE_SCHEMA);
  assert.equal(report.canUseAsyncVaultScan, true);
  assert.equal(report.recommendedSource, 'async-preference-aware-registry');
  assert.deepEqual(report.blockers, []);
});

test('createVaultScanSwitchReport falls back to sync registry when blocked', () => {
  const report = createVaultScanSwitchReport({
    workspaceAsyncStatus: { adapterId: 'indexedDB', available: false },
    registryParityReport: passingParity,
    storagePreferenceStatus: matchingPreference,
  });

  assert.equal(report.canUseAsyncVaultScan, false);
  assert.equal(report.recommendedSource, 'sync-localStorage-registry');
  assert.deepEqual(report.blockers, ['async_runtime_unavailable']);
});

test('summarizeVaultScanSwitchReport creates compact UI summary', () => {
  const report = createVaultScanSwitchReport({
    workspaceAsyncStatus: availableAsync,
    registryParityReport: passingParity,
    storagePreferenceStatus: matchingPreference,
  });

  assert.deepEqual(summarizeVaultScanSwitchReport(report), {
    asyncAdapterId: 'localStorage',
    canUseAsyncVaultScan: true,
    recommendedSource: 'async-preference-aware-registry',
    blockerCount: 0,
    syncCount: 2,
    asyncCount: 2,
  });
});
