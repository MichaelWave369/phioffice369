import { createStorageRecord, shouldIncludeInWorkspaceSnapshot } from './storageAdapters.js';

export const PHIOFFICE_INDEXED_DB_NAME = 'phioffice369-local-vault';
export const PHIOFFICE_INDEXED_DB_VERSION = 1;
export const PHIOFFICE_KV_STORE = 'kv';
export const PHIOFFICE_UPDATED_AT_INDEX = 'updatedAt';

export function isIndexedDbAvailable(environment = globalThis) {
  try {
    return Boolean(environment?.indexedDB);
  } catch {
    return false;
  }
}

export function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

export function openPhiOfficeIndexedDb(environment = globalThis) {
  if (!isIndexedDbAvailable(environment)) {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }

  const request = environment.indexedDB.open(PHIOFFICE_INDEXED_DB_NAME, PHIOFFICE_INDEXED_DB_VERSION);

  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(PHIOFFICE_KV_STORE)) {
      const store = database.createObjectStore(PHIOFFICE_KV_STORE, { keyPath: 'key' });
      store.createIndex(PHIOFFICE_UPDATED_AT_INDEX, PHIOFFICE_UPDATED_AT_INDEX, { unique: false });
    }
  };

  return requestToPromise(request);
}

export function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export async function withPhiOfficeStore({ environment = globalThis, mode = 'readonly', operation }) {
  const database = await openPhiOfficeIndexedDb(environment);
  try {
    const transaction = database.transaction(PHIOFFICE_KV_STORE, mode);
    const store = transaction.objectStore(PHIOFFICE_KV_STORE);
    const result = await operation(store, transaction);
    if (mode === 'readwrite') await transactionDone(transaction);
    return result;
  } finally {
    database.close?.();
  }
}

export function recordToEntry(record) {
  return record?.key ? [record.key, record.value] : null;
}

export function createIndexedDbStorageAdapter(environment = globalThis) {
  return {
    id: 'indexedDB',
    async isAvailable() {
      return isIndexedDbAvailable(environment);
    },
    async getItem(key) {
      return withPhiOfficeStore({
        environment,
        operation: async (store) => {
          const record = await requestToPromise(store.get(key));
          return record?.value ?? null;
        },
      });
    },
    async setItem(key, value) {
      const record = createStorageRecord(key, value);
      await withPhiOfficeStore({
        environment,
        mode: 'readwrite',
        operation: async (store) => {
          store.put(record);
          return record;
        },
      });
      return record;
    },
    async removeItem(key) {
      await withPhiOfficeStore({
        environment,
        mode: 'readwrite',
        operation: async (store) => {
          store.delete(key);
          return true;
        },
      });
      return true;
    },
    async keys() {
      return withPhiOfficeStore({
        environment,
        operation: async (store) => {
          const records = await requestToPromise(store.getAll());
          return records.map((record) => record.key);
        },
      });
    },
    async entries({ prefix = '', includeEmergencyBackups = true } = {}) {
      return withPhiOfficeStore({
        environment,
        operation: async (store) => {
          const records = await requestToPromise(store.getAll());
          return records
            .filter((record) => record.key.startsWith(prefix))
            .filter((record) => includeEmergencyBackups || shouldIncludeInWorkspaceSnapshot(record.key, { includeEmergencyBackups: false }))
            .map(recordToEntry)
            .filter(Boolean);
        },
      });
    },
    async workspaceSnapshot(options = {}) {
      return withPhiOfficeStore({
        environment,
        operation: async (store) => {
          const records = await requestToPromise(store.getAll());
          return records
            .filter((record) => shouldIncludeInWorkspaceSnapshot(record.key, options))
            .map(recordToEntry)
            .filter(Boolean);
        },
      });
    },
  };
}
