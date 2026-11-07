// Drive an isolated browser on wall-clock time over a loopback DevTools connection.
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export async function openChromeSession(browser, profile) {
  const child = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--disable-extensions', '--disable-popup-blocking', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-sync',
    '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
    '--user-data-dir=' + profile, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const pending = new Map();
  let sequence = 0;
  let diagnostics = '';
  let failure;
  let socket;

  function disconnect(error) {
    failure ??= error;
    for (const { reject } of pending.values()) reject(failure);
  }
  child.once('error', disconnect);
  const exited = new Promise((resolve) => child.once('close', (code, signal) => {
    disconnect(new Error(`Chrome closed (${code ?? signal}): ${diagnostics}`));
    resolve();
  }));
  child.stderr.on('data', (part) => { diagnostics = (diagnostics + part.toString()).slice(-2500); });

  async function connect() {
    const endpoint = join(profile, 'DevToolsActivePort');
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (failure) throw failure;
      const text = await readFile(endpoint, 'utf8').catch((error) => {
        if (error.code !== 'ENOENT') throw error;
        return '';
      });
      const [port, path] = text.trim().split('\n');
      if (/^\d+$/.test(port) && /^\/devtools\/browser\/[a-f0-9-]+$/i.test(path)) {
        const url = `ws://127.0.0.1:${port}${path}`;
        socket = new WebSocket(url);
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Chrome DevTools connection timed out.')), 12000);
          socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
          socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Chrome DevTools connection failed.')); }, { once: true });
        });
        return;
      }
      await sleep(100);
    }
    throw new Error('Chrome did not publish its local DevTools endpoint. ' + diagnostics);
  }

  function send(method, params = {}, sessionId) {
    if (failure) return Promise.reject(failure);
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        finish();
        reject(new Error(`Chrome timed out during ${method}. ${diagnostics}`));
      }, 18000);
      function finish() {
        clearTimeout(timer);
        pending.delete(id);
      }
      pending.set(id, {
        resolve(value) { finish(); resolve(value); },
        reject(error) { finish(); reject(error); },
      });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  // Test-only hard termination. Unlike close(), this never sends Browser.close
  // or pagehide, so acknowledged commits must survive a genuinely unclean exit.
  async function forceKill() {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Chrome already exited.');
    if (!child.kill('SIGKILL')) throw new Error('Could not forcibly terminate Chrome.');
    await Promise.race([exited, sleep(7000)]);
    if (child.exitCode === null && child.signalCode === null) {
      throw new Error('Chrome did not exit after SIGKILL.');
    }
    if (socket?.readyState === WebSocket.OPEN) socket.close();
  }

  async function close() {
    if (!failure && socket?.readyState === WebSocket.OPEN) {
      await Promise.race([send('Browser.close').catch(() => {}), sleep(1200)]);
      socket.close();
    }
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await Promise.race([exited, sleep(1200)]);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }

  try {
    await connect();
    socket.addEventListener('close', () => disconnect(new Error('Chrome DevTools connection closed. ' + diagnostics)));
    socket.addEventListener('message', (event) => {
      const response = JSON.parse(event.data);
      const request = pending.get(response.id);
      if (response.error) request?.reject(new Error(response.error.message));
      else request?.resolve(response.result);
    });
    const { targetInfos } = await send('Target.getTargets');
    const { targetId } = targetInfos.find(({ type }) => type === 'page') ?? await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    return { call: (method, params) => send(method, params, sessionId), close, forceKill, diagnostics: () => diagnostics };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function runChromeOnWallClock(browser, url, profile, { mobile = false } = {}) {
  const session = await openChromeSession(browser, profile);
  try {
    if (mobile) await session.call('Emulation.setDeviceMetricsOverride', { mobile: true, width: 390, height: 844, deviceScaleFactor: 1 });
    const { errorText } = await session.call('Page.navigate', { url });
    if (errorText) throw new Error(errorText);
    const deadline = Date.now() + 50000;
    while (Date.now() < deadline) {
      try {
        const { result } = await session.call('Runtime.evaluate', {
          expression: "document.documentElement?.hasAttribute('data-phi-acceptance') ? document.documentElement.outerHTML : null",
          returnByValue: true,
        });
        if (result?.value) return { output: result.value, stderr: session.diagnostics() };
      } catch (error) {
        if (!/context|inspected target navigated/i.test(error.message)) throw error;
      }
      await sleep(70);
    }
    throw new Error('Browser scenario did not publish a result on wall-clock time. ' + session.diagnostics());
  } finally {
    await session.close();
  }
}
