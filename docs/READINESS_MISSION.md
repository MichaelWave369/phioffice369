# PhiOffice369 readiness candidate

PHI369 Labs reviewed the release checkpoint, merged PRs #39 and #40, and the workspace at `b6997ba1368af56d5485b66d4b313b922e644b0c`. The baseline passed 416 Node tests and five Chromium scenarios against the compiled Pages path. The readiness work builds on those local drafts, independent file IDs, trust labels, and export receipts.

| Baseline area | Observed behavior | Candidate change |
| --- | --- | --- |
| PhiWrite | Basic Markdown formatting, find, print, DOCX and rapid exit worked. Markdown replacement was immediate, and the deck transition bypassed the save checkpoint. | Reviewed Markdown replacement, session text undo and redo, and a checked save before transforming to a new deck. |
| PhiGrid | Cells, budget arithmetic, CSV review, and export worked. There was no general calculation engine. | Bounded A1 arithmetic and five functions, stable-address sort and filter views, widths, and protected values-only CSV export. |
| PhiDeck | Native text slides saved and reloaded. The controlled bullet input stripped line breaks during typing. | Text entry preserves newlines. Slide ordering, layouts, accents, local raster images, keyboard presentation, reviewed JSON, and standalone HTML are available. |
| PhiVault | Search, tags, folders, and reports existed. The upload control bypassed the validator and restore could overwrite keys. | Validated additive restore, file management, recoverable Trash for independent files, quota feedback, and conflict reporting. |
| Workspace | The launcher and editor checkpoint worked. A stale tab could overwrite saved changes and corrupted drafts could be replaced by starter data. | Checked local saves, recovery export during quota failure, scoped offline shell, responsive dashboard, and theme controls. |
| Professor Phi | The assistant produced scripted guidance. | A provider interface separates demo, local, and remote modes. The shipped interface uses the local demo. |

The dashboard was inspected in Chromium at 1360, 768 and 390 pixels. [Desktop and mobile captures](readiness-dashboard.webp).

## Ecosystem boundaries

| Service | Inspected source | PhiOffice369 behavior |
| --- | --- | --- |
| PhiOS | [Public app catalog at 5a79b08](https://github.com/MichaelWave369/PhiOS/blob/5a79b08/interop/public-repo-catalog.v1.json) | The existing Pages URL is the entry. Optional `app=PhiWrite`, `PhiGrid`, `PhiDeck`, `PhiVault`, or `professor` selects a local surface. The URL conveys no file bytes, authority, or credentials. |
| PhiID | [R3 development clients at 47de3df](https://github.com/MichaelWave369/PhiID/blob/47de3df/docs/R3_PHIMAIL_OIDC_CLIENT.md) | The local realm has independent PhiID and PhiMail test clients. An Office client and hosted issuer are unavailable. Local editing is account-free. |
| PhiCloud | [Registry and R2 boundary at 2ec03d4](https://github.com/MichaelWave369/PhiCloud/blob/2ec03d4/docs/PHIMAIL_IDENTITY_R2.md) | PhiCloud publishes development service declarations. PhiOffice uses browser storage and explicit portable backups. Remote file storage and sync require a published storage contract. |
| PhiMail | [R2 local identity at 833a549](https://github.com/MichaelWave369/PhiMail/blob/833a549/docs/LOCAL_PHIID_R2.md) | PhiMail has a local demo, separate development OIDC login and experimental Gmail reading. An attachment or compose handoff contract is unavailable. Export and attach a file manually. |

A future PhiID link can use an independent Office relying party and a small backend-for-frontend, following the existing PhiID development architecture. Use issuer metadata and exact registered callbacks, authorization code with PKCE S256, state and nonce, ID token validation, and a short-lived HttpOnly session. Use the issuer and subject pair as the account key. Service grants and local file access require separate authorization. The static browser build has no credentials or production configuration. [OIDC Core](https://openid.net/specs/openid-connect-core-1_0.html) · [OAuth security BCP](https://www.rfc-editor.org/rfc/rfc9700.html).

The existing injectable workspace storage interface uses `isAvailable`, `getItem`, `setItem`, `setItemIfMissing`, `removeItem`, `entries`, and `workspaceSnapshot`. Vault scans and migration accept these asynchronous adapters. Editor checkpoints use the same browser-local data through a synchronous path so they can save on exit. Before adding remote storage, publish and verify a conditional-write contract with revisions, per-account isolation, allowlisted scopes, explicit file selection and consent, local queues, conflict copies, and a recovery test. A declaration or successful identity login cannot authorize an upload. Any later mail handoff should pass only a user-selected export through a documented, origin-checked, short-lived transfer and open a compose review for explicit send.

## Verification scope and limits

The readiness candidate passed 427 Node tests, the Pages build and smoke check, and eight Chromium scenarios. Run `npm ci --no-audit`, `npm test`, `npm run build`, `npm run smoke:pages`, and `npm run test:browser`. The Chromium suite runs compiled assets under `/phioffice369/` in disposable profiles. It checks independent editor file creation, save, leave, reopen, reload and export. Vault acceptance also covers invalid and conflicting backups, quota failure, cancellation, Trash and recovery. The IndexedDB pilot copy is verified against its preserved source. Offline acceptance exercises the scoped service worker and a local edit after cached navigation.

PWA caching starts after a successful online visit in a supported browser. Cached assets and user data can be removed by the browser or by clearing site data. Web storage is unencrypted, and GitHub Pages project paths on the same host share an origin. Browser storage quotas, crashes, and simultaneous writes from multiple tabs still matter. File saves compare the stored value before writing, which detects stale editors in ordinary use but is not a transactional multi-tab lock. The IndexedDB pilot does not own editor saves. Backup restore preserves conflicts and reports partial progress when interrupted.

DOCX conversion covers the documented subset. Real Word and LibreOffice layout parity, PDF pagination, XLSX and PPTX interoperability, editable slide object positioning, remote providers, and the five planned suite modules remain open. Browser tests use synthetic fixtures and intercept the system print dialog. A production deployment and operating-system install prompt require separate field checks.

## Next milestone

Move editor checkpoints to a transactional IndexedDB data path with verified legacy copy, explicit per-file revisions, fault injection, conflict recovery, and a rollback rehearsal. This addresses browser quota and concurrent editing limits before adding any account-linked storage.
