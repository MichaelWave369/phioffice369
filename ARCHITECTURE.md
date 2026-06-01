# PhiOffice369 Architecture

PhiOffice369 is a local-first React/Vite monorepo for a sovereign productivity-suite prototype. The architecture favors honest trust boundaries, browser-local data, reusable package contracts, and small feature modules that can be tested independently.

## Monorepo map

```text
apps/web                  React/Vite prototype shell and app components
apps/desktop              Future desktop shell placeholder
packages/core             Shared trust labels, artifact receipts, manifests, validation guards, schemas
packages/professor-phi    Professor Phi mode catalog and local mock response engine
packages/templates        Starter template catalog
docs                      Operator guides and planning notes
tests                     Node test suite for core models, web helpers, and trust boundaries
```

## Main app shell

`apps/web/src/App.jsx` owns the high-level launcher tabs:

- Suite
- Templates
- Vault
- Trust
- Professor Phi
- Transform
- Roadmap

The launcher should stay mostly orchestration-only. Heavy logic should live in `apps/web/src/lib/*` or standalone components under `apps/web/src/components/*`.

## Implemented app surfaces

Current implemented prototype surfaces:

- `PhiWriteLite.jsx` — Markdown writing, local autosave, export, trust labels, PhiWrite → PhiDeck bridge.
- `PhiGridLite.jsx` — editable table, import/export, totals, local autosave.
- `PhiDeckLite.jsx` — slide/deck editor, JSON export/import, receipt generation.
- `PhiVaultLite.jsx` — local continuity scan, tags, project folders, manifest export, backup/restore, storage migration reports.
- `ProfessorPhiPanel.jsx` — local mock assistant UI with mode-aware responses and trust metadata.

Planned apps should appear as honest placeholders until their implementation exists.

## Trust label model

Trust labels live in `packages/core/src/index.js`. They are shared across apps and used to label artifact provenance and public risk:

- `human_written`
- `ai_assisted`
- `sourced`
- `needs_citation`
- `hypothesis`
- `symbolic`
- `private`
- `verified`

New labels must be added in core first and tested before UI components rely on them.

## Artifact model

Core artifact helpers live in `packages/core/src/index.js`:

- `createArtifactReceipt`
- `createArtifactManifestEntry`
- `createProjectManifest`
- `addArtifactToProjectManifest`
- `createExportReceipt`
- `createLocalStorageExportReceiptKey`

These helpers include validation guards. Invalid apps, kinds, labels, empty IDs, and duplicate artifact IDs should fail before data reaches storage or export flows.

Schema-style validators live in `packages/core/src/schemas.js` and should be used for loaded/imported data.

## Storage architecture

The safe default is browser `localStorage`. IndexedDB is introduced through a gated pilot path.

Important storage modules:

- `storageAdapters.js` — adapter primitives.
- `workspaceStorageAccess.js` — sync local workspace access.
- `workspaceStorageAsync.js` — async preference-aware storage path.
- `storageMigration.js` — safe copy planning and migration.
- `storageMigrationVerify.js` — source/target verification.
- `storageReadinessGate.js` — IndexedDB pilot readiness and preference handling.
- `storageKeyCatalog.js` — known local key namespaces.

Control-plane keys must not appear as user artifacts. Current control-plane keys include storage backend preference and vault scan source preference.

## PhiVault scan policy

PhiVault keeps sync and async registry scans separate. Sync is the default visible source. Async becomes visible only when:

1. the operator requests async scan,
2. async runtime is available,
3. registry parity passes,
4. the scan switch gate allows it.

Relevant modules:

- `localArtifactRegistry.js`
- `localArtifactRegistryAsync.js`
- `artifactRegistryParity.js`
- `vaultScanSwitchGate.js`
- `vaultVisibleScanPolicy.js`
- `vaultScanSourcePreference.js`

## Backup and recovery

`AppErrorBoundary.jsx` catches app crashes and provides recovery actions. Emergency backups live under the `phioffice369:emergency_backup:` namespace and are intentionally excluded from normal artifact scans.

`DataSovereigntyStatusBar.jsx` provides a visible local-first signal and quick workspace export.

## Import validation

PhiVault imports should pass through the validation boundary in `vaultImportValidation.js` before preview or restore. Supported import types:

- PhiOffice project manifests
- PhiOffice workspace backups

Unknown JSON, invalid snapshots, and malformed manifests should be rejected safely.

## Compatibility honesty

Compatibility reports live in:

- `compatibilityReport.js`
- `CompatibilityReportModal.jsx`
- `CompatibilityReportLauncher.jsx`

The rule: never promise perfect Office round-tripping until tested. Show what was preserved, approximated, lost, and the round-trip risk.

## Professor Phi

Professor Phi currently runs as a local mock assistant. It does not call a backend. The mock response engine lives in `packages/professor-phi/src/index.js` and returns:

- mode ID and mode label
- local-only marker
- trust label
- publish risk
- response text

Future backend integration must preserve visible provenance and user control.

## Adding a new app

1. Add or update the app entry in `apps/web/src/App.jsx`.
2. If the app is implemented, add its name to `IMPLEMENTED_APP_NAMES` in `apps/web/src/lib/appReadiness.js`.
3. Create the app component in `apps/web/src/components/`.
4. Add storage key namespace records in `storageKeyCatalog.js` if it writes browser storage.
5. Add artifact kind/app handling in local registry modules if the app creates artifacts.
6. Add tests for helpers before wiring large UI changes.
7. Update README and roadmap language.

## Build truth rule

After meaningful changes, run:

```bash
npm ci --no-audit
npm test
npm run build
```

The build is the truth. If Vite compiles and tests pass, the orchestration is coherent.