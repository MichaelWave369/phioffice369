import { requestToPromise, transactionDone } from './indexedDbStorageAdapter.js';
import { getBrowserLocalStorage } from './workspaceStorageAccess.js';
import { parseWorkspaceRecord, readWorkspaceRecord, workspaceTypeForKey } from './workspaceRecords.js';
import { prepareWorkspaceCopy } from './workspaceFileCopy.js';

export const EDITOR_DB_NAME = 'phioffice369-editor-revisions';
export const EDITOR_FILE_STORE = 'files';
const revisionIsValid = (revision) => Number.isSafeInteger(revision) && revision > 0;
const isEditorKey = (key) => typeof key === 'string' && workspaceTypeForKey(key) &&
  /^file_tx_[a-z0-9_-]+$/i.test(key.slice(key.lastIndexOf(':') + 1));

function loadRow(row, key = row?.key) {
  if (!row) return { key, state: 'missing', raw: null, record: null };
  if (row.key === key && isEditorKey(key) && revisionIsValid(row.revision) && typeof row.raw === 'string') {
    return { key, revision: row.revision, ...parseWorkspaceRecord(key, row.raw) };
  }
  return { key, revision: row.revision, raw: row.raw, record: null, state: 'damaged' };
}

async function withStore(environment, mode, operation) {
  const request = environment.indexedDB.open(EDITOR_DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(EDITOR_FILE_STORE, { keyPath: 'key' });
  const database = await requestToPromise(request);
  try {
    const transaction = mode === 'readwrite'
      ? database.transaction(EDITOR_FILE_STORE, mode, { durability: 'strict' })
      : database.transaction(EDITOR_FILE_STORE, mode);
    const complete = transactionDone(transaction);
    try {
      const [result] = await Promise.all([operation(transaction.objectStore(EDITOR_FILE_STORE)), complete]);
      return result;
    } catch (error) {
      try { transaction.abort(); } catch { /* The transaction may already have finished. */ }
      await complete.catch(() => {});
      throw error;
    }
  } finally {
    database.close();
  }
}

export async function readTransactionalDraft(key, environment = globalThis) {
  if (!isEditorKey(key)) throw new Error('Invalid transactional file key.');
  return withStore(environment, 'readonly', async (store) => loadRow(await requestToPromise(store.get(key)), key));
}

export async function listTransactionalDrafts(environment = globalThis) {
  if (!environment.indexedDB) return [];
  return withStore(environment, 'readonly', async (store) => (await requestToPromise(store.getAll())).map((row) => loadRow(row)));
}

function makeRow(key, snapshot, revision) {
  if (!revisionIsValid(revision)) throw new Error('File revision limit reached.');
  const raw = JSON.stringify({ ...snapshot, updatedAt: new Date().toISOString() });
  const file = parseWorkspaceRecord(key, raw);
  if (!file.record) throw new Error('This draft cannot be stored because it has invalid content.');
  return { key, raw, revision };
}

function makeCopy(key, snapshot, recovered = false) {
  const copy = prepareWorkspaceCopy(key, snapshot, recovered ? ' (conflict copy)' : ' (IndexedDB copy)', 'tx_' + crypto.randomUUID());
  return makeRow(copy.key, {
    ...copy.snapshot,
    ...(recovered ? { recoveredFrom: key } : { copiedFrom: key }),
  }, 1);
}

function addVerifiedCopy(store, row) {
  const added = requestToPromise(store.add(row));
  const verified = requestToPromise(store.get(row.key)).then((actual) => {
    if (actual?.revision !== row.revision || actual?.raw !== row.raw || !loadRow(actual).record) {
      throw new Error('Transactional copy did not verify. The source file was preserved.');
    }
  });
  return Promise.all([added, verified]).then(() => row);
}

export async function migrateLegacyDraft(key, storage = getBrowserLocalStorage(), environment = globalThis) {
  const source = readWorkspaceRecord(key, storage);
  if (source.state !== 'saved') throw new Error('Only readable saved files can be copied.');
  const row = makeCopy(key, source.record);
  return withStore(environment, 'readwrite', (store) => {
    if (readWorkspaceRecord(key, storage).raw !== source.raw) {
      throw new Error('The source changed while the copy was starting. Refresh PhiVault and try again.');
    }
    return addVerifiedCopy(store, row);
  });
}

export async function duplicateTransactionalDraft(key, record, environment = globalThis) {
  if (!isEditorKey(key)) throw new Error('Invalid transactional file key.');
  const row = makeCopy(key, record);
  return withStore(environment, 'readwrite', (store) => addVerifiedCopy(store, row));
}

export async function saveTransactionalDraft(key, expectedRevision, snapshot, {
  environment = globalThis,
  recoverConflict = false,
  allowTrashed = false,
} = {}) {
  if (!isEditorKey(key) || !revisionIsValid(expectedRevision)) throw new Error('Invalid transactional file revision.');
  return withStore(environment, 'readwrite', (store) => new Promise((resolve, reject) => {
    const read = store.get(key);
    read.onerror = () => reject(read.error);
    read.onsuccess = () => {
      try {
        const current = loadRow(read.result, key);
        if (!current.record || current.revision !== expectedRevision || (current.state === 'trashed' && !allowTrashed)) {
          if (!recoverConflict) {
            resolve({ ok: false, state: current.state, revision: current.revision });
            return;
          }
          const copy = makeCopy(key, snapshot, true);
          addVerifiedCopy(store, copy).then((row) => resolve({ ok: true, ...row, recoveredFrom: key }), reject);
          return;
        }
        const next = makeRow(key, snapshot, expectedRevision + 1);
        requestToPromise(store.put(next)).then(() => resolve({ ok: true, ...next }), reject);
      } catch (error) {
        reject(error);
      }
    };
  }));
}


// Add-only, byte-preserving restore. A deterministic restored file key is
// supplied by the caller after validating a complete backup. A conflict never
// overwrites the existing revision or the imported source.
export async function restoreTransactionalDraftRaw(key, raw, environment = globalThis) {
  if (!isEditorKey(key) || typeof raw !== 'string' || !parseWorkspaceRecord(key, raw).record) {
    throw new Error('Only valid PhiOffice files can be restored into transactional storage.');
  }
  return withStore(environment, 'readwrite', (store) => new Promise((resolve, reject) => {
    const read = store.get(key);
    read.onerror = () => reject(read.error);
    read.onsuccess = () => {
      const existing = read.result;
      if (existing) {
        const valid = loadRow(existing, key);
        resolve({ status: valid.record && existing.raw === raw ? 'unchanged' : 'conflict', key });
        return;
      }
      const row = { key, raw, revision: 1 };
      const add = store.add(row);
      add.onerror = () => reject(add.error);
      add.onsuccess = () => {
        const verify = store.get(key);
        verify.onerror = () => reject(verify.error);
        verify.onsuccess = () => {
          if (verify.result?.raw !== raw || verify.result?.revision !== 1
              || !loadRow(verify.result, key).record) {
            reject(new Error('Restored IndexedDB copy could not be verified.'));
          } else {
            resolve({ status: 'restored', key });
          }
        };
      };
    };
  }));
}
