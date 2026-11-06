import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhiOSWorkspaceBridgeClient, PHIOS_WORKSPACE_PROTOCOL } from '../apps/web/src/lib/phiosWorkspaceBridge.js';

const parentOrigin = 'http://localhost:5173';
const parentSource = {};
const appId = 'phioffice';
const sessionId = 'f10342be-61dd-4ff2-bc32-4d8340fd6789';

function client() {
  return createPhiOSWorkspaceBridgeClient({ appId, parentOrigin, parentSource });
}
function event(data, origin = parentOrigin, source = parentSource) {
  return { origin, source, data };
}
function host(type, extra = {}) {
  return {
    protocol: PHIOS_WORKSPACE_PROTOCOL, type, app_id: appId,
    session_id: sessionId, execution_authority: false, ...extra,
  };
}

test('PhiOffice bridge is opt-in and refuses context before a verified bootstrap', () => {
  const bridge = client();
  assert.throws(() => bridge.requestProjectRef(), /not ready/);
  assert.equal(bridge.handle(event(host('host.bootstrap'), 'https://not-the-parent.test')), null);
  assert.equal(bridge.handle(event(host('host.bootstrap'), parentOrigin, {})), null);
  const hello = bridge.handle(event(host('host.bootstrap')));
  assert.equal(hello.kind, 'outbound');
  assert.equal(hello.targetOrigin, parentOrigin);
  assert.equal(hello.message.type, 'app.hello');
  assert.equal(hello.message.session_id, sessionId);
  assert.equal(bridge.handle(event(host('host.bootstrap'))), null);
});

test('PhiOffice accepts only correlated, read-only context results', () => {
  const bridge = client();
  const hello = bridge.handle(event(host('host.bootstrap')));
  assert.equal(bridge.handle(event(host('host.ready', {
    request_id: 'wrong', read_approved: true,
  }))), null);
  const ready = bridge.handle(event(host('host.ready', {
    request_id: hello.message.request_id, read_approved: false,
  })));
  assert.deepEqual(ready, { kind: 'ready', readApproved: false });
  const request = bridge.requestProjectRef();
  assert.equal(request.message.type, 'app.context.request');
  assert.throws(() => bridge.requestProjectRef(), /pending/);
  assert.equal(bridge.handle(event(host('host.context', {
    request_id: 'wrong', project_ref: 'project:test',
  }))), null);
  assert.deepEqual(bridge.handle(event(host('host.denied', {
    request_id: request.message.request_id, reason: 'operator_approval_required',
  }))), { kind: 'denied' });
  const retry = bridge.requestProjectRef();
  assert.deepEqual(bridge.handle(event(host('host.context', {
    request_id: retry.message.request_id, project_ref: 'project:phioffice-369',
  }))), { kind: 'project-ref', projectRef: 'project:phioffice-369' });
});

test('PhiOffice rejects forged authority, extra data, untrusted project paths and stale replies', () => {
  const bridge = client();
  const hello = bridge.handle(event(host('host.bootstrap')));
  assert.equal(bridge.handle(event(host('host.ready', {
    request_id: hello.message.request_id, read_approved: true,
    capabilities: ['shell.execute'],
  }))), null);
  bridge.handle(event(host('host.ready', {
    request_id: hello.message.request_id, read_approved: true,
  })));
  const request = bridge.requestProjectRef();
  for (const altered of [
    { execution_authority: true },
    { project_ref: '/home/user/private' },
    { payload: { document: 'secret' } },
  ]) {
    const candidate = host('host.context', {
      request_id: request.message.request_id, project_ref: 'project:test', ...altered,
    });
    assert.equal(bridge.handle(event(candidate)), null);
  }
  assert.deepEqual(bridge.handle(event(host('host.context', {
    request_id: request.message.request_id, project_ref: 'project:test',
  }))), { kind: 'project-ref', projectRef: 'project:test' });
  assert.equal(bridge.handle(event(host('host.context', {
    request_id: request.message.request_id, project_ref: 'project:stale',
  }))), null);
  bridge.disconnect();
  assert.throws(() => bridge.requestProjectRef(), /not ready/);
});

test('PhiOffice refuses arbitrary parent origins including wildcard and non-loopback HTTP', () => {
  for (const value of ['*', 'http://example.com', 'https://example.com/path', 'https://example.com/']) {
    assert.throws(() => createPhiOSWorkspaceBridgeClient({
      appId, parentOrigin: value, parentSource,
    }), /origin/);
  }
});
