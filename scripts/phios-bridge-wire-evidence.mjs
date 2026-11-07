// Read-only observations of the *actual* cross-origin postMessage boundary.
// The test sees synthetic project refs only. No production event logging.
const SHARED = ['app_id', 'execution_authority', 'protocol', 'request_id', 'session_id', 'type'];
const CONTEXT = [...SHARED, 'project_ref'].sort();
const DENIED = [...SHARED, 'reason'].sort();
const PROTOCOL = 'phios.workspace-bridge.v1';
const PROJECT = /^project:[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function witnessInstallExpression() {
  return `(() => {
    window.__phiosBridgeWitness = [];
    window.addEventListener('message', event => {
      const packet = event.data;
      if (!packet || typeof packet !== 'object'
          || packet.protocol !== 'phios.workspace-bridge.v1') return;
      // A small bounded record of test-only packet metadata, never full
      // documents, manifest content or network credentials.
      const evidence = window.__phiosBridgeWitness;
      if (evidence.length >= 100) return;
      evidence.push({
        type: packet.type,
        origin: event.origin,
        senderBound: event.source === window.parent,
        keys: Object.keys(packet).sort(),
        sessionId: packet.session_id,
        requestId: packet.request_id ?? null,
        projectRef: packet.project_ref ?? null,
        executionAuthority: packet.execution_authority,
      });
    }, true);
    return true;
  })()`;
}

export function verifyWireObservations(observed, {
  expectedHostOrigin, expectedRefs, priorSessionId = null, requireDenied = 1,
}) {
  if (!Array.isArray(observed) || !Array.isArray(expectedRefs)
      || expectedRefs.length < 1 || observed.length > 100
      || !/^http:\/\/127\.0\.0\.1:\d+$/.test(expectedHostOrigin)) {
    throw new Error('Invalid rendered bridge witness input');
  }
  const contexts = [];
  const denied = [];
  let sessionId = null;
  for (const item of observed) {
    if (item === null || typeof item !== 'object'
        || item.origin !== expectedHostOrigin || item.senderBound !== true
        || item.executionAuthority !== false
        || typeof item.sessionId !== 'string' || !/^[a-f0-9-]{36}$/.test(item.sessionId)
        || (sessionId !== null && item.sessionId !== sessionId)) {
      throw new Error('Bridge wire source, session, or authority mismatch');
    }
    sessionId = item.sessionId;
    if (item.type === 'host.context') {
      if (denied.length === 0) {
        throw new Error('Bridge context arrived without an observed default denial');
      }
      if (JSON.stringify(item.keys) !== JSON.stringify(CONTEXT)
          || typeof item.requestId !== 'string' || !item.requestId
          || typeof item.projectRef !== 'string' || !PROJECT.test(item.projectRef)) {
        throw new Error('Bridge context transmitted unreviewed fields');
      }
      contexts.push(item.projectRef);
    } else if (item.type === 'host.denied') {
      if (JSON.stringify(item.keys) !== JSON.stringify(DENIED)
          || typeof item.requestId !== 'string' || !item.requestId
          || item.projectRef !== null) {
        throw new Error('Bridge denial leaked an identity or additional data');
      }
      denied.push(item);
    } else {
      throw new Error('Unexpected host-to-child message type in witness');
    }
  }
  if (observed.at(-1)?.type !== 'host.denied') {
    throw new Error('Bridge latest revoked or forgotten request was not denied');
  }
  if (sessionId === null || (priorSessionId !== null && priorSessionId === sessionId)
      || contexts.length !== expectedRefs.length
      || contexts.some((ref, i) => ref !== expectedRefs[i])
      || denied.length < requireDenied) {
    throw new Error('Browser handoff incomplete, unauthorised or replayed');
  }
  return Object.freeze({
    receivedContextCount: contexts.length,
    deniedCount: denied.length,
    sessionId,
    allContextsAreOpaqueRefs: true,
    executionAuthority: false,
  });
}
