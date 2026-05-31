import { createBrowserStorageAdapter, detectStorageBackend } from './storageAdapters.js';

export function createStorageStatusSummary({ detectedBackend, activeAdapterId, available, snapshot }) {
  const snapshotCount = Array.isArray(snapshot) ? snapshot.length : 0;
  const migrationState = detectedBackend === 'indexedDB' && activeAdapterId === 'localStorage'
    ? 'indexedDB-detected-localStorage-compat'
    : `${detectedBackend}-active`;

  return {
    schema: 'phioffice369.storage_status.v0.1',
    detectedBackend,
    activeAdapterId,
    available: Boolean(available),
    snapshotCount,
    migrationState,
    readyForIndexedDbMigration: detectedBackend === 'indexedDB',
  };
}

export async function getStorageStatus(environment = globalThis) {
  const detectedBackend = detectStorageBackend(environment);
  const adapter = createBrowserStorageAdapter(environment);
  const available = await adapter.isAvailable();
  const snapshot = await adapter.workspaceSnapshot({ includeEmergencyBackups: false });

  return createStorageStatusSummary({
    detectedBackend,
    activeAdapterId: adapter.id,
    available,
    snapshot,
  });
}

export function getStorageStatusMessage(status) {
  if (!status?.available) return 'Storage unavailable; using in-memory fallback when possible.';
  if (status.migrationState === 'indexedDB-detected-localStorage-compat') {
    return 'IndexedDB is available. PhiOffice is currently using the localStorage compatibility adapter until the IndexedDB driver lands.';
  }
  if (status.activeAdapterId === 'localStorage') return 'Using browser localStorage adapter for current prototype continuity.';
  if (status.activeAdapterId === 'memory') return 'Using memory storage fallback for this environment.';
  return `Using ${status.activeAdapterId} storage adapter.`;
}
