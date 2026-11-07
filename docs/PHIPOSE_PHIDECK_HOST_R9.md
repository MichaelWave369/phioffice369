# ΦPose Rung 9 — PhiDeck Gesture Navigation Host v0.1

## Purpose

Integrate the **first real reviewed application gesture actions** into PhiOffice: selecting the next or previous slide in an active **PhiDeck editor** without modifying document content, changing saved files, exporting, launching applications, or granting operating-system privileges.

This pairs with the reviewed, opt-in **OverStrings Rung 9 PhiOffice sender** (separate PR), not the independent read-only PhiOS workspace bridge. Importing a PhiPose vocabulary alone never gives it authority.

## Actual UI behavior

The `PhiPoseDeckCompanion` panel is mounted **only when a PhiDeck editor is open**. It is disabled by default.

1. On the OverStrings Pages playground, choose the **PhiOffice** vocabulary and `Next Page` or `Previous Page`.
2. Click **Open PhiOffice deck companion**. This opens `https://michaelwave369.github.io/phioffice369/` in a new named window on the same GitHub Pages origin.
3. In PhiOffice, open or create a PhiDeck workspace, then click **Enable ΦPose deck navigation** in its visible panel. Only a trusted exact same-origin opener with a path within `/OverStrings/` is considered.
4. PhiOffice generates an ephemeral random UUID session, with five-minute expiry, and sends a `ready` message to the exact opener. There is no silent connection.
5. In OverStrings, select WebXR or explicitly opt into synthetic demo input. **Synthetic also requires separate opt-in in the PhiDeck host panel.** Arm one phrase and perform the tokens.
6. The PhiOffice host checks exact sender window/source and origin, session ID, message freshness, sequence replay, cooldown, action ID, advisory-only flags and boundaries.
7. If allowed and the requested slide exists, PhiDeck updates `activeSlideId` via its own React state setter. It does not mutate slide bodies, files, trust labels, or the save state.
8. PhiOffice returns a status of `accepted_for_ui_dispatch` or `denied`. This is not proof of persistence or a general OS effect.

## Strict routing

Only these names are accepted:

| Intent ID | UI effect |
| --- | --- |
| `phioffice.page.next` | Select adjacent next existing slide |
| `phioffice.page.previous` | Select adjacent previous existing slide |

The built-in Rung 8 vocabulary also describes `phioffice.palette.open`, which remains **preview only** and is deliberately rejected by the Rung 9 host.

Host refuses input when the slide is already at the respective boundary or when a separate full-screen presentation dialog is open. It does not attempt to manipulate the dialog, which has its own slide state.

## Permissions, privacy and lifecycle

- Disabled by default. Consent must occur **inside the active PhiDeck editor** and is not stored.
- Exact same-origin `OverStrings` opener; exact window object for every message; random session per enable; no wildcard `postMessage`.
- Five-minute expiry and visible disable control; component teardown on leaving PhiDeck revokes the session.
- Synthetic source disabled by default. No silently enabled demo mode.
- Replays, unrecognized actions, malformed extra keys, unsupported authority fields, unexpected origins/sources and short-interval repeats are rejected.
- No persistent tokens, credentials, gesture recordings, camera access, identity inference, file data or raw XR joints pass through this bridge.
- Same-origin browser code is **not authenticated** by source+session alone; untrusted scripts on the same origin can potentially interfere. These methods therefore must remain limited to safe, reversible UI selections.
- Browser navigation/focus behavior and Quest 3 two-window WebXR operation are **not validated**. If browser suspension prevents concurrent XR/input operation, the long-term solution should be a reviewed same-runtime input adapter, not a permission bypass.

## Versioned contract

`phioffice.phipose-deck.v0.1` with:
- Host `ready`: `{protocol,type,session_id,expires_at}`
- Sender `command`: `{protocol,type,session_id,sent_at,intent}` with precisely the minimal `overstrings.phipose.intent.v0.1` advisory keys
- Host `receipt`: `{protocol,type,accepted,status,reason,sequence,action_id}`

`action_authority` and `execution_authority` must both be false in the nested intent. Real authority decisions are NOT carried in this protocol.

## Validation

- `npm test`: runs `tests/phipose-deck-host.test.js`, including source/session, malformed packet, idle/at-bounds, synthetic, replay, cooldown, expiry and denied file/shell actions.
- `npm run build`: validates JSX and the real PhiDeck import.
- Existing browser-suite and PhiOS workspace-bridge tests must remain passing.
- **Physical Quest and deployed cross-window behavior must be tested separately**. CI on synthetic tokens does not prove XR accuracy or dependable dual-window operation.

## Future

A later rung can add reviewed, scoped host handlers for PhiWrite section navigation and PhiGrid selection; save/export/content mutations must use distinct explicit operator consent and the existing document-authority model. This host must never be expanded through arbitrary gesture-import JSON alone.
