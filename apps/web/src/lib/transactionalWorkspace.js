import { getBrowserLocalStorage, readStorageValue } from './workspaceStorageAccess.js';
import { storedDraftToArtifact } from './localArtifactRegistry.js';
import { listTransactionalDrafts, restoreTransactionalDraftRaw } from './transactionalDraftStore.js';
import { createWorkspaceBackupPayload, restoreWorkspaceBackupPayload } from './emergencyBackups.js';
import { validateWorkspaceBackupImport } from './vaultImportValidation.js';
import { workspaceTypeForKey } from './workspaceRecords.js';

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


// Explicit recovery route for backups too large for standard browser storage. Each
// file gets a stable, content-addressed new transactional key; source keys,
// occupied keys, metadata, and non-file records are never modified.
export async function restoreBackupFileCopiesToIndexedDb(payload, {
  storage = getBrowserLocalStorage(), environment = globalThis,
} = {}) {
  const result = { ok: false, restored: 0, unchanged: 0, conflicts: 0, ignored: 0, reason: null };
  const validation = validateWorkspaceBackupImport(payload);
  if (!validation.ok) {
    result.reason = validation.errors[0] ?? 'Backup validation failed.';
    return result;
  }
  if (!storage?.getItem || !environment.indexedDB || !environment.crypto?.subtle && !globalThis.crypto?.subtle) {
    result.reason = 'Standard browser storage, IndexedDB and WebCrypto are required to safely recover file copies.';
    return result;
  }
  const cryptoApi = environment.crypto?.subtle ? environment.crypto : globalThis.crypto;
  const encoder = new TextEncoder();
  const files = payload.storageSnapshot.filter(([key]) => workspaceTypeForKey(key));
  result.ignored = payload.storageSnapshot.length - files.length;
  try {
    for (const [sourceKey, raw] of files) {
      const type = workspaceTypeForKey(sourceKey);
      const bytes = encoder.encode(sourceKey + '\0' + raw);
      const hash = Array.from(new Uint8Array(await cryptoApi.subtle.digest('SHA-256', bytes)),
        (byte) => byte.toString(16).padStart(2, '0')).join('');
      const targetKey = type.prefix + 'file_tx_restore_' + hash;
      // The two browser stores cannot participate in one atomic transaction.
      // Refuse any target key already occupied in standard storage.
      if (storage.getItem(targetKey) !== null) {
        result.conflicts += 1;
        continue;
      }
      const outcome = await restoreTransactionalDraftRaw(targetKey, raw, environment);
      result[outcome.status === 'restored' ? 'restored'
        : outcome.status === 'unchanged' ? 'unchanged' : 'conflicts'] += 1;
    }
    result.ok = true;
  } catch (error) {
    result.reason = 'IndexedDB recovery was interrupted (' + (error?.name ?? 'StorageError')
      + '). Earlier verified copies remain available; retry the same backup to resume.';
  }
  return result;
}
