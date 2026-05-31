export const VAULT_VISIBLE_SCAN_POLICY_SCHEMA = 'phioffice369.vault_visible_scan_policy.v0.1';

export const VAULT_SCAN_SOURCE_SYNC = 'sync-localStorage-registry';
export const VAULT_SCAN_SOURCE_ASYNC = 'async-preference-aware-registry';

export function normalizeVaultScanSourcePreference(value) {
  return value === VAULT_SCAN_SOURCE_ASYNC ? VAULT_SCAN_SOURCE_ASYNC : VAULT_SCAN_SOURCE_SYNC;
}

export function createVaultVisibleScanPolicy({
  requestedSource = VAULT_SCAN_SOURCE_SYNC,
  vaultScanSwitchReport = null,
} = {}) {
  const normalizedRequestedSource = normalizeVaultScanSourcePreference(requestedSource);
  const asyncAllowed = Boolean(vaultScanSwitchReport?.canUseAsyncVaultScan);
  const activeSource = normalizedRequestedSource === VAULT_SCAN_SOURCE_ASYNC && asyncAllowed
    ? VAULT_SCAN_SOURCE_ASYNC
    : VAULT_SCAN_SOURCE_SYNC;

  return {
    schema: VAULT_VISIBLE_SCAN_POLICY_SCHEMA,
    createdAt: new Date().toISOString(),
    requestedSource: normalizedRequestedSource,
    activeSource,
    asyncAllowed,
    usedFallback: normalizedRequestedSource === VAULT_SCAN_SOURCE_ASYNC && activeSource !== VAULT_SCAN_SOURCE_ASYNC,
    reason: activeSource === VAULT_SCAN_SOURCE_ASYNC
      ? 'operator_requested_async_and_gate_passed'
      : normalizedRequestedSource === VAULT_SCAN_SOURCE_ASYNC
        ? 'operator_requested_async_but_gate_blocked'
        : 'sync_scan_default',
    blockers: vaultScanSwitchReport?.blockers ?? [],
  };
}

export function selectVisibleVaultArtifacts({
  syncArtifacts = [],
  asyncArtifacts = [],
  policy = null,
} = {}) {
  return policy?.activeSource === VAULT_SCAN_SOURCE_ASYNC ? asyncArtifacts : syncArtifacts;
}

export function summarizeVaultVisibleScanPolicy(policy) {
  return {
    requestedSource: policy?.requestedSource ?? VAULT_SCAN_SOURCE_SYNC,
    activeSource: policy?.activeSource ?? VAULT_SCAN_SOURCE_SYNC,
    asyncAllowed: Boolean(policy?.asyncAllowed),
    usedFallback: Boolean(policy?.usedFallback),
    blockerCount: policy?.blockers?.length ?? 0,
    reason: policy?.reason ?? 'sync_scan_default',
  };
}
