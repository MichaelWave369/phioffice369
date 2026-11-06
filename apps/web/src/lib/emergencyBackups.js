import { inspectBackupSnapshot } from './workspaceBackupSnapshot.js';
import { EMERGENCY_BACKUP_PREFIX, createBrowserStorageAdapter } from './storageAdapters.js';

export { EMERGENCY_BACKUP_PREFIX } from './storageAdapters.js';

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

export async function collectPhiOfficeStorageSnapshotFromAdapter(adapter = createBrowserStorageAdapter()) {
  return adapter.workspaceSnapshot({ includeEmergencyBackups: false });
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

export async function createEmergencyBackupPayloadFromAdapter({ error, errorInfo, adapter = createBrowserStorageAdapter(), source = 'AppErrorBoundary' }) {
  return {
    schema: 'phioffice369.emergency_backup.v0.1',
    source,
    createdAt: new Date().toISOString(),
    error: errorToPlainObject(error),
    componentStack: errorInfo?.componentStack ?? null,
    storageSnapshot: await collectPhiOfficeStorageSnapshotFromAdapter(adapter),
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

export async function createWorkspaceBackupPayloadFromAdapter({ adapter = createBrowserStorageAdapter(), manifest = null, source = 'PhiVault-lite manual export' }) {
  return {
    schema: WORKSPACE_BACKUP_SCHEMA,
    source,
    createdAt: new Date().toISOString(),
    manifest,
    storageSnapshot: await collectPhiOfficeStorageSnapshotFromAdapter(adapter),
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

function prepareRestore(payload) {
  if (!isWorkspaceBackupPayload(payload)) return { errors: ['Not a PhiOffice369 workspace backup.'] };
  return inspectBackupSnapshot(payload.storageSnapshot);
}

export function restoreWorkspaceBackupPayload(payload, storage) {
  const { entries, errors, ignored = 0 } = prepareRestore(payload);
  let restored = 0;
  let conflicts = 0;
  let unchanged = 0;
  let reason = errors[0] ?? null;
  try {
    if (!reason && !storage) reason = 'Browser storage is unavailable.';
    if (!reason) {
      for (const [key, value] of entries) {
        const existing = storage.getItem(key);
        if (existing === null) {
          storage.setItem(key, value);
          restored += 1;
        } else if (existing === value) unchanged += 1;
        else conflicts += 1;
      }
    }
  } catch {
    reason = 'Browser storage is full or unavailable. Existing records were kept. You can retry this backup.';
  }
  return { ok: !reason, restored, conflicts, unchanged, ignored, reason };
}

export async function restoreWorkspaceBackupPayloadWithAdapter(payload, adapter = createBrowserStorageAdapter()) {
  const { entries, errors, ignored = 0 } = prepareRestore(payload);
  let restored = 0;
  let conflicts = 0;
  let unchanged = 0;
  let reason = errors[0] ?? null;
  try {
    if (!reason && !await adapter.isAvailable()) reason = 'Workspace adapter is unavailable.';
    if (!reason) {
      for (const [key, value] of entries) {
        const result = await adapter.setItemIfMissing(key, value);
        if (result.written) restored += 1;
        else if (result.existing === value) unchanged += 1;
        else conflicts += 1;
      }
    }
  } catch {
    reason = 'The workspace adapter could not complete the restore. You can retry this backup.';
  }
  return { ok: !reason, restored, conflicts, unchanged, ignored, reason };
}

export function restoreEmergencyBackup(key) {
  if (!canUseEmergencyStorage()) return { ok: false, restored: 0, reason: 'localStorage unavailable' };

  const payload = readEmergencyBackup(key);
  if (!payload) return { ok: false, restored: 0, reason: 'backup not found' };

  return restoreWorkspaceBackupPayload({ ...payload, schema: WORKSPACE_BACKUP_SCHEMA }, window.localStorage);
}
