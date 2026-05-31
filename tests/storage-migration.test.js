import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStorageAdapter } from '../apps/web/src/lib/storageAdapters.js';
import {
  createMigrationEntry,
  createStorageMigrationPlan,
  migrateStorage,
  migrateStoragePlan,
  STORAGE_MIGRATION_SCHEMA,
  summarizeMigrationPlan,
} from '../apps/web/src/lib/storageMigration.js';

test('createMigrationEntry detects target conflicts', () => {
  assert.deepEqual(createMigrationEntry(['key', 'value'], null), {
    key: 'key',
    value: 'value',
    existsInTarget: false,
    targetValue: null,
    conflict: false,
  });

  assert.deepEqual(createMigrationEntry(['key', 'value'], 'other'), {
    key: 'key',
    value: 'value',
    existsInTarget: true,
    targetValue: 'other',
    conflict: true,
  });
});

test('createStorageMigrationPlan counts missing synced and conflict entries', async () => {
  const source = createMemoryStorageAdapter({
    'phioffice369:phiwrite:missing': 'missing-value',
    'phioffice369:phigrid:synced': 'same-value',
    'phioffice369:phideck:conflict': 'source-value',
    'phioffice369:emergency_backup:old': 'skip-me',
  });
  const target = createMemoryStorageAdapter({
    'phioffice369:phigrid:synced': 'same-value',
    'phioffice369:phideck:conflict': 'target-value',
  });

  const plan = await createStorageMigrationPlan({ sourceAdapter: source, targetAdapter: target });

  assert.equal(plan.schema, STORAGE_MIGRATION_SCHEMA);
  assert.equal(plan.sourceAdapterId, 'memory');
  assert.equal(plan.targetAdapterId, 'memory');
  assert.equal(plan.sourceCount, 3);
  assert.equal(plan.missingInTargetCount, 1);
  assert.equal(plan.alreadySyncedCount, 1);
  assert.equal(plan.conflictCount, 1);
  assert.equal(summarizeMigrationPlan(plan).safeToCopyWithoutOverwrite, false);
});

test('migrateStoragePlan dry run reports actions without writing', async () => {
  const source = createMemoryStorageAdapter({ 'phioffice369:phiwrite:test': 'doc' });
  const target = createMemoryStorageAdapter();
  const plan = await createStorageMigrationPlan({ sourceAdapter: source, targetAdapter: target });
  const result = await migrateStoragePlan({ plan, targetAdapter: target, dryRun: true });

  assert.equal(result.dryRun, true);
  assert.equal(result.appliedCount, 1);
  assert.equal(await target.getItem('phioffice369:phiwrite:test'), null);
});

test('migrateStorage copies missing entries when dryRun is false', async () => {
  const source = createMemoryStorageAdapter({ 'phioffice369:phiwrite:test': 'doc' });
  const target = createMemoryStorageAdapter();
  const { result } = await migrateStorage({ sourceAdapter: source, targetAdapter: target, dryRun: false });

  assert.equal(result.appliedCount, 1);
  assert.equal(result.skippedCount, 0);
  assert.equal(await target.getItem('phioffice369:phiwrite:test'), 'doc');
});

test('migrateStorage skips conflicts unless overwrite is true', async () => {
  const source = createMemoryStorageAdapter({ 'phioffice369:phiwrite:test': 'source' });
  const target = createMemoryStorageAdapter({ 'phioffice369:phiwrite:test': 'target' });

  const blocked = await migrateStorage({ sourceAdapter: source, targetAdapter: target, dryRun: false, overwrite: false });
  assert.equal(blocked.result.appliedCount, 0);
  assert.equal(blocked.result.conflictCount, 1);
  assert.equal(await target.getItem('phioffice369:phiwrite:test'), 'target');

  const overwritten = await migrateStorage({ sourceAdapter: source, targetAdapter: target, dryRun: false, overwrite: true });
  assert.equal(overwritten.result.appliedCount, 1);
  assert.equal(overwritten.result.conflictCount, 0);
  assert.equal(await target.getItem('phioffice369:phiwrite:test'), 'source');
});

test('migrateStorage skips already synced entries', async () => {
  const source = createMemoryStorageAdapter({ 'phioffice369:phiwrite:test': 'same' });
  const target = createMemoryStorageAdapter({ 'phioffice369:phiwrite:test': 'same' });
  const { result } = await migrateStorage({ sourceAdapter: source, targetAdapter: target, dryRun: false });

  assert.equal(result.appliedCount, 0);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.skipped[0].reason, 'already_synced');
});
