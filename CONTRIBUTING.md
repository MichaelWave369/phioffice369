# Contributing to PhiOffice369

Thank you for helping build PhiOffice369. This project is a local-first, trust-labeled, AI-assisted productivity-suite prototype. Contributions should protect user sovereignty, local data, and compatibility honesty.

## Local setup

```bash
npm ci --no-audit
npm test
npm run build
npm run dev
```

Use `npm ci --no-audit` for reproducible installs. Do not switch the repo back to `npm install` in CI docs or workflows.

## Contribution principles

1. **Keep user work local by default.** Do not add hidden network calls or cloud dependencies.
2. **Label AI assistance honestly.** AI-generated or AI-transformed output must be visible to the user.
3. **Do not fake compatibility.** Show preserved, approximated, lost, and risk fields when discussing document format support.
4. **Prefer small tested helpers.** Put logic in `apps/web/src/lib/*` or package modules, then wire UI components afterward.
5. **Fail safely.** Storage errors, import errors, and migration issues should show clear recovery guidance.
6. **Respect planned-state honesty.** Do not make unbuilt apps look functional until they are wired and tested.

## Before opening a PR

Run:

```bash
npm test
npm run build
```

Then verify the app manually with:

```bash
npm run dev
```

Check that:

- the launcher loads,
- PhiWrite, PhiGrid, PhiDeck, PhiVault, and Professor Phi tabs still work,
- the Data Sovereignty status bar appears,
- the Compatibility report launcher opens,
- no control-plane storage keys appear as Vault artifacts.

## Adding a trust label

Trust labels live in `packages/core/src/index.js`.

When adding a label:

1. Add it to `trustLabels`.
2. Update schema validators in `packages/core/src/schemas.js` if needed.
3. Add or update tests in `tests/core.test.js` and `tests/core-schemas.test.js`.
4. Confirm UI components render it clearly.

## Adding an artifact kind

Artifact kinds live in `packages/core/src/index.js`.

When adding a kind:

1. Add it to `artifactKinds`.
2. Update local artifact registry mapping if it is stored in browser storage.
3. Add storage key catalog records when new keys are introduced.
4. Add tests for scan inclusion and exclusion rules.

## Adding a new app surface

1. Create a component under `apps/web/src/components/`.
2. Add helper logic under `apps/web/src/lib/` when possible.
3. Add or update the app entry in the launcher.
4. Mark it implemented in `appReadiness.js` only when it has a real UI path.
5. Add storage namespaces and registry parsing if it writes artifacts.
6. Add tests before expanding UI wiring.

## Storage rules

Do not write random keys into browser storage. New keys need a namespace entry in `storageKeyCatalog.js`.

Control-plane keys are not artifacts. They must be excluded from both sync and async artifact registries.

Before enabling IndexedDB pilot behavior, the safe sequence is:

```text
Backup workspace
→ Plan IndexedDB migration
→ Copy missing safely
→ Verify copy
→ Review readiness gate
→ Enable IndexedDB pilot
→ Refresh app
```

## Import/export rules

Imported project manifests and workspace backups should pass through `vaultImportValidation.js` before preview or restore.

Exports should emit receipts where possible. Compatibility work should be honest and explicit.

## Professor Phi rules

Professor Phi currently uses a local mock response engine. Do not imply it is calling a backend. Future backend integrations must show provenance and preserve user control.

## GitHub Pages deployment

The deploy workflow lives at `.github/workflows/deploy.yml` and publishes `apps/web/dist`. GitHub Pages should be set to **GitHub Actions** as the source.

## Style guidance

- Warm, clear, practical wording.
- Avoid overclaiming.
- Prefer visible trust signals.
- Keep UI states honest.
- Use tests to protect every new boundary.