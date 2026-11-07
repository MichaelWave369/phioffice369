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

## R1 operator-visible embedding pilot

A disabled-by-default UI panel now exists in
`apps/web/src/components/PhiOSWorkspaceBridgePanel.jsx`.
It is not active in ordinary PhiOffice builds, even when opened in an iframe.
A separate, reviewed build of PhiOffice must explicitly configure
`VITE_PHIOS_PARENT_ORIGIN` as the **exact** origin of the PhiOS host.

Local development example (two distinct origins):

```sh
# PhiShell dev server listens at http://localhost:5173
# Start the PhiOffice dev server in a second terminal:
VITE_PHIOS_PARENT_ORIGIN=http://localhost:5173 npm run dev -- --port 5174
```

For that same pilot, PhiShell must be built with matching independently
configured `VITE_PHIOS_OFFICE_BRIDGE_URL=http://localhost:5174/` and
`VITE_PHIOS_OFFICE_BRIDGE_APPROVED_ORIGIN=http://localhost:5174`.
Neither application enables the link by default.

When a reviewed PhiOS host embeds the app, the panel listens only for the
configured exact parent origin/window source. It completes the existing
session-bound protocol, lets a user request a project ref, shows denial or an
opaque project reference, and allows local disconnection. This does not
provide access to the project or its artifacts, and it never persists the
reference in localStorage or IndexedDB.

`host.revokeProject()` prevents **future** responses; a reference already
delivered is not retrievable or deletable from the receiving process by the
host. The reference must never be used as a credential. The operator must
close the iframe or reload the application to establish a new consent
session. The standalone PhiOffice editors and local files remain untouched.

Run `npm test && npm run build && npm run test:browser:bridge` to verify
the existing protocol and the default-build non-regression. A dedicated
rendered-UI two-server acceptance is still a separate release gate.

## R2 rendered two-app browser acceptance

The `browser-bridge-ui` GitHub CI job checks out the reviewed PhiOS host
**at an exact pinned, review-required PhiOS PR #398 commit**
`cd04250aa8694ec1918c11c4c40feac6caceecaf`. It installs both
applications from their respective lockfiles and compiles each with
ephemeral loopback origins.

Run `npm run test:browser:bridge:ui` after placing that pinned checkout at
`.interop/phios` and installing both applications' dependencies. Chrome or
Chromium and Node's WebSocket support are required.

The test uses Chrome DevTools to open the real built PhiShell, select Build
Field, start the reviewed pilot, check a real PhiOffice iframe, request
context before approval (must deny), approve a *synthetic* project ID,
request again (must return only an opaque identifier), revoke and retry
(must deny), disconnect (must remove the iframe), and independently open
PhiOffice standalone (no embedded bridge UI). Browser context and user
profile are disposable; no real PhiOffice document, cloud data, identity,
or host command is accessed.

This validates the **rendered, configured pilot on local isolated origins**.
It does not qualify any public deployment or confirm that arbitrary remote
websites may safely be embedded. The pinned host SHA must be deliberately
reviewed and updated whenever the host code changes.

## R3 selected manifest identity acceptance (PhiOS R2)

The rendered two-app acceptance now pins the **PhiOS PR #399** host candidate
at `d8b2153d06fc3ba4c1d4561a6661c48581e30658`, pending its independent
qualification. This replaces the prior R2 synthetic-ID UI test, while
retaining the earlier isolated protocol tests.

The Chrome test supplies a disposable PhiOffice
`phioffice369.project_manifest.v0.1` file through the real PhiOS file
input (not a network request). It verifies there is no possible approval
before selection, the selected project ID remains unavailable until explicit
operator approval, the child receives only `project:<id>`, and private
manifest owner, tags, artifact paths, file titles and local display title
never enter the child's rendered content.

Changing the selected project revokes its predecessor until explicitly
reapproved. Revocation denies subsequent context requests, and the child
clears its stale displayed reference after receiving denial. Disconnect
removes the iframe. Standalone PhiOffice retains no embedded bridge UI.

The manifest is a **local selection aid**, not proof of ownership, project
registry membership, secure identity, or permission to read project data.
The host never sends manifest contents or files. The UI pilot remains
disabled without an independently reviewed configured origin.

## R4 browser-local project registry: remembered metadata, never saved consent

The real two-app Chrome acceptance now pins PhiOS local project registry R1,
currently proposed as [PhiOS PR #400](https://github.com/MichaelWave369/PhiOS/pull/400),
at commit `2f4d024e00e67ebf3eadfe1da469a817d132c854`.
It is still an explicitly configured, reviewed, cross-origin browser pilot
rather than a public deployment.

The fixture chooses a test-only local manifest, verifies its reference
is **not** stored automatically, and explicitly clicks
**Remember this project on device**. It inspects the browser's
`phios.project-registry.v1` key to confirm it contains only
`projectRef`, `title`, and `source` with a versioned format.
No owner, tags, artifact paths, manifest contents or grants may appear.

The test then disconnects and reconnects the real iframe, explicitly chooses
the remembered project, and verifies a new request is **denied** until
a fresh host approval. It tests that explicit **Forget saved project** deletes
the stored reference and revokes future requests. It retains standalone
PhiOffice and earlier denial/replacement/privacy checks.

**Important:** This is browser-origin-local project metadata, not a shared
project database, live application context, authenticated PhiID identity,
PhiCloud sync, or a document access grant. Any future shared registry must
have its own reviewable permission model and per-operation authorization.

## R5 portable, metadata-only reference bundle acceptance

The compiled two-app Chrome scenario now pins the reviewed PhiOS R4
candidate from [PhiOS PR #401](https://github.com/MichaelWave369/PhiOS/pull/401)
at `ca4648c61ff338ec40de623dd845554da0533aba`.

It supplies a test-only portable `phios.project-references` v1 JSON file
through the real PhiOS import picker. It verifies:

- Injected top-level authority fields cause rejection and **no storage writes**.
- A valid bundle is previewed but cannot be saved until **Confirm reference
  import** is clicked.
- Existing local titles win when an incoming ID conflicts.
- New IDs append only after confirmation.
- Imported metadata never selects a project, grants access, or changes
  the standalone PhiOffice behavior.
- The earlier reconnect/remember/forget suite still requires fresh consent.

Only the PhiOS browser-local registry is affected. This is an offline
identity-reference transfer, not synchronized projects or credentials.
No actual project files, private account data, or provider authorization
is exchanged.

## R6 reviewed project adapter catalog acceptance

The actual compiled two-app Chrome scenario pins the PhiOS reviewed-adapter
candidate at `c3285db4378938502c363d430fe9d124be51b2e4`
([PhiOS #402](https://github.com/MichaelWave369/PhiOS/pull/402)).

The test checks that the rendered PhiOS catalog lists exactly one
`reviewed-browser-pilot` adapter, the PhiOffice v0.1 project-manifest
reader, and explicitly says PhiID/PhiCloud have **no reviewed adapters**.
It then submits a forged PhiCloud source through the real local bundle
picker. The unknown source must fail, and the browser's project registry
must remain unchanged. The existing tests still verify separate manifest
selection, explicit approval, project ref-only replies, portable import
preview, and consent revocation after reconnect.

A reviewed adapter is a source-format and target compatibility declaration,
not authentication, ownership attestation or access permission. No other
PhiOS app is registered here; no cloud project or file data travels over
the browser bridge.

## R7: merged-host, wire-observed browser acceptance

The two-app Chromium acceptance is now explicitly bound to the **merged**
[PhiOS PR #402](https://github.com/MichaelWave369/PhiOS/pull/402) commit
`1d0119eb8e35a542a45dec3192aa271a42e65af4`, rather than the PR's
pre-merge candidate. The CI checkout and the executable local browser runner
share an exact source-SHA contract. A changed checkout fails before either
application is built, and no floating branch, network bootstrap or downloaded
descriptor may silently replace it.

The rendered Chrome acceptance continues to build both app clients from their
own lockfiles and serve them on independent random **127.0.0.1 origins**.
After a real cross-frame handshake, the test installs a *test-only listener in
the child browser context* and checks the actual received `postMessage`
envelopes (not just the visible status text):

- A default-denied request must precede the first successful project ref.
- Each `host.context` has exactly the protocol, type, app ID, session ID,
  request ID, `execution_authority: false`, and one opaque `project_ref`.
  It cannot include a document body, file path, title, owner, credential, token,
  grant, or unreviewed application data.
- Each `host.denied` carries only protocol-bound reason metadata, with no
  project ref. The last request after **Revoke** must be denied.
- After disconnect/reconnect, the host must issue a **different session**,
  a remembered reference still needs fresh approval, and **Forget** must deny
  future access. No new editor or credential permissions arise.
- Standalone PhiOffice continues to run without any embedded bridge panel.

On success CI prints `PHIOS_R7_BROWSER_HANDOFF:` followed by scoped JSON
counts and the exact merged host SHA. This is **test evidence**, not a signed
publisher credential or a release authorization.

### Admission gate for the next application

**Do not register another active provider yet.** PhiOS project registry v1
uses `projectRef` as a global local-storage key. Two providers with the same
reference could collide. The next adapter needs: a real versioned provider
manifest, a named reviewed parser, a provider-qualified identity or explicitly
approved v2 migration of existing v1 references, exact source/target
compatibility checks, a dedicated two-app Chromium acceptance, and no
background consent or native authority.

PhiMail has a browser demonstration and local development account pilots,
but *no reviewed PhiOS project identity manifest or cross-app browser adapter
was established by this rung*. Mailbox credentials and messages must never
be used as the next synthetic handoff fixture.

The R7 test is not a test of actual PhiOS x86_64 image installation,
native app lifecycle, Quest/browser WebXR runtime, PhiID or PhiCloud, network
transport authentication, or production physical-device qualification.
