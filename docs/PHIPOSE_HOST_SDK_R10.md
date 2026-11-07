# PhiOffice Rung 10 · Shared ΦPose Host SDK Adoption

PhiOffice's real `PhiDeck` gesture receiver now uses the same **dependency-free, zero-authority** validation core as OverStrings instead of independently copying the protocol/session parsing code.

## What changed

- New `apps/web/src/lib/phiPoseHostCore.js`: reviewed source snapshot of the canonical OverStrings `packages/phipose-host-sdk/index.mjs`.
- Existing `apps/web/src/lib/phiPoseDeckHost.js` now extends `ScopedPhiPoseHost` with only PhiDeck-specific **boundary / presentation state checks**.
- Existing UI remains mounted only inside PhiDeck, disabled until the operator explicitly enables a five-minute session.
- The only accepted actions are `phioffice.page.next` and `phioffice.page.previous`, converted into adjacent slide selection. No content, save state, files, downloads, browsers, permissions, or OS effects are changed.
- New offline provenance tests pin the exact Git blob SHA of the vendored SDK snapshot. PhiDeck's earlier regression tests remain active.

## Why a vendored file instead of a network dependency?

The browser app builds offline and maintains its own lockfile. Pulling JavaScript from a different GitHub Pages origin at runtime would undermine the reproducibility and security boundary. Vendoring the reviewed source gives us a checkable, immutable snapshot with no dynamic remote execution or package-install churn.

**Upstream source:** `MichaelWave369/OverStrings/packages/phipose-host-sdk/index.mjs`

**Snapshot Git blob SHA:** `70bf6014f7b69ec0efcf5289687e3cac01f648bc`

The SHA is a Git object identifier for *file bytes*, not an identity proof or signature of the author. Bump the provenance test only after comparing and reviewing the new upstream module. The two repository files had identical Git blob SHA values when this rung was authored.

## Invariants

- Gesture messages remain **advisory, zero execution authority**.
- The SDK never subscribes to events or executes UI effects itself.
- The app controls its exact opener pathname/origin, consent, UI context, message listening, state transition and teardown.
- Malformed, stale, replayed, wrong-source or unknown-action packets fail closed.
- Synthetic input requires host-side opt-in as before.
- The same-origin browser transport is not cryptographic authentication.
- Context guards deny navigation outside slide bounds and while presentation is active.
- Existing keyboard, touch, and button controls remain available.
- No permission to edit, save, delete, export, or launch apps is granted.

## Verification

```sh
npm test
npm run build
npm run smoke:pages
```

This release includes no Quest 3 hardware test. Cross-window background WebXR behavior is still not validated. The separate PhiOS workspace-reference bridge remains unchanged.

## Future app adapter approach

For PhiWrite section navigation, PhiGrid cell selection, Domistika XR palettes and Gen.E-Wrist tools, create an app-reviewed **fixed action allowlist and pure context guard**, bind only harmless UI events at first, and build an explicit consent surface. A vocabulary pack by itself must never install actions or authorize device commands.
