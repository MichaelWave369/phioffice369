# GitHub Pages Deploy Guide

PhiOffice369 uses GitHub Actions to build and deploy the interactive Vite app in `apps/web`.

## Live URL

After Pages is enabled, the site should publish at:

```text
https://michaelwave369.github.io/phioffice369/
```

## Required GitHub setting

Open the repository settings:

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

## Local build check

Run this from the repository root:

```bash
npm install
npm run build
```

## Node version

The project pins Node through:

```text
.nvmrc
```

Current target:

```text
20
```

The root `package.json` also declares:

```json
"engines": {
  "node": ">=20",
  "npm": ">=10"
}
```

## Common issue: workspace protocol error

If GitHub Actions shows:

```text
npm error EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

The web app package should use local file dependencies instead of `workspace:*`:

```json
"@phioffice369/core": "file:../../packages/core",
"@phioffice369/professor-phi": "file:../../packages/professor-phi",
"@phioffice369/templates": "file:../../packages/templates"
```

## Vite base path

Because this deploys under a project page, `apps/web/vite.config.js` must use:

```js
base: '/phioffice369/'
```

Without this, assets may 404 on GitHub Pages.

## Workflow file

Deployment is controlled by:

```text
.github/workflows/deploy-pages.yml
```

The workflow:

1. Checks out the repo
2. Uses Node from `.nvmrc`
3. Runs `npm install`
4. Runs `npm run build`
5. Uploads `apps/web/dist`
6. Deploys to GitHub Pages
