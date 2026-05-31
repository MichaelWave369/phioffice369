import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStorageAdapter } from '../apps/web/src/lib/storageAdapters.js';
import {
  compareStorageSnapshots,
  createStorageVerificationReport,
  entriesToMap,
  getVerificationProblemKeys,
  STORAGE_MIGRATION_VERIFY_SCHEMA,
  verifyStorageMigration,
} from '../apps/web/src/lib/storageMigrationVerify.js';

test('entriesToMap converts entry arrays into maps', () => {
  const map = entriesToMap([['a', '1'], ['b', '2']]);

  assert.equal(map.get('a'), '1');
  assert.equal(map.get('b'), '2');
});

test('compareStorageSnapshots reports missing mismatched and extra target entries without values', () => {
  const comparison = compareStorageSnapshots({
    sourceEntries: [
      ['phioffice369:phiwrite:missing', 'source-only'],
      ['phioffice369:phigrid:mismatch', 'source-value'],
      ['phioffice369:phideck:same', 'same-value'],
    ],
    targetEntries: [
      ['phioffice369:phigrid:mismatch', 'target-value'],
      ['phioffice369:phideck:same', 'same-value'],
      ['phioffice369:extra:item', 'target-only'],
    ],
  });

  assert.equal(comparison.sourceCount, 3);
  assert.equal(comparison.targetCount, 3);
  assert.deepEqual(comparison.missingInTarget, [{ key: 'phioffice369:phiwrite:missing', sourceValueLength: 11 }]);
  assert.deepEqual(comparison.mismatched, [{ key: 'phioffice369:phigrid:mismatch', sourceValueLength: 12, targetValueLength: 12 }]);
  assert.deepEqual(comparison.extraInTarget, [{ key: 'phioffice369:extra:item', targetValueLength: 11 }]);
});

test('createStorageVerificationReport marks verified only when missing and mismatched are empty', () => {
  const ok = createStorageVerificationReport({
    sourceAdapterId: 'localStorage',
    targetAdapterId: 'indexedDB',
    comparison: compareStorageSnapshots({ sourceEntries: [['a', '1']], targetEntries: [['a', '1'], ['extra', '2']] }),
  });
  const bad = createStorageVerificationReport({
    sourceAdapterId: 'localStorage',
    targetAdapterId: 'indexedDB',
    comparison: compareStorageSnapshots({ sourceEntries: [['a', '1']], targetEntries: [['a', '2']] }),
  });

  assert.equal(ok.schema, STORAGE_MIGRATION_VERIFY_SCHEMA);
  assert.equal(ok.verified, true);
  assert.equal(ok.extraInTargetCount, 1);
  assert.equal(bad.verified, false);
  assert.equal(bad.mismatchedCount, 1);
});

test('verifyStorageMigration compares adapter workspace snapshots', async () => {
  const source = createMemoryStorageAdapter({
    'phioffice369:phiwrite:test': 'doc',
    'phioffice369:emergency_backup:old': 'skip',
  });
  const target = createMemoryStorageAdapter({
    'phioffice369:phiwrite:test': 'doc',
  });

  const report = await verifyStorageMigration({ sourceAdapter: source, targetAdapter: target });

  assert.equal(report.sourceAdapterId, 'memory');
  assert.equal(report.targetAdapterId, 'memory');
  assert.equal(report.sourceCount, 1);
  assert.equal(report.targetCount, 1);
  assert.equal(report.verified, true);
});

test('getVerificationProblemKeys returns missing and mismatched keys only', () => {
  const report = {
    missingInTarget: [{ key: 'missing' }],
    mismatched: [{ key: 'mismatch' }],
    extraInTarget: [{ key: 'extra' }],
  };

  assert.deepEqual(getVerificationProblemKeys(report), ['missing', 'mismatch']);
});
