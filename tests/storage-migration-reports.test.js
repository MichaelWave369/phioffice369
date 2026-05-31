import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStorageMigrationReport,
  getMigrationConflictKeys,
  redactMigrationEntry,
  redactMigrationResultEntry,
  STORAGE_MIGRATION_REPORT_SCHEMA,
  valueLength,
} from '../apps/web/src/lib/storageMigrationReports.js';

const entry = {
  key: 'phioffice369:phiwrite:test',
  value: '{"title":"Private draft"}',
  existsInTarget: true,
  targetValue: '{"title":"Other draft"}',
  conflict: true,
};

const plan = {
  schema: 'phioffice369.storage_migration.v0.1',
  createdAt: '2026-05-31T00:00:00.000Z',
  sourceAdapterId: 'localStorage',
  targetAdapterId: 'indexedDB',
  sourceCount: 1,
  missingInTargetCount: 0,
  alreadySyncedCount: 0,
  conflictCount: 1,
  entries: [entry],
};

const result = {
  schema: 'phioffice369.storage_migration_result.v0.1',
  createdAt: '2026-05-31T00:01:00.000Z',
  dryRun: false,
  overwrite: false,
  appliedCount: 0,
  skippedCount: 1,
  conflictCount: 1,
  applied: [],
  skipped: [{ ...entry, reason: 'conflict' }],
  conflicts: [entry],
};

test('valueLength safely reports string lengths only', () => {
  assert.equal(valueLength('abc'), 3);
  assert.equal(valueLength(null), 0);
  assert.equal(valueLength({}), 0);
});

test('redactMigrationEntry removes storage values and keeps audit metadata', () => {
  assert.deepEqual(redactMigrationEntry(entry), {
    key: 'phioffice369:phiwrite:test',
    existsInTarget: true,
    conflict: true,
    valueLength: 25,
    targetValueLength: 23,
  });
});

test('redactMigrationResultEntry keeps reason but removes values', () => {
  assert.deepEqual(redactMigrationResultEntry({ ...entry, reason: 'conflict' }), {
    key: 'phioffice369:phiwrite:test',
    reason: 'conflict',
    existsInTarget: true,
    conflict: true,
    valueLength: 25,
    targetValueLength: 23,
  });
});

test('createStorageMigrationReport creates redacted plan and result envelopes', () => {
  const report = createStorageMigrationReport({ plan, result });

  assert.equal(report.schema, STORAGE_MIGRATION_REPORT_SCHEMA);
  assert.equal(report.plan.conflictCount, 1);
  assert.equal(report.plan.entries[0].value, undefined);
  assert.equal(report.result.skipped[0].targetValue, undefined);
  assert.equal(report.result.skipped[0].reason, 'conflict');
});

test('getMigrationConflictKeys returns limited conflict keys from plans or results', () => {
  assert.deepEqual(getMigrationConflictKeys(plan), ['phioffice369:phiwrite:test']);
  assert.deepEqual(getMigrationConflictKeys(result, 1), ['phioffice369:phiwrite:test']);
  assert.deepEqual(getMigrationConflictKeys({ entries: [{ key: 'safe', conflict: false }] }), []);
});
