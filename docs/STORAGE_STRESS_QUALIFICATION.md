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

## Manual Firefox and Safari/WebKit runs

Run the same built fixture on each real browser engine. The project does not currently ship a Firefox/WebKit automation dependency, so **do not report automated cross-browser PASS** on the strength of Chromium CI.

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
- Verify **actual downloaded** backups can be transferred to a clean profile on a different device and restored, not merely kept in sessionStorage during a synthetic rehearsal.
- Test explicit eviction/quota scenarios separately for each browser and preserve exports of unsaved or damaged records.
- Rehearse abrupt process termination, recovery after disk pressure, and concurrent multi-tab writes with separate profiles. A best-effort pagehide save is not crash-safe.
- Measure backup duration, restore duration and peak storage; note failures rather than dropping records.
- Check accessibility and clear user messaging for loss, corruption, and denied storage permissions.

**Release rule:** Keep standard local saves as the default until the broader cross-browser matrix is independently verified and human-reviewed. The backup is unencrypted; use only synthetic fixtures in CI and treat any real exported backup as sensitive.
