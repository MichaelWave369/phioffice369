// Drive the installed browser on wall-clock time using Chrome's debugging pipe.
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { setTimeout as sleep } from 'node:timers/promises';

export async function openChromeSession(browser, profile) {
  const child = spawn(browser, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--disable-extensions', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-sync', '--remote-debugging-pipe',
    '--user-data-dir=' + profile, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  const pending = new Map();
  const decoder = new StringDecoder('utf8');
  let sequence = 0;
  let buffer = '';
  let diagnostics = '';
  let closed = false;

  function disconnect(error) {
    closed = true;
    for (const { reject } of pending.values()) reject(error);
  }
  child.once('error', disconnect);
  child.once('close', (code, signal) => disconnect(new Error(`Chrome closed (${code ?? signal}): ${diagnostics}`)));
  child.stdio[3].on('error', disconnect);
  child.stderr.on('data', (part) => { diagnostics = (diagnostics + part.toString()).slice(-2500); });
  child.stdio[4].on('data', (part) => {
    buffer += decoder.write(part);
    let delimiter;
    while ((delimiter = buffer.indexOf('\0')) !== -1) {
      const response = JSON.parse(buffer.slice(0, delimiter));
      buffer = buffer.slice(delimiter + 1);
      const request = pending.get(response.id);
      if (response.error) request?.reject(new Error(response.error.message));
      else request?.resolve(response.result);
    }
  });

  function send(method, params = {}, sessionId) {
    if (closed) return Promise.reject(new Error('Chrome is closed. ' + diagnostics));
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        finish();
        reject(new Error(`Chrome timed out during ${method}. ${diagnostics}`));
      }, 12000);
      function finish() {
        clearTimeout(timer);
        pending.delete(id);
      }
      pending.set(id, {
        resolve(value) { finish(); resolve(value); },
        reject(error) { finish(); reject(error); },
      });
      child.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
    });
  }

  const exited = new Promise((resolve) => child.once('close', resolve));
  async function close() {
    if (!closed) await Promise.race([send('Browser.close').catch(() => {}), sleep(1500)]);
    if (!closed) child.kill('SIGTERM');
    await Promise.race([exited, sleep(1500)]);
    if (!closed) child.kill('SIGKILL');
  }

  try {
    const { targetInfos } = await send('Target.getTargets');
    const { targetId } = targetInfos.find(({ type }) => type === 'page') ?? await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    return { call: (method, params) => send(method, params, sessionId), close, diagnostics: () => diagnostics };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function runChromeOnWallClock(browser, url, profile) {
  const session = await openChromeSession(browser, profile);
  try {
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
