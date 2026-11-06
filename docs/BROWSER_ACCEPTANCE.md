# PhiOffice369 browser acceptance

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

Each scenario runs against the compiled Vite app with a **separate disposable Chrome profile**. The runner launches eight independent scenarios and fails CI if any scenario lacks a PASS result. It uses a loopback DevTools connection and real wall-clock time.

### PhiWrite (#18)

- A disposable Chromium profile loads the compiled `/phioffice369/` app from a temporary localhost HTTP server.
- Closes first-run onboarding, enters Templates, and opens the Basic Project Spec in PhiWrite.
- Updates the document title and body via actual browser input events.
- Uses the PhiWrite inline-formatting toolbar and Ctrl/Cmd+B, I, U shortcuts on actual textarea selections; verifies bold, italic, underline, strikethrough, highlight and code, selection restoration, toggle removal/reapplication, and rejection of multiline selections.
- Reviews selected link text without changing the working draft; rejects a script-scheme URL with visible feedback, cancels safely, then inserts an HTTPS hyperlink via Ctrl/Cmd+K.
- Verifies the approved Markdown link reaches local autosave, HTML export, semantic print rendering, and survives reload, with no unsafe href.
- Exercises Heading 1/2/3 switching and toggle-off, numbered-list creation/removal, bullet-list creation, and refusal to apply a heading to multiple lines. Adds Quote and Code block creation/toggle-off and attempts to quote an existing fenced code region; verifies the protected refusal, semantic React print, exported HTML, autosave, and reload.
- Exercises Ctrl/Cmd+F local literal Find & Replace: two matches, Next/Previous selection, case-sensitive zero-hit control, case-insensitive recovery, selected replacement, explicit Replace All and guarded undo; verifies HTML/print and autosave/reload of the replaced Markdown.
- Uses Insert Table to refuse nonempty-line insertion, open/cancel review, create a three-column, two-body-row table with an escaped pipe, and verify selection. Uses Edit Existing Table to reject unrelated text, load parsed cells, keep dimensions locked, cancel without mutation, then explicitly edit a header and cell. Confirms the resulting table in HTML/React print, autosave and reload.
- Verifies the resulting Markdown markup is saved and the semantic print nodes survive reload.
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
- Opens a separate, independently assembled **Word-style OOXML fixture** (not a Microsoft Word-authored binary) containing custom heading styles, style inheritance, Title, content controls, a simple table, bold/italic runs, external hyperlink relationships, and a decimal list with start override, bullets, and a two-level decimal/bullet Word list; verifies nested markup, safe links, Word CodeChar/Code paragraphs, Quote styles, formatted table cells and Word strikethrough/yellow highlight runs and single underlining (double/disabled underline negative controls); tests preview, safe print markup, accept and reload.

The disposable profiles are removed after each scenario. Nothing is sent to an external endpoint.

### Independent files, Vault, and offline

- Recent Files checks independent IDs, legacy preservation, reopening, and reload.
- Workspace readiness creates, edits, saves, navigates away, reopens, reloads, and exports a file from each primary editor. It checks document markup, spreadsheet results and formula strings, and slide layout, order, and image bytes.
- PhiVault verifies rename, duplication, tags and folders, confirmation cancellation, recoverable Trash, quota failure with a usable export, rejected backup input, conflict-preserving restore, and an IndexedDB copy that keeps its source.
- The mobile offline scenario checks the dashboard, modal focus, both themes, blank files, the labeled assistant demo, and the service worker. A fixture server returns 503 for an in-scope launch, and Chromium must open the cached application and save a local edit.

## Deliberate limitations

- Print calls are intercepted. Actual print-to-PDF pagination and Office application layout fidelity require external verification.
- Browser tests exercise a local production build. They do not deploy to the live Pages site or verify an operating-system install prompt.
- The IndexedDB pilot test verifies copy and comparison. Editor persistence still uses browser local storage.
- The scenarios use disposable synthetic profiles and make no live identity, mail, storage or AI service requests.

## CI

The source PR workflow installs dependencies, runs Node tests, builds the production site, checks the Pages output, and uses a real Chromium-based browser. Inspect the **Run production browser acceptance** step for a separate verdict per scenario.
