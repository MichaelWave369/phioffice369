import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVaultVisibleScanPolicy,
  normalizeVaultScanSourcePreference,
  selectVisibleVaultArtifacts,
  summarizeVaultVisibleScanPolicy,
  VAULT_SCAN_SOURCE_ASYNC,
  VAULT_SCAN_SOURCE_SYNC,
  VAULT_VISIBLE_SCAN_POLICY_SCHEMA,
} from '../apps/web/src/lib/vaultVisibleScanPolicy.js';

test('normalizeVaultScanSourcePreference defaults to sync source', () => {
  assert.equal(normalizeVaultScanSourcePreference(VAULT_SCAN_SOURCE_ASYNC), VAULT_SCAN_SOURCE_ASYNC);
  assert.equal(normalizeVaultScanSourcePreference('unknown'), VAULT_SCAN_SOURCE_SYNC);
  assert.equal(normalizeVaultScanSourcePreference(null), VAULT_SCAN_SOURCE_SYNC);
});

test('createVaultVisibleScanPolicy keeps sync as default', () => {
  const policy = createVaultVisibleScanPolicy();

  assert.equal(policy.schema, VAULT_VISIBLE_SCAN_POLICY_SCHEMA);
  assert.equal(policy.requestedSource, VAULT_SCAN_SOURCE_SYNC);
  assert.equal(policy.activeSource, VAULT_SCAN_SOURCE_SYNC);
  assert.equal(policy.usedFallback, false);
  assert.equal(policy.reason, 'sync_scan_default');
});

test('createVaultVisibleScanPolicy allows async only when operator requests it and gate passes', () => {
  const policy = createVaultVisibleScanPolicy({
    requestedSource: VAULT_SCAN_SOURCE_ASYNC,
    vaultScanSwitchReport: { canUseAsyncVaultScan: true, blockers: [] },
  });

  assert.equal(policy.activeSource, VAULT_SCAN_SOURCE_ASYNC);
  assert.equal(policy.asyncAllowed, true);
  assert.equal(policy.usedFallback, false);
  assert.equal(policy.reason, 'operator_requested_async_and_gate_passed');
});

test('createVaultVisibleScanPolicy falls back to sync when async is requested but blocked', () => {
  const policy = createVaultVisibleScanPolicy({
    requestedSource: VAULT_SCAN_SOURCE_ASYNC,
    vaultScanSwitchReport: { canUseAsyncVaultScan: false, blockers: ['registry_parity_not_passing'] },
  });

  assert.equal(policy.activeSource, VAULT_SCAN_SOURCE_SYNC);
  assert.equal(policy.asyncAllowed, false);
  assert.equal(policy.usedFallback, true);
  assert.deepEqual(policy.blockers, ['registry_parity_not_passing']);
});

test('selectVisibleVaultArtifacts returns artifacts for the active policy source', () => {
  const syncArtifacts = [{ artifactId: 'sync' }];
  const asyncArtifacts = [{ artifactId: 'async' }];

  assert.deepEqual(selectVisibleVaultArtifacts({ syncArtifacts, asyncArtifacts, policy: createVaultVisibleScanPolicy() }), syncArtifacts);
  assert.deepEqual(selectVisibleVaultArtifacts({
    syncArtifacts,
    asyncArtifacts,
    policy: createVaultVisibleScanPolicy({ requestedSource: VAULT_SCAN_SOURCE_ASYNC, vaultScanSwitchReport: { canUseAsyncVaultScan: true } }),
  }), asyncArtifacts);
});

test('summarizeVaultVisibleScanPolicy returns compact UI state', () => {
  const policy = createVaultVisibleScanPolicy({
    requestedSource: VAULT_SCAN_SOURCE_ASYNC,
    vaultScanSwitchReport: { canUseAsyncVaultScan: false, blockers: ['async_runtime_unavailable'] },
  });

  assert.deepEqual(summarizeVaultVisibleScanPolicy(policy), {
    requestedSource: VAULT_SCAN_SOURCE_ASYNC,
    activeSource: VAULT_SCAN_SOURCE_SYNC,
    asyncAllowed: false,
    usedFallback: true,
    blockerCount: 1,
    reason: 'operator_requested_async_but_gate_blocked',
  });
});
