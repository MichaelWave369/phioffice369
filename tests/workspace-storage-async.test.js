import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryStorageAdapter } from '../apps/web/src/lib/storageAdapters.js';
import {
  createWorkspaceAsyncStatus,
  readWorkspaceJson,
  readWorkspaceValue,
  removeWorkspaceValue,
  scanWorkspaceEntries,
  scanWorkspaceJsonEntries,
  WORKSPACE_STORAGE_ASYNC_SCHEMA,
  writeWorkspaceJson,
  writeWorkspaceValue,
} from '../apps/web/src/lib/workspaceStorageAsync.js';

test('async workspace storage reads writes and removes raw values', async () => {
  const adapter = createMemoryStorageAdapter();

  await writeWorkspaceValue('phioffice369:phiwrite:test', 'doc', { adapter });
  assert.equal(await readWorkspaceValue('phioffice369:phiwrite:test', { adapter }), 'doc');
  assert.equal(await removeWorkspaceValue('phioffice369:phiwrite:test', { adapter }), true);
  assert.equal(await readWorkspaceValue('phioffice369:phiwrite:test', { adapter }), null);
});

test('async workspace storage reads and writes JSON safely', async () => {
  const adapter = createMemoryStorageAdapter();

  await writeWorkspaceJson('phioffice369:phigrid:test', { rows: [] }, { adapter });
  await writeWorkspaceValue('phioffice369:broken', '{bad json', { adapter });

  assert.deepEqual(await readWorkspaceJson('phioffice369:phigrid:test', null, { adapter }), { rows: [] });
  assert.equal(await readWorkspaceJson('phioffice369:missing', 'fallback', { adapter }), 'fallback');
  assert.equal(await readWorkspaceJson('phioffice369:broken', 'fallback', { adapter }), 'fallback');
});

test('async workspace scan helpers return entries and parsed JSON entries', async () => {
  const adapter = createMemoryStorageAdapter({
    'phioffice369:phiwrite:test': '{"title":"Doc"}',
    'phioffice369:phigrid:test': '{"rows":[]}',
    'external:key': 'ignore',
  });

  assert.deepEqual(await scanWorkspaceEntries({ prefix: 'phioffice369:', adapter }), [
    ['phioffice369:phiwrite:test', '{"title":"Doc"}'],
    ['phioffice369:phigrid:test', '{"rows":[]}'],
  ]);
  assert.deepEqual(await scanWorkspaceJsonEntries({ prefix: 'phioffice369:', adapter }), [
    { key: 'phioffice369:phiwrite:test', value: { title: 'Doc' } },
    { key: 'phioffice369:phigrid:test', value: { rows: [] } },
  ]);
});

test('async workspace status reports adapter availability and snapshot count', async () => {
  const adapter = createMemoryStorageAdapter({
    'phioffice369:phiwrite:test': 'doc',
    'phioffice369:emergency_backup:test': 'skip',
  });
  const status = await createWorkspaceAsyncStatus({ adapter });

  assert.equal(status.schema, WORKSPACE_STORAGE_ASYNC_SCHEMA);
  assert.equal(status.adapterId, 'memory');
  assert.equal(status.available, true);
  assert.equal(status.snapshotCount, 1);
});
