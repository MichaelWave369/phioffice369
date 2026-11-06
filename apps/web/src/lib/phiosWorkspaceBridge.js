/**
 * Opt-in, read-only PhiOS workspace-bridge client v1.
 * This module does not register listeners, launch embeds, fetch files, or
 * grant permissions. A future, reviewed PhiOffice UI must connect it.
 */
export const PHIOS_WORKSPACE_PROTOCOL = 'phios.workspace-bridge.v1';
export const MAX_BRIDGE_MESSAGE_BYTES = 2048;

const APP_ID = /^[a-z][a-z0-9._-]{0,63}$/;
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const PROJECT_REF = /^project:[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function object(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function exact(value, keys) {
  return Object.keys(value).length === keys.length
    && Object.keys(value).every((key) => keys.includes(key));
}
function exactOrigin(origin) {
  if (typeof origin !== 'string' || !origin || origin.length > 300) {
    throw new Error('Parent origin must be exact');
  }
  let url;
  try { url = new URL(origin); } catch { throw new Error('Invalid parent origin'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (origin !== url.origin || url.username || url.password
      || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
    throw new Error('Expected exact HTTPS or local loopback parent origin');
  }
  return origin;
}
function validPacket(value, allowedTypes) {
  if (!object(value) || value.protocol !== PHIOS_WORKSPACE_PROTOCOL
      || !allowedTypes.includes(value.type)
      || typeof value.app_id !== 'string' || !APP_ID.test(value.app_id)
      || typeof value.session_id !== 'string' || !SESSION_ID.test(value.session_id)
      || value.execution_authority !== false) {
    return false;
  }
  const fields = ['protocol', 'type', 'app_id', 'session_id', 'execution_authority'];
  if (value.type === 'host.ready') {
    fields.push('request_id', 'read_approved');
    if (typeof value.read_approved !== 'boolean') return false;
  }
  if (value.type === 'host.denied') {
    fields.push('request_id', 'reason');
    if (value.reason !== 'operator_approval_required') return false;
  }
  if (value.type === 'host.context') {
    fields.push('request_id', 'project_ref');
    if (typeof value.project_ref !== 'string' || !PROJECT_REF.test(value.project_ref)) return false;
  }
  if (value.type !== 'host.bootstrap'
      && (typeof value.request_id !== 'string' || !REQUEST_ID.test(value.request_id))) {
    return false;
  }
  if (!exact(value, fields)) return false;
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= MAX_BRIDGE_MESSAGE_BYTES;
  } catch {
    return false;
  }
}

/**
 * Use only with a separately verified embedding host and an operator-visible
 * connect flow. Never infer the parent's origin from arbitrary message data.
 */
export function createPhiOSWorkspaceBridgeClient({ appId = 'phioffice', parentOrigin, parentSource }) {
  if (!APP_ID.test(appId) || !object(parentSource)) throw new Error('Invalid PhiOS parent binding');
  const targetOrigin = exactOrigin(parentOrigin);
  let sessionId = null;
  let helloRequestId = null;
  let pendingRequestId = null;
  let ready = false;

  const packet = (type, requestId) => ({
    protocol: PHIOS_WORKSPACE_PROTOCOL, type, app_id: appId,
    session_id: sessionId, request_id: requestId,
  });

  return {
    handle(event) {
      if (!event || event.origin !== targetOrigin || event.source !== parentSource
          || !validPacket(event.data, [
            'host.bootstrap', 'host.ready', 'host.context', 'host.denied',
          ])) return null;
      const message = event.data;
      if (message.app_id !== appId) return null;
      if (message.type === 'host.bootstrap') {
        if (sessionId !== null) return null; // no silent session replacement
        sessionId = message.session_id;
        helloRequestId = globalThis.crypto.randomUUID();
        return { kind: 'outbound', targetOrigin, message: packet('app.hello', helloRequestId) };
      }
      if (message.session_id !== sessionId) return null;
      if (message.type === 'host.ready') {
        if (!helloRequestId || message.request_id !== helloRequestId) return null;
        helloRequestId = null;
        ready = true;
        return { kind: 'ready', readApproved: message.read_approved };
      }
      if (!ready || !pendingRequestId || message.request_id !== pendingRequestId) return null;
      pendingRequestId = null;
      if (message.type === 'host.denied') return { kind: 'denied' };
      if (message.type === 'host.context') {
        return { kind: 'project-ref', projectRef: message.project_ref };
      }
      return null;
    },
    requestProjectRef() {
      if (!ready || !sessionId || pendingRequestId) {
        throw new Error('Bridge not ready or request already pending');
      }
      pendingRequestId = globalThis.crypto.randomUUID();
      return { targetOrigin, message: packet('app.context.request', pendingRequestId) };
    },
    disconnect() {
      // Information previously received cannot be revoked; callers must treat
      // project refs as unprivileged identifiers, never as storage credentials.
      sessionId = null;
      helloRequestId = null;
      pendingRequestId = null;
      ready = false;
    },
  };
}
