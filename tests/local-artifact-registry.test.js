import test from 'node:test';
import assert from 'node:assert/strict';
import {
  artifactMatchesSearch,
  buildExportTimeline,
  filterArtifacts,
  getArtifactKindAndAppFromStorageKey,
  getArtifactStatusFromStorageKey,
  getArtifactTitleFromStoredValue,
  groupArtifactsByApp,
  storageKeyToArtifactId,
  uniqueArtifactValues,
} from '../apps/web/src/lib/localArtifactRegistry.js';
import {
  createArtifactMetadataKey,
  mergeArtifactMetadata,
  normalizeTag,
  parseTagInput,
} from '../apps/web/src/lib/localArtifactMetadata.js';

const sampleArtifacts = [
  {
    artifactId: 'phioffice369_phiwrite_basic_project_spec',
    title: 'Basic Project Spec',
    app: 'PhiWrite',
    kind: 'document',
    path: 'phioffice369:phiwrite:basic_project_spec',
    labels: ['human_written'],
    tags: ['launch', 'client-work'],
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
    tags: [],
    sourceTemplateId: 'simple_family_budget',
    status: 'local-grid',
  },
  {
    artifactId: 'phioffice369_phideck_pitch_deck_outline',
    title: 'Pitch Deck Outline',
    app: 'PhiDeck',
    kind: 'deck',
    path: 'phioffice369:phideck:pitch_deck_outline',
    labels: ['ai_assisted'],
    tags: ['presentation'],
    sourceTemplateId: 'pitch_deck_outline',
    status: 'local-deck',
  },
  {
    artifactId: 'phioffice369_export_receipt_PhiWrite_draft_basic_project_spec_markdown_2026',
    title: 'basic-project-spec.md',
    app: 'PhiWrite',
    kind: 'export_receipt',
    path: 'phioffice369:export_receipt:PhiWrite:draft_basic_project_spec:markdown:2026-05-30T00:00:00.000Z',
    labels: [],
    tags: [],
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
    tags: [],
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
  assert.deepEqual(getArtifactKindAndAppFromStorageKey('phioffice369:phideck:pitch_deck_outline'), { kind: 'deck', app: 'PhiDeck' });
  assert.deepEqual(getArtifactKindAndAppFromStorageKey('phioffice369:export_receipt:PhiWrite:test:markdown:date'), { kind: 'export_receipt', app: 'PhiVault' });
});

test('getArtifactStatusFromStorageKey maps local app keys to continuity statuses', () => {
  assert.equal(getArtifactStatusFromStorageKey('phioffice369:phiwrite:basic_project_spec'), 'local-draft');
  assert.equal(getArtifactStatusFromStorageKey('phioffice369:phigrid:simple_family_budget'), 'local-grid');
  assert.equal(getArtifactStatusFromStorageKey('phioffice369:phideck:pitch_deck_outline'), 'local-deck');
  assert.equal(getArtifactStatusFromStorageKey('phioffice369:export_receipt:PhiWrite:test:markdown:date'), 'exported');
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
  assert.equal(grouped.PhiDeck.length, 1);
});

test('uniqueArtifactValues returns all plus sorted detected values', () => {
  assert.deepEqual(uniqueArtifactValues(sampleArtifacts, 'app'), ['all', 'PhiDeck', 'PhiGrid', 'PhiWrite']);
  assert.deepEqual(uniqueArtifactValues(sampleArtifacts, 'kind'), ['all', 'deck', 'document', 'export_receipt', 'grid']);
});

test('artifactMatchesSearch checks title app kind path status labels tags and receipt fields', () => {
  assert.equal(artifactMatchesSearch(sampleArtifacts[0], 'basic project'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[0], 'client-work'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[1], 'private'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[2], 'presentation'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[2], 'local-deck'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[3], 'markdown'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[3], 'native'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[0], 'not-present'), false);
});

test('filterArtifacts applies search app and kind filters together', () => {
  assert.equal(filterArtifacts(sampleArtifacts, 'budget', 'all', 'all').length, 2);
  assert.equal(filterArtifacts(sampleArtifacts, '', 'PhiWrite', 'all').length, 2);
  assert.equal(filterArtifacts(sampleArtifacts, '', 'PhiGrid', 'grid').length, 1);
  assert.equal(filterArtifacts(sampleArtifacts, '', 'PhiDeck', 'deck').length, 1);
  assert.equal(filterArtifacts(sampleArtifacts, 'csv', 'PhiWrite', 'export_receipt').length, 0);
});

test('buildExportTimeline returns export receipts newest first', () => {
  const timeline = buildExportTimeline(sampleArtifacts);

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].receipt.filename, 'simple-family-budget.csv');
  assert.equal(timeline[1].receipt.filename, 'basic-project-spec.md');
});

test('local artifact metadata helpers normalize and merge tags', () => {
  assert.equal(createArtifactMetadataKey('artifact_001'), 'phioffice369:artifact_metadata:artifact_001');
  assert.equal(normalizeTag('  #Client Work!  '), 'client-work');
  assert.deepEqual(parseTagInput('Client Work, launch, launch, #Private'), ['client-work', 'launch', 'private']);

  const merged = mergeArtifactMetadata(sampleArtifacts[0], { tags: ['Client Work', 'Launch', ''], updatedAt: '2026-05-31T00:00:00.000Z' });

  assert.deepEqual(merged.tags, ['client-work', 'launch']);
  assert.deepEqual(merged.metadata.tags, ['client-work', 'launch']);
  assert.equal(merged.metadata.metadataUpdatedAt, '2026-05-31T00:00:00.000Z');
});
