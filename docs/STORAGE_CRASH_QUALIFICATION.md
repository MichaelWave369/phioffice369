# Sprint 6: hard-kill crash and image-heavy durability qualification

**This fixture runs against disposable localhost browser data only.** Never point it at a real profile. The test intentionally issues a process-level `SIGKILL` to Chromium.

## Automated evidence

After `npm ci --no-audit && npm run build`, execute:

    npm run test:browser:crash

The runner starts a local server for the compiled app and a unique temporary Chromium user-data directory. It then:

1. Creates a synthetic standard-storage PhiWrite source, verifies an opt-in IndexedDB copy, opens the copy in the real editor and waits until **revision 2** is acknowledged as committed.
2. Creates eight additional **synthetic image-heavy PhiDeck records**, each containing four independent 256×256 seeded PNG slide images. All are stored in completed real IndexedDB transactions. The fixture checks that the combined image payload exceeds six million encoded characters. These image rows are directly seeded into the editor IndexedDB store to stress persistence, **not** produced by the normal slide editor UI.
3. Abruptly kills the Chrome process with `SIGKILL`, **without sending Browser.close, pagehide or a graceful shutdown**.
4. Starts a new Chrome process using the **same temporary browser profile**, reads all IndexedDB records and checks the previously acknowledged revision 2, 32 PNG slide images and the unchanged legacy source.
5. Reopens the committed PhiWrite document through the real UI and uses **Backup workspace** to verify the combined original source and every transactional record are included exactly.

The runner removes only its own temporary browser profile. No synthetic crash data is ever installed in your normal Chrome profile.

The ordinary CI test suite still runs independently; the crash fixture is **not** run in the ordinary Chromium acceptance loop because it requires the external hard-termination orchestrator.

## What PASS means and does not mean

PASS establishes that previously acknowledged commits survive **one real hard browser-process termination** on the GitHub Linux Chromium runner, with sizable raster-bearing IndexedDB records.

It does **not** guarantee that an edit still awaiting IndexedDB transaction completion survives the crash. On browser exit, that unsaved edit can be lost, and tests should not assume otherwise. Other gaps include power interruption, disk/controller write caches, browser site-data eviction, mobile browser policies, native Safari/macOS, and disk-full behavior on the same image-heavy workload.

The backup contains unencrypted data. This fixture uses only synthetic pixels and test text. A large IndexedDB backup may exceed the receiving browser's localStorage quota on restore, because portable backups currently restore missing files to standard storage. **Do not enable IndexedDB-by-default or promise large-image backup restores until that quota and destination-store limitation is separately solved.**

## Required next qualification

Add user-reviewed restore-to-IndexedDB for large downloaded backups without overwriting occupied file keys. Exercise a backup larger than a realistic localStorage quota in a clean browser and measure partial restore, abort/retry, and recovered-source integrity. Keep the default standard path unchanged until recovery gates pass.
