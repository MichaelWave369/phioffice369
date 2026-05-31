# PhiOffice369

**A free, local-first, AI-assisted sovereign productivity suite.**

PhiOffice369 is a PHI369 Labs / Parallax productivity-suite concept for builders, families, creators, students, small businesses, and community projects. The goal is not to clone existing office suites, but to build a distinct, humane, local-first workspace where documents, spreadsheets, decks, notes, diagrams, databases, and project folders can become living artifacts.

> Internal codename: **MikeySoft Office**  
> Public-facing name: **PhiOffice369**

## Live prototype

After GitHub Pages is enabled for this repo, the interactive prototype is intended to publish here:

https://michaelwave369.github.io/phioffice369/

## Run locally

```bash
npm install
npm run dev
```

The Vite dev server will print a local URL. Open it in your browser to view the interactive PhiOffice369 launcher.

## Build and test

```bash
npm test
npm run build
```

Dependency notes live in [`docs/dependency-policy.md`](docs/dependency-policy.md). Short version: npm workspaces are used, internal packages currently use `file:` references for GitHub Actions compatibility, and `latest` dependency ranges are temporary until the v0.2 lockfile hardening pass.

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
- PhiVault-lite local continuity scan, search, filters, manifest export, imported manifest preview, and export receipt timeline.
- Shared local artifact registry for drafts, grids, decks, and export receipts.

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

## Repository status

This repository begins as a public planning and prototype home. The first phase should focus on clean documentation, mockups, architecture, and a small working prototype before making large compatibility promises.

## Trademark and affiliation notice

PhiOffice369 is designed as a distinct sovereign productivity suite with compatibility goals. It is not affiliated with, endorsed by, or sponsored by Microsoft or any other third-party office-suite vendor. Microsoft Office, Word, Excel, PowerPoint, Outlook, OneNote, Access, Publisher, OneDrive, and Visio are third-party product names/trademarks.

## License

Initial starter materials use the license in this repository unless otherwise noted. Brand names, logos, PHI369 identity marks, Parallax identity marks, and product names are reserved by their respective owner(s). See `TRADEMARK.md`.
