# PhiOffice369 launch status

Last source audit: October 9, 2026. This is a source-level audit, not a verified browser walkthrough.

## Overall maturity

**Tested prototype foundation. Not yet a production Office replacement.**

### Currently implemented (lite versions)

- **PhiWrite:** Markdown editor, local autosave, Markdown import/export, standalone HTML export, print-to-PDF via browser, DOCX local text-only review/confirmation and basic OOXML export with Word styles, lists and simple rectangular tables, basic bold/italic and safe hyperlinks; custom Word heading styles and content-control text extraction (complex layout remains lossy), trust labels, and document-to-deck transformations.
- **PhiGrid:** editable tables, CSV import/export, JSON export, simple numeric totals and local autosave. Not an Excel calculation engine.
- **PhiDeck:** standalone slide title/bullet editor, slide management, native deck JSON import/export and local autosave.
- **PhiVault:** local artifact search, tags, project folders, backup/restore, receipt timeline, and guarded storage migration tooling.
- **Professor Phi:** browser-local **mock** responses. No production AI connection.
- **Core packages:** native artifact schemas, receipts, transformation packets, trust metadata and starter templates.

### Planned, not yet implemented as full apps

PhiNotes, PhiMap, PhiPress, PhiBase, PhiFlow, and desktop installation.

### Compatibility boundaries

- Native lite flows: Markdown, CSV, JSON, local workspace backup and restore.
- Not yet supported: faithful DOCX/XLSX/PPTX import/export, Microsoft macro support, Excel formula parity, enterprise collaboration or cloud sync.
- LocalStorage is the default. IndexedDB is a **gated pilot**, not a general replacement.
- GitHub Pages hosts the app, **not** your personal files. Back up the workspace before clearing site storage or switching browsers.

## Build/deployment truth

- Public repository: https://github.com/MichaelWave369/phioffice369
- Intended Pages URL: https://michaelwave369.github.io/phioffice369/
- Canonical Pages workflow: `.github/workflows/deploy.yml`. The duplicate publisher was removed in the deployment revival branch.
- Deployment only runs from `main` or manual workflow dispatch after merging.
- Install/test/build/gate: `npm ci --no-audit`, `npm test`, `npm run build`, `npm run smoke:pages`.
- The smoke check confirms the built HTML's React mount point, `.nojekyll` marker and on-disk Vite assets under `/phioffice369/`. It does not prove browser interactivity or remote site availability.

GitHub Settings → Pages → Build and deployment → Source must be **GitHub Actions**.

## Acceptance plan

1. Merge a green deployment revival PR and observe **one** successful Pages publisher for that revision.
2. Open the live URL in a fresh browser and verify navigation, PhiWrite, PhiGrid, PhiDeck and PhiVault.
3. Round-trip one small Markdown document, one CSV grid and one native JSON deck; refresh and check local persistence.
4. In a throwaway browser profile, export a workspace backup, reset local data and verify restore, with no valuable data at risk.
5. Add browser smoke tests and only then advance PWA/desktop packaging or actual Office format interoperability.

The open Parallax interop PR #14 is separate from this deployment repair.

**Claims boundary:** green CI demonstrates the tested source paths pass; it does not establish Office compatibility, a fully functioning live site, or production readiness.
