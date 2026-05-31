# PhiOffice369 Dependency Policy

PhiOffice369 is a local-first, browser-based productivity prototype. Dependency choices should support stability, public trust, and easy GitHub Pages deployment.

## Current policy

- Root install uses npm workspaces.
- Internal packages use `file:` workspace references for GitHub Actions compatibility.
- Avoid `workspace:*` until the deployment workflow is confirmed to support it safely.
- Avoid hidden install steps that require private credentials.
- Keep CI install simple: `npm install --prefer-offline --no-audit` until a lockfile is committed.
- External runtime/build dependencies should use explicit semver ranges, not `latest`.

## Current external ranges

The web app currently pins external dependency ranges instead of using `latest`:

```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "vite": "^7.0.0",
  "@vitejs/plugin-react": "^5.0.0",
  "lucide-react": "^0.468.0"
}
```

These ranges are intended to reduce surprise breakage while still allowing compatible patch/minor updates.

## Remaining v0.2 hardening target

Before closing the dependency hardening issue, do the following:

1. Run `npm install` from the repository root.
2. Commit the generated `package-lock.json`.
3. Switch CI from `npm install` to `npm ci`.
4. Use `actions/setup-node` cache once the lockfile exists.
5. Keep the explicit cache fallback only if it still improves workflow speed.

## Local-first dependency rules

Dependencies should be rejected or reviewed carefully if they:

- require cloud accounts for basic use,
- collect telemetry without a clear opt-out,
- force user data through a third-party service,
- add heavy bundle size without clear value,
- complicate GitHub Pages deployment,
- bypass the trust-label model.

## Internal package rule

Internal packages should stay simple and browser-safe:

- `@phioffice369/core`
- `@phioffice369/templates`
- `@phioffice369/professor-phi`

They should avoid browser-only globals unless the package is explicitly web-only.

## Release readiness checklist

Before tagging a public release:

- `npm test` passes.
- `npm run build` passes.
- GitHub Pages deploy passes.
- No dependency uses `latest`.
- Lockfile is committed.
- Import/export flows still work locally.
- PhiVault continuity scan still detects drafts, grids, decks, and export receipts.
