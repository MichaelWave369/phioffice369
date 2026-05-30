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
