// Download a *single live editor snapshot* without touching either browser
// persistence store. Output is the existing, validated PhiVault backup schema.
import { WORKSPACE_BACKUP_SCHEMA } from './emergencyBackups.js';
import { isWorkspaceRecord, workspaceTypeForKey } from './workspaceRecords.js';
import { validateWorkspaceBackupImport } from './vaultImportValidation.js';

// Keep exports within PhiVault's existing 32 MiB import ceiling. That limit
// includes Unicode UTF-8 bytes, not JS UTF-16 string length.
export const LIVE_DRAFT_BACKUP_MAX_BYTES = 32 * 1024 * 1024;

export function createLiveDraftRecoveryBackup(storageKey, snapshot, {
  now = new Date(), maxBytes = LIVE_DRAFT_BACKUP_MAX_BYTES,
} = {}) {
  const type = typeof storageKey === 'string' ? workspaceTypeForKey(storageKey) : null;
  if (!type || !isWorkspaceRecord(snapshot, type.kind)) {
    throw new Error('Only a valid PhiWrite, PhiGrid, or PhiDeck editor draft can be exported.');
  }
  const timestamp = now instanceof Date && Number.isFinite(now.getTime()) ? now.toISOString() : null;
  if (!timestamp) throw new Error('The backup timestamp is invalid.');
  // Clone only by JSON serialization. Never mutate the current React draft.
  const record = { ...snapshot, updatedAt: timestamp };
  const raw = JSON.stringify(record);
  const payload = {
    schema: WORKSPACE_BACKUP_SCHEMA,
    source: 'PhiOffice369 live editor emergency recovery export',
    createdAt: timestamp,
    manifest: null,
    storageSnapshot: [[storageKey, raw]],
  };
  const validation = validateWorkspaceBackupImport(payload);
  if (!validation.ok) throw new Error('The recovery file did not pass PhiVault validation.');
  const json = JSON.stringify(payload, null, 2);
  const byteLength = new TextEncoder().encode(json).byteLength;
  if (byteLength >= maxBytes) {
    throw new Error('This draft exceeds PhiVault’s current 32 MiB JSON import limit. Use the editor’s native export and keep an external copy.');
  }
  const suffix = storageKey.slice(type.prefix.length);
  const compactTime = timestamp.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const filename = 'phioffice369-' + type.kind + '-' + suffix + '-recovery-' + compactTime + '.json';
  return { payload, json, filename, byteLength };
}

export function downloadLiveDraftRecoveryBackup(storageKey, snapshot, {
  documentRef = document, urlApi = URL, ...options
} = {}) {
  const result = createLiveDraftRecoveryBackup(storageKey, snapshot, options);
  const blob = new Blob([result.json], { type: 'application/json;charset=utf-8' });
  const url = urlApi.createObjectURL(blob);
  try {
    const link = documentRef.createElement('a');
    link.href = url;
    link.download = result.filename;
    documentRef.body.appendChild(link);
    try { link.click(); } finally { link.remove(); }
  } finally {
    urlApi.revokeObjectURL(url);
  }
  return { filename: result.filename, byteLength: result.byteLength };
}
