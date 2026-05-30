import { createExportReceipt, createLocalStorageExportReceiptKey } from '@phioffice369/core';

export function canUseBrowserLocalStorage() {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

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
    window.localStorage.setItem(key, JSON.stringify(receipt));
  }

  return receipt;
}

export function scanLocalExportReceipts() {
  if (!canUseBrowserLocalStorage()) return [];

  return Object.keys(window.localStorage)
    .filter((key) => key.startsWith('phioffice369:export_receipt:'))
    .map((key) => {
      try {
        return { key, receipt: JSON.parse(window.localStorage.getItem(key)) };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
