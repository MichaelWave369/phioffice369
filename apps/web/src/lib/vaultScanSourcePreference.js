import { VAULT_SCAN_SOURCE_SYNC, normalizeVaultScanSourcePreference } from './vaultVisibleScanPolicy.js';

export const VAULT_SCAN_SOURCE_PREFERENCE_SCHEMA = 'phioffice369.vault_scan_source_preference.v0.1';
export const VAULT_SCAN_SOURCE_PREFERENCE_KEY = 'phioffice369:vault_scan_source_preference';

export function createVaultScanSourcePreference({ requestedSource = VAULT_SCAN_SOURCE_SYNC, reason = 'operator_choice' } = {}) {
  return {
    schema: VAULT_SCAN_SOURCE_PREFERENCE_SCHEMA,
    requestedSource: normalizeVaultScanSourcePreference(requestedSource),
    reason,
    createdAt: new Date().toISOString(),
  };
}

export function parseVaultScanSourcePreference(rawValue) {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    if (parsed?.schema !== VAULT_SCAN_SOURCE_PREFERENCE_SCHEMA) return null;
    return {
      schema: parsed.schema,
      requestedSource: normalizeVaultScanSourcePreference(parsed.requestedSource),
      reason: parsed.reason ?? 'unknown',
      createdAt: parsed.createdAt ?? null,
    };
  } catch {
    return null;
  }
}
