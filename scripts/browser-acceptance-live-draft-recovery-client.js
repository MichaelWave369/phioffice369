// Browser acceptance: a blocked standard save must never prevent downloading
// the latest in-memory editor content in the ordinary PhiVault JSON format.
const key = 'phioffice369:phiwrite:file_emergency_live_draft';
const title = 'Live Recovery Fixture';
const originalBody = 'This is the version stored before the failure.';
const unsavedBody = 'Latest keystroke retained despite QUOTA: π 369.\nUnsent notes.';
function assert(ok, message) { if (!ok) throw Error(message); }
async function waitFor(check, label, attempts = 220) {
  for (let i = 0; i < attempts; i++) {
    const value = await check();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 45));
  }
  throw Error('Timed out: ' + label);
}
const button = label => [...document.querySelectorAll('button')]
  .find(node => !node.disabled && node.textContent.trim() === label);
async function click(label) { (await waitFor(() => button(label), label)).click(); }
function changeTextarea(field, value) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set;
  setter.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}
function publish(status, detail) {
  document.documentElement.dataset.phiAcceptance = status;
  const element = document.createElement('pre');
  element.id = 'phi-browser-acceptance-result';
  element.textContent = detail;
  document.body.prepend(element);
}
async function run() {
  await waitFor(() => document.querySelector('.tabs'), 'workspace');
  document.querySelector('[aria-label="Close onboarding"]')?.click();
  const existingRaw = JSON.stringify({
    title, templateId: 'file_emergency_live_draft',
    sourceTemplateId: 'file_emergency_live_draft', activeLabelId: 'private', content: originalBody,
  });
  localStorage.setItem(key, existingRaw);
  await click('Vault');
  const row = await waitFor(() => [...document.querySelectorAll('.artifact-row')]
    .find(item => item.querySelector('h3')?.textContent === title), 'source in PhiVault');
  row.click();
  await click('Open file');
  const editor = await waitFor(() => document.querySelector('.editor-field textarea'), 'PhiWrite textarea');
  assert(button('Download recovery JSON'), 'Live recovery button missing');

  const actualSetItem = Storage.prototype.setItem;
  let blockedWrites = 0;
  Storage.prototype.setItem = function (name, value) {
    if (name === key) {
      blockedWrites++;
      throw new DOMException('Simulated disk full', 'QuotaExceededError');
    }
    return actualSetItem.call(this, name, value);
  };
  const actualCreateUrl = URL.createObjectURL;
  const actualRevokeUrl = URL.revokeObjectURL;
  let exportedBlob = null;
  let createdUrl = null;
  let revokedUrl = null;
  URL.createObjectURL = (blob) => {
    exportedBlob = blob;
    createdUrl = actualCreateUrl.call(URL, blob);
    return createdUrl;
  };
  URL.revokeObjectURL = (value) => {
    revokedUrl = value;
    return actualRevokeUrl.call(URL, value);
  };
  try {
    changeTextarea(editor, unsavedBody);
    await click('Save file');
    await waitFor(() => document.querySelector('.save-status')?.textContent.includes('Local save failed'),
      'standard save failure surfaced');
    assert(blockedWrites > 0, 'The fixture failed to block actual persistence');
    assert(localStorage.getItem(key) === existingRaw, 'The failed save changed existing bytes');
    await click('Download recovery JSON');
    const blob = await waitFor(() => exportedBlob, 'download Blob');
    const payload = JSON.parse(await blob.text());
    assert(payload.schema === 'phioffice369.workspace_backup.v0.1', 'Not importable PhiVault schema');
    assert(payload.storageSnapshot.length === 1, 'Export leaked other workspace files');
    assert(payload.storageSnapshot[0][0] === key, 'Backup key differs from the editor source');
    const record = JSON.parse(payload.storageSnapshot[0][1]);
    assert(record.content === unsavedBody, 'Backup lost in-memory edits after quota failure');
    assert(record.content !== originalBody, 'Backup incorrectly used persisted old bytes');
    assert(revokedUrl === createdUrl, 'Temporary Blob URL was not cleaned up');
    assert(document.querySelector('.save-status')?.textContent.includes('This file is unencrypted'),
      'UI did not explain that recovery JSON is unencrypted');
    assert(localStorage.getItem(key) === existingRaw, 'Export itself modified standard storage');
    publish('PASS', 'Latest unsaved in-memory PhiWrite draft exported as a single-file PhiVault JSON recovery download'
      + ' after deliberately failed standard save, with intact source bytes and explicit unencrypted warning.');
  } finally {
    Storage.prototype.setItem = actualSetItem;
    URL.createObjectURL = actualCreateUrl;
    URL.revokeObjectURL = actualRevokeUrl;
  }
}
run().catch(error => publish('FAIL', error?.stack ?? String(error)));
