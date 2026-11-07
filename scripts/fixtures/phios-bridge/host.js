import { createWorkspaceBridgeHost, generateBridgeSessionId, WORKSPACE_BRIDGE_PROTOCOL } from '/upstream-host.js';

const { childOrigin, attackerOrigin, hostOrigin } = JSON.parse(document.getElementById('fixture-config').textContent);
const project = 'project:sprint-2-fixture';
const observations = [];
const packets = [];
let child;
let host;
let holdContext = false;
let heldReply;

function assert(condition, message) { if (!condition) throw new Error(message); }
async function waitFor(check, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 35));
  }
  throw new Error('Timed out: ' + label);
}
function command(frame, origin, name, packet) {
  frame.contentWindow.postMessage({ fixture: 'command', command: name, packet }, origin);
}
const commandChild = (name, packet) => command(child, childOrigin, name, packet);
const send = ({ message, targetOrigin }) => child.contentWindow.postMessage(message, targetOrigin);

window.addEventListener('message', (event) => {
  const boundSource = event.source === child?.contentWindow;
  if (event.data?.fixture === 'observation' && boundSource && event.origin === childOrigin) observations.push(event.data);
  if (event.data?.protocol !== WORKSPACE_BRIDGE_PROTOCOL) return;
  const reply = host?.handle(event);
  packets.push({ boundSource, origin: event.origin, packet: event.data, reply });
  if (reply && holdContext && event.data.type === 'app.context.request') heldReply = reply;
  else if (reply) send(reply);
});
document.getElementById('approve').addEventListener('click', () => host.approveProject(project));
document.getElementById('revoke').addEventListener('click', () => host.revokeProject());

async function nextObservation(kind, since = observations.length) {
  return waitFor(() => observations.slice(since).find((item) => item.kind === kind), kind);
}

async function navigate(frame, url) {
  const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  frame.src = url;
  if (!frame.isConnected) document.body.append(frame);
  await loaded;
}

async function request(kind) {
  const pending = nextObservation('result');
  commandChild('request');
  const { result } = await pending;
  assert(result.kind === kind, 'Expected ' + kind + ', got ' + result.kind);
  return result;
}

async function bootstrap() {
  const sessionId = generateBridgeSessionId();
  host = createWorkspaceBridgeHost({ appId: 'phioffice', appOrigin: childOrigin, frameSource: child.contentWindow, sessionId });
  const pending = nextObservation('result');
  send(host.bootstrap());
  const { result } = await pending;
  assert(result.kind === 'ready' && result.readApproved === false, 'Handshake leaked project approval');
  return sessionId;
}

function publish(status, message) {
  document.documentElement.dataset.phiAcceptance = status;
  const result = document.createElement('pre');
  result.id = 'phi-browser-acceptance-result';
  result.textContent = message;
  document.body.prepend(result);
}

async function run() {
  child = document.createElement('iframe');
  await navigate(child, childOrigin + '/client');
  let pending = nextObservation('not-ready');
  commandChild('request');
  await pending;
  const sessionId = await bootstrap();
  const hello = packets.find(({ packet }) => packet.type === 'app.hello');
  assert(hello?.packet.session_id === sessionId && hello.reply?.message.request_id === hello.packet.request_id, 'Hello was not correlated');
  assert(!Object.hasOwn(hello.reply.message, 'project_ref'), 'Readiness included a project reference');

  await request('denied');
  document.getElementById('approve').click();
  holdContext = true;
  commandChild('request');
  const approved = await waitFor(() => heldReply, 'held project response');
  assert(approved.message.project_ref === project && approved.message.execution_authority === false, 'Invalid approved response');

  for (const patch of [{ session_id: generateBridgeSessionId() }, { request_id: 'forged-request' }, { execution_authority: true }]) {
    pending = nextObservation('rejected');
    send({ ...approved, message: { ...approved.message, ...patch } });
    assert((await pending).senderIsParent, 'Wrong-session/request/authority packet did not come from bound parent');
  }
  const wrongParent = document.createElement('iframe');
  await navigate(wrongParent, hostOrigin + '/rogue');
  pending = nextObservation('rejected');
  command(wrongParent, hostOrigin, 'spoof-client', approved.message);
  const rejected = await pending;
  assert(rejected.senderOrigin === hostOrigin && !rejected.senderIsParent, 'Client did not reject same-origin sibling');

  const attacker = document.createElement('iframe');
  await navigate(attacker, attackerOrigin + '/rogue');
  pending = nextObservation('rejected');
  command(attacker, attackerOrigin, 'spoof-client', approved.message);
  assert((await pending).senderOrigin === attackerOrigin, 'Client did not reject a foreign-origin sender');

  pending = nextObservation('result');
  send(approved);
  const context = (await pending).result;
  assert(context.kind === 'project-ref' && context.projectRef === project, 'Forged responses consumed the legitimate request');
  holdContext = false;

  const spoof = {
    protocol: WORKSPACE_BRIDGE_PROTOCOL, type: 'app.context.request', app_id: 'phioffice',
    session_id: sessionId, request_id: 'rogue-host-request',
  };
  const wrongChild = document.createElement('iframe');
  await navigate(wrongChild, childOrigin + '/rogue');
  command(wrongChild, childOrigin, 'spoof-host', spoof);
  let forged = await waitFor(() => packets.find(({ packet }) => packet.request_id === spoof.request_id), 'wrong child source');
  assert(forged.origin === childOrigin && !forged.boundSource && !forged.reply, 'Host accepted a same-origin sibling');

  commandChild('spoof', { ...spoof, session_id: generateBridgeSessionId(), request_id: 'wrong-app-session' });
  forged = await waitFor(() => packets.find(({ packet }) => packet.request_id === 'wrong-app-session'), 'wrong child session');
  assert(forged.boundSource && !forged.reply, 'Host accepted a forged session from the registered frame');

  commandChild('spoof', { ...spoof, project_data: 'invalid extra field', request_id: 'extra-app-field' });
  forged = await waitFor(() => packets.find(({ packet }) => packet.request_id === 'extra-app-field'), 'malformed child packet');
  assert(forged.boundSource && !forged.reply, 'Host accepted unexpected project data');

  document.getElementById('revoke').click();
  await request('denied');
  holdContext = true;
  heldReply = null;
  commandChild('request');
  const pendingReply = await waitFor(() => heldReply, 'pending response before disconnect');
  holdContext = false;
  pending = nextObservation('disconnected');
  commandChild('disconnect');
  await pending;
  pending = nextObservation('not-ready');
  commandChild('request');
  await pending;
  pending = nextObservation('rejected');
  send(pendingReply);
  await pending;

  await navigate(child, attackerOrigin + '/rogue');
  command(child, attackerOrigin, 'spoof-host', { ...spoof, request_id: 'navigated-frame' });
  forged = await waitFor(() => packets.find(({ packet }) => packet.request_id === 'navigated-frame'), 'wrong child origin');
  assert(forged.boundSource && forged.origin === attackerOrigin && !forged.reply, 'Host accepted its frame after foreign navigation');

  await navigate(child, childOrigin + '/client');
  const newSession = await bootstrap();
  assert(newSession !== sessionId, 'Reconnection reused its session');
  commandChild('spoof', { ...spoof, request_id: 'disconnected-session-replay' });
  forged = await waitFor(() => packets.find(({ packet }) => packet.request_id === 'disconnected-session-replay'), 'disconnected session replay');
  assert(!forged.reply, 'Reconnected host accepted the old session');
  await request('denied');
  child.remove();
  host = null;
  publish('PASS', 'Pinned PhiOS host and PhiOffice client verified over postMessage across real loopback origins. Consent, revocation, disconnect, forged source/origin/session, and reply correlation passed.');
}
run().catch((error) => publish('FAIL', error.stack));
