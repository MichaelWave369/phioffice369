// Dependency-free browser acceptance runner for PhiOffice369's built Vite app.
// Requires a locally installed Chromium/Chrome, available on GitHub-hosted Ubuntu.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

const appRoot = resolve('apps/web/dist');
const indexFile = join(appRoot, 'index.html');
const acceptanceClient = resolve('scripts/browser-acceptance-client.js');
const base = '/phioffice369/';
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    const check = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (check.status === 0) return candidate;
  }
  throw new Error('Chrome/Chromium not installed; set CHROME_BIN to the browser executable.');
}

async function serve(request, response) {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (!url.pathname.startsWith(base)) {
      response.writeHead(404).end('Not found');
      return;
    }

    if (url.pathname === base + '__phi_acceptance_client.js') {
      response.writeHead(200, { 'content-type': mime['.js'], 'cache-control': 'no-store' });
      response.end(await readFile(acceptanceClient));
      return;
    }

    const relativePath = decodeURIComponent(url.pathname.slice(base.length)) || 'index.html';
    const target = resolve(appRoot, relativePath);
    if (!target.startsWith(appRoot + sep) && target !== indexFile) {
      response.writeHead(403).end('Access denied');
      return;
    }
    const info = await stat(target);
    if (!info.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    let bytes = await readFile(target);
    if (target === indexFile) {
      const html = bytes.toString('utf8');
      assert.ok(html.includes('</body>'), 'Built index missing closing body');
      bytes = Buffer.from(html.replace(
        '</body>',
        '<script type="module" src="' + base + '__phi_acceptance_client.js"></script></body>',
      ));
    }
    response.writeHead(200, {
      'content-type': mime[extname(target)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(bytes);
  } catch (error) {
    response.writeHead(404).end(error?.message ?? 'Not found');
  }
}

function runChrome(browser, url, profile) {
  return new Promise((resolveRun, rejectRun) => {
    const args = [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-sync',
      '--virtual-time-budget=20000',
      '--dump-dom',
      '--user-data-dir=' + profile,
      url,
    ];
    const child = spawn(browser, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let stderr = '';
    const maxOutput = 8_000_000;
    child.stdout.on('data', (part) => { output = (output + part.toString()).slice(-maxOutput); });
    child.stderr.on('data', (part) => { stderr = (stderr + part.toString()).slice(-10000); });
    const watchdog = setTimeout(() => {
      child.kill('SIGKILL');
      rejectRun(new Error('Headless Chrome timed out. ' + stderr.slice(-900)));
    }, 75000);
    child.once('error', (error) => {
      clearTimeout(watchdog);
      rejectRun(error);
    });
    child.once('close', (code) => {
      clearTimeout(watchdog);
      resolveRun({ code, output, stderr });
    });
  });
}

await stat(indexFile); // Fail before opening the browser if npm run build was skipped.
const browser = findChrome();
const profile = await mkdtemp(join(tmpdir(), 'phioffice369-browser-'));
const server = createServer((request, response) => {
  void serve(request, response);
});

try {
  await new Promise((resolveReady) => server.listen(0, '127.0.0.1', resolveReady));
  const address = server.address();
  const url = 'http://127.0.0.1:' + address.port + base;
  console.log('PhiOffice369 browser acceptance (disposable local profile) using: ' + browser);
  const result = await runChrome(browser, url, profile);
  const marker = result.output.match(/data-phi-acceptance="(PASS|FAIL)"/);
  const detail = result.output.match(/<pre id="phi-browser-acceptance-result">([\s\S]*?)<\/pre>/);
  if (result.code !== 0 || marker?.[1] !== 'PASS') {
    console.error('Browser acceptance did not pass:', detail?.[1] ?? 'no result marker');
    console.error('Browser diagnostics:', result.stderr.slice(-1600));
    throw new Error('PhiOffice369 browser acceptance failed (Chrome exit ' + result.code + ').');
  }
  console.log('PASS: PhiWrite edit, autosave, HTML export, print control, and reload restore.');
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
  await rm(profile, { recursive: true, force: true });
}
