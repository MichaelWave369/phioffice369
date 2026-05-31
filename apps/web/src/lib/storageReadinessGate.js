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

export function clearStorageBackendPreference(storage) {
  if (!storage?.removeItem) return false;
  storage.removeItem(STORAGE_BACKEND_PREFERENCE_KEY);
  return true;
}

export function getStoragePreferenceLabel(preference) {
  if (!preference) return 'Default localStorage mode';
  if (preference.backend === 'indexedDB-pilot') return 'IndexedDB pilot preference saved';
  if (preference.backend === 'localStorage') return 'LocalStorage preference saved';
  return `Unknown storage preference: ${preference.backend}`;
}

export function getStoragePreferenceMessage(preference) {
  if (!preference) return 'No explicit storage preference is saved. PhiOffice stays on localStorage by default.';
  if (preference.backend === 'indexedDB-pilot') return 'IndexedDB pilot is requested. PhiOffice will use the pilot adapter where preference-aware storage is enabled.';
  if (preference.backend === 'localStorage') return 'LocalStorage is explicitly requested. This is the safest fallback mode.';
  return 'The saved storage preference is not recognized. PhiOffice should fall back to localStorage.';
}

export function createStoragePreferenceStatus({ storage, activeAdapterId = 'unknown' }) {
  const preference = readStorageBackendPreference(storage);
  const requestedBackend = preference?.backend ?? 'localStorage-default';
  const activeMatchesPreference = preference?.backend === 'indexedDB-pilot'
    ? activeAdapterId === 'indexedDB'
    : activeAdapterId === 'localStorage';

  return {
    schema: 'phioffice369.storage_preference_status.v0.1',
    createdAt: new Date().toISOString(),
    preference,
    requestedBackend,
    activeAdapterId,
    activeMatchesPreference,
    label: getStoragePreferenceLabel(preference),
    message: getStoragePreferenceMessage(preference),
  };
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
