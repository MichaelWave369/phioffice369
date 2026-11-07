# Transactional editor storage

In PhiVault, select a saved PhiWrite, PhiGrid, or PhiDeck file and choose **Create IndexedDB copy**. Open the copy to use transactional saves. Each migrated copy has a new file ID and records its source. The original, including a template-bound draft, keeps its original key and bytes. Tags and project folder follow the copy when standard browser metadata storage is writable. The editor reports the committed revision after the transaction completes.

## Conflicts and recovery

- Each save checks the loaded revision and writes the next revision in one IndexedDB transaction. A stale editor writes a separate **conflict copy**. Further saves from that editor follow the copy. Find both versions in PhiVault before deciding which to use.
- A failed or aborted transaction leaves the committed record available. Keep the editor open and retry, or use its export action for unsaved edits. Browser exit warnings and best-effort checkpoints cannot guarantee a pending save on abrupt close.
- **Copy to standard storage** creates a new standard file with the selected content. Open it to resume standard saves. Both source and copy stay available. Trash and Restore use revision-checked transactions for IndexedDB files.
- **Backup workspace** and **Backup saved files** include both stores. The portable backup imports missing files into standard storage, keeps keys present in either store, and preserves document contents and metadata. Revision counters are local to the active IndexedDB records. Damaged records and file-key collisions are included separately for manual recovery and can be downloaded from PhiVault.
- Standard saves and the earlier Vault scan pilot are separate from these editor transactions. Each migration is explicit and verifies the copy before acknowledging success. A failed copy can be retried without deleting the source or rolling back earlier successful copies.

Storage is local to the browser profile and origin. Quota, eviction, and clearing site data can affect both stores. Backups are unencrypted. Use the editor's committed status and keep exported copies outside the browser. The workspace backup reads committed data from each store, with independent metadata writes and no cross-store transaction.

## Checks

Node tests simulate interrupted transactions and partial migrations, stale saves, quota failures, corrupt records, and backup collisions. Chromium acceptance uses two real tabs on the Pages build to verify migration, saving, reload, conflict recovery, export, Trash, and copying back to standard storage.
