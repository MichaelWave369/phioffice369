// Synchronous checkpoint for a user leaving an editor or reloading a tab.
// Never claim success if browser storage is blocked or full.
import { getBrowserLocalStorage, readStorageValue, writeStorageValue } from './workspaceStorageAccess.js';

export function persistDraftSnapshot(key, snapshot, storage = getBrowserLocalStorage(), expectedRaw) {
  try {
    if (storage && expectedRaw !== undefined && readStorageValue(key, storage) !== expectedRaw) {
      return { ok: false, message: 'This file changed in another tab or in PhiVault. Export a copy before reopening.' };
    }
    const raw = JSON.stringify({ ...snapshot, updatedAt: new Date().toISOString() });
    if (writeStorageValue(key, raw, storage)) return { ok: true, message: 'Saved locally in this browser (not crash-proof). Export backups of important work.', raw };
    return { ok: false, message: 'Local storage is unavailable. Export a copy before leaving.' };
  } catch {
    return { ok: false, message: 'Local save failed (possibly full storage). Export a copy before leaving.' };
  }
}
