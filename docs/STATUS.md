# PhiOffice369 Status

## Current project status

**Phase:** v0.1 prototype foundation  
**Repo state:** public planning + interactive prototype  
**Primary app:** `apps/web` React/Vite prototype  
**Deploy target:** GitHub Pages

## What is working

- Public README and roadmap
- GitHub Pages deployment workflow
- Standalone CI build workflow
- Node 20 version pin through `.nvmrc`
- Shared package structure
- Interactive suite shell
- Templates tab
- Trust panel model
- Professor Phi mode definitions
- PhiWrite-lite workspace
- Local autosave for PhiWrite-lite
- Markdown export from PhiWrite-lite
- Receipt JSON preview/copy in PhiWrite-lite
- Local mock Professor Phi actions
- PhiDeck-lite preview from PhiWrite-lite draft
- PhiDeck-lite JSON export

## In progress

- PhiGrid-lite local spreadsheet workspace
- Template launcher routing for PhiGrid templates
- More durable local artifact model
- Better export/import consistency

## Known limitations

- No real DOCX/XLSX/PPTX compatibility yet
- No cloud sync
- No real AI API integration yet
- Professor Phi actions are local mock helpers in the browser
- PhiGrid-lite is tracked as an MVP issue and not fully wired yet
- No package lockfile is committed yet

## Build notes

Run locally from the repository root:

```bash
npm install
npm run build
npm run dev
```

The GitHub Pages workflow deploys `apps/web/dist`.

## Next recommended build steps

1. Finish PhiGrid-lite and wire it into template routing.
2. Add package lockfile once dependencies stabilize.
3. Add a local artifact manifest model.
4. Add import/export receipts shared across PhiWrite/PhiGrid/PhiDeck.
5. Add basic tests for shared package functions.
