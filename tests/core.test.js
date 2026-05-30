import test from 'node:test';
import assert from 'node:assert/strict';
import { createArtifactReceipt, getTrustLabelById, suiteApps, trustLabels } from '../packages/core/src/index.js';

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
