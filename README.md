# PhiOffice369

**A free, local-first, AI-assisted sovereign productivity suite.**

PhiOffice369 is a PHI369 Labs / Parallax productivity-suite concept for builders, families, creators, students, small businesses, and community projects. The goal is not to clone existing office suites, but to build a distinct, humane, local-first workspace where documents, spreadsheets, decks, notes, diagrams, databases, and project folders can become living artifacts.

> Internal codename: **MikeySoft Office**  
> Public-facing name: **PhiOffice369**

## Current checkpoint

**Known-good foundation:** [`v0.1-greencheck-foundation`](docs/release-checkpoints/v0.1-greencheck-foundation.md)

This repo has a green-check prototype foundation covering the local-first shell, core artifact model, trust labels, PhiWrite/PhiGrid/PhiDeck/PhiVault surfaces, Professor Phi local mock assistant, compatibility honesty report, onboarding, storage hardening, GitHub Pages deployment, and contributor/architecture docs.

See [`CHANGELOG.md`](CHANGELOG.md) for checkpoint history.

## Live prototype

After GitHub Pages is enabled for this repo, the interactive prototype is intended to publish here:

https://michaelwave369.github.io/phioffice369/

## Run locally

```bash
npm ci --no-audit
npm run dev
```

The Vite dev server will print a local URL. Open it in your browser to view the interactive PhiOffice369 launcher.

## Build and test

```bash
npm test
npm run build
```

Dependency notes live in [`docs/dependency-policy.md`](docs/dependency-policy.md). The repo now uses a committed `package-lock.json`, CI installs with `npm ci --no-audit`, and dependency policy tests prevent `latest` and `workspace:*` from sneaking back into the prototype.

## Core idea

Build once. Transform ethically. Work sovereign.

PhiOffice369 aims to provide a free core suite with:

- **PhiWrite** — documents, specs, letters, PDFs
- **PhiGrid** — spreadsheets, formulas, budgets, atlases
- **PhiDeck** — slides, posters, pitch decks
- **PhiNotes** — research notebooks and idea gardens
- **PhiMap** — diagrams, flowcharts, system maps
- **PhiPress** — flyers, zines, print layouts
- **PhiBase** — local databases and dashboards
- **PhiVault** — local file vault, tags, project folders
- **PhiFlow** — tasks, calendar, reminders, workflow bridge
- **Professor Phi** — built-in assistant, editor, transformer, and claim-checker

## Product principles

1. **Local-first by default** — User work should remain user-owned, offline-friendly, and usable without a forced account.
2. **Free core suite** — Baseline tools should be useful for everyday people, not trapped behind a subscription.
3. **Compatibility honesty** — Import/export should include visible compatibility reports rather than pretending complex formats always round-trip perfectly.
4. **Trust panels** — Documents should label content as human-written, AI-assisted, sourced, hypothesis, symbolic, private, or verified.
5. **Living artifact transformations** — A spec can become a deck. A spreadsheet can become a dashboard. A notebook can become an article.
6. **Professor Phi as a helpful assistant** — AI assistance should be warm, useful, funny, transparent, and disciplined.

## Current prototype features

- PhiWrite-lite Markdown writing, import, export, local autosave, trust labels, mock assistant actions, and PhiWrite → PhiDeck bridge.
- PhiGrid-lite editable local table, CSV import/export, JSON export, local totals, trust labels, and local autosave.
- PhiDeck-lite standalone slide editor, deck JSON import/export, local autosave, trust labels, and receipt generation.
- PhiVault-lite local continuity scan, search, filters, detail drawer, local tags, project folders, manifest export, workspace backup/restore, imported manifest preview, export receipt timeline, and redacted storage migration reports.
- Professor Phi local mock assistant panel with mode-aware responses, visible AI-assisted trust metadata, publish risk, and copy flow.
- Compatibility Honesty Report launcher showing preserved, approximated, lost, and round-trip risk fields.
- Data Sovereignty status bar with local storage status, artifact count, last emergency backup timestamp, and workspace export.
- First-run onboarding explaining local-first storage, trust labels, and starter templates.
- Storage adapter foundation with localStorage default, IndexedDB pilot path, safe migration planning, safe copy, verification reports, readiness gate, and resettable storage preference.
- Shared local artifact registry for drafts, grids, decks, and export receipts.

## Storage pilot guide

PhiOffice369 currently keeps localStorage as the safe default. IndexedDB support is being introduced through a gated pilot path.

Read the operator guide before testing IndexedDB pilot mode:

[`docs/storage-pilot-guide.md`](docs/storage-pilot-guide.md)

Safe sequence:

```text
Backup workspace
→ Plan IndexedDB migration
→ Copy missing safely
→ Verify copy
→ Review readiness gate
→ Enable IndexedDB pilot
→ Refresh app
```

## MVP v0.1 target

- Launcher shell
- PhiWrite-lite
- PhiGrid-lite
- PhiDeck-lite
- Template packs
- Trust panel
- Local-only privacy controls
- Professor Phi prompt panel
- Basic PDF, Markdown, CSV, JSON, and HTML flows

## Roadmap

| Version | Focus | Goal |
|---|---|---|
| v0.1 | Identity MVP | Establish the core suite foundation |
| v0.2 | Artifact transformation | Imports, receipt timeline, shared artifact registry, standalone PhiDeck-lite |
| v0.3 | PhiVault + search | Local index, tags, project graph, related artifacts |
| v0.4 | Compatibility lab | Evaluate DOCX/XLSX/PPTX workflows with transparent reports |
| v1.0 | Free sovereign suite | Stable local-first app with practical everyday workflows |

## Current repo structure

```text
apps/web                  Interactive React/Vite prototype
apps/desktop              Future desktop shell placeholder
packages/core             Shared trust labels and artifact receipt model
packages/professor-phi    Assistant mode definitions
packages/templates        Starter template catalog
docs                      Product planning and public notes
templates                 Template pack manifest examples
tests                     Node test suite for core models and web helpers
```

## Key project docs

- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md)
- [`CHANGELOG.md`](CHANGELOG.md)
- [`docs/release-checkpoints/`](docs/release-checkpoints/)
- [`docs/storage-pilot-guide.md`](docs/storage-pilot-guide.md)
- [`docs/dependency-policy.md`](docs/dependency-policy.md)

## Repository status

This repository is currently anchored at the `v0.1-greencheck-foundation` checkpoint. The next phase should build from that known-good state with small, tested changes.

## Trademark and affiliation notice

PhiOffice369 is designed as a distinct sovereign productivity suite with compatibility goals. It is not affiliated with, endorsed by, or sponsored by Microsoft or any other third-party office-suite vendor. Microsoft Office, Word, Excel, PowerPoint, Outlook, OneNote, Access, Publisher, OneDrive, and Visio are third-party product names/trademarks.

## License

Initial starter materials use the license in this repository unless otherwise noted. Brand names, logos, PHI369 identity marks, Parallax identity marks, and product names are reserved by their respective owner(s). See `TRADEMARK.md`.
