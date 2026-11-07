# PhiOffice Rung 11: ΦPose Heading and Cell Navigation

The shared, reviewed `ScopedPhiPoseHost` (Rung 10) now powers two **additional real, non-destructive UI gesture hosts**, accessible in actual PhiWrite and PhiGrid workspaces. They do **not** inherit a deck's permission or confer any application execution authority.

## Real UI actions

| Action ID | Active workspace | Effect |
| --- | --- | --- |
| `phioffice.write.section.next` | PhiWrite | Move the Markdown editor caret to the next H1-H3 heading |
| `phioffice.write.section.previous` | PhiWrite | Move the caret to the previous H1-H3 heading |
| `phioffice.grid.cell.next` | PhiGrid | Focus the next displayed cell, left to right through the currently visible sorted/filtered rows |
| `phioffice.grid.cell.previous` | PhiGrid | Focus the prior displayed cell |

### Explicit non-goals

No text insert, delete, formatting, save, undo, export, import acceptance, file selection, system call, clipboard operation or OS capability. The existing PhiDeck navigation remains separate and unchanged. The underlying `readWorkspaceDraft`/autosave system remains untouched.

## Integration

- Protocol: `phioffice.gesture-nav.v0.1`.
- Core host: `apps/web/src/lib/phiPoseEditorHost.js` backed by Rung 10 `phiPoseHostCore.js`.
- Consent component: `apps/web/src/components/PhiPoseEditorCompanion.jsx`.
- Navigation targets: `apps/web/src/lib/phiPoseNavigationTargets.js`, pure and read-only.
- Sender: OverStrings `web/phipose-office-transport.mjs` on the paired Rung 11 PR, same user-opened popup as the existing PhiDeck route but a **different explicit host session/protocol**.

Open OverStrings on GitHub Pages, choose the built-in PhiOffice scope, select a PhiWrite or PhiGrid command, click **Open PhiOffice companion**, open the desired editor in PhiOffice, then click **Enable ΦPose** in that editor. Both applications must share the same origin and keep the popup relationship; this is a browser pilot, not an authenticated production trust boundary. Each enable uses an independently generated random UUID, expires in five minutes, can be disabled instantly and is revoked when leaving the workspace. Synthetic practice requires separate explicit opt-in.

All requests are read-only gesture intents with `action_authority:false`, `execution_authority:false`. An allowlisted host action is checked against the *actual current workspace mode*, target bounds, and import or editing dialogs. Replays, stale messages, wrong origin/source/session, synthetic-without-consent, and actions outside the host's two-item allowlist are denied. No raw hand joints or document contents are transmitted.

### Design boundaries

- PhiWrite recognizes H1-H3 Markdown headings outside fenced code blocks; it changes only the native textarea cursor/selection, not source text. Its navigation state is ephemeral.
- PhiGrid derives targets from the current `visibleIndices` (sorted/filtered display order). It focuses actual input/textarea DOM cells through safe deterministic A1-style addresses, never invoking `updateCell`. Clicking or typing manually continues to work.
- Focus can blur another form control. The feature is opt-in and intentionally disabled by default; its effects must be tested alongside real editing flows.
- Other PhiOffice vocabulary entries such as `phioffice.palette.open` remain preview-only. A JSON import cannot grant permission.
- **Same-origin messages are not authentication.** Untrusted scripts running at the same origin can potentially forge messages. The exposed effects stay limited to reversible UI navigation.

## Qualification

```sh
npm test
npm run build
npm run smoke:pages
```

Node tests verify heading parsing, fenced examples, sorted grid addresses, bounds, host isolation, replay/expiry, denial of file and cross-app actions. Existing browser, storage and PhiOS workspace bridge qualification should remain green. A deployed, two-window browser test and real Quest 3 WebXR test are **still required**; CI tests do not prove headset motion reliability or background browser responsiveness.
