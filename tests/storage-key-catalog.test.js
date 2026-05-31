import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyStorageKey,
  findStorageNamespace,
  getAdapterRefactorBacklog,
  getStorageKeyCatalog,
  normalizeStorageKey,
  STORAGE_KEY_CATALOG_SCHEMA,
  STORAGE_NAMESPACE_CATALOG,
  summarizeStorageCatalog,
} from '../apps/web/src/lib/storageKeyCatalog.js';

test('storage key catalog exposes versioned namespace records', () => {
  const catalog = getStorageKeyCatalog();

  assert.equal(catalog.schema, STORAGE_KEY_CATALOG_SCHEMA);
  assert.equal(catalog.namespaces.length, STORAGE_NAMESPACE_CATALOG.length);
  assert.ok(catalog.namespaces.length >= 7);
});

test('storage key namespaces have unique ids and prefixes', () => {
  const ids = STORAGE_NAMESPACE_CATALOG.map((entry) => entry.id);
  const prefixes = STORAGE_NAMESPACE_CATALOG.map((entry) => entry.prefix);

  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(prefixes).size, prefixes.length);
});

test('normalizeStorageKey trims input', () => {
  assert.equal(normalizeStorageKey('  phioffice369:phiwrite:test  '), 'phioffice369:phiwrite:test');
});

test('findStorageNamespace finds known prefixes', () => {
  assert.equal(findStorageNamespace('phioffice369:phiwrite:test')?.id, 'phiwrite_drafts');
  assert.equal(findStorageNamespace('phioffice369:phigrid:test')?.id, 'phigrid_tables');
  assert.equal(findStorageNamespace('phioffice369:phideck:test')?.id, 'phideck_decks');
  assert.equal(findStorageNamespace('phioffice369:export_receipt:test')?.id, 'export_receipts');
  assert.equal(findStorageNamespace('phioffice369:artifact_metadata:test')?.id, 'artifact_metadata');
  assert.equal(findStorageNamespace('phioffice369:emergency_backup:test')?.id, 'emergency_backups');
  assert.equal(findStorageNamespace('phioffice369:storage_backend_preference')?.id, 'storage_backend_preference');
});

test('classifyStorageKey marks known PhiOffice namespaces', () => {
  const classified = classifyStorageKey('phioffice369:phiwrite:test');

  assert.equal(classified.known, true);
  assert.equal(classified.namespaceId, 'phiwrite_drafts');
  assert.equal(classified.app, 'PhiWrite');
  assert.equal(classified.kind, 'document');
  assert.equal(classified.currentBackend, 'localStorage');
  assert.equal(classified.migrationTarget, 'indexedDB');
});

test('classifyStorageKey marks unknown PhiOffice and external namespaces', () => {
  assert.equal(classifyStorageKey('phioffice369:unknown:test').namespaceId, 'unknown_phioffice_namespace');
  assert.equal(classifyStorageKey('external:key').namespaceId, 'external_namespace');
});

test('summarizeStorageCatalog counts namespaces and adapter backlog', () => {
  const summary = summarizeStorageCatalog();

  assert.equal(summary.totalNamespaces, STORAGE_NAMESPACE_CATALOG.length);
  assert.equal(summary.byBackend.localStorage, STORAGE_NAMESPACE_CATALOG.length);
  assert.ok(summary.pendingAdapterRefactor >= 5);
});

test('getAdapterRefactorBacklog returns only pending app data namespaces', () => {
  const backlog = getAdapterRefactorBacklog();
  const ids = backlog.map((entry) => entry.id);

  assert.ok(backlog.every((entry) => entry.adapterStatus === 'pending-adapter-refactor'));
  assert.ok(ids.includes('phiwrite_drafts'));
  assert.ok(ids.includes('phigrid_tables'));
  assert.ok(ids.includes('phideck_decks'));
});
