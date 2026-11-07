// Real compiled PhiOS + PhiOffice369 browser UI acceptance (two loopback origins).
// Requires CI to check out pinned PhiOS under .interop/phios, and Chrome/Chromium.
// Never connects to live services, real projects, PhiID, or PhiCloud.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { openChromeSession } from './chrome-session.mjs';
import { verifyReviewedHostCheckout, REVIEWED_PHIOS_HOST_SHA } from './phios-reviewed-host-pin.mjs';
import { witnessInstallExpression, verifyWireObservations } from './phios-bridge-wire-evidence.mjs';
import { qualifyR9BrowserRegistry } from './phios-r9-rendered-registry-acceptance.mjs';

const officeDir = resolve('.');
const phiShellDir = resolve('.interop/phios/phishell');
const officeDist = resolve(officeDir, 'apps/web/dist');
const hostDist = resolve(phiShellDir, 'dist');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function staticServer(root, base) {
  return createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
      if (!pathname.startsWith(base)) {
        response.writeHead(404).end('Unknown path');
        return;
      }
      const relative = decodeURIComponent(pathname.slice(base.length)) || 'index.html';
      const target = resolve(root, relative);
      if (target !== join(root, 'index.html') && !target.startsWith(root + sep)) {
        response.writeHead(403).end('Outside distribution');
        return;
      }
      const info = await stat(target);
      if (!info.isFile()) throw new Error('Not a file');
      const bytes = await readFile(target);
      response.writeHead(200, {
        'content-type': mime[extname(target)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      }).end(bytes);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
}

function findBrowser() {
  for (const candidate of [
    process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser',
  ].filter(Boolean)) {
    if (spawnSync(candidate, ['--version'], { encoding: 'utf8' }).status === 0) {
      return candidate;
    }
  }
  throw new Error('Chrome/Chromium required for rendered PhiOS integration acceptance');
}

function buildApp(dir, env) {
  const build = spawnSync('npm', ['run', 'build'], {
    cwd: dir, env: { ...process.env, ...env },
    encoding: 'utf8', timeout: 180000, maxBuffer: 20 * 1024 * 1024,
  });
  assert.equal(build.status, 0, 'Build failed in ' + dir + ':\n'
    + (build.stdout || '').slice(-2200) + '\n' + (build.stderr || '').slice(-2200));
}

function childFrameId(frameTree, url) {
  if (frameTree.frame?.url?.startsWith(url)) return frameTree.frame.id;
  for (const item of frameTree.childFrames ?? []) {
    const match = childFrameId(item, url);
    if (match) return match;
  }
  return null;
}

async function waitFor(label, predicate, timeout = 25000) {
  const stop = Date.now() + timeout;
  let lastError = '';
  while (Date.now() < stop) {
    try {
      const result = await predicate();
      if (result) return result;
    } catch (error) {
      lastError = error.message;
    }
    await sleep(120);
  }
  throw new Error('Timeout waiting for ' + label + ': ' + lastError);
}

function clickExpression(rootSelector, name) {
  return '(() => { const root = document.querySelector(' + JSON.stringify(rootSelector)
    + '); const button = Array.from(root?.querySelectorAll("button") ?? [])'
    + '.find(b => b.textContent?.trim() === ' + JSON.stringify(name)
    + '); if (!button || button.disabled) return "unavailable"; button.click(); return "clicked"; })()';
}

function selectManifestExpression(projectId, title) {
  const manifest = {
    schema: 'phioffice369.project_manifest.v0.1',
    projectId, title,
    description: 'private test-only description; MUST NOT CROSS BRIDGE',
    owner: 'private-user@local.invalid',
    tags: ['private-secret-tag'],
    artifacts: [{ path: '/sensitive/test/document.docx', title: 'secret local file' }],
    createdAt: '2026-11-06T00:00:00Z',
    updatedAt: '2026-11-06T00:00:00Z',
  };
  const contents = JSON.stringify(manifest);
  return '(() => {'
    + 'const input = document.querySelector('
    + JSON.stringify('input[aria-label="Choose local PhiOffice project manifest"]') + ');'
    + 'if (!input) return false;'
    + 'const file = new File([' + JSON.stringify(contents)
    + '], "selected-project.json", { type: "application/json" });'
    + 'const transfer = new DataTransfer(); transfer.items.add(file);'
    + 'input.files = transfer.files;'
    + 'input.dispatchEvent(new Event("change", { bubbles: true }));'
    + 'return true;'
    + '})()';
}

function importReferenceBundleExpression(entries, extraFields = {}) {
  const bundle = {
    format: 'phios.project-references',
    version: 1,
    entries,
    ...extraFields,
  };
  const contents = JSON.stringify(bundle);
  return '(() => {'
    + 'const input = document.querySelector('
    + JSON.stringify('input[aria-label="Import project reference bundle"]') + ');'
    + 'if (!input) return false;'
    + 'const file = new File([' + JSON.stringify(contents)
    + '], "phios-project-references-v1.json", { type: "application/json" });'
    + 'const transfer = new DataTransfer(); transfer.items.add(file);'
    + 'input.files = transfer.files;'
    + 'input.dispatchEvent(new Event("change", { bubbles: true }));'
    + 'return true;'
    + '})()';
}

// Fail before building either app if the independently checked-out PhiOS
// source differs from the reviewed, *merged* PhiOS #406 commit.
const reviewedHostCommit = verifyReviewedHostCheckout(resolve('.interop/phios'));
const chrome = findBrowser();
const hostServer = staticServer(hostDist, '/');
const officeServer = staticServer(officeDist, '/phioffice369/');
const profile = await mkdtemp(join(tmpdir(), 'phios-office-ui-'));
let browserSession;

try {
  await Promise.all([hostServer, officeServer].map((server) => new Promise((ok) =>
    server.listen(0, '127.0.0.1', ok))));
  const hostOrigin = 'http://127.0.0.1:' + hostServer.address().port;
  const officeOrigin = 'http://127.0.0.1:' + officeServer.address().port;

  // The two independently compiled applications use explicit, exact origins.
  buildApp(phiShellDir, {
    VITE_PHIOS_OFFICE_BRIDGE_URL: officeOrigin + '/phioffice369/',
    VITE_PHIOS_OFFICE_BRIDGE_APPROVED_ORIGIN: officeOrigin,
  });
  buildApp(officeDir, { VITE_PHIOS_PARENT_ORIGIN: hostOrigin });
  await Promise.all([stat(join(hostDist, 'index.html')),
    stat(join(officeDist, 'index.html'))]);

  browserSession = await openChromeSession(chrome, profile);
  const call = browserSession.call;
  await call('Page.enable');
  await call('Runtime.enable');

  async function evaluate(expression, contextId) {
    const response = await call('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
      ...(contextId ? { contextId } : {}),
    });
    if (response.exceptionDetails) {
      throw new Error('Browser expression failed: ' + JSON.stringify(response.exceptionDetails).slice(0, 450));
    }
    return response.result?.value;
  }

  await call('Page.navigate', { url: hostOrigin + '/' });
  await waitFor('rendered PhiOS desktop', () =>
    evaluate('Boolean(document.querySelector(".start-button"))'));

  const opened = await evaluate("(() => { const b = document.querySelector('[aria-label^=Builder]');"
    + " if (!b) return false; b.click(); return true; })()");
  assert.equal(opened, true, 'PhiShell Builder tile must open an actual Build Field window');

  await waitFor('PhiOffice pilot panel in Build Field', () =>
    evaluate('Boolean(document.querySelector(".phios-bridge-pilot"))'));
  assert.equal(await evaluate(clickExpression('.phios-bridge-pilot', 'Start opt-in pilot')),
    'clicked', 'An explicit operator start must be required');
  const adapterText = await waitFor('reviewed project adapter catalog', () =>
    evaluate('document.querySelector(".phios-project-adapter-catalog")?.textContent || ""'));
  assert.ok(adapterText.includes('PhiOffice project manifest v0.1'),
    'The reviewed PhiOffice adapter must appear in the actual host UI');
  assert.ok(adapterText.includes('No file authority'),
    'Reviewed adapter display must not imply access to documents');
  assert.ok(adapterText.includes('PhiID and PhiCloud do not have reviewed project adapters yet'),
    'Unimplemented integrations must be clearly labeled as absent');
  assert.equal(await evaluate(
    'Array.from(document.querySelectorAll(".phios-project-adapter-catalog p"))'
      + '.filter(p => p.textContent.includes("reviewed-browser-pilot")).length'), 1,
    'Only one verified adapter is admitted in the catalog');

  const frameId = await waitFor('separately loaded PhiOffice frame', async () => {
    const tree = await call('Page.getFrameTree');
    return childFrameId(tree.frameTree, officeOrigin + '/phioffice369/');
  });
  let { executionContextId: childContext } = await call('Page.createIsolatedWorld', {
    frameId, worldName: 'PhiOSOfficeBridgeAcceptance',
  });

  const clientText = () => evaluate(
    'document.querySelector(".phioffice-phios-bridge")?.textContent || ""', childContext,
  );
  await waitFor('visible PhiOffice bridge client', async () =>
    (await clientText()).includes('Request project reference'));
  await waitFor('origin-bound PhiOffice handshake', async () =>
    (await clientText()).includes('Connected; project access is not yet approved'), 12000)
    .catch(async (error) => {
      const childStatus = await clientText().catch(() => 'unavailable');
      const hostStatus = await evaluate(
        'document.querySelector(".phios-bridge-pilot [role=status]")?.textContent || ""',
      ).catch(() => 'unavailable');
      throw new Error(error.message + '; child=' + childStatus.slice(0, 300)
        + '; host=' + hostStatus.slice(0, 300));
    });
  assert.equal(await evaluate(witnessInstallExpression(), childContext), true,
    'A fresh child context must install the bounded wire observer before context requests');

  assert.equal(await evaluate(clickExpression('.phioffice-phios-bridge',
    'Request project reference'), childContext), 'clicked');
  await waitFor('denied unapproved project request', async () =>
    (await clientText()).includes('Project request denied; operator approval required'));
  assert.ok(!(await clientText()).includes('project:qa-browser-case'),
    'No project ID may appear before approval');
  assert.equal(await evaluate(clickExpression('.phios-bridge-pilot',
    'Approve selected project ref')), 'unavailable',
    'Operator cannot approve without choosing a manifest');

  assert.equal(await evaluate(selectManifestExpression('qa-browser-case', 'Browser QA Project')),
    true, 'Operator-selected manifest must be read from local File input');
  await waitFor('locally displayed manifest header', async () => {
    const text = await evaluate('document.querySelector(".phios-bridge-project-picker")?.textContent || ""');
    return text.includes('Browser QA Project') && text.includes('project:qa-browser-case');
  });
  const hostText = await evaluate('document.querySelector(".phios-bridge-pilot")?.textContent || ""');
  for (const secret of ['private-user@local.invalid', 'private-secret-tag',
    '/sensitive/test/document.docx', 'secret local file']) {
    assert.ok(!hostText.includes(secret), 'Private manifest fields must not appear in host panel');
  }

  assert.equal(await evaluate('localStorage.getItem("phios.project-registry.v1")'), null,
    'Selecting a manifest must not save metadata automatically');
  assert.equal(await evaluate(clickExpression('.phios-bridge-local-registry',
    'Remember this project on device')), 'clicked',
    'Remembering project metadata requires a separate operator click');
  const registryJSON = await waitFor('explicit local saved reference', () =>
    evaluate('localStorage.getItem("phios.project-registry.v1")'));
  const registry = JSON.parse(registryJSON);
  assert.deepEqual(Object.keys(registry), ['format', 'version', 'entries']);
  assert.deepEqual(registry.entries, [{
    projectRef: 'project:qa-browser-case',
    title: 'Browser QA Project',
    source: 'phioffice369.project_manifest.v0.1',
  }], 'Only ID, local title and source may be remembered');
  for (const secret of ['private-user@local.invalid', 'private-secret-tag',
    '/sensitive/test/document.docx', 'secret local file',
    'execution_authority', 'read_approved', 'credentials']) {
    assert.ok(!registryJSON.includes(secret), 'Private fields and grants must never persist');
  }

  // Portable bundle import is separate from identity selection and approval.
  const imported = {
    projectRef: 'project:imported-01',
    title: 'Imported QA Label',
    source: 'phioffice369.project_manifest.v0.1',
  };
  const conflicting = {
    projectRef: 'project:qa-browser-case',
    title: 'Untrusted overwrite of local title',
    source: 'phioffice369.project_manifest.v0.1',
  };
  const beforePortableImport = await evaluate('localStorage.getItem("phios.project-registry.v1")');
  assert.equal(await evaluate(importReferenceBundleExpression([imported], { grant: true })),
    true, 'A local bundle file may be offered for validation');
  await waitFor('untrusted portable bundle rejected', () =>
    evaluate('document.querySelector(".phios-bridge-local-registry [role=status]")?.textContent?.includes("Unsupported project reference bundle format or version")'));
  assert.equal(await evaluate('localStorage.getItem("phios.project-registry.v1")'),
    beforePortableImport, 'An invalid bundle must never change local data');

  const fakeProvider = {
    projectRef: 'project:forged-provider',
    title: 'Forged PhiCloud Claim',
    source: 'phicloud.project_manifest.v1',
  };
  assert.equal(await evaluate(importReferenceBundleExpression([fakeProvider])), true,
    'An unreviewed provider must be tested through the real file picker');
  await waitFor('unreviewed source rejected by adapter catalog', () =>
    evaluate('document.querySelector(".phios-bridge-local-registry [role=status]")'
      + '?.textContent?.includes("Unreviewed project identity source")'));
  assert.equal(await evaluate('localStorage.getItem("phios.project-registry.v1")'),
    beforePortableImport,
    'An unreviewed provider must never be admitted or persisted');

  assert.equal(await evaluate(importReferenceBundleExpression([conflicting, imported])),
    true, 'A valid offline bundle can be inspected locally');
  await waitFor('non-destructive import preview', () =>
    evaluate('document.querySelector(".phios-bridge-import-preview")?.textContent?.includes("1 new")'));
  assert.equal(await evaluate('localStorage.getItem("phios.project-registry.v1")'),
    beforePortableImport, 'Preview must not persist anything');
  assert.equal(await evaluate(clickExpression('.phios-bridge-import-preview',
    'Confirm reference import')), 'clicked', 'Only an explicit second click may commit import');
  const afterPortableImport = await waitFor('new reference stored after explicit import', async () => {
    const value = await evaluate('localStorage.getItem("phios.project-registry.v1")');
    return value?.includes('project:imported-01') ? value : null;
  });
  const importedRegistry = JSON.parse(afterPortableImport);
  assert.deepEqual(importedRegistry.entries, [
    registry.entries[0], imported,
  ], 'Local metadata wins on conflict; only new references are appended');
  assert.ok(!afterPortableImport.includes('grant'), 'Import must never persist authority fields');

  // R9 lives on the merged PhiOS host, not in PhiOffice. Exercise the
  // actual two-step, operator-confirmed V2 copy/rollback UI before any
  // project-ref approval is given to the iframe. Only test data are used.
  const r9Evidence = await qualifyR9BrowserRegistry({
    evaluate, waitFor, clientText, hostOrigin,
    clickClientRequest: () => evaluate(clickExpression(
      '.phioffice-phios-bridge', 'Request project reference'), childContext),
  });
  assert.equal(r9Evidence.hostOriginIsLoopback, true);
  console.log('PASS: actual PhiOS R9 V2 copy/rollback in compiled Chrome, with V1 preserved');
  console.log('PHIOS_R9_BROWSER_COPY_ROLLBACK:' + JSON.stringify({
    ...r9Evidence, hostCommit: reviewedHostCommit,
  }));

  assert.equal(await evaluate(clickExpression('.phios-bridge-pilot',
    'Approve selected project ref')), 'clicked',
    'Import never grants context; the selected project still requires approval');
  assert.equal(await evaluate(clickExpression('.phioffice-phios-bridge',
    'Request project reference'), childContext), 'clicked');
  await waitFor('approved selected project reference', async () =>
    (await clientText()).includes('Received project ID: project:qa-browser-case'));
  for (const secret of ['Browser QA Project', 'private-user@local.invalid',
    'private-secret-tag', '/sensitive/test/document.docx', 'secret local file']) {
    assert.ok(!(await clientText()).includes(secret),
      'Only an opaque project ref may reach the embedded app');
  }

  assert.equal(await evaluate(selectManifestExpression('second-project', 'Second Project')),
    true, 'Changing the selection must clear the old approval');
  await waitFor('second selection visible locally', async () =>
    (await evaluate('document.querySelector(".phios-bridge-project-picker")?.textContent || ""'))
      .includes('project:second-project'));
  assert.equal(await evaluate(clickExpression('.phioffice-phios-bridge',
    'Request project reference'), childContext), 'clicked');
  await waitFor('denied until second project is reapproved', async () =>
    (await clientText()).includes('Project request denied; operator approval required'));
  assert.ok(!(await clientText()).includes('project:qa-browser-case'),
    'Rejected request must not show stale prior project as current');
  assert.equal(await evaluate(clickExpression('.phios-bridge-pilot',
    'Approve selected project ref')), 'clicked');
  assert.equal(await evaluate(clickExpression('.phioffice-phios-bridge',
    'Request project reference'), childContext), 'clicked');
  await waitFor('second approved project ID', async () =>
    (await clientText()).includes('Received project ID: project:second-project'));

  assert.equal(await evaluate(clickExpression('.phios-bridge-pilot', 'Revoke')),
    'clicked');
  assert.equal(await evaluate(clickExpression('.phioffice-phios-bridge',
    'Request project reference'), childContext), 'clicked');
  await waitFor('revocation enforced on subsequent request', async () =>
    (await clientText()).includes('Project request denied; operator approval required'));
  assert.ok(!(await clientText()).includes('project:second-project'),
    'Revocation result clears stale project display in PhiOffice');
  const firstWire = verifyWireObservations(
    await evaluate('window.__phiosBridgeWitness', childContext), {
      expectedHostOrigin: hostOrigin,
      expectedRefs: ['project:qa-browser-case', 'project:second-project'],
      requireDenied: 3,
    },
  );

  assert.equal(await evaluate(clickExpression('.phios-bridge-pilot', 'Disconnect')),
    'clicked');
  await waitFor('iframe detached by host disconnect', () =>
    evaluate('!document.querySelector(".phios-bridge-pilot iframe")'));

  // A remembered project survives a disconnect, but its approval MUST NOT.
  assert.equal(await evaluate(clickExpression('.phios-bridge-pilot', 'Start opt-in pilot')),
    'clicked', 'Reconnecting is always an explicit operator action');
  const nextFrameId = await waitFor('newly loaded PhiOffice frame after reconnect', async () => {
    const tree = await call('Page.getFrameTree');
    return childFrameId(tree.frameTree, officeOrigin + '/phioffice369/');
  });
  ({ executionContextId: childContext } = await call('Page.createIsolatedWorld', {
    frameId: nextFrameId, worldName: 'PhiOSOfficeRegistryReconnect',
  }));
  await waitFor('fresh child connection without saved authority', async () =>
    (await clientText()).includes('Connected; project access is not yet approved'));
  assert.equal(await evaluate(witnessInstallExpression(), childContext), true,
    'Reconnect must install a new, isolated wire observer');

  const savedPickExpression = '(() => {'
    + 'const sel = document.querySelector('
    + JSON.stringify('select[aria-label="Saved project references"]') + ');'
    + 'if (!sel) return false;'
    + 'sel.value = "project:qa-browser-case";'
    + 'sel.dispatchEvent(new Event("change", { bubbles: true }));'
    + 'return sel.value === "project:qa-browser-case";'
    + '})()';
  assert.equal(await evaluate(savedPickExpression), true,
    'Only explicitly remembered project metadata is available after reconnect');
  assert.equal(await evaluate(clickExpression('.phios-bridge-pilot',
    'Approve selected project ref')), 'unavailable',
    'A remembered ID must never restore previous sharing approval');
  await waitFor('remembered project action enabled', () =>
    evaluate('(() => { const b = Array.from(document.querySelectorAll(".phios-bridge-local-registry button"))'
      + '.find(button => button.textContent?.trim() === "Use remembered project");'
      + 'return Boolean(b && !b.disabled); })()'));
  assert.equal(await evaluate(clickExpression('.phios-bridge-local-registry',
    'Use remembered project')), 'clicked');
  await waitFor('remembered project shown locally', async () =>
    (await evaluate('document.querySelector(".phios-bridge-project-picker > p.muted")?.textContent || ""'))
      .includes('project:qa-browser-case'));
  assert.equal(await evaluate(clickExpression('.phioffice-phios-bridge',
    'Request project reference'), childContext), 'clicked');
  await waitFor('remembered reference denied until reapproved', async () =>
    (await clientText()).includes('Project request denied; operator approval required'));
  assert.equal(await evaluate(clickExpression('.phios-bridge-pilot',
    'Approve selected project ref')), 'clicked');
  assert.equal(await evaluate(clickExpression('.phioffice-phios-bridge',
    'Request project reference'), childContext), 'clicked');
  await waitFor('remembered reference consented again', async () =>
    (await clientText()).includes('Received project ID: project:qa-browser-case'));

  assert.equal(await evaluate(clickExpression('.phios-bridge-local-registry',
    'Forget saved project')), 'clicked');
  const forgottenJSON = await evaluate('localStorage.getItem("phios.project-registry.v1")');
  assert.deepEqual(JSON.parse(forgottenJSON).entries, [imported],
    'Operator Forget removes only the chosen entry, preserving separately imported metadata');
  assert.equal(await evaluate(clickExpression('.phioffice-phios-bridge',
    'Request project reference'), childContext), 'clicked');
  await waitFor('forget revokes future reads', async () =>
    (await clientText()).includes('Project request denied; operator approval required'));
  assert.ok(!(await clientText()).includes('project:qa-browser-case'),
    'Forget must revoke future reads and clear stale client display');
  const secondWire = verifyWireObservations(
    await evaluate('window.__phiosBridgeWitness', childContext), {
      expectedHostOrigin: hostOrigin,
      expectedRefs: ['project:qa-browser-case'],
      priorSessionId: firstWire.sessionId,
      requireDenied: 2,
    },
  );
  assert.equal(firstWire.executionAuthority, false);
  assert.equal(secondWire.executionAuthority, false);

  await call('Page.navigate', { url: officeOrigin + '/phioffice369/' });
  await waitFor('standalone PhiOffice suite available', () =>
    evaluate('Boolean(document.querySelector(".workspace-brandbar"))'));
  assert.equal(await evaluate('document.querySelector(".phioffice-phios-bridge") === null'),
    true, 'The bridge UI must not activate for standalone PhiOffice');

  console.log('PASS: compiled PhiOS + PhiOffice real Chrome UI bridge acceptance');
  console.log('PASS: reviewed adapter catalog, forged-source denial, portable import, fresh consent, standalone');
  assert.equal(reviewedHostCommit, REVIEWED_PHIOS_HOST_SHA);
  console.log('PASS: merged PhiOS #406 host pin, actual postMessage field allowlist, default denial and new-session identity');
  // Structured *test-only* evidence. This summarizes the rendered Chrome run,
  // not a production app install, publisher signature, or durable user grant.
  console.log('PHIOS_R7_BROWSER_HANDOFF:' + JSON.stringify({
    schema: 'phios.browser_phi_office_handoff_r7.v0.1',
    scope: 'disposable_two_origin_chromium_qa',
    hostCommit: reviewedHostCommit,
    defaultDenied: firstWire.deniedCount >= 1,
    opaqueRefReplies: firstWire.receivedContextCount + secondWire.receivedContextCount,
    revokedAndForgottenRequestsDenied: firstWire.deniedCount >= 3 && secondWire.deniedCount >= 2,
    uniqueSessionAfterReconnect: firstWire.sessionId !== secondWire.sessionId,
    standalonePhiOfficeUnaffected: true,
    nativeAppInstalled: false,
    publisherIdentityAuthenticated: false,
    executionAuthority: false,
  }));
} finally {
  await browserSession?.close();
  await Promise.all([hostServer, officeServer].map((server) =>
    new Promise((done) => server.close(done))));
  await rm(profile, { recursive: true, force: true });
}
