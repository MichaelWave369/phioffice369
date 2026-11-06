import { createExportReceipt, createLocalStorageExportReceiptKey } from '@phioffice369/core';
import {
  canUseBrowserLocalStorage,
  scanStorageJsonEntries,
  writeStorageJson,
} from './workspaceStorageAccess.js';

export { canUseBrowserLocalStorage } from './workspaceStorageAccess.js';

export function recordLocalExport(description, { artifactId, format, filename, sourceApp, warnings = [], compatibility = 'native' }) {
  try {
    const receipt = createExportReceipt({ artifactId, format, filename, sourceApp, warnings, compatibility });
    const key = createLocalStorageExportReceiptKey({ sourceApp, artifactId, format, exportedAt: receipt.exportedAt });
    if (writeStorageJson(key, receipt)) return description + '. Local receipt saved.';
  } catch {
    // Download has already been requested. Receipt storage is independent.
  }
  return description + '. Browser storage could not save its receipt.';
}

export function scanLocalExportReceipts() {
  if (!canUseBrowserLocalStorage()) return [];

  return scanStorageJsonEntries({ prefix: 'phioffice369:export_receipt:' })
    .map(({ key, value }) => ({ key, receipt: value }));
}
