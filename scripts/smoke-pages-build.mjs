// Static output check only. Runtime and remote site verification remain separate.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const siteRoot = resolve('apps/web/dist');
const indexPath = join(siteRoot, 'index.html');
const pagesBase = '/phioffice369/';

assert.ok(existsSync(indexPath), 'Missing dist/index.html; run npm run build');
const html = readFileSync(indexPath, 'utf8');
assert.match(html, /<div\s+id=["']root["']\s*><\/div>/, 'React mount node missing');
assert.ok(existsSync(join(siteRoot, '.nojekyll')), 'GitHub Pages .nojekyll marker missing');

const references = Array.from(
  html.matchAll(/(?:src|href)=["'](\/phioffice369\/[^"']+)["']/g),
  (match) => match[1].split(/[?#]/)[0],
);

assert.ok(references.some((reference) => reference.endsWith('.js')), 'Prefixed JS asset missing');
assert.ok(references.some((reference) => reference.endsWith('.css')), 'Prefixed CSS asset missing');

for (const assetUrl of references) {
  const relativePath = assetUrl.slice(pagesBase.length);
  assert.ok(relativePath && !relativePath.split('/').includes('..'), 'Invalid asset URL');
  assert.ok(existsSync(join(siteRoot, relativePath)), 'Missing referenced asset: ' + assetUrl);
}

const manifest = JSON.parse(readFileSync(join(siteRoot, 'manifest.webmanifest'), 'utf8'));
assert.equal(new URL(manifest.start_url, 'https://pages.invalid' + pagesBase).pathname, pagesBase);
assert.equal(new URL(manifest.scope, 'https://pages.invalid' + pagesBase).pathname, pagesBase);
for (const icon of manifest.icons) assert.ok(existsSync(join(siteRoot, icon.src)), 'Missing install icon: ' + icon.src);
const worker = readFileSync(join(siteRoot, 'service-worker.js'), 'utf8');
assert.ok(!worker.includes('__SHELL_FILES__') && !worker.includes('__SHELL_VERSION__'), 'Offline assets were not compiled');
for (const assetUrl of references) assert.ok(worker.includes(assetUrl.slice(pagesBase.length)), 'Offline shell missing: ' + assetUrl);

console.log('PhiOffice369 Pages smoke passed: ' + references.length + ' linked assets found.');
