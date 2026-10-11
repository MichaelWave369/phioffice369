# PhiOffice369 browser acceptance (PRs #18 and #19)

This is a **real-browser, production-build smoke check**. It complements, not replaces, `npm test` and `npm run smoke:pages`.

## Run locally

```bash
npm ci --no-audit
npm test
npm run build
npm run smoke:pages
npm run test:browser
```

Requires installed Google Chrome or Chromium. If Chrome is not discoverable, set `CHROME_BIN` to its executable. No Playwright or other external test dependency is installed.

## What is verified automatically

Each scenario runs against the compiled Vite app with a **separate disposable Chrome profile**. The same runner launches three independent scenarios and fails CI if any one is missing a PASS result.

### PhiWrite (#18)

- A disposable Chromium profile loads the compiled `/phioffice369/` app from a temporary localhost HTTP server.
- Closes first-run onboarding, enters Templates, and opens the Basic Project Spec in PhiWrite.
- Updates the document title and body via actual browser input events.
- Verifies the updated values reach browser-local autosave storage.
- Verifies the safe document print component updates from the actual editor.
- Clicks Export HTML, captures the Blob in memory, and checks its filename, HTML escaping and trust metadata.
- Clicks Print / Save as PDF with browser print **intercepted** and confirms the print control calls `window.print()`.
- Reloads the page and reopens the template, verifying title, body and print content survived.
- Returns PASS or FAIL to Node, which fails CI if the expected result is missing.

### PhiGrid (#19)

- Opens the Simple Family Budget template, edits the title and cells, checks automatic `Difference` recalculation and local autosave.
- Exercises actual CSV and JSON export controls, validating the exported contents in memory.
- Uploads fixture CSV using the browser file-input API; verifies the **preview does not overwrite** the working grid and warns on duplicate headers.
- Cancels the preview and verifies the original editor state is unchanged.
- Rejects malformed quoted CSV without altering the working grid.
- Confirms a valid multiline CSV, then reloads the page and verifies restored title, deduplicated columns and multiline cell content.

### PhiDeck (#19)

- Opens Pitch Deck Outline, changes deck title and active slide title/bullets, and confirms autosave.
- Adds a slide, renames it, exports native deck JSON and checks the exported slide list.
- Rejects an unrelated JSON schema without replacing existing deck state.
- Imports a valid native PhiDeck JSON fixture; reloads and verifies imported title, slide title and bullet text.

### DOCX preview lab (#20)

- Builds a minimal real OOXML ZIP package within the disposable browser.
- Rejects an invalid ZIP without altering the active PhiWrite draft.
- Reviews a valid DOCX text/heading extraction without replacing active content.
- Cancels the preview, checks preserved local data, then confirms a second preview.
- Reloads the page and verifies converted Markdown content and source filename title persisted.
- Exports the same draft as genuine local DOCX (ZIP+OOXML), feeds that downloaded package to the DOCX importer, reviews/accepts it, then reloads and checks the content again.
- Opens a separate, independently assembled **Word-style OOXML fixture** (not a Microsoft Word-authored binary) containing custom heading styles, style inheritance, Title, content controls, a simple table, bold/italic runs, external hyperlink relationships, and a decimal list with start override, bullets, and a two-level decimal/bullet Word list; verifies nested markup, safe links, preview, print hierarchy, accept and reload.

The disposable profiles are removed after each scenario. Nothing is sent to an external endpoint.

## Deliberate limitations

- Does not generate or visually compare actual printed PDF pages.
- Does not guarantee print dialog interaction, color fidelity or print-to-PDF pagination; test these manually.
- Does not test DOCX/XLSX/PPTX compatibility.
- Does not verify the publicly hosted Pages URL, cross-device sync, IndexedDB migration or workspace recovery.
- PhiVault and other planned editors do not yet have full browser acceptance coverage. This is **not** full-suite validation.

## CI

The source PR workflow performs Node tests and build first, then runs this browser check on the production build. GitHub-hosted Ubuntu runners generally include Chrome. If a runner image changes, the separate Chrome availability step fails explicitly rather than silently skipping the test.

To diagnose failures, inspect the `Accept PhiWrite in a real browser` step. The Node runner prints a separate local verdict for PhiWrite, PhiGrid and PhiDeck, plus Chrome diagnostics when a scenario fails. It does not print private user file content because the profile is temporary and contains only fixed fixture text.
