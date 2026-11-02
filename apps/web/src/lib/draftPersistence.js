// Synchronous checkpoint for a user leaving an editor or reloading a tab.
// Never claim success if browser storage is blocked or full.
import { writeStorageJson } from './workspaceStorageAccess.js';

export function persistDraftSnapshot(key, snapshot, storage) {
  try {
    const payload = { ...snapshot, updatedAt: new Date().toISOString() };
    const saved = storage === undefined
      ? writeStorageJson(key, payload)
      : writeStorageJson(key, payload, storage);
    if (saved) return { ok: true, message: 'Saved locally' };
    return { ok: false, message: 'Local storage is unavailable. Export a copy before leaving.' };
  } catch {
    return { ok: false, message: 'Local save failed (possibly full storage). Export a copy before leaving.' };
  }
}
