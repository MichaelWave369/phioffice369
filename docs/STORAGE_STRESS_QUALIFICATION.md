# Sprint 3: large-workspace storage recovery qualification

This is a **synthetic, destructive test of a disposable browser profile**, not a migration guide for a user's real workspace. Never run the stress fixture against production browser data. It deliberately clears both localStorage and the PhiOffice editor IndexedDB database on its local test origin.

## Automated checks

From a clean checkout:

    npm ci --no-audit
    npm test
    npm run build
    npm run smoke:pages
    npm run test:browser
    npm run test:browser:bridge

The Node suite includes tests/storage-stress.test.js:
- 150 deterministic mixed PhiWrite/PhiGrid/PhiDeck files.
- Per-file verified IndexedDB copying while preserving legacy source bytes.
- Revision advancement and a stale-editor recovery copy.
- A combined backup containing original and transactional records.
- Restoration into a new empty storage profile and SHA-256 equality for every backed-up value.
- Idempotent restore, standard-storage rollback copy, quota-limited partial restore and safe retry.
- An existing changed file that must not be overwritten by a backup replay.

The production Chromium suite includes the stress scenario:
- Seeds 120 independent mixed files on a disposable local test origin.
- Makes an IndexedDB copy of one file in PhiVault.
- Exports a combined backup through the real UI, verifying original bytes and the IndexedDB copy.
- Deletes **only the fixture origin's** editor IndexedDB and clears its localStorage.
- Restores that backup through the real PhiVault upload/approval UI.
- Reloads the app, compares every original file and the copied file, then opens the restored document.

These checks verify content integrity under the specific fixtures. They do **not** prove that a browser can store arbitrary amounts of data or survive forced OS/browser termination while a write is still pending.

## Automated Firefox and WebKit qualification (Sprint 4 candidate)

The new separate GitHub Actions workflow, `.github/workflows/browser-engine-matrix.yml`, runs the **same production stress fixture** in real Mozilla Firefox and Playwright WebKit engines on an isolated Ubuntu runner. It checks the browser's declared result after seed, migration, combined backup, storage reset, UI restore, reload and document reopen. It records each engine's version. The runner uses an explicit pinned Playwright version (`1.56.1`) installed only in the optional qualification job; the standard app lockfile and production bundle remain untouched.

To run this locally after building, install Playwright version 1.56.1 without modifying the project lockfile, install its Firefox and WebKit browsers with the CLI, then run `npm run test:browser:engines`. Use `npm run test:browser:engines -- firefox` to target one engine. This script launches only disposable browser contexts and starts its own local fixture server; it never touches your usual browser profile.

**Coverage boundary:** WebKit in Playwright is a useful browser-engine check, not a substitute for Safari on actual Apple hardware. Manual macOS Safari testing, real browser crashes, 500+ file loads, device-to-device downloaded backup restores and heavier slide image workloads still need separate evidence. A successful CI run must not be described as production Safari certification.

## Sprint 5: downloaded backup portability (candidate)

The browser-engine qualification runner additionally performs a **real downloaded-file** restore. It generates **510 synthetic** independent files (170 documents, 170 grids, 170 presentations, with PNG images on selected slides) and creates three verified IndexedDB copies in PhiVault.

For each engine, the test:
1. Opens the production build on the disposable localhost origin in a clean browser process.
2. Exports the **actual PhiVault JSON download** to a temporary file on disk, checks that every source item and all three IndexedDB copies are present, and computes SHA-256 hashes of every original raw record.
3. **Closes the source browser process**, opens a second completely fresh browser process and profile, and confirms the destination has no source files.
4. Imports the saved JSON file via PhiVault's real file chooser, approves restore, verifies **513 raw file records byte-for-byte**, reloads, and reopens the copied document to check its contents.
5. Deletes the synthetic downloaded backup file and both disposable contexts when finished.

This closes the earlier **sessionStorage-only simulation gap**. It does not prove restore from a different physical device, Safari on macOS, or survival of data loss before the export was downloaded. The downloaded backup contains **unencrypted** synthetic document data. Never point the harness at your normal browser profile. The matrix may be re-run with \`npm run test:browser:engines\` after installing the pinned optional Playwright engines.

## Manual Firefox and Safari/WebKit runs

Run the same built fixture on each real browser engine. The project ships an optional Firefox/WebKit Playwright CI matrix, but manual **macOS Safari** qualification remains separate from Linux WebKit and Chromium evidence.

1. Build with npm ci --no-audit && npm run build.
2. Start the local acceptance server in manual mode:
   - Bash: PHI_BROWSER_MANUAL=1 npm run test:browser
   - PowerShell: $env:PHI_BROWSER_MANUAL='1'; npm run test:browser
3. Copy the printed loopback URL ending in ?scenario=stress.
4. Open it in a **fresh disposable browser profile** in Firefox. Let it reload through the fixture's seed, backup, restore and verification stages.
5. Check the page for data-phi-acceptance="PASS" and the visible phi-browser-acceptance-result message. Record browser version, OS, elapsed time and any console errors. A FAIL or timeout is **not** a pass.
6. Restart the manual server and repeat with a fresh Safari profile on macOS (or actual WebKit in an isolated browser harness). Chromium-based browsers are not Safari coverage.
7. Press Ctrl+C to stop the local server. Do not reuse the test origin/profile for personal documents.

If a browser blocks popups, storage, service workers, or downloads, investigate and record the exact outcome. Do not weaken permission checks or bypass content validation just to obtain a green result.

## Additional pre-rollout qualification

Before defaulting editor persistence to IndexedDB:
- Repeat with 500+ mixed files and representative image-heavy presentations, respecting documented per-image and browser quota constraints.
- Extend the downloaded-file transfer test to a **different physical device** and verify identical SHA-256 record hashes there.
- Test explicit eviction/quota scenarios separately for each browser and preserve exports of unsaved or damaged records.
- Rehearse abrupt process termination, recovery after disk pressure, and concurrent multi-tab writes with separate profiles. A best-effort pagehide save is not crash-safe.
- Measure backup duration, restore duration and peak storage; note failures rather than dropping records.
- Check accessibility and clear user messaging for loss, corruption, and denied storage permissions.

**Release rule:** Keep standard local saves as the default until the broader cross-browser matrix is independently verified and human-reviewed. The backup is unencrypted; use only synthetic fixtures in CI and treat any real exported backup as sensitive.
