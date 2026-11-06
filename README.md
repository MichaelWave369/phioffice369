# PhiOffice369

**A free, local-first office workspace from PHI369 Labs.**

PhiOffice369 gives builders, families, creators, students, small businesses, and community projects a browser workspace for documents, spreadsheets, presentations, and local files.

> Internal codename: **MikeySoft Office**  
> Public-facing name: **PhiOffice369**

## Current checkpoint

**Known-good foundation:** [`v0.1-greencheck-foundation`](docs/release-checkpoints/v0.1-greencheck-foundation.md)

This repo has a green-check prototype foundation covering the local-first shell, core artifact model, trust labels, PhiWrite/PhiGrid/PhiDeck/PhiVault surfaces, Professor Phi local mock assistant, compatibility honesty report, onboarding, storage hardening, GitHub Pages deployment, and contributor/architecture docs.

See [`CHANGELOG.md`](CHANGELOG.md) for checkpoint history.

## Live prototype

The deployed prototype is available on GitHub Pages:

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

- PhiWrite-lite Markdown writing with a selection-aware Bold/Italic/Underline/Strike/Highlight/Code toolbar, reviewed safe HTTP(S) links (Ctrl/Cmd+B, I, U, K), plus reversible Heading 1–3 / Bullet / Numbered / Quote / Code block paragraph controls, **local literal Find & Replace** (Ctrl/Cmd+F, Next/Previous, case option, replace selected/all and guarded undo) and review-first **Insert Table** and **Edit Existing Table** composers (2–8 columns, 1–12 rows, safe pipe escaping, cell-only existing-table changes, cancel/stale-source protection), import/export, **local DOCX text import preview and basic DOCX export**, standalone offline HTML export, browser Print / Save as PDF, local autosave, trust labels, mock assistant actions, and PhiWrite → PhiDeck bridge. DOCX preview preserves basic text/headings, bullet/decimal lists up to two levels with supported start values, and simple rectangular tables as editable Markdown pipe tables; complex Word tables still flatten with warnings; simple table cells can retain basic bold/italic/code and safe HTTP(S) links. Simple bold, italic, strikethrough (`~~text~~`), yellow highlighting (`==text==`), nonstandard single underline (`++text++`), inline code, fenced code, quote styles, and safe HTTP(S) links are supported; nested styling, arbitrary embedded links, Word layout and images are not preserved. HTML and print cover a basic block-level Markdown subset.
- PhiGrid-lite editable local table, CSV import/export, JSON export, local totals, trust labels, and local autosave.
- PhiDeck-lite standalone slide editor, deck JSON import/export, local autosave, trust labels, and receipt generation.
- PhiVault-lite local continuity scan, search, filters, detail drawer, local tags, project folders, manifest export, workspace backup/restore, imported manifest preview, export receipt timeline, and redacted storage migration reports.
- Professor Phi local mock assistant panel with mode-aware responses, visible AI-assisted trust metadata, publish risk, and copy flow.
- Compatibility Honesty Report launcher showing preserved, approximated, lost, and round-trip risk fields.
- Data Sovereignty status bar with local storage status, artifact count, last emergency backup timestamp, and workspace export.
- First-run onboarding explaining local-first storage, trust labels, and starter templates.
- Storage adapter foundation with localStorage default, IndexedDB pilot path, safe migration planning, safe copy, verification reports, readiness gate, and resettable storage preference.
- Shared local artifact registry for drafts, grids, decks, and export receipts.

## Independent files and Recent Files

- The **Suite** launcher offers **New PhiWrite file**, **New PhiGrid file**, and **New PhiDeck file** actions. New files receive their own browser-local storage keys, so people can create multiple independent artifacts from the same starter template.
- The **Templates** view keeps its existing **Open in ...** behavior for legacy template-bound drafts, and now offers **Create independent file** for supported editors.
- The **Recent files** panel on the Suite screen lists saved documents, grids, and decks by last saved timestamp. It can reopen both new independent files and preexisting template-bound drafts without an automatic data migration.
- Original template IDs and previously saved data remain unchanged. Source-template information travels with new files and is visible in PhiVault's local registry.
- A file is saved in this browser's storage, not in an account or another device. Export from the editor and back up the full workspace in **PhiVault** before clearing browser storage.
- This is still a prototype. New files are local-only; there is no live collaborative editing, remote sync, or fully interoperable XLSX/PPTX round trip.

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

## Workspace safety

Use **Save file** or Ctrl/Cmd+S to checkpoint an open editor. PhiVault opens, renames, and duplicates local files, and moves independent files to recoverable Trash after confirmation. Trashed records keep their original content and use browser space. Template-bound drafts keep their existing storage keys.

PhiVault validates backup files before offering restore. Restore adds missing file, metadata, and receipt records and reports existing conflicts, identical records, and skipped settings. If a quota error interrupts restore, the count shows what was written and the same backup can be retried. Backups contain unencrypted user content and should be kept outside the browser. Export a copy before leaving an editor if a save is blocked by full storage, an unreadable record, or a change detected from another tab.

## Everyday editor workflows

- **PhiWrite** includes text undo and redo for typing and toolbar edits. Markdown and DOCX imports preview before replacing an open draft. Save rich-layout originals separately and review DOCX compatibility before exporting.
- **PhiGrid** supports A1 references, arithmetic, SUM, AVERAGE, MIN, MAX and COUNT. Sort and filter change the view while preserving cell addresses and export order. CSV imports formula-like cells as text until you enable calculation. CSV exports the full sheet with calculated values. Formula-like text can receive a leading apostrophe, so keep the JSON export or workspace backup for raw cell data. Imported CSV is limited to 500 rows, 40 columns, 10,000 cells, and 4 MiB. See the [CSV interoperability and injection limits](docs/COMPATIBILITY.md).
- **PhiDeck** supports slide ordering, duplication, keyboard presentation mode, fixed layouts and shapes, and local PNG, JPEG and WebP images. Editable visual decks use PhiDeck JSON v0.2 and text-only decks still support v0.1. Standalone HTML opens offline for viewing and printing. PPTX remains planned.

## Launch and offline use

Open PhiOffice369 in a supported browser. After a successful online load, **Offline ready** indicates that the scoped app shell is cached. Files stay in browser storage and can be backed up through PhiVault. System, Light and Dark themes are available in the header.

The [readiness and ecosystem report](docs/READINESS_MISSION.md) explains the verified workflows, storage limits, and optional PhiOS, PhiID, PhiCloud and PhiMail boundaries.
