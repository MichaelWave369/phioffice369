// Diagnostic only. Disposable same-profile Chrome sessions; no personal data.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { openChromeSession } from './chrome-session.mjs';

const browser = [process.env.CHROME_BIN, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
  .filter(Boolean).find(cmd => spawnSync(cmd, ['--version'], { encoding: 'utf8' }).status === 0);
assert.ok(browser, 'Chrome/Chromium is required.');
const version = spawnSync(browser, ['--version'], { encoding: 'utf8' }).stdout.trim();
const digest = raw => raw === null ? null : createHash('sha256').update(raw).digest('hex');
const trials = [
  { id: 'grace-now', mode: 'grace', ms: 0 },
  { id: 'grace-2s', mode: 'grace', ms: 2000 },
  { id: 'grace-5s', mode: 'grace', ms: 5000 },
  { id: 'kill-now', mode: 'kill', ms: 0 },
  { id: 'kill-2s', mode: 'kill', ms: 2000 },
  { id: 'kill-5s', mode: 'kill', ms: 5000 },
  { id: 'pagehide-kill', mode: 'pagehide-kill', ms: 2000 },
];

const child = spawn(process.execPath, ['--experimental-websocket', 'scripts/browser-acceptance.mjs'], {
  env: { ...process.env, PHI_BROWSER_MANUAL: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverClosed = false;
let stderr = '';
let output = '';
child.stderr.on('data', part => { stderr = (stderr + part).slice(-3000); });
const ready = new Promise((resolve, reject) => {
  let done = false;
  const timer = setTimeout(() => finish(Error('Fixture server timeout. ' + stderr)), 30000);
  function finish(error, value) {
    if (done) return;
    done = true;
    clearTimeout(timer);
    if (error) reject(error);
    else resolve(value);
  }
  child.stdout.on('data', part => {
    output = (output + part).slice(-4000);
    const match = output.match(/Manual browser acceptance URL: (http:\/\/127\.0\.0\.1:\d+\/phioffice369\/)/);
    if (match) finish(null, match[1]);
  });
  child.once('error', finish);
  child.once('close', code => {
    serverClosed = true;
    finish(Error('Fixture server stopped (' + code + '). ' + stderr));
  });
});

async function evalInPage(session, expression) {
  const response = await session.call('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (response.exceptionDetails) throw Error(response.exceptionDetails.text);
  return response.result?.value;
}
async function loadApp(session, url) {
  await session.call('Network.enable');
  await session.call('Network.setBypassServiceWorker', { bypass: true });
  const response = await session.call('Page.navigate', { url });
  if (response.errorText) throw Error(response.errorText);
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const result = await evalInPage(session,
        "({origin:location.origin,ready:Boolean(document.querySelector('.tabs'))})");
      if (result?.ready) return result.origin;
    } catch (error) {
      if (!/context|navigated|Execution context was destroyed/i.test(error.message)) throw error;
    }
    await sleep(75);
  }
  throw Error('Test app did not load.');
}

const rows = [];
let graceLost = false;
try {
  const url = await ready;
  for (const trial of trials) {
    const profile = await mkdtemp(join(tmpdir(), 'phi-l54-' + trial.id + '-'));
    const key = 'phioffice369:phiwrite:file_issue54_' + trial.id.replaceAll('-', '_');
    const controlKey = '__phi_issue54_control_' + trial.id;
    const raw = JSON.stringify({
      title: 'Synthetic ' + trial.id,
      templateId: key.split(':').at(-1),
      content: 'Data persisted? ' + trial.id,
      activeLabelId: 'private',
    });
    let first = null;
    let second = null;
    try {
      first = await openChromeSession(browser, profile);
      const beforeOrigin = await loadApp(first, url);
      const expression = '(() => {localStorage.setItem(' + JSON.stringify(key) + ',' + JSON.stringify(raw)
        + ');localStorage.setItem(' + JSON.stringify(controlKey) + ',' + JSON.stringify('control:' + trial.id)
        + ');return {file:localStorage.getItem(' + JSON.stringify(key) + '),'
        + 'control:localStorage.getItem(' + JSON.stringify(controlKey) + ')}})()';
      const written = await evalInPage(first, expression);
      assert.equal(written.file, raw, 'Immediate readback failed');
      assert.equal(written.control, 'control:' + trial.id, 'Control readback failed');
      if (trial.ms) await sleep(trial.ms);
      if (trial.mode === 'pagehide-kill') {
        await first.call('Page.navigate', { url: 'about:blank' });
        await sleep(500);
      }
      if (trial.mode === 'grace') await first.close();
      else await first.forceKill();
      first = null;
      await rm(join(profile, 'DevToolsActivePort'), { force: true });
      second = await openChromeSession(browser, profile);
      const afterOrigin = await loadApp(second, url);
      assert.equal(afterOrigin, beforeOrigin, 'Browser restart used a different origin');
      const seen = await evalInPage(second, '({file:localStorage.getItem('
        + JSON.stringify(key) + '),control:localStorage.getItem(' + JSON.stringify(controlKey) + ')})');
      const row = {
        trial: trial.id, mode: trial.mode, delayMs: trial.ms, origin: afterOrigin,
        rawBeforeSha256: digest(raw), rawAfterSha256: digest(seen.file),
        filePersisted: seen.file === raw, controlPersisted: seen.control === 'control:' + trial.id,
      };
      rows.push(row);
      if (trial.mode === 'grace' && (!row.filePersisted || !row.controlPersisted)) graceLost = true;
      console.log((row.filePersisted && row.controlPersisted ? 'PERSISTED' : 'OBSERVED LOSS') + ': '
        + trial.id + ', saved file=' + row.filePersisted + ', control=' + row.controlPersisted
        + ', origin=' + row.origin);
    } finally {
      await first?.close().catch(() => {});
      await second?.close().catch(() => {});
      await rm(profile, { recursive: true, force: true });
    }
  }
  console.log('LOCALSTORAGE_DURABILITY_PROBE=' + JSON.stringify({
    schema: 'phioffice369.localstorage_durability_probe.v1',
    browserVersion: version, rows, gracefulBaselineLoss: graceLost,
    verdict: 'Diagnostic only; successful test execution does not certify localStorage durability',
  }));
  if (graceLost) console.warn('UNRESOLVED: Graceful-close baseline did not preserve data. Investigate profile and browser flushing.');
} finally {
  if (!serverClosed) {
    child.kill('SIGINT');
    await Promise.race([once(child, 'close').catch(() => {}), sleep(1800)]);
    if (!serverClosed) child.kill('SIGKILL');
  }
}
