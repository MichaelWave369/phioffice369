import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLocalStorageBoundaryAudit,
  findLocalStorageBoundaryFile,
  getLocalStorageBoundaryFiles,
  LOCAL_STORAGE_BOUNDARY_AUDIT_SCHEMA,
  summarizeLocalStorageBoundaryAudit,
} from '../apps/web/src/lib/localStorageBoundaryAudit.js';

test('localStorage boundary files are versioned and discoverable', () => {
  const files = getLocalStorageBoundaryFiles();
  const paths = files.map((entry) => entry.path);

  assert.ok(files.length >= 6);
  assert.ok(files.every((entry) => entry.path && entry.boundary && entry.migrationAction));
  assert.equal(findLocalStorageBoundaryFile('apps/web/src/lib/workspaceStorageAccess.js')?.boundary, 'primary-sync-access-layer');
  assert.equal(findLocalStorageBoundaryFile('apps/web/src/components/PhiWriteLite.jsx'), null);
  assert.equal(findLocalStorageBoundaryFile('unknown.js'), null);
  assert.equal(paths.includes('apps/web/src/components/PhiGridLite.jsx'), false);
  assert.equal(paths.includes('apps/web/src/components/PhiDeckLite.jsx'), false);
});

test('createLocalStorageBoundaryAudit reports unexpected files and unknown keys', () => {
  const audit = createLocalStorageBoundaryAudit({
    observedFiles: [
      'apps/web/src/lib/workspaceStorageAccess.js',
      'apps/web/src/components/Unexpected.jsx',
    ],
    observedKeys: [
      'phioffice369:phiwrite:test',
      'phioffice369:unknown:test',
    ],
  });

  assert.equal(audit.schema, LOCAL_STORAGE_BOUNDARY_AUDIT_SCHEMA);
  assert.deepEqual(audit.unexpectedFiles, ['apps/web/src/components/Unexpected.jsx']);
  assert.deepEqual(audit.unknownPhiOfficeKeys, ['phioffice369:unknown:test']);
  assert.ok(audit.missingExpectedFiles.includes('apps/web/src/components/PhiVaultLite.jsx'));
  assert.equal(audit.adapterRefactorBacklog.length, 0);
});

test('summarizeLocalStorageBoundaryAudit returns clean boundary decision fields', () => {
  const cleanAudit = createLocalStorageBoundaryAudit({
    observedFiles: getLocalStorageBoundaryFiles().map((entry) => entry.path),
    observedKeys: ['phioffice369:phiwrite:test'],
  });
  const dirtyAudit = createLocalStorageBoundaryAudit({
    observedFiles: ['apps/web/src/components/Unexpected.jsx'],
    observedKeys: ['phioffice369:unknown:test'],
  });

  assert.equal(summarizeLocalStorageBoundaryAudit(cleanAudit).cleanBoundary, true);
  assert.equal(summarizeLocalStorageBoundaryAudit(dirtyAudit).cleanBoundary, false);
  assert.equal(summarizeLocalStorageBoundaryAudit(dirtyAudit).unexpectedFileCount, 1);
  assert.equal(summarizeLocalStorageBoundaryAudit(dirtyAudit).unknownPhiOfficeKeyCount, 1);
});
