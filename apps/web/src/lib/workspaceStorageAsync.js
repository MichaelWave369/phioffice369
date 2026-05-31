import { createBrowserStorageAdapter } from './storageAdapters.js';

export const WORKSPACE_STORAGE_ASYNC_SCHEMA = 'phioffice369.workspace_storage_async.v0.1';

export function createWorkspaceStorageAdapter(environment = globalThis, options = {}) {
  return createBrowserStorageAdapter(environment, options);
}

export async function readWorkspaceValue(key, { adapter = null, environment = globalThis, options = {} } = {}) {
  const storageAdapter = adapter ?? createWorkspaceStorageAdapter(environment, options);
  return storageAdapter.getItem(key);
}

export async function writeWorkspaceValue(key, value, { adapter = null, environment = globalThis, options = {} } = {}) {
  const storageAdapter = adapter ?? createWorkspaceStorageAdapter(environment, options);
  return storageAdapter.setItem(key, value);
}

export async function removeWorkspaceValue(key, { adapter = null, environment = globalThis, options = {} } = {}) {
  const storageAdapter = adapter ?? createWorkspaceStorageAdapter(environment, options);
  return storageAdapter.removeItem(key);
}

export async function readWorkspaceJson(key, fallback = null, options = {}) {
  const raw = await readWorkspaceValue(key, options);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function writeWorkspaceJson(key, value, options = {}) {
  return writeWorkspaceValue(key, JSON.stringify(value), options);
}

export async function scanWorkspaceEntries({ prefix = '', adapter = null, environment = globalThis, options = {}, includeEmergencyBackups = true } = {}) {
  const storageAdapter = adapter ?? createWorkspaceStorageAdapter(environment, options);
  return storageAdapter.entries({ prefix, includeEmergencyBackups });
}

export async function scanWorkspaceJsonEntries({ prefix = '', adapter = null, environment = globalThis, options = {}, includeEmergencyBackups = true } = {}) {
  const entries = await scanWorkspaceEntries({ prefix, adapter, environment, options, includeEmergencyBackups });
  return entries
    .map(([key, value]) => {
      try {
        return { key, value: JSON.parse(value) };
      } catch {
        return { key, value: null };
      }
    })
    .filter((entry) => entry.value !== null);
}

export async function createWorkspaceAsyncStatus({ adapter = null, environment = globalThis, options = {} } = {}) {
  const storageAdapter = adapter ?? createWorkspaceStorageAdapter(environment, options);
  const available = await storageAdapter.isAvailable();
  const snapshot = await storageAdapter.workspaceSnapshot({ includeEmergencyBackups: false });

  return {
    schema: WORKSPACE_STORAGE_ASYNC_SCHEMA,
    createdAt: new Date().toISOString(),
    adapterId: storageAdapter.id,
    available,
    snapshotCount: snapshot.length,
  };
}
