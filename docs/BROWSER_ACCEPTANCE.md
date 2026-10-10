# PhiOffice369 browser acceptance (PR #18)

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

- A disposable Chromium profile loads the compiled `/phioffice369/` app from a temporary localhost HTTP server.
- Closes first-run onboarding, enters Templates, and opens the Basic Project Spec in PhiWrite.
- Updates the document title and body via actual browser input events.
- Verifies the updated values reach browser-local autosave storage.
- Verifies the safe document print component updates from the actual editor.
- Clicks Export HTML, captures the Blob in memory, and checks its filename, HTML escaping and trust metadata.
- Clicks Print / Save as PDF with browser print **intercepted** and confirms the print control calls `window.print()`.
- Reloads the page and reopens the template, verifying title, body and print content survived.
- Returns PASS or FAIL to Node, which fails CI if the expected result is missing.

The disposable profile is removed after the run. Nothing is sent to an external endpoint.

## Deliberate limitations

- Does not generate or visually compare actual printed PDF pages.
- Does not guarantee print dialog interaction, color fidelity or print-to-PDF pagination; test these manually.
- Does not test DOCX/XLSX/PPTX compatibility.
- Does not verify the publicly hosted Pages URL, cross-device sync, IndexedDB migration or workspace recovery.
- Other editors should get their own browser acceptance scenarios before claiming whole-suite browser coverage.

## CI

The source PR workflow performs Node tests and build first, then runs this browser check on the production build. GitHub-hosted Ubuntu runners generally include Chrome. If a runner image changes, the separate Chrome availability step fails explicitly rather than silently skipping the test.

To diagnose failures, inspect the `Accept PhiWrite in a real browser` step. The Node runner prints its local test verdict and Chrome diagnostics. It does not print private user file content because the profile is temporary and contains only fixed fixture text.
