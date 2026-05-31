import { createExportReceipt, createLocalStorageExportReceiptKey } from '@phioffice369/core';
import {
  canUseBrowserLocalStorage,
  scanStorageJsonEntries,
  writeStorageJson,
} from './workspaceStorageAccess.js';

export { canUseBrowserLocalStorage } from './workspaceStorageAccess.js';

export function saveLocalExportReceipt({ artifactId, format, filename, sourceApp, warnings = [], compatibility = 'native' }) {
  const receipt = createExportReceipt({
    artifactId,
    format,
    filename,
    sourceApp,
    warnings,
    compatibility,
  });

  if (canUseBrowserLocalStorage()) {
    const key = createLocalStorageExportReceiptKey({
      sourceApp,
      artifactId,
      format,
      exportedAt: receipt.exportedAt,
    });
    writeStorageJson(key, receipt);
  }

  return receipt;
}

export function scanLocalExportReceipts() {
  if (!canUseBrowserLocalStorage()) return [];

  return scanStorageJsonEntries({ prefix: 'phioffice369:export_receipt:' })
    .map(({ key, value }) => ({ key, receipt: value }));
}
