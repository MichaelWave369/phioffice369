import test from 'node:test';
import assert from 'node:assert/strict';
import {
  artifactMatchesSearch,
  buildExportTimeline,
  CONTROL_PLANE_STORAGE_KEYS,
  filterArtifacts,
  getArtifactKindAndAppFromStorageKey,
  getArtifactStatusFromStorageKey,
  getArtifactTitleFromStoredValue,
  groupArtifactsByApp,
  isControlPlaneStorageKey,
  scanContinuityArtifacts,
  storageKeyToArtifactId,
  uniqueArtifactValues,
} from '../apps/web/src/lib/localArtifactRegistry.js';
import {
  createArtifactMetadataKey,
  mergeArtifactMetadata,
  normalizeProjectFolder,
  normalizeTag,
  parseTagInput,
} from '../apps/web/src/lib/localArtifactMetadata.js';

function createFakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    key(index) {
      return Array.from(map.keys())[index] ?? null;
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

const sampleArtifacts = [
  {
    artifactId: 'phioffice369_phiwrite_basic_project_spec',
    title: 'Basic Project Spec',
    app: 'PhiWrite',
    kind: 'document',
    path: 'phioffice369:phiwrite:basic_project_spec',
    labels: ['human_written'],
    tags: ['launch', 'client-work'],
    projectFolder: 'Client Launch',
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
    projectFolder: 'Home Ops',
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
    projectFolder: 'Client Launch',
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
    projectFolder: '',
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
    projectFolder: '',
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

test('control-plane storage keys are not treated as artifact keys', () => {
  assert.equal(CONTROL_PLANE_STORAGE_KEYS.includes('phioffice369:storage_backend_preference'), true);
  assert.equal(CONTROL_PLANE_STORAGE_KEYS.includes('phioffice369:vault_scan_source_preference'), true);
  assert.equal(isControlPlaneStorageKey('phioffice369:storage_backend_preference'), true);
  assert.equal(isControlPlaneStorageKey('phioffice369:vault_scan_source_preference'), true);
  assert.equal(isControlPlaneStorageKey('phioffice369:phiwrite:test'), false);
});

test('scanContinuityArtifacts excludes sync control-plane and emergency keys', () => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: createFakeStorage({
      'phioffice369:phiwrite:test': '{"title":"Doc","activeLabelId":"private"}',
      'phioffice369:phigrid:test': '{"title":"Grid","rows":[]}',
      'phioffice369:export_receipt:test': '{"filename":"doc.md","sourceApp":"PhiWrite","format":"markdown"}',
      'phioffice369:artifact_metadata:phioffice369_phiwrite_test': '{"tags":["Launch"],"projectFolder":"Client Work","updatedAt":"now"}',
      'phioffice369:emergency_backup:test': '{"skip":true}',
      'phioffice369:storage_backend_preference': '{"backend":"localStorage"}',
      'phioffice369:vault_scan_source_preference': '{"requestedSource":"async-preference-aware-registry"}',
    }),
  };

  try {
    const artifacts = scanContinuityArtifacts();
    const ids = artifacts.map((artifact) => artifact.artifactId);

    assert.equal(artifacts.length, 3);
    assert.ok(ids.includes('phioffice369_phiwrite_test'));
    assert.ok(ids.includes('phioffice369_phigrid_test'));
    assert.ok(ids.includes('phioffice369_export_receipt_test'));
    assert.equal(ids.includes('phioffice369_storage_backend_preference'), false);
    assert.equal(ids.includes('phioffice369_vault_scan_source_preference'), false);
    assert.equal(ids.includes('phioffice369_emergency_backup_test'), false);
    assert.equal(artifacts.find((artifact) => artifact.artifactId === 'phioffice369_phiwrite_test').projectFolder, 'Client Work');
  } finally {
    globalThis.window = previousWindow;
  }
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
  assert.deepEqual(uniqueArtifactValues(sampleArtifacts, 'projectFolder'), ['all', 'Client Launch', 'Home Ops']);
});

test('artifactMatchesSearch checks title app kind path status labels tags project folders and receipt fields', () => {
  assert.equal(artifactMatchesSearch(sampleArtifacts[0], 'basic project'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[0], 'client-work'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[0], 'client launch'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[1], 'home ops'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[1], 'private'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[2], 'presentation'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[2], 'local-deck'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[3], 'markdown'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[3], 'native'), true);
  assert.equal(artifactMatchesSearch(sampleArtifacts[0], 'not-present'), false);
});

test('filterArtifacts applies search app kind and project filters together', () => {
  assert.equal(filterArtifacts(sampleArtifacts, 'budget', 'all', 'all').length, 2);
  assert.equal(filterArtifacts(sampleArtifacts, '', 'PhiWrite', 'all').length, 2);
  assert.equal(filterArtifacts(sampleArtifacts, '', 'PhiGrid', 'grid').length, 1);
  assert.equal(filterArtifacts(sampleArtifacts, '', 'PhiDeck', 'deck').length, 1);
  assert.equal(filterArtifacts(sampleArtifacts, '', 'all', 'all', 'Client Launch').length, 2);
  assert.equal(filterArtifacts(sampleArtifacts, '', 'PhiGrid', 'all', 'Home Ops').length, 1);
  assert.equal(filterArtifacts(sampleArtifacts, 'csv', 'PhiWrite', 'export_receipt').length, 0);
});

test('buildExportTimeline returns export receipts newest first', () => {
  const timeline = buildExportTimeline(sampleArtifacts);

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].receipt.filename, 'simple-family-budget.csv');
  assert.equal(timeline[1].receipt.filename, 'basic-project-spec.md');
});

test('local artifact metadata helpers normalize and merge tags and project folders', () => {
  assert.equal(createArtifactMetadataKey('artifact_001'), 'phioffice369:artifact_metadata:artifact_001');
  assert.equal(normalizeTag('  #Client Work!  '), 'client-work');
  assert.equal(normalizeProjectFolder('  Client   Launch  '), 'Client Launch');
  assert.deepEqual(parseTagInput('Client Work, launch, launch, #Private'), ['client-work', 'launch', 'private']);

  const merged = mergeArtifactMetadata(sampleArtifacts[0], { tags: ['Client Work', 'Launch', ''], projectFolder: 'Client Launch', updatedAt: '2026-05-31T00:00:00.000Z' });

  assert.deepEqual(merged.tags, ['client-work', 'launch']);
  assert.equal(merged.projectFolder, 'Client Launch');
  assert.deepEqual(merged.metadata.tags, ['client-work', 'launch']);
  assert.equal(merged.metadata.projectFolder, 'Client Launch');
  assert.equal(merged.metadata.metadataUpdatedAt, '2026-05-31T00:00:00.000Z');
});
