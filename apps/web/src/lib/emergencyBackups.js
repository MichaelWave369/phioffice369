export const EMERGENCY_BACKUP_PREFIX = 'phioffice369:emergency_backup:';
export const WORKSPACE_BACKUP_SCHEMA = 'phioffice369.workspace_backup.v0.1';

export function canUseEmergencyStorage() {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

export function storageKeys(storage) {
  if (!storage) return [];

  if (typeof storage.key === 'function' && Number.isFinite(storage.length)) {
    return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean);
  }

  return Object.keys(storage);
}

export function collectPhiOfficeStorageSnapshot(storage) {
  return storageKeys(storage)
    .filter((key) => key.startsWith('phioffice369:'))
    .filter((key) => !key.startsWith(EMERGENCY_BACKUP_PREFIX))
    .map((key) => [key, storage.getItem(key)])
    .filter(([, value]) => value !== null && value !== undefined);
}

export function errorToPlainObject(error) {
  return {
    name: error?.name ?? 'UnknownError',
    message: error?.message ?? 'Unknown error',
    stack: error?.stack ?? null,
  };
}

export function createEmergencyBackupPayload({ error, errorInfo, storage, source = 'AppErrorBoundary' }) {
  return {
    schema: 'phioffice369.emergency_backup.v0.1',
    source,
    createdAt: new Date().toISOString(),
    error: errorToPlainObject(error),
    componentStack: errorInfo?.componentStack ?? null,
    storageSnapshot: collectPhiOfficeStorageSnapshot(storage),
  };
}

export function createWorkspaceBackupPayload({ storage, manifest = null, source = 'PhiVault-lite manual export' }) {
  return {
    schema: WORKSPACE_BACKUP_SCHEMA,
    source,
    createdAt: new Date().toISOString(),
    manifest,
    storageSnapshot: collectPhiOfficeStorageSnapshot(storage),
  };
}

export function isWorkspaceBackupPayload(payload) {
  return payload?.schema === WORKSPACE_BACKUP_SCHEMA && Array.isArray(payload.storageSnapshot);
}

export function writeEmergencyBackup({ error, errorInfo, source = 'AppErrorBoundary' }) {
  if (!canUseEmergencyStorage()) {
    return { ok: false, key: null, payload: null, reason: 'localStorage unavailable' };
  }

  try {
    const payload = createEmergencyBackupPayload({ error, errorInfo, storage: window.localStorage, source });
    const key = `${EMERGENCY_BACKUP_PREFIX}${payload.createdAt}`;
    window.localStorage.setItem(key, JSON.stringify(payload));
    return { ok: true, key, payload };
  } catch (backupError) {
    return { ok: false, key: null, payload: null, reason: backupError?.message ?? 'backup failed' };
  }
}

export function readEmergencyBackup(key) {
  if (!canUseEmergencyStorage() || !key) return null;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function restoreEmergencyBackupPayload(payload, storage) {
  if (!payload?.storageSnapshot || !storage) return 0;

  let restored = 0;
  payload.storageSnapshot.forEach(([key, value]) => {
    if (typeof key === 'string' && typeof value === 'string') {
      storage.setItem(key, value);
      restored += 1;
    }
  });

  return restored;
}

export function restoreWorkspaceBackupPayload(payload, storage) {
  if (!isWorkspaceBackupPayload(payload)) {
    return { ok: false, restored: 0, reason: 'not a PhiOffice369 workspace backup' };
  }

  try {
    return { ok: true, restored: restoreEmergencyBackupPayload(payload, storage), reason: null };
  } catch (restoreError) {
    return { ok: false, restored: 0, reason: restoreError?.message ?? 'restore failed' };
  }
}

export function restoreEmergencyBackup(key) {
  if (!canUseEmergencyStorage()) return { ok: false, restored: 0, reason: 'localStorage unavailable' };

  const payload = readEmergencyBackup(key);
  if (!payload) return { ok: false, restored: 0, reason: 'backup not found' };

  try {
    const restored = restoreEmergencyBackupPayload(payload, window.localStorage);
    return { ok: true, restored, reason: null };
  } catch (restoreError) {
    return { ok: false, restored: 0, reason: restoreError?.message ?? 'restore failed' };
  }
}
