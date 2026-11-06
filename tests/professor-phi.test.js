import test from 'node:test';
import assert from 'node:assert/strict';
import { getProfessorPhiMode, professorPhiModes, professorPhiSystemNotes } from '../packages/professor-phi/src/index.js';

test('Professor Phi mode catalog includes core assistant modes', () => {
  const ids = professorPhiModes.map((mode) => mode.id);

  assert.ok(ids.includes('draft'));
  assert.ok(ids.includes('polish'));
  assert.ok(ids.includes('transform'));
  assert.ok(ids.includes('claim_check'));
});

test('getProfessorPhiMode returns modes and null for missing modes', () => {
  assert.equal(getProfessorPhiMode('draft')?.label, 'Draft');
  assert.equal(getProfessorPhiMode('missing_mode'), null);
});

test('Professor Phi system notes include transparency and local-first guidance', () => {
  const notes = professorPhiSystemNotes.join(' ').toLowerCase();

  assert.match(notes, /do not hide ai assistance/);
  assert.match(notes, /local-first/);
});

test('provider interface gates remote prompts and preserves visible provenance', async () => {
  const { runProfessorPhi, professorPhiDemoProvider } = await import('../packages/professor-phi/src/index.js');
  let calls = 0;
  const remote = {
    id: 'test-remote', name: 'Test backend', kind: 'remote',
    run: () => { calls += 1; return { response: 'Test fixture', trustLabel: 'verified' }; },
  };
  await assert.rejects(runProfessorPhi(remote, { prompt: 'Private', modeId: 'draft' }), /explicit approval/);
  assert.equal(calls, 0);
  const result = await runProfessorPhi(remote, { prompt: 'Approved', modeId: 'draft' }, { approveRemote: true });
  assert.equal(result.providerName, 'Test backend');
  assert.equal(result.localOnly, false);
  assert.equal(result.trustLabel, 'ai_assisted');
  assert.equal(calls, 1);
  const demo = await runProfessorPhi(professorPhiDemoProvider, { prompt: 'Fixture', modeId: 'teach' });
  assert.equal(demo.providerKind, 'demo');
  assert.equal(demo.localOnly, true);
  assert.match(demo.response, /mock response/);
});
