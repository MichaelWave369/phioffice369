import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addArtifactToProjectManifest,
  artifactKinds,
  createArtifactManifestEntry,
  createArtifactReceipt,
  createExportReceipt,
  createLocalStorageExportReceiptKey,
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

test('artifact kind catalog includes core artifact and receipt kinds', () => {
  assert.ok(artifactKinds.includes('document'));
  assert.ok(artifactKinds.includes('grid'));
  assert.ok(artifactKinds.includes('deck'));
  assert.ok(artifactKinds.includes('export_receipt'));
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

test('createArtifactReceipt rejects invalid core fields', () => {
  assert.throws(() => createArtifactReceipt({ artifactId: '', title: 'Test', app: 'PhiWrite' }), /artifactId/);
  assert.throws(() => createArtifactReceipt({ artifactId: 'artifact_001', title: '', app: 'PhiWrite' }), /title/);
  assert.throws(() => createArtifactReceipt({ artifactId: 'artifact_001', title: 'Test', app: 'BadApp' }), /Invalid app/);
  assert.throws(() => createArtifactReceipt({ artifactId: 'artifact_001', title: 'Test', app: 'PhiWrite', labels: ['bad_label'] }), /Invalid trust labels/);
  assert.throws(() => createArtifactReceipt({ artifactId: 'artifact_001', title: 'Test', app: 'PhiWrite', transformations: [123] }), /transformations/);
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

test('project manifest and addArtifactToProjectManifest reject duplicate artifact ids', () => {
  const artifact = createArtifactManifestEntry({
    artifactId: 'artifact_001',
    title: 'Test Artifact',
    kind: 'document',
    app: 'PhiWrite',
  });

  assert.throws(() => createProjectManifest({
    projectId: 'project_001',
    title: 'Test Project',
    artifacts: [artifact, artifact],
  }), /Duplicate artifact ids/);

  const project = createProjectManifest({ projectId: 'project_001', title: 'Test Project', artifacts: [artifact] });
  assert.throws(() => addArtifactToProjectManifest(project, artifact), /Duplicate artifact ids/);
});

test('createArtifactManifestEntry rejects invalid kind app and labels', () => {
  assert.throws(() => createArtifactManifestEntry({ artifactId: 'artifact_001', title: 'Test', kind: 'bad_kind', app: 'PhiWrite' }), /Invalid artifact kind/);
  assert.throws(() => createArtifactManifestEntry({ artifactId: 'artifact_001', title: 'Test', kind: 'document', app: 'BadApp' }), /Invalid app/);
  assert.throws(() => createArtifactManifestEntry({ artifactId: 'artifact_001', title: 'Test', kind: 'document', app: 'PhiWrite', labels: ['bad_label'] }), /Invalid trust labels/);
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

test('export receipts reject invalid source apps and warnings', () => {
  assert.throws(() => createExportReceipt({ artifactId: 'artifact_001', format: 'markdown', filename: 'test.md', sourceApp: 'BadApp' }), /Invalid sourceApp/);
  assert.throws(() => createExportReceipt({ artifactId: 'artifact_001', format: 'markdown', filename: 'test.md', sourceApp: 'PhiWrite', warnings: ['ok', 123] }), /warnings/);
});

test('export receipt local storage keys are namespaced and scan-friendly', () => {
  const key = createLocalStorageExportReceiptKey({
    sourceApp: 'PhiWrite',
    artifactId: 'draft_basic_project_spec',
    format: 'markdown',
    exportedAt: '2026-05-30T00:00:00.000Z',
  });

  assert.equal(key, 'phioffice369:export_receipt:PhiWrite:draft_basic_project_spec:markdown:2026-05-30T00:00:00.000Z');
});

test('export receipt key rejects invalid input before writing storage keys', () => {
  assert.throws(() => createLocalStorageExportReceiptKey({ sourceApp: 'BadApp', artifactId: 'artifact_001', format: 'markdown' }), /Invalid sourceApp/);
  assert.throws(() => createLocalStorageExportReceiptKey({ sourceApp: 'PhiWrite', artifactId: '', format: 'markdown' }), /artifactId/);
});
