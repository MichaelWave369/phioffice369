import { classifyStorageKey } from './storageKeyCatalog.js';

export const WORKSPACE_STORAGE_ACCESS_SCHEMA = 'phioffice369.workspace_storage_access.v0.1';

export function canUseBrowserLocalStorage() {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

export function getBrowserLocalStorage(environment = globalThis) {
  try {
    return environment?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function listStorageKeys(storage) {
  if (!storage) return [];

  if (typeof storage.key === 'function' && Number.isFinite(storage.length)) {
    return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean);
  }

  return Object.keys(storage);
}

export function readStorageValue(key, storage = getBrowserLocalStorage()) {
  if (!storage?.getItem) return null;
  return storage.getItem(key);
}

export function writeStorageValue(key, value, storage = getBrowserLocalStorage()) {
  if (!storage?.setItem) return false;
  storage.setItem(key, String(value));
  return true;
}

export function removeStorageValue(key, storage = getBrowserLocalStorage()) {
  if (!storage?.removeItem) return false;
  storage.removeItem(key);
  return true;
}

export function readStorageJson(key, storage = getBrowserLocalStorage()) {
  const raw = readStorageValue(key, storage);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeStorageJson(key, value, storage = getBrowserLocalStorage()) {
  return writeStorageValue(key, JSON.stringify(value), storage);
}

export function scanStorageEntries({ prefix = '', storage = getBrowserLocalStorage(), includeValues = true } = {}) {
  return listStorageKeys(storage)
    .filter((key) => key.startsWith(prefix))
    .map((key) => (includeValues ? [key, readStorageValue(key, storage)] : [key, null]))
    .filter(([, value]) => includeValues === false || value !== null && value !== undefined);
}

export function scanStorageJsonEntries({ prefix = '', storage = getBrowserLocalStorage() } = {}) {
  return scanStorageEntries({ prefix, storage })
    .map(([key]) => ({ key, value: readStorageJson(key, storage) }))
    .filter((entry) => entry.value !== null);
}

export function createWorkspaceStorageAudit({ storage = getBrowserLocalStorage(), prefix = 'phioffice369:' } = {}) {
  const entries = scanStorageEntries({ prefix, storage, includeValues: false }).map(([key]) => classifyStorageKey(key));
  const unknownPhiOfficeKeys = entries.filter((entry) => entry.namespaceId === 'unknown_phioffice_namespace').map((entry) => entry.key);

  return {
    schema: WORKSPACE_STORAGE_ACCESS_SCHEMA,
    createdAt: new Date().toISOString(),
    prefix,
    totalKeys: entries.length,
    knownKeys: entries.filter((entry) => entry.known).length,
    unknownPhiOfficeKeys,
    entries,
  };
}
