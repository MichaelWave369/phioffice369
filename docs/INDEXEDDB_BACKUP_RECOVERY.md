# PhiVault opt-in backup file recovery to IndexedDB (Sprint 7)

PhiVault's ordinary **Restore missing items** action is unchanged: it restores valid missing files and metadata into standard browser storage without overwriting existing keys.

For a large workspace when localStorage is full, a validated backup preview now offers **Recover file copies to IndexedDB**. This action is explicitly selected by the user. It is not a new default storage backend and does not migrate, rename, overwrite or delete an existing source key.

## What is restored

- Each valid PhiWrite, PhiGrid or PhiDeck file record in the uploaded backup becomes an **independent IndexedDB file copy** with its original raw JSON bytes intact and a new revision counter starting at 1.
- The copy key uses the file type prefix plus file_tx_restore_ followed by a SHA-256 digest of the **source key and exact source bytes**. Reimporting the same backup yields the same target keys: copies that already match are reported as unchanged rather than duplicated.
- Existing standard-storage values are never written by this action. If the derived key is occupied in either browser store, existing content is kept. A different IndexedDB revision/record at the destination counts as a collision, not an overwrite.
- Each add is verified in its own atomic IndexedDB transaction. If a quota error, aborted transaction or interruption occurs, earlier copies remain available, the result reports how many completed, and the user can retry the **same backup** to resume without duplication.
- Damaged, duplicated, external, or unsupported backup entries block the operation during whole-backup validation **before any file is copied**.

## Deliberate limitations

This recovery option copies **files only**. It does not import standard-storage tags, project-folder metadata, export receipts, settings, or other non-file records. The preview and result state this. The ordinary **Restore missing items** action is still available when standard storage permits, including for metadata. Records flagged as damaged in transactionalRecovery are not silently reconstructed.

Recovered files have new IndexedDB keys and fresh revision counters; the original backup keys are not installed as new standard-storage records. Exact file JSON is retained, so a restored record may have the same visible title as its source. This is intentional non-destructive recovery, **not** a claim that the source's original key, conflict history, tags, or folder was faithfully migrated.

The current backup upload accepts JSON files smaller than 32 MiB. This feature does **not** remove that import size limit or guarantee enough IndexedDB space. Storage partition eviction, site-data deletion, OS power loss, collisions between concurrent localStorage/IndexedDB writers, and corrupted backup attachments can still affect recovery. Keep exported backups outside the browser; exported JSON is **unencrypted**.

## Tests

tests/backup-to-indexeddb.test.js verifies quota-blocked standard storage, accurate file bytes, idempotent replay, interrupted IndexedDB writes and safe retry, occupied key handling, and whole-backup rejection for invalid or external keys.

The built Chromium acceptance scenario backup-idb imports a synthetic 126-file backup (120 text files and 6 PNG-bearing decks with 60 slide images) through the actual PhiVault UI while localStorage writes throw a quota error. It checks exact file bytes, no standard-store modifications, idempotent repeat import and opening a restored document.

**Release discipline:** standard storage remains the default for editors. Review and verify backup recovery tests and other cross-engine storage qualifications before expanding the pilot. The browser's IndexedDB transaction completion does not promise survival of every pending edit after an immediate hard crash.
