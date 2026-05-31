# PhiOffice369 Dependency Policy

PhiOffice369 is a local-first, browser-based productivity prototype. Dependency choices should support stability, public trust, and easy GitHub Pages deployment.

## Current policy

- Root install uses npm workspaces.
- Internal packages use `file:` workspace references for GitHub Actions compatibility.
- Avoid `workspace:*` until the deployment workflow is confirmed to support it safely.
- Avoid hidden install steps that require private credentials.
- Keep CI install simple: `npm install --prefer-offline --no-audit`.

## Temporary state

The web app currently uses `latest` for external dependencies while the prototype is moving quickly:

- React
- React DOM
- Vite
- Vite React plugin
- lucide-react

This is acceptable for the early prototype, but it should not remain the long-term release strategy.

## v0.2 hardening target

Before closing the dependency hardening issue, do the following:

1. Replace `latest` with explicit compatible semver ranges.
2. Run `npm install` from the repository root.
3. Commit the generated `package-lock.json`.
4. Switch CI from `npm install` to `npm ci`.
5. Use `actions/setup-node` cache once the lockfile exists.
6. Keep the explicit cache fallback only if it still improves workflow speed.

## Recommended version strategy

Use conservative compatible ranges instead of chasing newest releases:

```json
{
  "react": "^19.x",
  "react-dom": "^19.x",
  "vite": "^7.x",
  "@vitejs/plugin-react": "^5.x",
  "lucide-react": "^0.x"
}
```

Exact version selection should happen in a real local install or a workflow-generated lockfile pass, not by guessing.

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
