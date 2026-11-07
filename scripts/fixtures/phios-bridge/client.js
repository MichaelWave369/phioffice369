import { createPhiOSWorkspaceBridgeClient, PHIOS_WORKSPACE_PROTOCOL } from '/office-client.js';

const { hostOrigin } = JSON.parse(document.getElementById('fixture-config').textContent);
const client = createPhiOSWorkspaceBridgeClient({ parentOrigin: hostOrigin, parentSource: parent });
const report = (kind, details = {}) => parent.postMessage({ fixture: 'observation', kind, ...details }, hostOrigin);
const send = ({ message, targetOrigin }) => parent.postMessage(message, targetOrigin);

window.addEventListener('message', (event) => {
  if (event.data?.protocol === PHIOS_WORKSPACE_PROTOCOL) {
    const result = client.handle(event);
    if (result?.kind === 'outbound') send(result);
    else if (result) report('result', { result });
    else report('rejected', { senderOrigin: event.origin, senderIsParent: event.source === parent });
    return;
  }
  if (event.origin !== hostOrigin || event.source !== parent || event.data?.fixture !== 'command') return;
  switch (event.data.command) {
    case 'request':
      try { send(client.requestProjectRef()); } catch { report('not-ready'); }
      break;
    case 'disconnect':
      client.disconnect();
      report('disconnected');
      break;
    case 'spoof':
      parent.postMessage(event.data.packet, hostOrigin);
      break;
  }
});
