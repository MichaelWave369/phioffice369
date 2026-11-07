// Crash durability qualification against the actual compiled PhiOffice UI.
// Destructive only to a temporary localhost browser profile created here.
// Requires Chromium/Chrome and Node's WebSocket support.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { openChromeSession } from './chrome-session.mjs';

const browser = [process.env.CHROME_BIN, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
  .filter(Boolean)
  .find(executable => spawnSync(executable, ['--version'], { encoding: 'utf8' }).status === 0);
assert.ok(browser, 'Chromium/Chrome is required for the hard-kill qualification. Set CHROME_BIN.');

const profile = await mkdtemp(join(tmpdir(), 'phi-crash-qualification-'));
const server = spawn(process.execPath, ['--experimental-websocket', 'scripts/browser-acceptance.mjs'], {
  env: { ...process.env, PHI_BROWSER_MANUAL: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverExited = false;
let serverStderr = '';
let output = '';
server.stderr.on('data', part => { serverStderr = (serverStderr + part.toString()).slice(-2500); });

const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error('Fixture server startup timed out: ' + serverStderr)), 30000);
  const finish = (error, value) => {
    clearTimeout(timer);
    if (error) reject(error);
    else resolve(value);
  };
  server.stdout.on('data', part => {
    output = (output + part.toString()).slice(-4000);
    const url = output.match(/Manual browser acceptance URL: (http:\/\/127\.0\.0\.1:\d+\/phioffice369\/)/);
    if (url) finish(null, url[1]);
  });
  server.once('error', finish);
  server.once('close', code => {
    serverExited = true;
    finish(Error('Fixture server exited before startup: ' + code + '\n' + serverStderr));
  });
});

async function waitForStatus(session, desired, seconds = 100) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    try {
      const response = await session.call('Runtime.evaluate', {
        expression: "({status: document.documentElement?.dataset.phiAcceptance || '', detail: document.getElementById('phi-browser-acceptance-result')?.textContent || ''})",
        returnByValue: true,
      });
      const data = response.result?.value;
      if (data?.status === 'FAIL') throw Error('Browser fixture failed: ' + data.detail);
      if (data?.status === desired) return data.detail;
    } catch (error) {
      if (!/context|inspected target navigated|Execution context was destroyed/i.test(error.message)) throw error;
    }
    await sleep(80);
  }
  throw Error('Browser did not publish ' + desired + '. Chrome diagnostics: ' + session.diagnostics());
}

async function navigate(session, url) {
  await session.call('Network.enable');
  await session.call('Network.setBypassServiceWorker', { bypass: true });
  const result = await session.call('Page.navigate', { url });
  if (result.errorText) throw Error(result.errorText);
}

let preparation = null;
let first = null;
let second = null;
try {
  const base = await ready;
  preparation = await openChromeSession(browser, profile);
  await navigate(preparation, base + '?scenario=crash&phase=prepare');
  const checkpoint = await waitForStatus(preparation, 'PREPARED');
  console.log('LEGACY CHECKPOINT: ' + checkpoint);
  await preparation.close();
  preparation = null;
  await rm(join(profile, 'DevToolsActivePort'), { force: true });
  first = await openChromeSession(browser, profile);
  await navigate(first, base + '?scenario=crash&phase=seed');
  const prepared = await waitForStatus(first, 'READY');
  console.log('ACKNOWLEDGED BEFORE CRASH: ' + prepared);
  await first.forceKill();
  first = null;
  // A killed Chromium may leave its remote-debugging endpoint file behind.
  await rm(join(profile, 'DevToolsActivePort'), { force: true });
  second = await openChromeSession(browser, profile);
  await navigate(second, base + '?scenario=crash&phase=verify');
  const verified = await waitForStatus(second, 'PASS');
  console.log('PASS: Hard Chromium SIGKILL + restart. ' + verified);
} finally {
  await preparation?.close().catch(() => {});
  await first?.close().catch(() => {});
  await second?.close().catch(() => {});
  if (!serverExited) {
    server.kill('SIGINT');
    await Promise.race([once(server, 'close').catch(() => {}), sleep(1800)]);
    if (!serverExited) server.kill('SIGKILL');
  }
  await rm(profile, { recursive: true, force: true });
}
