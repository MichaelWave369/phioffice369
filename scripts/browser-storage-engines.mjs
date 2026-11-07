// Runs the existing disposable-profile storage stress fixture in independent
// Firefox and WebKit engines. Playwright is installed only in the optional
// qualification CI job; ordinary npm ci/build and Chromium checks stay lean.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { runPortableBackupQualification } from './browser-portable-backup.mjs';

const allowed = new Set(['firefox', 'webkit']);
const engines = process.argv.slice(2).length ? process.argv.slice(2) : ['firefox', 'webkit'];
for (const engine of engines) assert(allowed.has(engine), 'Unsupported browser engine: ' + engine);

let playwright;
try {
  playwright = await import('playwright');
} catch {
  throw new Error('Install the pinned optional Playwright dependency before running the engine matrix.');
}

const child = spawn(process.execPath, ['--experimental-websocket', 'scripts/browser-acceptance.mjs'], {
  env: { ...process.env, PHI_BROWSER_MANUAL: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
let diagnostics = '';
let serverClosed = false;
child.stderr.setEncoding('utf8');
child.stderr.on('data', (part) => { diagnostics = (diagnostics + part).slice(-4000); });

const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Local fixture server did not start. ' + diagnostics)), 30000);
  const done = (error, value) => {
    clearTimeout(timer);
    if (error) reject(error);
    else resolve(value);
  };
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (part) => {
    output = (output + part).slice(-4000);
    const match = output.match(/Manual browser acceptance URL: (http:\/\/127\.0\.0\.1:\d+\/phioffice369\/\?scenario=stress)/);
    if (match) done(null, match[1]);
  });
  child.once('error', (error) => done(error));
  child.once('close', (code) => {
    serverClosed = true;
    done(new Error('Local fixture server exited early (' + code + '). ' + diagnostics));
  });
});

try {
  const url = await ready;
  console.log('Synthetic data-only fixture: ' + url);
  for (const engine of engines) {
    let browser;
    let context;
    const pageErrors = [];
    try {
      browser = await playwright[engine].launch({ headless: true });
      context = await browser.newContext({ acceptDownloads: true });
      const page = await context.newPage();
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('crash', () => pageErrors.push('Page crashed'));
      console.log('Running ' + engine + ' ' + browser.version() + ' storage recovery qualification');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(
        () => ['PASS', 'FAIL'].includes(document.documentElement.dataset.phiAcceptance),
        undefined, { polling: 200, timeout: 120000 },
      );
      const status = await page.locator('html').getAttribute('data-phi-acceptance');
      const details = await page.locator('#phi-browser-acceptance-result').innerText();
      assert.equal(status, 'PASS', engine + ' fixture failure: ' + details);
      console.log('PASS ' + engine + ' ' + browser.version() + ': ' + details);
      await context.close();
      context = await browser.newContext({ acceptDownloads: true });
      const recoveryPage = await context.newPage();
      await recoveryPage.goto(url.replace('?scenario=stress', '?scenario=backup-idb'), {
        waitUntil: 'domcontentloaded', timeout: 30000,
      });
      await recoveryPage.waitForFunction(
        () => ['PASS', 'FAIL'].includes(document.documentElement.dataset.phiAcceptance),
        undefined, { polling: 200, timeout: 120000 },
      );
      const recoveryStatus = await recoveryPage.locator('html').getAttribute('data-phi-acceptance');
      const recoveryDetail = await recoveryPage.locator('#phi-browser-acceptance-result').innerText();
      assert.equal(recoveryStatus, 'PASS', engine + ' recovery under quota: ' + recoveryDetail);
      console.log('PASS ' + engine + ' IndexedDB-only backup restore: ' + recoveryDetail);
      await context.close();
      context = null;
      await browser.close();
      browser = null;
      await runPortableBackupQualification(playwright[engine], url, engine);
    } catch (error) {
      throw new Error(engine + ' did not qualify: ' + error.message
        + (pageErrors.length ? '\nBrowser errors:\n' + pageErrors.join('\n') : ''));
    } finally {
      await context?.close().catch(() => {});
      await browser?.close().catch(() => {});
    }
  }
} finally {
  if (!serverClosed) {
    // SIGINT triggers the fixture server's clean shutdown handler.
    child.kill('SIGINT');
    await Promise.race([
      once(child, 'close').catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
    if (!serverClosed) child.kill('SIGKILL');
  }
}
