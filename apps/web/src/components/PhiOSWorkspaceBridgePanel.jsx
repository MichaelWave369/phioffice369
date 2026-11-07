import { useEffect, useRef, useState } from 'react';
import { createPhiOSWorkspaceBridgeClient } from '../lib/phiosWorkspaceBridge.js';
import './PhiOSWorkspaceBridgePanel.css';

/**
 * Invisible in ordinary standalone PhiOffice builds.
 * Never activates unless the operator explicitly sets VITE_PHIOS_PARENT_ORIGIN
 * at build/dev time AND PhiOffice is actually embedded by a separate origin.
 */
export default function PhiOSWorkspaceBridgePanel() {
  const parentOrigin = import.meta.env.VITE_PHIOS_PARENT_ORIGIN;
  const isEmbedded = globalThis.parent !== globalThis;
  const isConfigured = Boolean(parentOrigin) && isEmbedded;
  const clientRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [status, setStatus] = useState('Awaiting an authenticated PhiOS handshake');
  const [projectRef, setProjectRef] = useState(null);

  useEffect(() => {
    if (!isConfigured || parentOrigin === globalThis.location.origin) return;
    let client;
    try {
      client = createPhiOSWorkspaceBridgeClient({
        appId: 'phioffice',
        parentOrigin,
        parentSource: globalThis.parent,
      });
    } catch {
      setStatus('PhiOS pilot disabled: invalid expected parent origin');
      return;
    }
    clientRef.current = client;
    const handleMessage = (event) => {
      const response = client.handle(event);
      if (!response) return;
      if (response.kind === 'outbound') {
        globalThis.parent.postMessage(response.message, response.targetOrigin);
        setStatus('PhiOS host identity received; confirming handshake');
      } else if (response.kind === 'ready') {
        setReady(true);
        setStatus(response.readApproved
          ? 'Connected; operator permits a synthetic project reference'
          : 'Connected; project access is not yet approved');
      } else if (response.kind === 'denied') {
        // A revoked reference is never a credential; clear stale display state.
        setProjectRef(null);
        setStatus('Project request denied; operator approval required in PhiOS');
      } else if (response.kind === 'project-ref') {
        setProjectRef(response.projectRef);
        setStatus('Received an opaque, non-authorizing project reference');
      }
    };
    globalThis.addEventListener('message', handleMessage);
    return () => {
      globalThis.removeEventListener('message', handleMessage);
      client.disconnect();
      clientRef.current = null;
    };
  }, [isConfigured, parentOrigin]);

  if (!isConfigured || parentOrigin === globalThis.location.origin) return null;

  const requestProject = () => {
    try {
      const outbound = clientRef.current?.requestProjectRef();
      if (!outbound) return;
      globalThis.parent.postMessage(outbound.message, outbound.targetOrigin);
      setStatus('Requested project reference; waiting for host decision');
    } catch {
      setStatus('Cannot request: session not ready or a request is pending');
    }
  };

  const disconnect = () => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setReady(false);
    setProjectRef(null);
    setDisconnected(true);
    setStatus('Disconnected locally. Close the PhiOS iframe to end host session.');
  };

  return (
    <aside className="phioffice-phios-bridge" aria-label="PhiOS project reference pilot">
      <strong>Φ PhiOS workspace bridge</strong>
      <small>Experimental · read-only · no document transfer</small>
      <p role="status">{status}</p>
      {projectRef && <p>Received project ID: <code>{projectRef}</code> (not access to its files)</p>}
      <div className="phioffice-phios-bridge-actions">
        <button type="button" onClick={requestProject} disabled={!ready || disconnected}>
          Request project reference
        </button>
        <button type="button" onClick={disconnect} disabled={disconnected}>
          Disconnect
        </button>
      </div>
    </aside>
  );
}
