export const VAULT_SCAN_SWITCH_GATE_SCHEMA = 'phioffice369.vault_scan_switch_gate.v0.1';

export function buildVaultScanSwitchBlockers({
  workspaceAsyncStatus = null,
  registryParityReport = null,
  storagePreferenceStatus = null,
} = {}) {
  const blockers = [];

  if (!workspaceAsyncStatus?.available) blockers.push('async_runtime_unavailable');
  if (!registryParityReport) blockers.push('registry_parity_missing');
  if (registryParityReport && !registryParityReport.parity) blockers.push('registry_parity_not_passing');
  if ((registryParityReport?.missingInAsyncCount ?? 0) > 0) blockers.push('sync_items_missing_from_async_registry');
  if ((registryParityReport?.extraInAsyncCount ?? 0) > 0) blockers.push('extra_async_registry_items');
  if (storagePreferenceStatus && !storagePreferenceStatus.activeMatchesPreference) blockers.push('storage_preference_mismatch');

  return Array.from(new Set(blockers));
}

export function createVaultScanSwitchReport({
  workspaceAsyncStatus = null,
  registryParityReport = null,
  storagePreferenceStatus = null,
} = {}) {
  const blockers = buildVaultScanSwitchBlockers({ workspaceAsyncStatus, registryParityReport, storagePreferenceStatus });

  return {
    schema: VAULT_SCAN_SWITCH_GATE_SCHEMA,
    createdAt: new Date().toISOString(),
    currentVisibleSource: 'sync-localStorage-registry',
    candidateSource: 'async-preference-aware-registry',
    asyncAdapterId: workspaceAsyncStatus?.adapterId ?? 'unknown',
    asyncAvailable: Boolean(workspaceAsyncStatus?.available),
    syncCount: registryParityReport?.syncCount ?? 0,
    asyncCount: registryParityReport?.asyncCount ?? 0,
    registryParity: Boolean(registryParityReport?.parity),
    missingInAsyncCount: registryParityReport?.missingInAsyncCount ?? 0,
    extraInAsyncCount: registryParityReport?.extraInAsyncCount ?? 0,
    storagePreferenceMatches: storagePreferenceStatus ? Boolean(storagePreferenceStatus.activeMatchesPreference) : null,
    canUseAsyncVaultScan: blockers.length === 0,
    recommendedSource: blockers.length === 0 ? 'async-preference-aware-registry' : 'sync-localStorage-registry',
    blockers,
  };
}

export function summarizeVaultScanSwitchReport(report) {
  return {
    asyncAdapterId: report?.asyncAdapterId ?? 'unknown',
    canUseAsyncVaultScan: Boolean(report?.canUseAsyncVaultScan),
    recommendedSource: report?.recommendedSource ?? 'sync-localStorage-registry',
    blockerCount: report?.blockers?.length ?? 0,
    syncCount: report?.syncCount ?? 0,
    asyncCount: report?.asyncCount ?? 0,
  };
}
