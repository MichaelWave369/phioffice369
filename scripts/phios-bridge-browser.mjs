import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transformWithEsbuild } from 'vite';
import { runChromeOnWallClock } from './chrome-session.mjs';

const fixture = new URL('./fixtures/phios-bridge/', import.meta.url);
const upstream = await readFile(new URL('workspaceBridge.ts', fixture));
const gitBlob = createHash('sha1').update(`blob ${upstream.length}\0`).update(upstream).digest('hex');
assert.equal(gitBlob, 'b5568d78819fde42121bb17de433c0c2b519e3f0', 'Pinned PhiOS host source differs from PR #396');
const { code: hostSource } = await transformWithEsbuild(upstream.toString('utf8'), 'workspaceBridge.ts', { loader: 'ts', format: 'esm' });
const clientSource = await readFile(new URL('../apps/web/src/lib/phiosWorkspaceBridge.js', import.meta.url));

const browser = [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser']
  .filter(Boolean).find((candidate) => spawnSync(candidate, ['--version']).status === 0);
assert.ok(browser, 'Chrome/Chromium is required. Set CHROME_BIN to its executable.');

const config = {};
const scripts = new Map(await Promise.all(['host', 'client', 'rogue'].map(async (name) =>
  ['/' + name + '.js', await readFile(new URL(name + '.js', fixture))])));
scripts.set('/upstream-host.js', hostSource);
scripts.set('/office-client.js', clientSource);
const servers = ['hostOrigin', 'childOrigin', 'attackerOrigin'].map((key) => [key, createServer((req, res) => {
  const path = req.url;
  const script = scripts.get(path);
  if (script) {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }).end(script);
    return;
  }
  const page = path === '/' && key === 'hostOrigin' ? 'host'
    : path === '/client' && key === 'childOrigin' ? 'client' : path === '/rogue' ? 'rogue' : null;
  if (!page) { res.writeHead(404).end(); return; }
  const controls = page === 'host' ? '<button id="approve">Approve fixture project</button><button id="revoke">Revoke</button>' : '';
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(
    `<!doctype html><meta charset="utf-8"><title>PhiOS bridge acceptance</title><body>${controls}
    <script type="application/json" id="fixture-config">${JSON.stringify(config)}</script>
    <script type="module" src="/${page}.js"></script></body>`,
  );
})]);

const profile = await mkdtemp(join(tmpdir(), 'phioffice-phios-bridge-'));
try {
  for (const [key, server] of servers) {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    config[key] = 'http://127.0.0.1:' + server.address().port;
  }
  const { output } = await runChromeOnWallClock(browser, config.hostOrigin + '/', profile);
  const verdict = output.match(/data-phi-acceptance="(PASS|FAIL)"/)?.[1];
  const detail = output.match(/<pre id="phi-browser-acceptance-result">([\s\S]*?)<\/pre>/)?.[1];
  assert.equal(verdict, 'PASS', detail ?? 'PhiOS bridge fixture returned no result');
  console.log('PASS: PhiOS workspace bridge acceptance. ' + detail);
} finally {
  await Promise.all(servers.map(([, server]) => new Promise((resolve) => server.close(resolve))));
  await rm(profile, { recursive: true, force: true });
}
