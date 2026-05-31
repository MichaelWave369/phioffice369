import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createArtifactManifestEntry,
  createArtifactReceipt,
  createExportReceipt,
  createProjectManifest,
} from '../packages/core/src/index.js';
import {
  ARTIFACT_MANIFEST_ENTRY_SCHEMA,
  ARTIFACT_RECEIPT_SCHEMA,
  EXPORT_RECEIPT_SCHEMA,
  PROJECT_MANIFEST_SCHEMA,
  collectDuplicateArtifactIds,
  validateArtifactManifestEntry,
  validateArtifactReceipt,
  validateExportReceipt,
  validateProjectManifest,
} from '../packages/core/src/schemas.js';

test('core schema constants expose version ids', () => {
  assert.equal(ARTIFACT_RECEIPT_SCHEMA.$id, 'phioffice369.artifact_receipt.v0.1');
  assert.equal(ARTIFACT_MANIFEST_ENTRY_SCHEMA.$id, 'phioffice369.artifact_manifest_entry.v0.1');
  assert.equal(PROJECT_MANIFEST_SCHEMA.$id, 'phioffice369.project_manifest.v0.1');
  assert.equal(EXPORT_RECEIPT_SCHEMA.$id, 'phioffice369.export_receipt.v0.1');
});

test('validateArtifactReceipt accepts valid receipts and rejects malformed ones', () => {
  const receipt = createArtifactReceipt({
    artifactId: 'artifact_001',
    title: 'Artifact',
    app: 'PhiWrite',
    labels: ['human_written'],
    transformations: ['template_to_draft'],
  });

  assert.equal(validateArtifactReceipt(receipt).ok, true);

  const invalid = validateArtifactReceipt({ ...receipt, app: 'BadApp', labels: ['bad_label'] });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => error.includes('Invalid app')));
  assert.ok(invalid.errors.some((error) => error.includes('Invalid trust labels')));
});

test('validateArtifactManifestEntry accepts valid entries and rejects invalid nested values', () => {
  const entry = createArtifactManifestEntry({
    artifactId: 'artifact_001',
    title: 'Artifact',
    kind: 'document',
    app: 'PhiWrite',
    labels: ['human_written'],
  });

  assert.equal(validateArtifactManifestEntry(entry).ok, true);

  const invalid = validateArtifactManifestEntry({ ...entry, kind: 'bad_kind', sourceTemplateId: 123 });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => error.includes('Invalid artifact kind')));
  assert.ok(invalid.errors.some((error) => error.includes('sourceTemplateId')));
});

test('validateProjectManifest accepts valid manifests and catches duplicate artifact ids', () => {
  const artifact = createArtifactManifestEntry({
    artifactId: 'artifact_001',
    title: 'Artifact',
    kind: 'document',
    app: 'PhiWrite',
  });
  const manifest = createProjectManifest({ projectId: 'project_001', title: 'Project', artifacts: [artifact] });

  assert.equal(validateProjectManifest(manifest).ok, true);
  assert.deepEqual(collectDuplicateArtifactIds([artifact, artifact]), ['artifact_001']);

  const invalid = validateProjectManifest({ ...manifest, artifacts: [artifact, artifact] });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => error.includes('Duplicate artifact ids')));
});

test('validateProjectManifest reports invalid artifact entries with indexed paths', () => {
  const invalid = validateProjectManifest({
    schema: 'phioffice369.project_manifest.v0.1',
    projectId: 'project_001',
    title: 'Project',
    description: '',
    owner: 'local-user',
    tags: [],
    artifacts: [{ artifactId: '', title: 'Bad', kind: 'bad_kind', app: 'BadApp', path: '', labels: [], receipts: [], sourceTemplateId: null, status: '', createdAt: '', updatedAt: '' }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => error.startsWith('artifacts[0].')));
});

test('validateExportReceipt accepts valid receipts and rejects invalid source apps', () => {
  const receipt = createExportReceipt({
    artifactId: 'artifact_001',
    format: 'markdown',
    filename: 'artifact.md',
    sourceApp: 'PhiWrite',
  });

  assert.equal(validateExportReceipt(receipt).ok, true);

  const invalid = validateExportReceipt({ ...receipt, sourceApp: 'BadApp', warnings: [123] });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => error.includes('Invalid sourceApp')));
  assert.ok(invalid.errors.some((error) => error.includes('warnings')));
});
