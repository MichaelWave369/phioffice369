# Sprint 8: Standard-file protection and browser persistence diagnosis

## Purpose

PhiOffice369's standard browser save path is still the default. GitHub issue #54 records an unclean Chrome termination where a recently written standard-storage source disappeared, but acknowledged IndexedDB commits survived. This sprint **does not** pretend to fix localStorage persistence itself or switch anyone's default storage backend.

## User-facing protection

A standard PhiWrite, PhiGrid or PhiDeck editor now offers **Save protected copy** beside **Save file**.

- First, save the current editor snapshot using the existing standard-storage save path. Compare the exact acknowledged source bytes with a fresh read immediately before protecting it. If the save fails or another tab changed those bytes, refuse to create a misleading protected copy.
- Next, use the existing PhiVault migration action to create a verified **new** revision-1 IndexedDB file. The source key and original bytes are preserved. If possible, copy its tags and folder as separate standard metadata; report metadata failure honestly.
- A success message names PhiVault as the place to find the copy. This is a **one-time checkpoint**, not a live two-store synchronization service. New edits in the original file **do not** automatically update its protected copy.
- The button is not offered for an already transactional editor or a damaged/trashed source. Existing recovery controls are unchanged. Multiple copies are never created for a second click on the same saved bytes during the current editor session.
- A failed action keeps the original intact, reports failure, and leaves file export available.

The standard save status now reads: **Saved locally in this browser (not crash-proof). Export backups of important work.** This is an accurate statement about the API result, not a durability promise.

## Same-profile Chromium diagnostic

After a production build, run:

    npm run test:browser:localstorage-probe

The probe runs only on freshly created disposable Chrome profiles and a loopback server. It uses a stable origin for writing and reopening data, checks both a synthetic PhiWrite record and a separate control key, and compares SHA-256 hashes of exact source bytes. It tests six independent profile lifecycles: immediate and delayed graceful close, immediate and delayed SIGKILL, and a pagehide/navigation variant followed by SIGKILL.

Each trial prints either **PERSISTED** or **OBSERVED LOSS**. A machine-readable `LOCALSTORAGE_DURABILITY_PROBE` JSON line records Chrome version, delay, origin, exact hash comparison, and whether control and document values survived. A **green diagnostic job means the test was executed**, not that every localStorage case was persistent.

This remains a single Linux headless Chrome environment, not a universal claim about browser implementations. Timing, site-data eviction, process teardown, origin changes, disk caching, power loss, and a clean close must be distinguished before assigning root cause. Issue #54 stays open until that investigation and an explicit protection policy are complete.

## Qualification

The production browser suite runs a `protected-save` acceptance scenario in Chromium, Firefox, and WebKit. It opens a standard PhiWrite draft, edits and saves, explicitly creates a checkpoint, verifies the original bytes are unchanged, edits the source again, and simulates a competing-tab edit. It refuses to protect the stale source, leaves the existing IndexedDB checkpoint unchanged, and reopens it correctly from PhiVault. Existing crash recovery, cross-engine backup restore, and PhiOS bridge gates remain unchanged.

**Remaining limits:** The user's full browser profile and downloaded backups are not magically protected by a copy. IndexedDB data may be evicted or cleared with site data. The export format is unencrypted and requires safe external handling. A protected copy is not automatically replicated to PhiCloud. Use exported backups outside the browser for important data.
