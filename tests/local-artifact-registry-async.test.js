import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStorageAdapter } from '../apps/web/src/lib/storageAdapters.js';
import {
  ASYNC_ARTIFACT_REGISTRY_SCHEMA,
  asyncStorageEntryToArtifact,
  createAsyncArtifactRegistryStatus,
  createMetadataLookup,
  scanContinuityArtifactsAsync,
  shouldIncludeAsyncArtifactEntry,
} from '../apps/web/src/lib/localArtifactRegistryAsync.js';

test('createMetadataLookup maps artifact metadata entries by artifact id', () => {
  const lookup = createMetadataLookup([
    { key: 'phioffice369:artifact_metadata:phioffice369_phiwrite_test', value: { tags: ['Draft'], projectFolder: 'Launch', updatedAt: 'now' } },
  ]);

  assert.deepEqual(lookup.phioffice369_phiwrite_test, {
    tags: ['draft'],
    projectFolder: 'Launch',
    updatedAt: 'now',
  });
});

test('shouldIncludeAsyncArtifactEntry excludes metadata emergency and control-plane keys', () => {
  assert.equal(shouldIncludeAsyncArtifactEntry({ key: 'phioffice369:phiwrite:test' }), true);
  assert.equal(shouldIncludeAsyncArtifactEntry({ key: 'phioffice369:artifact_metadata:test' }), false);
  assert.equal(shouldIncludeAsyncArtifactEntry({ key: 'phioffice369:emergency_backup:test' }), false);
  assert.equal(shouldIncludeAsyncArtifactEntry({ key: 'phioffice369:storage_backend_preference' }), false);
  assert.equal(shouldIncludeAsyncArtifactEntry({ key: 'phioffice369:vault_scan_source_preference' }), false);
  assert.equal(shouldIncludeAsyncArtifactEntry({ key: 'external:key' }), false);
});

test('asyncStorageEntryToArtifact creates manifest entries with metadata', () => {
  const artifact = asyncStorageEntryToArtifact({
    key: 'phioffice369:phiwrite:test',
    value: { title: 'Doc', activeLabelId: 'private', templateId: 'starter' },
  }, {
    phioffice369_phiwrite_test: { tags: ['launch'], projectFolder: 'Client Work', updatedAt: 'now' },
  });

  assert.equal(artifact.artifactId, 'phioffice369_phiwrite_test');
  assert.equal(artifact.title, 'Doc');
  assert.equal(artifact.kind, 'document');
  assert.equal(artifact.app, 'PhiWrite');
  assert.deepEqual(artifact.tags, ['launch']);
  assert.equal(artifact.projectFolder, 'Client Work');
});

test('scanContinuityArtifactsAsync scans adapter-backed workspace artifacts', async () => {
  const adapter = createMemoryStorageAdapter({
    'phioffice369:phiwrite:test': '{"title":"Doc","activeLabelId":"private"}',
    'phioffice369:phigrid:test': '{"title":"Grid","rows":[]}',
    'phioffice369:export_receipt:test': '{"filename":"doc.md","sourceApp":"PhiWrite","format":"markdown"}',
    'phioffice369:artifact_metadata:phioffice369_phiwrite_test': '{"tags":["Launch"],"projectFolder":"Client Work","updatedAt":"now"}',
    'phioffice369:emergency_backup:test': '{"skip":true}',
    'phioffice369:storage_backend_preference': '{"backend":"localStorage"}',
    'phioffice369:vault_scan_source_preference': '{"requestedSource":"async-preference-aware-registry"}',
  });

  const artifacts = await scanContinuityArtifactsAsync({ adapter });
  const ids = artifacts.map((artifact) => artifact.artifactId);

  assert.equal(artifacts.length, 3);
  assert.ok(ids.includes('phioffice369_phiwrite_test'));
  assert.ok(ids.includes('phioffice369_phigrid_test'));
  assert.ok(ids.includes('phioffice369_export_receipt_test'));
  assert.equal(ids.includes('phioffice369_storage_backend_preference'), false);
  assert.equal(ids.includes('phioffice369_vault_scan_source_preference'), false);
  assert.equal(artifacts.find((artifact) => artifact.artifactId === 'phioffice369_phiwrite_test').projectFolder, 'Client Work');
});

test('createAsyncArtifactRegistryStatus summarizes adapter-backed artifacts', async () => {
  const adapter = createMemoryStorageAdapter({
    'phioffice369:phiwrite:test': '{"title":"Doc"}',
    'phioffice369:phideck:test': '{"title":"Deck","slides":[]}',
  });
  const status = await createAsyncArtifactRegistryStatus({ adapter });

  assert.equal(status.schema, ASYNC_ARTIFACT_REGISTRY_SCHEMA);
  assert.equal(status.artifactCount, 2);
  assert.deepEqual(status.apps, ['PhiDeck', 'PhiWrite']);
  assert.deepEqual(status.kinds, ['deck', 'document']);
});
