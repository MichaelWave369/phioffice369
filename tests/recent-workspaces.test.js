import test from 'node:test';
import assert from 'node:assert/strict';
import { makeIndependentWorkspaceTemplate, resolveRecentWorkspaceTemplate, scanRecentWorkspaces } from '../apps/web/src/lib/recentWorkspaces.js';
import { getTemplateById } from '../packages/templates/src/index.js';

function fakeStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    get length() { return entries.size; },
    key(index) { return Array.from(entries.keys())[index] ?? null; },
    getItem(key) { return entries.get(key) ?? null; },
    setItem(key, value) { entries.set(key, String(value)); },
  };
}

test('independent IDs keep source template intact and do not collide with its original key', () => {
  const base = getTemplateById('simple_family_budget');
  const a = makeIndependentWorkspaceTemplate(base, 'file000001');
  const b = makeIndependentWorkspaceTemplate(base, 'file000002');
  assert.equal(base.id, 'simple_family_budget');
  assert.equal(a.sourceTemplateId, base.id);
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.id, base.id);
  assert.deepEqual(a.sections, base.sections);
});

test('recent scan sorts valid files, keeps legacy template drafts, and omits unrelated keys', () => {
  const storage = fakeStorage({
    'phioffice369:phiwrite:basic_project_spec': JSON.stringify({
      templateId: 'basic_project_spec', title: 'Legacy spec', content: 'Old work',
      updatedAt: '2026-10-01T01:00:00Z',
    }),
    'phioffice369:phiwrite:file_0000001': JSON.stringify({
      templateId: 'file_0000001', sourceTemplateId: 'basic_project_spec',
      title: 'New spec A', content: 'First', updatedAt: '2026-11-01T01:00:00Z',
    }),
    'phioffice369:phiwrite:file_0000002': JSON.stringify({
      templateId: 'file_0000002', sourceTemplateId: 'basic_project_spec',
      title: 'New spec B', content: 'Second', updatedAt: '2026-11-02T01:00:00Z',
    }),
    'phioffice369:phigrid:file_grid001': JSON.stringify({
      title: 'Budget', columns: ['Item'], rows: [{ Item: 'Paid' }],
      sourceTemplateId: 'simple_family_budget', updatedAt: '2026-10-31T01:00:00Z',
    }),
    'phioffice369:phideck:pitch_deck_outline': JSON.stringify({
      title: 'Deck', slides: [{ id: '1', title: 'Intro', bullets: [] }],
    }),
    'phioffice369:export_receipt:test': JSON.stringify({ title: 'Export' }),
    'phioffice369:phiwrite:file_broken': '{bad json',
    'phioffice369:phigrid:invalid': JSON.stringify({ title: 'No rows' }),
  });
  const rows = scanRecentWorkspaces({ storage });
  assert.equal(rows.length, 5);
  assert.equal(rows[0].title, 'New spec B');
  assert.equal(rows[1].title, 'New spec A');
  assert.equal(rows.find((row) => row.title === 'Legacy spec').sourceTemplateId, 'basic_project_spec');
  assert.equal(rows.find((row) => row.title === 'Budget').app, 'PhiGrid');
  assert.equal(rows.find((row) => row.title === 'Deck').app, 'PhiDeck');
  const result = resolveRecentWorkspaceTemplate(rows[0]);
  assert.equal(result.id, 'file_0000002');
  assert.equal(result.sourceTemplateId, 'basic_project_spec');
  assert.equal(result.app, 'PhiWrite');
  assert.equal(result.title, 'New spec B');
});

test('bad input, unknown namespaces and denied storage are never invented as recent files', () => {
  const storage = fakeStorage({ 'phioffice369:phiwrite:file_ok000': JSON.stringify({ title: 'test', content: 'yes' }) });
  assert.equal(scanRecentWorkspaces({ storage }).length, 1);
  assert.deepEqual(scanRecentWorkspaces({ storage: null }), []);
  assert.deepEqual(scanRecentWorkspaces({ storage: { get length() { throw new Error('denied'); } } }), []);
  assert.throws(() => makeIndependentWorkspaceTemplate(getTemplateById('meeting_notes'), 'abc000'), /Only PhiWrite/);
  assert.throws(() => makeIndependentWorkspaceTemplate(getTemplateById('basic_project_spec'), 'oops:unsafe'), /Invalid/);
});
