# Sprint 10: Download a Recovery JSON from the Live Editor

## Purpose

A failed browser save can leave the newest changes **in memory only**. A PhiVault backup exported from storage would capture the previous saved version, not necessarily the editor text or slides still on screen. This sprint adds an **explicit, single-file, portable recovery download**, independent of browser storage writes.

## In-editor action

PhiWrite, PhiGrid, and PhiDeck show **Download recovery JSON** beside their existing save controls. The action:

1. Captures the **current in-memory editor snapshot** from the shared `useWorkspaceDraft` hook, without first calling the potentially failing browser save path.
2. Validates the file key and the snapshot using the existing PhiOffice file schema, adds a recovery timestamp to a copy (not the active editor state), and serializes exactly **one file** in `phioffice369.workspace_backup.v0.1` format.
3. Validates the resulting backup through the existing PhiVault importer, then initiates an ordinary browser JSON-file download.
4. Shows a precise message: **download requested**, not a claim that the browser or OS successfully wrote a file. Users must check the download actually exists outside browser storage. The JSON is **unencrypted**.

The action remains available when standard storage is full, unavailable, or a save attempt fails. It doesn't write either localStorage or IndexedDB, modify source keys, overwrite backups, sync to PhiCloud, or automatically protect later edits.

## Restoring a downloaded recovery file

1. Open PhiVault in a normal or fresh PhiOffice session.
2. Use **Import manifest / backup** to select the recovery JSON.
3. If the original key is missing, **Restore missing items** can recover it without overwriting an occupied key.
4. If an existing key conflicts or browser localStorage is full, choose **Recover file copies to IndexedDB** to create a separate, verified revision-1 copy instead. That option intentionally does not import tags and other workspace metadata.
5. Open the restored file from PhiVault and verify the content.

**Limits:** Each recovery download must be **smaller than 32 MiB** including the UTF-8 JSON envelope, matching PhiVault's current import ceiling. For a larger image-heavy deck the action refuses to claim an importable backup and directs the user toward existing native exports. This action does not fix the backup file-size ceiling, power-loss risk, data in a terminated tab before export, or physical site-data eviction.

## Qualification

- `tests/live-draft-recovery.test.js` checks valid portable one-file backups for all three editors, Unicode, source immutability, safe collision handling, invalid records, payload ceiling, Blob URL cleanup, and download failure.
- The production Chromium `live-recovery` browser scenario opens PhiWrite, simulates a `QuotaExceededError`, verifies the original source bytes are intact, then exports and parses the **latest unsaved** in-memory text.
- Firefox and WebKit run the same `live-recovery` acceptance scenario in their independent browser-engine CI matrix, alongside existing recovery and portability tests.

**Trust boundary:** A requested browser download is not a verified backup on disk. The user must keep the downloaded file in a separate, trusted location. Exports may contain private material and are not encrypted. Standard storage remains the default. Issue #54 continues to cover abrupt-crash persistence.
