import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addArtifactToProjectManifest,
  artifactKinds,
  createArtifactManifestEntry,
  createArtifactReceipt,
  createExportReceipt,
  createProjectManifest,
  getTrustLabelById,
  suiteApps,
  trustLabels,
} from '../packages/core/src/index.js';

test('trust label catalog includes required public labels', () => {
  const ids = trustLabels.map((label) => label.id);

  assert.ok(ids.includes('human_written'));
  assert.ok(ids.includes('ai_assisted'));
  assert.ok(ids.includes('needs_citation'));
  assert.ok(ids.includes('private'));
  assert.ok(ids.includes('verified'));
});

test('getTrustLabelById returns labels and null for missing labels', () => {
  assert.equal(getTrustLabelById('private')?.label, 'Private');
  assert.equal(getTrustLabelById('missing_label'), null);
});

test('suite app catalog includes the first three MVP apps', () => {
  assert.ok(suiteApps.includes('PhiWrite'));
  assert.ok(suiteApps.includes('PhiGrid'));
  assert.ok(suiteApps.includes('PhiDeck'));
});

test('artifact kind catalog includes document, grid, and deck', () => {
  assert.ok(artifactKinds.includes('document'));
  assert.ok(artifactKinds.includes('grid'));
  assert.ok(artifactKinds.includes('deck'));
});

test('createArtifactReceipt produces a v0.1 receipt envelope', () => {
  const receipt = createArtifactReceipt({
    artifactId: 'artifact_001',
    title: 'Test Artifact',
    app: 'PhiWrite',
    labels: ['human_written'],
    transformations: ['template_to_draft'],
  });

  assert.equal(receipt.schema, 'phioffice369.artifact_receipt.v0.1');
  assert.equal(receipt.artifactId, 'artifact_001');
  assert.equal(receipt.title, 'Test Artifact');
  assert.equal(receipt.app, 'PhiWrite');
  assert.deepEqual(receipt.labels, ['human_written']);
  assert.deepEqual(receipt.transformations, ['template_to_draft']);
  assert.match(receipt.createdAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('project manifest can receive artifact manifest entries', () => {
  const project = createProjectManifest({
    projectId: 'project_001',
    title: 'Test Project',
    tags: ['local-first'],
  });

  const artifact = createArtifactManifestEntry({
    artifactId: 'artifact_001',
    title: 'Test Artifact',
    kind: 'document',
    app: 'PhiWrite',
    labels: ['human_written'],
    sourceTemplateId: 'basic_project_spec',
  });

  const nextProject = addArtifactToProjectManifest(project, artifact);

  assert.equal(project.schema, 'phioffice369.project_manifest.v0.1');
  assert.equal(nextProject.artifacts.length, 1);
  assert.equal(nextProject.artifacts[0].artifactId, 'artifact_001');
  assert.equal(nextProject.artifacts[0].status, 'draft');
});

test('export receipts capture format, filename, and compatibility status', () => {
  const receipt = createExportReceipt({
    artifactId: 'artifact_001',
    format: 'markdown',
    filename: 'test-artifact.md',
    sourceApp: 'PhiWrite',
    compatibility: 'native',
  });

  assert.equal(receipt.schema, 'phioffice369.export_receipt.v0.1');
  assert.equal(receipt.format, 'markdown');
  assert.equal(receipt.filename, 'test-artifact.md');
  assert.equal(receipt.compatibility, 'native');
  assert.deepEqual(receipt.warnings, []);
});
