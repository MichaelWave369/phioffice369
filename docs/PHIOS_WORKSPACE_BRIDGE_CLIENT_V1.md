# PhiOffice369 ↔ PhiOS Workspace Bridge Client v1

PhiOffice now includes an **opt-in protocol client** in
`apps/web/src/lib/phiosWorkspaceBridge.js`, with Node unit tests. This is
**not** a live hosted integration and is not automatically attached to the
PhiOffice application UI. PhiOffice keeps working stand-alone, offline and
without PhiID accounts.

The client pairs with PhiOS's proposed
`phios.workspace-bridge.v1` host contract. It binds messages to an
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

No permission or trusted origin is inferred from a public repository,
GitHub Pages listing, or source-only application shelf. The first browser
embedding fixture and integration UI remain separate, review-required
milestones.

Test with `npm test` from the repository root.
