export const PHIOFFICE_STORAGE_PREFIX = 'phioffice369:';
export const EMERGENCY_BACKUP_PREFIX = 'phioffice369:emergency_backup:';

export function isPhiOfficeStorageKey(key) {
  return String(key ?? '').startsWith(PHIOFFICE_STORAGE_PREFIX);
}

export function isEmergencyBackupStorageKey(key) {
  return String(key ?? '').startsWith(EMERGENCY_BACKUP_PREFIX);
}

export function shouldIncludeInWorkspaceSnapshot(key, { includeEmergencyBackups = false } = {}) {
  if (!isPhiOfficeStorageKey(key)) return false;
  if (!includeEmergencyBackups && isEmergencyBackupStorageKey(key)) return false;
  return true;
}

export function createStorageRecord(key, value) {
  return {
    key,
    value: String(value ?? ''),
    updatedAt: new Date().toISOString(),
  };
}

export function storageKeys(storage) {
  if (!storage) return [];

  if (typeof storage.key === 'function' && Number.isFinite(storage.length)) {
    return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean);
  }

  return Object.keys(storage);
}

export function createLocalStorageAdapter(storage) {
  return {
    id: 'localStorage',
    async isAvailable() {
      return Boolean(storage);
    },
    async getItem(key) {
      return storage?.getItem(key) ?? null;
    },
    async setItem(key, value) {
      storage?.setItem(key, String(value));
      return createStorageRecord(key, value);
    },
    async removeItem(key) {
      storage?.removeItem?.(key);
      return true;
    },
    async keys() {
      return storageKeys(storage);
    },
    async entries({ prefix = '', includeEmergencyBackups = true } = {}) {
      const keys = storageKeys(storage).filter((key) => key.startsWith(prefix));
      return keys
        .filter((key) => includeEmergencyBackups || !isEmergencyBackupStorageKey(key))
        .map((key) => [key, storage.getItem(key)])
        .filter(([, value]) => value !== null && value !== undefined);
    },
    async workspaceSnapshot(options = {}) {
      return storageKeys(storage)
        .filter((key) => shouldIncludeInWorkspaceSnapshot(key, options))
        .map((key) => [key, storage.getItem(key)])
        .filter(([, value]) => value !== null && value !== undefined);
    },
  };
}

export function createMemoryStorageAdapter(seed = {}) {
  const map = new Map(Object.entries(seed));

  return {
    id: 'memory',
    async isAvailable() {
      return true;
    },
    async getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async setItem(key, value) {
      map.set(key, String(value));
      return createStorageRecord(key, value);
    },
    async removeItem(key) {
      map.delete(key);
      return true;
    },
    async keys() {
      return Array.from(map.keys());
    },
    async entries({ prefix = '', includeEmergencyBackups = true } = {}) {
      return Array.from(map.entries())
        .filter(([key]) => key.startsWith(prefix))
        .filter(([key]) => includeEmergencyBackups || !isEmergencyBackupStorageKey(key));
    },
    async workspaceSnapshot(options = {}) {
      return Array.from(map.entries()).filter(([key]) => shouldIncludeInWorkspaceSnapshot(key, options));
    },
    dump() {
      return Object.fromEntries(map.entries());
    },
  };
}

export function detectStorageBackend(environment = globalThis) {
  if (environment?.indexedDB) return 'indexedDB';
  if (environment?.localStorage) return 'localStorage';
  return 'memory';
}

export function createBrowserStorageAdapter(environment = globalThis) {
  const backend = detectStorageBackend(environment);

  if (backend === 'localStorage' || backend === 'indexedDB') {
    // IndexedDB is the next durable target, but this adapter keeps the current
    // app behavior stable until the async IndexedDB driver lands.
    return createLocalStorageAdapter(environment.localStorage);
  }

  return createMemoryStorageAdapter();
}
