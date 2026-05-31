import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARTIFACT_REGISTRY_PARITY_SCHEMA,
  createArtifactRegistryParityReport,
  getArtifactRegistryParityProblemIds,
  summarizeArtifactRegistryParity,
  uniqueSortedArtifactIds,
} from '../apps/web/src/lib/artifactRegistryParity.js';

test('uniqueSortedArtifactIds returns sorted unique artifact ids', () => {
  assert.deepEqual(uniqueSortedArtifactIds([
    { artifactId: 'b' },
    { artifactId: 'a' },
    { artifactId: 'b' },
    {},
  ]), ['a', 'b']);
});

test('createArtifactRegistryParityReport marks parity when ids match', () => {
  const report = createArtifactRegistryParityReport({
    syncArtifacts: [{ artifactId: 'a' }, { artifactId: 'b' }],
    asyncArtifacts: [{ artifactId: 'b' }, { artifactId: 'a' }],
    asyncAdapterId: 'localStorage',
  });

  assert.equal(report.schema, ARTIFACT_REGISTRY_PARITY_SCHEMA);
  assert.equal(report.parity, true);
  assert.equal(report.syncCount, 2);
  assert.equal(report.asyncCount, 2);
  assert.deepEqual(report.missingInAsync, []);
  assert.deepEqual(report.extraInAsync, []);
});

test('createArtifactRegistryParityReport reports missing and extra async ids', () => {
  const report = createArtifactRegistryParityReport({
    syncArtifacts: [{ artifactId: 'a' }, { artifactId: 'b' }],
    asyncArtifacts: [{ artifactId: 'b' }, { artifactId: 'c' }],
  });

  assert.equal(report.parity, false);
  assert.deepEqual(report.missingInAsync, ['a']);
  assert.deepEqual(report.extraInAsync, ['c']);
});

test('summarizeArtifactRegistryParity and problem ids expose compact status', () => {
  const report = createArtifactRegistryParityReport({
    syncArtifacts: [{ artifactId: 'a' }, { artifactId: 'b' }],
    asyncArtifacts: [{ artifactId: 'c' }],
  });

  assert.deepEqual(summarizeArtifactRegistryParity(report), {
    syncCount: 2,
    asyncCount: 1,
    missingInAsyncCount: 2,
    extraInAsyncCount: 1,
    parity: false,
  });
  assert.deepEqual(getArtifactRegistryParityProblemIds(report, 2), ['a', 'b']);
});
