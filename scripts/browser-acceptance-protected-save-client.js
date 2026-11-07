// Dedicated production browser acceptance: opt-in protected copy from editor.
// Uses synthetic data and a disposable localhost profile.
const key = 'phioffice369:phiwrite:file_protected_editor';
const title = 'Protected save fixture';
const firstBody = 'A specifically protected original draft.\nπ 369';
const protectedBody = 'A saved, verified one-time checkpoint.\n3-6-9';
const newerBody = 'Later edits remain on the original only.\n';
function assert(ok, message) { if (!ok) throw Error(message); }
async function waitFor(check, label, tries = 180) {
  for (let i = 0; i < tries; i += 1) {
    const result = check();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw Error('Timed out waiting for ' + label);
}
const button = text => [...document.querySelectorAll('button')]
  .find(node => !node.disabled && node.textContent.trim() === text);
async function click(text) { (await waitFor(() => button(text), text)).click(); }
function edit(field, text) {
  assert(field, 'Editor textarea missing');
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set.call(field, text);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}
async function readTransactionalRows() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('phioffice369-editor-revisions', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const request = tx.objectStore('files').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
function emit(status, detail) {
  document.documentElement.dataset.phiAcceptance = status;
  const element = document.createElement('pre');
  element.id = 'phi-browser-acceptance-result';
  element.textContent = detail;
  document.body.prepend(element);
}
async function run() {
  await waitFor(() => document.querySelector('.tabs'), 'app launcher');
  document.querySelector('[aria-label="Close onboarding"]')?.click();
  const original = JSON.stringify({
    title, content: firstBody, templateId: 'file_protected_editor',
    sourceTemplateId: 'protected_fixture', activeLabelId: 'private',
  });
  localStorage.setItem(key, original);
  await click('Vault');
  const row = await waitFor(() => [...document.querySelectorAll('.artifact-row')]
    .find(item => item.querySelector('h3')?.textContent === title), 'fixture source in Vault');
  row.click();
  await click('Open file');
  const editor = await waitFor(() => document.querySelector('.editor-field textarea'), 'PhiWrite editor');
  assert(button('Save protected copy'), 'Standard editor does not offer one-time protected copy');
  edit(editor, protectedBody);
  await click('Save file');
  await waitFor(() => document.querySelector('.save-status')?.textContent.includes('Saved locally'), 'standard save');
  const before = localStorage.getItem(key);
  assert(JSON.parse(before).content === protectedBody, 'Standard save was incomplete');

  await click('Save protected copy');
  await waitFor(() => document.querySelector('.save-status')?.textContent.includes('Verified one-time IndexedDB copy'), 'verified protected copy');
  assert(document.querySelector('.save-status').textContent.includes('NOT protected automatically'), 'Protection scope not explained');
  const copies = (await readTransactionalRows()).filter(row => row.key.startsWith('phioffice369:phiwrite:file_tx_'));
  assert(copies.length === 1, 'Exactly one explicitly requested copy expected');
  const recovered = JSON.parse(copies[0].raw);
  assert(copies[0].revision === 1, 'Protected copy revision should start at 1');
  assert(recovered.content === protectedBody && recovered.copiedFrom === key, 'Protected copy lost content or lineage');
  assert(localStorage.getItem(key) === before, 'Protected copy changed source raw bytes');
  assert(localStorage.getItem(copies[0].key) === null, 'Protected copy accidentally used standard storage');

  edit(editor, newerBody);
  await click('Save file');
  await waitFor(() => document.querySelector('.save-status')?.textContent.includes('Saved locally'), 'later standard save');
  assert(JSON.parse(localStorage.getItem(key)).content === newerBody, 'Later editor update lost');
  const protectedAgain = await readTransactionalRows();
  assert(protectedAgain.length === 1 && protectedAgain[0].raw === copies[0].raw,
    'A later standard edit unexpectedly modified the one-time protected checkpoint');

  const competingSource = JSON.stringify({ ...JSON.parse(localStorage.getItem(key)),
    content: 'Another tab modified this source before we made a protected copy.' });
  localStorage.setItem(key, competingSource);
  await click('Save protected copy');
  await waitFor(() => document.querySelector('.save-status')?.textContent.includes('changed in another tab'),
    'stale editor copy blocked');
  assert((await readTransactionalRows()).length === 1, 'Stale editor created a misleading new checkpoint');
  assert(localStorage.getItem(key) === competingSource, 'Stale protected-copy action overwrote another tab');

  await click('Back to PhiOffice');
  await click('Vault');
  const protectedRow = await waitFor(() => [...document.querySelectorAll('.artifact-row')]
    .find(item => item.querySelector('h3')?.textContent === title + ' (IndexedDB copy)'), 'protected Vault copy');
  protectedRow.click();
  await click('Open file');
  const reopened = await waitFor(() => document.querySelector('.editor-field textarea'), 'reopened protected editor');
  assert(reopened.value === protectedBody, 'Protected checkpoint could not be opened from Vault');
  assert(!button('Save protected copy'), 'Transactional editor must not present a redundant copy button');
  emit('PASS', 'Explicit protected save from PhiWrite: verified IndexedDB revision, immutable original, '
    + 'no silent continuous protection, later edit isolation and Vault reopen.');
}
run().catch(error => emit('FAIL', error?.stack ?? String(error)));
