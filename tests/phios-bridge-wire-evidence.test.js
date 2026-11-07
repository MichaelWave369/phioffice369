import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requireReviewedHostSha, REVIEWED_PHIOS_HOST_SHA } from '../scripts/phios-reviewed-host-pin.mjs';
import { witnessInstallExpression, verifyWireObservations } from '../scripts/phios-bridge-wire-evidence.mjs';

const ORIGIN = 'http://127.0.0.1:51123';
const ID1 = 'a1234567-1234-4abc-8abc-111111111111';
const ID2 = 'b1234567-1234-4abc-8abc-222222222222';
const CONTEXT_KEYS = ['app_id', 'execution_authority', 'project_ref',
  'protocol', 'request_id', 'session_id', 'type'];
const DENIED_KEYS = ['app_id', 'execution_authority', 'protocol',
  'reason', 'request_id', 'session_id', 'type'];

function denial(sessionId = ID1) {
  return { type: 'host.denied', origin: ORIGIN, senderBound: true,
    keys: DENIED_KEYS, sessionId, requestId: 'req-001', projectRef: null,
    executionAuthority: false };
}
function context(ref, sessionId = ID1) {
  return { type: 'host.context', origin: ORIGIN, senderBound: true,
    keys: CONTEXT_KEYS, sessionId, requestId: 'req-002', projectRef: ref,
    executionAuthority: false };
}
function verify(items, opts = {}) {
  return verifyWireObservations(items, {
    expectedHostOrigin: ORIGIN, expectedRefs: ['project:test'],
    requireDenied: 1, ...opts,
  });
}

test('the browser host test pins merged PhiOS PR #406 exactly, not its candidate SHA', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(workflow, /browser-bridge-ui:/);
  assert.ok(workflow.includes('ref: ' + REVIEWED_PHIOS_HOST_SHA));
  assert.equal(REVIEWED_PHIOS_HOST_SHA, '53ed5caa46c463a0c7385c9bb177c803fdeaaa03');
  assert.equal(requireReviewedHostSha(REVIEWED_PHIOS_HOST_SHA), REVIEWED_PHIOS_HOST_SHA);
  for (const changed of ['c3285db4378938502c363d430fe9d124be51b2e4', 'g'.repeat(40), '']) {
    assert.throws(() => requireReviewedHostSha(changed), /SHA mismatch/);
  }
  assert.throws(() => requireReviewedHostSha(REVIEWED_PHIOS_HOST_SHA, 'b'.repeat(40)), /SHA mismatch/);
});

test('captured Chrome evidence demonstrates only a bounded, approved project ref crossed', () => {
  const observed = [denial(), context('project:test'), denial()];
  const result = verify(observed);
  assert.equal(result.receivedContextCount, 1);
  assert.equal(result.deniedCount, 2);
  assert.equal(result.sessionId, ID1);
  assert.equal(result.executionAuthority, false);
  assert.equal(result.allContextsAreOpaqueRefs, true);
  assert.ok(witnessInstallExpression().includes('addEventListener'));
  assert.ok(!witnessInstallExpression().includes('localStorage'));
});

test('fresh session after reconnect is mandatory', () => {
  const next = [denial(ID2), context('project:test', ID2), denial(ID2)];
  assert.equal(verify(next, { priorSessionId: ID1 }).sessionId, ID2);
  assert.throws(() => verify([denial(), context('project:test'), denial()],
    { priorSessionId: ID1 }), /replayed/);
});

test('rejects wrong frame/origin/authority, mixed sessions and unexpected packet types', () => {
  const [d, c] = [denial(), context('project:test')];
  for (const invalid of [
    { ...c, senderBound: false }, { ...c, origin: 'http://127.0.0.1:9999' },
    { ...c, executionAuthority: true },
    { ...c, sessionId: ID2 },
    { ...c, type: 'host.ready' },
    { ...c, keys: [...CONTEXT_KEYS, 'path'].sort() },
    { ...c, keys: CONTEXT_KEYS.filter(key => key !== 'project_ref') },
    { ...c, projectRef: '/private/token' },
  ]) {
    assert.throws(() => verify([d, invalid]), /Bridge|Unexpected/);
  }
});

test('denial may never carry an identity or private fields', () => {
  for (const invalid of [
    { ...denial(), projectRef: 'project:test' },
    { ...denial(), keys: [...DENIED_KEYS, 'credential'].sort() },
  ]) {
    assert.throws(() => verify([invalid, context('project:test')]), /Bridge/);
  }
});

test('fail closed on missing consent, extra contexts, incorrect order and invalid witness envelope', () => {
  assert.throws(() => verify([denial()]), /incomplete/);
  assert.throws(() => verify([context('project:test')]), /Bridge/);
  assert.throws(() => verify([context('project:test'), denial()]), /Bridge/);
  assert.throws(() => verify([denial(), context('project:test'), context('project:test')]), /Bridge/);
  assert.throws(() => verify([denial(), context('project:other'), denial()]), /incomplete/);
  assert.throws(() => verify(null), /input/);
  assert.throws(() => verify([denial(), context('project:test')], {
    expectedHostOrigin: 'https://example.com',
  }), /input/);
});
