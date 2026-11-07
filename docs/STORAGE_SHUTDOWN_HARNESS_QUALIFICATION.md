# Sprint 9: Correct Chrome Shutdown Semantics for Storage Durability Evidence

## Finding

The original test-only `openChromeSession.close()` sent `Browser.close` over DevTools but then immediately checked the child status and issued `SIGTERM` if the process had not already exited. This gave Chrome effectively **no separate time to finish** its requested shutdown. Some previous "graceful" trials therefore may have been forcibly terminated, and those observations **cannot** be taken as reliable evidence of a completed, graceful browser shutdown.

This is a **measurement-harness defect**, not a demonstrated production PhiOffice bug or proof that the standard browser storage API is crash-proof. The earlier SIGKILL trials were explicitly unclean and retain that meaning. Keep [Issue #54](https://github.com/MichaelWave369/phioffice369/issues/54) open until the corrected evidence is analyzed.

## Changes

- A new test-only `shutdownBrowserProcess` helper waits for the real browser child-process exit **after** requesting `Browser.close`. It uses a six-second grace period before `SIGTERM`, then escalates to `SIGKILL` only if the earlier termination did not finish. Unit tests distinguish genuine graceful exits, DevTools socket disconnects, escalation and failed hard kills.
- `openChromeSession.close()` returns `exitKind` and `forced`, rather than silently converting the test to a forced exit. Existing disposable-profile browser tests retain their cleanup guarantees.
- The seven-trial `test:browser:localstorage-probe` records **actual exit kind** for every row. A graceful-close case that required a forced fallback is explicitly identified as **inconclusive**, not counted as a successful graceful-close baseline.
- Existing browser suite, rendered PhiOS bridge, 510-file backup portability, IndexedDB recovery and hard SIGKILL tests remain unchanged. **No production editor code, save path or user storage format is modified.**

## Qualification commands

    npm ci --no-audit
    npm test
    npm run build
    npm run smoke:pages
    npm run test:browser
    npm run test:browser:bridge
    npm run test:browser:bridge:ui
    npm run test:browser:crash
    npm run test:browser:localstorage-probe
    npm run test:browser:engines

The usual GitHub CI jobs exercise these tests and report the seven-trial probe results. The probe still uses distinct temporary user-data directories and a stable loopback origin per trial. It includes a separate, unrelated control key and exact SHA-256 source hashes.

## What results mean

A genuine `browser-close` exit followed by preserved file and control values is evidence of persistence **in that browser/version/environment/test**. A matching loss after a genuine graceful exit would require further investigation. A `sigterm`/`sigkill` fallback is not a graceful-close test; it is labeled accordingly.

No fixed waiting period, OS power-loss survival, pending-edit durability, Safari certification, protection from user-cleared site data or general localStorage crash safety is established by this probe. Continue to offer user-selected verified IndexedDB checkpoints and downloadable backups.

**Issue #54 remains open pending independent verification.**
