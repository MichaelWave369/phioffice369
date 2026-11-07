// R9 browser-only qualification of PhiOS V1 -> V2 metadata copy and rollback.
// This operates on an isolated Chrome profile with synthetic project IDs.
// It never accesses actual users' project files, tokens, accounts or devices.
import assert from 'node:assert/strict';

const V1 = 'phios.project-registry.v1';
const V2 = 'phios.project-registry.v2';
const ROOT = '.phios-bridge-qualified-preview';
const REF = 'project:qa-browser-case';

function clickExpression(label) {
  return '(() => { const root = document.querySelector(' + JSON.stringify(ROOT)
    + '); const button = Array.from(root?.querySelectorAll("button") ?? [])'
    + '.find(b => b.textContent?.trim() === ' + JSON.stringify(label)
    + '); if (!button || button.disabled) return "unavailable";'
    + ' button.click(); return "clicked"; })()';
}

async function readStorage(evaluate, key) {
  return evaluate('localStorage.getItem(' + JSON.stringify(key) + ')');
}

async function writeStorage(evaluate, key, value) {
  return evaluate('(() => { localStorage.setItem(' + JSON.stringify(key)
    + ', ' + JSON.stringify(value) + '); return true; })()');
}

async function click(evaluate, label) {
  assert.equal(await evaluate(clickExpression(label)), 'clicked',
    'R9 rendered action missing or disabled: ' + label);
}

async function confirmMode(evaluate, value) {
  return evaluate('(() => { window.__r9ConfirmationCount = 0;'
    + ' window.confirm = () => { window.__r9ConfirmationCount++;'
    + ' return ' + JSON.stringify(value) + '; }; return true; })()');
}

export async function qualifyR9BrowserRegistry({
  evaluate, waitFor, clientText, clickClientRequest, receivedDenials, hostOrigin,
}) {
  const initialV1 = await readStorage(evaluate, V1);
  assert.ok(initialV1, 'R9 requires already stored, reviewed V1 fixture');
  assert.equal(await readStorage(evaluate, V2), null,
    'R9 must not create V2 on startup or V1 import');
  const originalConfirmInstalled = await evaluate(
    '(() => { window.__r9OriginalConfirm = window.confirm; return true; })()');
  assert.equal(originalConfirmInstalled, true);

  try {
    await click(evaluate, 'Preview provider-qualified project IDs');
    await waitFor('R9 V2 review-only preview', () => evaluate(
      'document.querySelector(".phios-bridge-qualified-results")?.textContent'
      + '?.includes("2 project references")'));
    assert.equal(await readStorage(evaluate, V2), null,
      'R9 preview MUST NOT persist any V2 bytes');
    assert.ok((await evaluate('document.querySelector('
      + JSON.stringify(ROOT) + ')?.textContent || ""')).includes('phioffice / ' + REF),
    'Actual Chrome UI must show provider-qualified identity');

    // A dialog dismissal may never write anything.
    await confirmMode(evaluate, false);
    await click(evaluate, 'Create V2 metadata copy (keep V1)');
    assert.equal(await readStorage(evaluate, V2), null, 'Cancelled copy wrote V2');
    assert.equal(await readStorage(evaluate, V1), initialV1, 'Cancelled copy changed V1');
    assert.equal(await evaluate('window.__r9ConfirmationCount'), 1,
      'R9 must actually ask for user confirmation');

    // Source drift between preview and approved commit must refuse stale writes.
    const mutatedV1 = JSON.stringify({
      ...JSON.parse(initialV1),
      entries: JSON.parse(initialV1).entries.map((entry, index) =>
        index === 0 ? { ...entry, title: 'Changed during review' } : entry),
    });
    await writeStorage(evaluate, V1, mutatedV1);
    await confirmMode(evaluate, true);
    await click(evaluate, 'Create V2 metadata copy (keep V1)');
    await waitFor('R9 stale source rejection', () => evaluate(
      'document.querySelector(' + JSON.stringify(ROOT)
      + ')?.textContent?.includes("changed since preview")'));
    assert.equal(await readStorage(evaluate, V2), null,
      'Stale source MUST NOT produce a partial V2 record');
    assert.equal(await readStorage(evaluate, V1), mutatedV1,
      'Rejected stale copy must preserve the altered source');

    // Restore the purely synthetic fixture, then renew the preview.
    await writeStorage(evaluate, V1, initialV1);
    await click(evaluate, 'Preview provider-qualified project IDs');
    await waitFor('R9 renewed mapping preview', () => evaluate(
      'document.querySelector(".phios-bridge-qualified-results")?.textContent'
      + '?.includes("2 project references")'));
    await confirmMode(evaluate, true);
    await click(evaluate, 'Create V2 metadata copy (keep V1)');
    const copiedRaw = await waitFor('explicit R9 V2 storage copy', async () =>
      readStorage(evaluate, V2));
    const copied = JSON.parse(copiedRaw);
    assert.deepEqual(Object.keys(copied), ['format', 'version', 'entries']);
    assert.equal(copied.format, 'phios.project-registry');
    assert.equal(copied.version, 2);
    assert.equal(copied.entries.length, 2);
    assert.deepEqual(copied.entries, JSON.parse(initialV1).entries.map((entry) => ({
      providerAppId: 'phioffice', ...entry,
    })), 'V2 may only store reviewed provider-qualified metadata');
    for (const entry of copied.entries) {
      assert.deepEqual(Object.keys(entry), [
        'providerAppId', 'projectRef', 'title', 'source',
      ]);
    }
    for (const forbidden of ['private-user@local.invalid', 'secret local file',
      '/sensitive/test/document.docx', 'grant', 'execution_authority', 'read_approved']) {
      assert.ok(!copiedRaw.includes(forbidden), 'R9 V2 leaked data: ' + forbidden);
    }
    assert.equal(await readStorage(evaluate, V1), initialV1,
      'V1 MUST remain byte-identical after V2 copy');
    assert.equal(await evaluate('window.__r9ConfirmationCount'), 1,
      'R9 copy must require one user confirmation');

    // V2 is metadata, not an app grant. Observe a NEW real postMessage
    // denial, rather than accepting possibly stale text from a prior denial.
    const deniedBeforeCopyRequest = await receivedDenials();
    assert.equal(await clickClientRequest(), 'clicked');
    await waitFor('R9 V2 copy cannot grant child read', async () =>
      (await receivedDenials()) > deniedBeforeCopyRequest
      && (await clientText()).includes('Project request denied; operator approval required'));
    assert.ok(!(await clientText()).includes('Received project ID: ' + REF),
      'R9 copy MUST NOT grant the embedded app project access');

    await click(evaluate, 'Preview provider-qualified project IDs');
    await waitFor('occupied V2 blocks a second copy', () => evaluate(
      'document.querySelector(' + JSON.stringify(ROOT)
      + ')?.textContent?.includes("already exists; refusing overwrite")'));
    assert.equal(await readStorage(evaluate, V2), copiedRaw);

    // Rollback review displays the exact bytes and requires a NEW confirmation.
    await click(evaluate, 'Inspect existing V2 copy');
    await waitFor('R9 validated V2 rollback review', () => evaluate(
      'document.querySelector(".phios-bridge-qualified-results")?.textContent'
      + '?.includes("Existing V2 copy: 2 reviewed references")'));

    await confirmMode(evaluate, false);
    await click(evaluate, 'Remove reviewed V2 copy (keep V1)');
    assert.equal(await readStorage(evaluate, V2), copiedRaw, 'Cancelled rollback deleted V2');
    assert.equal(await evaluate('window.__r9ConfirmationCount'), 1,
      'R9 rollback must request user confirmation');

    // Protect against a change in V1 AFTER rollback review.
    await writeStorage(evaluate, V1, mutatedV1);
    await confirmMode(evaluate, true);
    await click(evaluate, 'Remove reviewed V2 copy (keep V1)');
    await waitFor('R9 stale rollback refusal', () => evaluate(
      'document.querySelector(' + JSON.stringify(ROOT)
      + ')?.textContent?.includes("differ")'));
    assert.equal(await readStorage(evaluate, V2), copiedRaw,
      'Changed V1 must prevent V2 deletion');
    await writeStorage(evaluate, V1, initialV1);

    // Reinspect, confirm and verify absence of V2 with intact V1.
    await click(evaluate, 'Inspect existing V2 copy');
    await waitFor('R9 rollback re-reviewed', () => evaluate(
      'document.querySelector(".phios-bridge-qualified-results")?.textContent'
      + '?.includes("Existing V2 copy: 2 reviewed references")'));
    await confirmMode(evaluate, true);
    await click(evaluate, 'Remove reviewed V2 copy (keep V1)');
    await waitFor('verified V2 copy removal', async () =>
      (await readStorage(evaluate, V2)) === null);
    assert.equal(await readStorage(evaluate, V1), initialV1,
      'Rollback MUST preserve the original V1 bytes');

    return Object.freeze({
      schema: 'phios.r9_provider_qualified_browser_copy_rollback.v0.1',
      scope: 'disposable_two_origin_chromium_qa',
      hostOriginIsLoopback: /^http:\/\/127\.0\.0\.1:\d+$/.test(hostOrigin),
      provider: 'phioffice',
      copiedRefs: copied.entries.length,
      previewOnlyWrites: 0,
      canceledCopyRefused: true,
      changedSourceCopyRefused: true,
      staleRollbackRefused: true,
      canceledRollbackRefused: true,
      v1Preserved: true,
      v2Removed: true,
      newAppAuthority: false,
      nativeInstalled: false,
      externallyDurableBackupVerified: false,
    });
  } finally {
    await evaluate('(() => { if (window.__r9OriginalConfirm) {'
      + ' window.confirm = window.__r9OriginalConfirm;'
      + ' delete window.__r9OriginalConfirm; }'
      + ' delete window.__r9ConfirmationCount; return true; })()');
  }
}
