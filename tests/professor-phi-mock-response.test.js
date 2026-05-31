import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProfessorPhiMockResponse,
  createProfessorPhiPromptSummary,
  getProfessorPhiModeInstruction,
  normalizeProfessorPhiInput,
  PROFESSOR_PHI_MOCK_RESPONSE_SCHEMA,
} from '../packages/professor-phi/src/index.js';

test('normalizeProfessorPhiInput trims prompt text safely', () => {
  assert.equal(normalizeProfessorPhiInput('  hello Professor  '), 'hello Professor');
  assert.equal(normalizeProfessorPhiInput(null), '');
});

test('createProfessorPhiPromptSummary compresses long prompt text', () => {
  const summary = createProfessorPhiPromptSummary('a '.repeat(100), 20);

  assert.equal(summary.length, 20);
  assert.ok(summary.endsWith('…'));
});

test('getProfessorPhiModeInstruction returns mode-aware guidance', () => {
  assert.match(getProfessorPhiModeInstruction('claim_check'), /supported claims/);
  assert.match(getProfessorPhiModeInstruction('build'), /structure/);
  assert.match(getProfessorPhiModeInstruction('unknown'), /first draft/);
});

test('createProfessorPhiMockResponse returns local trust-labeled demo response', () => {
  const response = createProfessorPhiMockResponse({
    prompt: 'Help me turn this spec into a launch checklist.',
    modeId: 'build',
  });

  assert.equal(response.schema, PROFESSOR_PHI_MOCK_RESPONSE_SCHEMA);
  assert.equal(response.modeId, 'build');
  assert.equal(response.trustLabel, 'ai_assisted');
  assert.equal(response.publishRisk, 'low');
  assert.equal(response.localOnly, true);
  assert.match(response.response, /Professor Phi mock response/);
  assert.match(response.response, /Review before publishing/);
});

test('createProfessorPhiMockResponse returns a friendly empty prompt response', () => {
  const response = createProfessorPhiMockResponse({ prompt: '', modeId: 'draft' });

  assert.equal(response.modeId, 'draft');
  assert.match(response.response, /I’m here/);
});

test('claim-check mock response carries medium publish risk', () => {
  const response = createProfessorPhiMockResponse({ prompt: 'Check this public claim.', modeId: 'claim_check' });

  assert.equal(response.publishRisk, 'medium');
  assert.match(response.response, /supported claims/);
});
