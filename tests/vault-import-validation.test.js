import test from 'node:test';
import assert from 'node:assert/strict';
import { createArtifactManifestEntry, createProjectManifest } from '../packages/core/src/index.js';
import {
  applyVaultImportPreviewState,
  createPhiVaultImportChangeHandler,
  createVaultImportPreviewFromFile,
  createVaultImportPreviewState,
  parseAndValidateVaultImportText,
  validateProjectManifestImport,
  validateVaultImportPayload,
  validateWorkspaceBackupImport,
  VAULT_IMPORT_VALIDATION_SCHEMA,
} from '../apps/web/src/lib/vaultImportValidation.js';

function createValidManifest() {
  const artifact = createArtifactManifestEntry({
    artifactId: 'artifact_001',
    title: 'Artifact',
    kind: 'document',
    app: 'PhiWrite',
  });
  return createProjectManifest({ projectId: 'project_001', title: 'Project', artifacts: [artifact] });
}

test('validateProjectManifestImport accepts valid project manifests', () => {
  const result = validateProjectManifestImport(createValidManifest());

  assert.equal(result.schema, VAULT_IMPORT_VALIDATION_SCHEMA);
  assert.equal(result.ok, true);
  assert.equal(result.kind, 'project_manifest');
  assert.equal(result.payload.projectId, 'project_001');
  assert.match(result.summary, /Project manifest valid/);
});

test('validateProjectManifestImport rejects malformed project manifests', () => {
  const result = validateProjectManifestImport({ schema: 'phioffice369.project_manifest.v0.1', projectId: '', artifacts: [] });

  assert.equal(result.ok, false);
  assert.equal(result.payload, null);
  assert.ok(result.errors.length > 0);
});

test('validateWorkspaceBackupImport validates backup snapshot and optional manifest', () => {
  const result = validateWorkspaceBackupImport({
    schema: 'phioffice369.workspace_backup.v0.1',
    source: 'test',
    createdAt: new Date().toISOString(),
    manifest: createValidManifest(),
    storageSnapshot: [['phioffice369:phiwrite:test', '{"title":"Doc"}']],
  });

  assert.equal(result.ok, true);
  assert.equal(result.kind, 'workspace_backup');
  assert.match(result.summary, /Workspace backup valid/);
});

test('validateWorkspaceBackupImport rejects invalid snapshot pairs', () => {
  const result = validateWorkspaceBackupImport({
    schema: 'phioffice369.workspace_backup.v0.1',
    storageSnapshot: [['phioffice369:phiwrite:test', 123]],
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('storageSnapshot')));
});

test('validateVaultImportPayload dispatches supported import types and rejects unknown JSON', () => {
  assert.equal(validateVaultImportPayload(createValidManifest()).kind, 'project_manifest');
  assert.equal(validateVaultImportPayload({ schema: 'phioffice369.workspace_backup.v0.1', storageSnapshot: [] }).kind, 'workspace_backup');

  const unknown = validateVaultImportPayload({ schema: 'other.v0.1' });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.kind, 'unknown');
});

test('createVaultImportPreviewState maps valid project manifests and backups to UI preview state', () => {
  const manifestResult = validateProjectManifestImport(createValidManifest());
  const manifestState = createVaultImportPreviewState(manifestResult);

  assert.equal(manifestState.importedBackup, null);
  assert.equal(manifestState.importedManifest.projectId, 'project_001');
  assert.equal(manifestState.errors.length, 0);

  const backupResult = validateWorkspaceBackupImport({
    schema: 'phioffice369.workspace_backup.v0.1',
    manifest: createValidManifest(),
    storageSnapshot: [],
  });
  const backupState = createVaultImportPreviewState(backupResult);

  assert.equal(backupState.importedBackup.schema, 'phioffice369.workspace_backup.v0.1');
  assert.equal(backupState.importedManifest.projectId, 'project_001');
});

test('createVaultImportPreviewState clears preview state when validation fails', () => {
  const state = createVaultImportPreviewState(validateVaultImportPayload({ schema: 'other.v0.1' }));

  assert.equal(state.importedBackup, null);
  assert.equal(state.importedManifest, null);
  assert.ok(state.errors.length > 0);
});

test('parseAndValidateVaultImportText parses valid JSON and rejects invalid JSON before preview', () => {
  const valid = parseAndValidateVaultImportText(JSON.stringify(createValidManifest()));
  assert.equal(valid.parseOk, true);
  assert.equal(valid.validation.ok, true);
  assert.equal(valid.previewState.importedManifest.projectId, 'project_001');

  const invalid = parseAndValidateVaultImportText('{bad json');
  assert.equal(invalid.parseOk, false);
  assert.equal(invalid.validation.ok, false);
  assert.equal(invalid.previewState.importedManifest, null);
  assert.match(invalid.previewState.status, /Could not read/);
});

test('createVaultImportPreviewFromFile validates file text before creating preview state', async () => {
  const file = {
    name: 'manifest.json',
    async text() {
      return JSON.stringify(createValidManifest());
    },
  };

  const result = await createVaultImportPreviewFromFile(file);

  assert.equal(result.fileName, 'manifest.json');
  assert.equal(result.validation.ok, true);
  assert.equal(result.previewState.importedManifest.projectId, 'project_001');
});

test('createVaultImportPreviewFromFile rejects missing files safely', async () => {
  const result = await createVaultImportPreviewFromFile(null);

  assert.equal(result.validation.ok, false);
  assert.equal(result.previewState.importedManifest, null);
  assert.match(result.previewState.status, /No import file selected/);
});

test('applyVaultImportPreviewState calls supplied component setters', () => {
  const calls = [];
  const previewState = createVaultImportPreviewState(validateProjectManifestImport(createValidManifest()));

  const applied = applyVaultImportPreviewState(previewState, {
    setImportedBackup: (value) => calls.push(['backup', value]),
    setImportedManifest: (value) => calls.push(['manifest', value?.projectId]),
    setStatus: (value) => calls.push(['status', value]),
    setImportErrors: (value) => calls.push(['errors', value.length]),
  });

  assert.equal(applied.importedManifest.projectId, 'project_001');
  assert.deepEqual(calls.map(([name]) => name), ['backup', 'manifest', 'status', 'errors']);
});

test('createPhiVaultImportChangeHandler validates selected file and resets input value', async () => {
  const calls = [];
  const handler = createPhiVaultImportChangeHandler({
    setImportedBackup: (value) => calls.push(['backup', value]),
    setImportedManifest: (value) => calls.push(['manifest', value?.projectId]),
    setStatus: (value) => calls.push(['status', value]),
    setImportErrors: (value) => calls.push(['errors', value.length]),
  });
  const event = {
    target: {
      value: 'manifest.json',
      files: [{
        name: 'manifest.json',
        async text() {
          return JSON.stringify(createValidManifest());
        },
      }],
    },
  };

  const result = await handler(event);

  assert.equal(result.validation.ok, true);
  assert.equal(event.target.value, '');
  assert.deepEqual(calls.map(([name]) => name), ['backup', 'manifest', 'status', 'errors']);
});
