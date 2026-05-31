export const STORAGE_READINESS_SCHEMA = 'phioffice369.storage_readiness.v0.1';
export const STORAGE_BACKEND_PREFERENCE_KEY = 'phioffice369:storage_backend_preference';

export function buildIndexedDbReadinessBlockers({ storageStatus, verificationReport }) {
  const blockers = [];

  if (!storageStatus?.readyForIndexedDbMigration) blockers.push('indexeddb_unavailable');
  if (!verificationReport) blockers.push('verification_missing');
  if (verificationReport && !verificationReport.verified) blockers.push('verification_not_passing');
  if ((verificationReport?.missingInTargetCount ?? 0) > 0) blockers.push('missing_items_in_indexeddb');
  if ((verificationReport?.mismatchedCount ?? 0) > 0) blockers.push('mismatched_items_in_indexeddb');

  return Array.from(new Set(blockers));
}

export function createStorageReadinessReport({ storageStatus, verificationReport }) {
  const blockers = buildIndexedDbReadinessBlockers({ storageStatus, verificationReport });

  return {
    schema: STORAGE_READINESS_SCHEMA,
    createdAt: new Date().toISOString(),
    detectedBackend: storageStatus?.detectedBackend ?? 'unknown',
    activeAdapterId: storageStatus?.activeAdapterId ?? 'unknown',
    snapshotCount: storageStatus?.snapshotCount ?? 0,
    readyForIndexedDbMigration: Boolean(storageStatus?.readyForIndexedDbMigration),
    verificationVerified: Boolean(verificationReport?.verified),
    verificationSourceCount: verificationReport?.sourceCount ?? 0,
    verificationTargetCount: verificationReport?.targetCount ?? 0,
    verificationMissingCount: verificationReport?.missingInTargetCount ?? 0,
    verificationMismatchedCount: verificationReport?.mismatchedCount ?? 0,
    canEnableIndexedDbPilot: blockers.length === 0,
    blockers,
  };
}

export function createStorageBackendPreference({ backend = 'localStorage', reason = 'default', readinessReport = null }) {
  return {
    schema: 'phioffice369.storage_backend_preference.v0.1',
    backend,
    reason,
    createdAt: new Date().toISOString(),
    readinessReport,
  };
}

export function safeParseStoragePreference(raw) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed?.schema === 'phioffice369.storage_backend_preference.v0.1' ? parsed : null;
  } catch {
    return null;
  }
}

export function readStorageBackendPreference(storage) {
  return safeParseStoragePreference(storage?.getItem?.(STORAGE_BACKEND_PREFERENCE_KEY));
}

export function writeStorageBackendPreference(storage, preference) {
  if (!storage?.setItem) return false;
  storage.setItem(STORAGE_BACKEND_PREFERENCE_KEY, JSON.stringify(preference));
  return true;
}

export function createIndexedDbPilotPreference(readinessReport) {
  if (!readinessReport?.canEnableIndexedDbPilot) {
    return createStorageBackendPreference({
      backend: 'localStorage',
      reason: 'indexeddb_pilot_blocked',
      readinessReport,
    });
  }

  return createStorageBackendPreference({
    backend: 'indexedDB-pilot',
    reason: 'verified_indexeddb_copy',
    readinessReport,
  });
}
