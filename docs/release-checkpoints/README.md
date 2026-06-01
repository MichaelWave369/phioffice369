# Release Checkpoints

Release checkpoints mark known-good project states for PhiOffice369. They are not always full production releases; they are safe build anchors that future work can return to.

## Current checkpoint

| Checkpoint | Status | Purpose |
|---|---|---|
| [`v0.1-greencheck-foundation`](v0.1-greencheck-foundation.md) | Known-good green-check foundation | First stable prototype foundation after local-first, trust, storage, Professor Phi, compatibility, onboarding, deployment, and documentation hardening. |

## Checkpoint rules

A checkpoint should include:

- a clear name,
- the status of the build,
- what foundation areas are included,
- what was fixed immediately before the checkpoint,
- the build/test command set,
- recommended next-phase work,
- clear claim boundaries.

## Build truth command set

```bash
npm ci --no-audit
npm test
npm run build
```

If these commands pass in CI, the checkpoint can be treated as a known-good anchor.