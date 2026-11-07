# PhiOffice369 ↔ PhiOS Workspace Bridge Client v1

PhiOffice now includes an **opt-in protocol client** in
`apps/web/src/lib/phiosWorkspaceBridge.js`, with Node unit tests. This is
**not** a live hosted integration and is not automatically attached to the
PhiOffice application UI. PhiOffice keeps working stand-alone, offline and
without PhiID accounts.

The client pairs with the `phios.workspace-bridge.v1` host module merged in [PhiOS PR #396](https://github.com/MichaelWave369/PhiOS/pull/396). It binds messages to an
independently configured exact PhiOS parent origin and parent frame identity,
checks protocol/app/session IDs and strict packet fields, and correlates
read-only requests to replies. It does not read document bodies, issue shell
commands or use `postMessage("*")`.

The permitted flow is:
1. Operator chooses a reviewed PhiOffice embed in PhiShell.
2. Host sends `host.bootstrap` to the exact reviewed child origin.
3. Client returns a session-bound `app.hello`.
4. Host responds `host.ready`, without exposing project identity.
5. The user explicitly approves a project reference in PhiShell.
6. A PhiOffice UI action may send `app.context.request` and receive a
   bounded opaque `project:...` reference, never file paths or content.
7. On removal or navigation, both sides disconnect; host revokes future reads.

A previously shared reference cannot be un-shared. Therefore the ref is
**never a credential or entitlement**. Future project artifact APIs must
perform independent authorization per operation.

## Controlled browser verification

Run `npm run test:browser:bridge` from the repository root with Chrome or
Chromium installed. The fixture uses real loopback origins and a disposable
browser profile. It serves the PhiOffice client source and the unmodified
PhiOS host source from commit `c26c143ce94d680b8cdb4c309a8f244d87cae66e`.
The runner checks the pinned Git blob before compiling it with Vite's
TypeScript transform. The fixture includes the upstream MIT license.

The scenario checks exact origins and frame sources on both sides, session
binding, readiness and reply correlation, default denial, explicit project
approval, revocation, and reconnection with a new session. It injects
forged messages from real frames and confirms a reply pending at disconnect
is ignored. The project reference is synthetic.

The protocol remains experimental. A production embed and a reviewed
operator connect flow are separate milestones. A public repository, Pages
listing, or source-only application shelf grants no trust. Standalone app
verification continues through `npm run test:browser`.
