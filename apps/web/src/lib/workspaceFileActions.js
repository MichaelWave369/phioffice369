import { prepareWorkspaceCopy } from './workspaceFileCopy.js';
import { duplicateTransactionalDraft, migrateLegacyDraft, readTransactionalDraft, saveTransactionalDraft } from './transactionalDraftStore.js';
import { persistDraftSnapshot } from './draftPersistence.js';
import { getBrowserLocalStorage, readStorageValue, writeStorageValue } from './workspaceStorageAccess.js';
import { readWorkspaceRecord, workspaceTypeForKey } from './workspaceRecords.js';
import { createArtifactMetadataKey } from './localArtifactMetadata.js';
import { storageKeyToArtifactId } from './localArtifactRegistry.js';

function withCopiedMetadata(result, sourceKey, copyKey, storage) {
  if (!result.ok) return result;
  try {
    const metadata = readStorageValue(createArtifactMetadataKey(storageKeyToArtifactId(sourceKey)), storage);
    if (metadata !== null && !writeStorageValue(createArtifactMetadataKey(storageKeyToArtifactId(copyKey)), metadata, storage)) {
      throw new Error('Metadata storage unavailable.');
    }
    return { ...result, key: copyKey };
  } catch {
    return { ...result, key: copyKey, metadataFailed: true };
  }
}

export function changeWorkspaceFile(key, action, title, storage = getBrowserLocalStorage()) {
  const type = workspaceTypeForKey(key);
  const { record, raw, state } = readWorkspaceRecord(key, storage);
  if (!type || state !== (action === 'restore' ? 'trashed' : 'saved')) {
    return { ok: false, message: 'This file is no longer available for that action. Refresh PhiVault.' };
  }
  const id = key.slice(type.prefix.length);
  if (action === 'rename') {
    if (!title?.trim()) return { ok: false, message: 'Enter a file name before renaming.' };
    return persistDraftSnapshot(key, { ...record, title: title.trim().slice(0, 240) }, storage, raw);
  }
  if (action === 'duplicate') {
    const copy = prepareWorkspaceCopy(key, record, ' (copy)');
    return withCopiedMetadata(persistDraftSnapshot(copy.key, copy.snapshot, storage, null), key, copy.key, storage);
  }
  if (action === 'trash' && id.startsWith('file_')) {
    return persistDraftSnapshot(key, { ...record, trashedAt: new Date().toISOString() }, storage, raw);
  }
  if (action === 'restore') {
    const next = { ...record };
    delete next.trashedAt;
    return persistDraftSnapshot(key, next, storage, raw);
  }
  return { ok: false, message: 'Only independent files can be moved to Trash.' };
}

export async function migrateWorkspaceFile(key, storage = getBrowserLocalStorage()) {
  const row = await migrateLegacyDraft(key, storage);
  return withCopiedMetadata({ ok: true }, key, row.key, storage);
}

export async function changeTransactionalFile(file, action, title, storage = getBrowserLocalStorage()) {
  const { key, revision } = file;
  const loaded = await readTransactionalDraft(key);
  const unavailable = { ok: false, message: 'This file changed in another editor. Refresh PhiVault and try again.' };
  if (loaded.revision !== revision || loaded.state !== (action === 'restore' ? 'trashed' : 'saved')) return unavailable;
  const { record } = loaded;
  if (action === 'duplicate') {
    const copy = await duplicateTransactionalDraft(key, record);
    return withCopiedMetadata({ ok: true }, key, copy.key, storage);
  }
  if (action === 'standard-copy') {
    const copy = prepareWorkspaceCopy(key, record, ' (standard copy)');
    return withCopiedMetadata(persistDraftSnapshot(copy.key, copy.snapshot, storage, null), key, copy.key, storage);
  }
  const snapshot = { ...record };
  if (action === 'rename') {
    if (!title?.trim()) return { ok: false, message: 'Enter a file name before renaming.' };
    snapshot.title = title.trim().slice(0, 240);
  } else if (action === 'trash') {
    snapshot.trashedAt = new Date().toISOString();
  } else if (action === 'restore') {
    delete snapshot.trashedAt;
  } else {
    return { ok: false, message: 'Unsupported transactional file action.' };
  }
  const result = await saveTransactionalDraft(key, revision, snapshot, { allowTrashed: action === 'restore' });
  return result.ok ? result : unavailable;
}
