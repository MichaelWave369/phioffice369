# Changelog

All notable PhiOffice369 prototype checkpoints will be tracked here.

## v0.1-greencheck-foundation

**Status:** known-good green-check foundation

This checkpoint marks the first stable public prototype foundation after the local-first, trust, storage, Professor Phi, compatibility, onboarding, documentation, and GitHub Pages hardening passes.

### Added

- Local-first React/Vite suite shell.
- PhiWrite-lite, PhiGrid-lite, PhiDeck-lite, PhiVault-lite, and Professor Phi prototype surfaces.
- Planned app placeholders for unbuilt suite apps.
- Data Sovereignty status bar with local status and workspace export.
- First-run onboarding modal and onboarding gate.
- Professor Phi local mock response engine and chat panel.
- Compatibility Honesty Report model, modal, and global launcher.
- GitHub Pages deploy workflow.
- Architecture guide.
- Expanded contributing guide.
- Release checkpoint note at `docs/release-checkpoints/v0.1-greencheck-foundation.md`.

### Hardened

- Core artifact receipt, manifest, export receipt, app, kind, label, and duplicate-ID validation.
- Core schema validation helpers for loaded/imported data.
- PhiVault import validation boundary for manifests and workspace backups.
- Sync and async artifact registry control-plane exclusions.
- Vault visible scan source policy.
- Storage migration, verification, and readiness gate tests.
- localStorage boundary audit.
- Dependency policy and reproducible install path.

### Fixed before checkpoint

- Dependency policy now checks both dependencies and devDependencies.
- Emergency backup prefix export restored.
- Sync registry browser storage test stub corrected.
- Onboarding DOM helpers moved into a Node-testable module.
- localStorage boundary catalog updated for approved boundary files.

### Build truth

```bash
npm ci --no-audit
npm test
npm run build
```
