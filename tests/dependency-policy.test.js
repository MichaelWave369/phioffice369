import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const packageJsonPaths = [
  'package.json',
  'apps/web/package.json',
  'packages/core/package.json',
  'packages/professor-phi/package.json',
  'packages/templates/package.json',
];

function readPackageJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function dependencyEntries(pkg) {
  return [
    ...Object.entries(pkg.dependencies ?? {}),
    ...Object.entries(pkg.devDependencies ?? {}),
    ...Object.entries(pkg.peerDependencies ?? {}),
    ...Object.entries(pkg.optionalDependencies ?? {}),
  ];
}

test('package files are valid JSON and have names', () => {
  packageJsonPaths.forEach((relativePath) => {
    const pkg = readPackageJson(relativePath);
    assert.equal(typeof pkg.name, 'string', `${relativePath} should have a package name`);
    assert.ok(pkg.name.length > 0, `${relativePath} package name should not be empty`);
  });
});

test('dependencies do not use latest ranges', () => {
  const offenders = packageJsonPaths.flatMap((relativePath) => {
    const pkg = readPackageJson(relativePath);
    return dependencyEntries(pkg)
      .filter(([, version]) => version === 'latest')
      .map(([name]) => `${relativePath}: ${name}`);
  });

  assert.deepEqual(offenders, [], `Dependencies must not use latest: ${offenders.join(', ')}`);
});

test('dependencies do not use workspace protocol yet', () => {
  const offenders = packageJsonPaths.flatMap((relativePath) => {
    const pkg = readPackageJson(relativePath);
    return dependencyEntries(pkg)
      .filter(([, version]) => String(version).startsWith('workspace:'))
      .map(([name, version]) => `${relativePath}: ${name}@${version}`);
  });

  assert.deepEqual(offenders, [], `workspace: protocol is intentionally avoided for CI compatibility: ${offenders.join(', ')}`);
});

test('web app uses local file references for internal PhiOffice packages', () => {
  const webPackage = readPackageJson('apps/web/package.json');

  assert.equal(webPackage.dependencies['@phioffice369/core'], 'file:../../packages/core');
  assert.equal(webPackage.dependencies['@phioffice369/professor-phi'], 'file:../../packages/professor-phi');
  assert.equal(webPackage.dependencies['@phioffice369/templates'], 'file:../../packages/templates');
});

test('web app external dependency ranges are explicit semver ranges', () => {
  const webPackage = readPackageJson('apps/web/package.json');
  const externalNames = ['@vitejs/plugin-react', 'vite', 'react', 'react-dom', 'lucide-react'];

  externalNames.forEach((name) => {
    const version = webPackage.dependencies[name];
    assert.match(version, /^\^\d+\.\d+\.\d+$/, `${name} should use an explicit caret semver range`);
  });
});
