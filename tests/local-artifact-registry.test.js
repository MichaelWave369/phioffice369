import test from 'node:test';
import assert from 'node:assert/strict';
import {
  artifactMatchesSearch,
  buildExportTimeline,
  filterArtifacts,
  getArtifactKindAndAppFromStorageKey,
  getArtifactTitleFromStoredValue,
  groupArtifactsByApp,
  storageKeyToArtifactId,
  uniqueArtifactValues,
} from '../apps/web/src/lib/localArtifactRegistry.js';

const sampleArtifacts = [
  {
    artifactId: 'phioffice369_phiwrite_basic_project_spec',
    title: 'Basic Project Spec',
    app: 'PhiWrite',
    kind: 'document',
    path: 'phioffice369:phiwrite:basic_project_spec',
    labels: ['human_written'],
    sourceTemplateId: 'basic_project_spec',
    status: 'local-draft',
  },
  {
    artifactId: 'phioffice369_phigrid_simple_family_budget',
    title: 'Simple Family Budget',
    app: 'PhiGrid',
    kind: 'grid',
    path: 'phioffice369:phigrid:simple_family_budget',
    labels: ['private'],
    sourceTemplateId: 'simple_family_budget',
    status: 'local-draft',
  },
  {
    artifactId: 'phioffice369_export_receipt_PhiWrite_draft_basic_project_spec_markdown_2026',
    title: 'basic-project-spec.md',
    app: 'PhiWrite',
    kind: 'export_receipt',
    path: 'phioffice369:export_receipt:PhiWrite:draft_basic_project_spec:markdown:2026-05-30T00:00:00.000Z',
    labels: [],
    receipts: [{
      artifactId: 'draft_basic_project_spec',
      filename: 'basic-project-spec.md',
      sourceApp: 'PhiWrite',
      format: 'markdown',
      compatibility: 'native',
      exportedAt: '2026-05-30T00:00:00.000Z',
    }],
    status: 'exported',
  },
  {
    artifactId: 'phioffice369_export_receipt_PhiGrid_grid_budget_csv_2026',
    title: 'simple-family-budget.csv',
    app: 'PhiGrid',
    kind: 'export_receipt',
    path: 'phioffice369:export_receipt:PhiGrid:grid_simple_family_budget:csv:2026-05-31T00:00:00.000Z',
    labels: [],
    receipts: [{
      artifactId: 'grid_simple_family_budget',
      filename: 'simple-family-budget.csv',
      sourceApp: 'PhiGrid',
      format: 'csv',
      compatibility: 'native',
      exportedAt: '2026-05-31T00:00:00.000Z',
    }],
    status: 'exported',
  },
];

test('storageKeyToArtifactId creates manifest-safe ids', () => {
  assert.equal(
    storageKeyToArtifactId('phioffice369:phiwrite:basic_project_spec'),
    'phioffice369_phiwrite_basic_project_spec',
  );
});

test('getArtifactKindAndAppFromStorageKey detects core local app storage keys', () => {
  assert.deepEqual(getArtifactKindAndAppFromStorageKey('phioffice369:phiwrite:basic_project_spec'), { kind: 'document', app: 'PhiWrite' });
  assert.deepEqual(getArtifactKindAndAppFromStorageKey('phioffice369:phigrid:simple_family_budget'), { kind: 'grid', app: 'PhiGrid' });
  assert.deepEqual(getArtifactKindAndAppFromStorageKey('phioffice369:export_receipt:PhiWrite:test:markdown:date'), { kind: 'export_receipt', app: 'PhiVault' });
});

test('getArtifactTitleFromStoredValue prefers stored titles and filenames', () => {
  assert.equal(getArtifactTitleFromStoredValue('key', { title: 'Stored Title' }), 'Stored Title');
  assert.equal(getArtifactTitleFromStoredValue('key', { filename: 'export.csv' }), 'export.csv');
  assert.equal(getArtifactTitleFromStoredValue('phioffice369:phiwrite:fallback_title', null), 'fallback_title');
});

test('groupArtifactsByApp groups continuity items by app', () => {
  const grouped = groupArtifactsByApp(sampleArtifacts);

  assert.equal(grouped.PhiWrite.length, 2);
  assert.equal(grouped.PhiGrid.length, 2);
});

test('uniqueArtifactValues returns all plus sorted detected values', () => {
  assert.deepEqual(uniqueArtifactValues(sampleArtifacts, 'app'), ['all', 'PhiGrid', 'PhiWrite']);
  assert.deepEqual(uniqueArtifactValues(sampleArtifacts, 'kind'), ['all', 'document', 'export_receipt', 'grid']);
});

test('artifactMatchesSearch checks title app kind path status labels and receipt fields', () => {
  assert.equal(artifactMatchesSearch(sampleArtifacts[0], 'basic project'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[1], 'private'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[2], 'markdown'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[2], 'native'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[0], 'not-present'), false);
});

test('filterArtifacts applies search app and kind filters together', () => {
  assert.equal(filterArtifacts(sampleArtifacts, 'budget', 'all', 'all').length, 2);
  assert.equal(filterArtifacts(sampleArtifacts, '', 'PhiWrite', 'all').length, 2);
  assert.equal(filterArtifacts(sampleArtifacts, '', 'PhiGrid', 'grid').length, 1);
  assert.equal(filterArtifacts(sampleArtifacts, 'csv', 'PhiWrite', 'export_receipt').length, 0);
});

test('buildExportTimeline returns export receipts newest first', () => {
  const timeline = buildExportTimeline(sampleArtifacts);

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].receipt.filename, 'simple-family-budget.csv');
  assert.equal(timeline[1].receipt.filename, 'basic-project-spec.md');
});
