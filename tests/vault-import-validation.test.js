import test from 'node:test';
import assert from 'node:assert/strict';
import { createArtifactManifestEntry, createProjectManifest } from '../packages/core/src/index.js';
import {
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
