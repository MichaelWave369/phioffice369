import { getBrowserLocalStorage, readStorageValue } from './workspaceStorageAccess.js';
import { storedDraftToArtifact } from './localArtifactRegistry.js';
import { listTransactionalDrafts } from './transactionalDraftStore.js';
import { createWorkspaceBackupPayload, restoreWorkspaceBackupPayload } from './emergencyBackups.js';

export async function readTransactionalWorkspace(storage = getBrowserLocalStorage()) {
  const files = [];
  const recovery = [];
  for (const entry of await listTransactionalDrafts()) {
    if (!entry.record || readStorageValue(entry.key, storage) !== null) {
      const { key, revision, raw } = entry;
      recovery.push({ key, revision, raw, reason: entry.record ? 'file-key-collision' : 'damaged-record' });
    } else {
      files.push(entry);
    }
  }
  return { files, recovery };
}

export async function createCompleteWorkspaceBackup({ storage = getBrowserLocalStorage(), ...options } = {}) {
  if (!storage) throw new Error('Standard browser storage is unavailable.');
  const { files, recovery } = await readTransactionalWorkspace(storage);
  const payload = createWorkspaceBackupPayload({ storage, ...options });
  const occupied = new Set(payload.storageSnapshot.map(([key]) => key));
  const manifestPaths = new Set(payload.manifest?.artifacts.map(({ path }) => path));
  const manifestEntries = [];
  for (const { key, raw, revision, state, record } of files) {
    // An older app can write a legacy copy while this backup is being prepared.
    if (occupied.has(key)) recovery.push({ key, raw, revision, reason: 'file-key-collision' });
    else {
      payload.storageSnapshot.push([key, raw]);
      if (payload.manifest && state === 'saved' && !manifestPaths.has(key)) {
        manifestEntries.push(storedDraftToArtifact(key, record, revision));
      }
    }
  }
  if (manifestEntries.length) payload.manifest = { ...payload.manifest, artifacts: [...payload.manifest.artifacts, ...manifestEntries] };
  if (recovery.length) payload.transactionalRecovery = recovery;
  return payload;
}

export async function restoreCompleteWorkspaceBackup(payload, storage = getBrowserLocalStorage()) {
  const transactional = new Map((await listTransactionalDrafts()).map(({ key, raw }) => [key, raw]));
  const guardedStorage = storage && {
    getItem(key) {
      return transactional.has(key) ? transactional.get(key) ?? 'Existing transactional record' : storage.getItem(key);
    },
    setItem: (key, value) => storage.setItem(key, value),
  };
  return restoreWorkspaceBackupPayload(payload, guardedStorage);
}
