import { makeIndependentWorkspaceTemplate } from './recentWorkspaces.js';
import { persistDraftSnapshot } from './draftPersistence.js';
import { getBrowserLocalStorage, readStorageValue, writeStorageValue } from './workspaceStorageAccess.js';
import { readWorkspaceRecord, workspaceTitle, workspaceTypeForKey } from './workspaceRecords.js';
import { createArtifactMetadataKey } from './localArtifactMetadata.js';
import { storageKeyToArtifactId } from './localArtifactRegistry.js';

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
    const next = makeIndependentWorkspaceTemplate({ app: type.app, id, sourceTemplateId: record.sourceTemplateId });
    const nextKey = type.prefix + next.id;
    const sourceTitle = workspaceTitle(record.title ?? '', type.app);
    const result = persistDraftSnapshot(nextKey, {
      ...record, templateId: next.id, sourceTemplateId: next.sourceTemplateId, title: sourceTitle + ' (copy)',
    }, storage, null);
    if (!result.ok) return result;
    try {
      const metadata = readStorageValue(createArtifactMetadataKey(storageKeyToArtifactId(key)), storage);
      if (metadata !== null) writeStorageValue(createArtifactMetadataKey(storageKeyToArtifactId(nextKey)), metadata, storage);
    } catch {
      return { ...result, key: nextKey, message: 'File duplicated. Its tags and folder could not be copied.' };
    }
    return { ...result, key: nextKey };
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
