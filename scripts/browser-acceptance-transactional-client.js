// Exercises the built suite through two Chrome tabs sharing one browser profile.
const legacyKey = 'phioffice369:phiwrite:basic_project_spec';
const originalTitle = 'Sprint legacy template';
const copiedTitle = originalTitle + ' (IndexedDB copy)';
const conflictTitle = copiedTitle + ' (conflict copy)';
const legacyRaw = JSON.stringify({
  title: originalTitle, content: 'Original template content.\n', activeLabelId: 'private',
  templateId: 'basic_project_spec', sourceTemplateId: 'basic_project_spec',
});
const phase = '__phi_transactional_reloaded';

function assert(value, message) { if (!value) throw new Error(message); }
async function waitFor(check, label) {
  for (let i = 0; i < 160; i += 1) {
    const result = check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 45));
  }
  throw new Error('Timed out: ' + label);
}
const button = (doc, label) => [...doc.querySelectorAll('button')].find((item) => !item.disabled && item.textContent.trim() === label);
async function click(doc, label) { (await waitFor(() => button(doc, label), label)).click(); }
function edit(field, value) {
  assert(field, 'Missing editable field');
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set.call(field, value);
  field.dispatchEvent(new field.ownerDocument.defaultView.Event('input', { bubbles: true }));
}
const textarea = (doc) => doc.querySelector('.editor-field textarea');
async function selectFile(doc, title) {
  if (!doc.querySelector('.vault-hero')) await click(doc, 'Vault');
  const row = await waitFor(() => [...doc.querySelectorAll('.artifact-row')]
    .find((item) => item.querySelector('h3')?.textContent === title), 'Vault file ' + title);
  row.click();
  return waitFor(() => doc.querySelector('.artifact-detail-drawer'), 'file details');
}
async function openFile(doc, title) {
  await selectFile(doc, title);
  await click(doc, 'Open file');
  return waitFor(() => textarea(doc), 'editor for ' + title);
}
function statusIncludes(doc, text) { return doc.querySelector('.save-status')?.textContent.includes(text); }
function publish(result, message) {
  document.documentElement.dataset.phiAcceptance = result;
  const node = document.createElement('pre');
  node.id = 'phi-browser-acceptance-result';
  node.textContent = message;
  document.body.prepend(node);
}

async function run() {
  await waitFor(() => document.querySelector('.tabs'), 'workspace');
  document.querySelector('[aria-label="Close onboarding"]')?.click();

  if (!sessionStorage.getItem(phase)) {
    localStorage.setItem(legacyKey, legacyRaw);
    const source = await selectFile(document, originalTitle);
    edit(source.querySelector('input[placeholder^="client-work"]'), 'fieldnotes');
    await click(document, 'Save tags');
    edit(source.querySelector('input[placeholder^="Client Launch"]'), 'Field Project');
    await click(document, 'Save folder');
    await click(document, 'Create IndexedDB copy');

    const copy = await selectFile(document, copiedTitle);
    assert(copy.textContent.includes('revision 1'), 'Copy revision was not verified');
    assert(copy.textContent.includes('fieldnotes') && copy.textContent.includes('Field Project'), 'Migration dropped tags or folder');
    assert(localStorage.getItem(legacyKey) === legacyRaw, 'Migration modified the original draft');
    await click(document, 'Open file');
    const field = await waitFor(() => textarea(document), 'transactional editor');
    assert(field.value === 'Original template content.\n', 'Migration changed file content');
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'files') throw new DOMException('Fixture quota error', 'QuotaExceededError');
      return put.apply(this, args);
    };
    try {
      edit(field, 'Pending edit while storage is full');
      await click(document, 'Back to PhiOffice');
      await waitFor(() => statusIncludes(document, 'IndexedDB is full'), 'quota failure surfaced');
      assert(textarea(document)?.value === 'Pending edit while storage is full', 'Quota failure discarded the active editor');
    } finally {
      IDBObjectStore.prototype.put = put;
    }
    edit(field, 'Revision two before reload');
    await click(document, 'Save file');
    await waitFor(() => statusIncludes(document, 'revision 2'), 'revision two committed');
    sessionStorage.setItem(phase, '1');
    location.reload();
    return;
  }

  const winner = await openFile(document, copiedTitle);
  assert(winner.value === 'Revision two before reload' && statusIncludes(document, 'revision 2'), 'Reload lost the committed revision');
  const peer = window.open(location.pathname + '?app=PhiVault', 'phioffice-transaction-peer');
  assert(peer, 'Could not open the competing browser tab');
  try {
    const peerDoc = await waitFor(() => peer.document.querySelector('.vault-hero') && peer.document, 'peer Vault');
    const stale = await openFile(peerDoc, copiedTitle);
    assert(stale.value === 'Revision two before reload', 'Peer did not open revision two');

    edit(winner, 'Winning revision three');
    await click(document, 'Save file');
    await waitFor(() => statusIncludes(document, 'revision 3'), 'winning revision committed');
    edit(stale, 'Competing edit to recover');
    await click(peerDoc, 'Save file');
    await waitFor(() => statusIncludes(peerDoc, 'Conflict copy saved'), 'stale editor wrote a recovery copy');
    edit(stale, 'Competing edit with a second save');
    await click(peerDoc, 'Save file');
    await waitFor(() => statusIncludes(peerDoc, 'Conflict copy saved in IndexedDB · revision 2'), 'later edits follow the recovery copy');
  } finally {
    peer.close();
  }

  await click(document, 'Back to PhiOffice');
  await selectFile(document, conflictTitle);
  const recovered = await openFile(document, conflictTitle);
  assert(recovered.value === 'Competing edit with a second save', 'Conflict copy lost its latest edit');

  const originalCreateUrl = URL.createObjectURL;
  let download;
  URL.createObjectURL = (blob) => { download = blob; return originalCreateUrl.call(URL, blob); };
  await click(document, 'Export .md');
  assert((await (await waitFor(() => download, 'recovery download')).text()).includes(recovered.value), 'Recovery export dropped content');
  await click(document, 'Back to PhiOffice');

  await selectFile(document, copiedTitle);
  const confirm = window.confirm;
  window.confirm = () => true;
  try { await click(document, 'Move to Trash'); } finally { window.confirm = confirm; }
  const trash = await waitFor(() => document.querySelector('.vault-artifacts details'), 'transactional Trash');
  trash.open = true;
  await click(document, 'Restore ' + copiedTitle);
  await selectFile(document, copiedTitle);
  await click(document, 'Copy to standard storage');
  const standard = await openFile(document, copiedTitle + ' (standard copy)');
  assert(standard.value === 'Winning revision three', 'Rollback copy lost the winner');
  assert(!statusIncludes(document, 'IndexedDB'), 'Rollback opened the transactional save path');
  await click(document, 'Back to PhiOffice');

  download = null;
  await click(document, 'Backup workspace');
  const backup = JSON.parse(await (await waitFor(() => download, 'combined backup')).text());
  const drafts = backup.storageSnapshot
    .filter(([key]) => key.startsWith('phioffice369:phiwrite:'))
    .map(([key, raw]) => [key, JSON.parse(raw)]);
  const active = drafts.find(([, record]) => record.title === copiedTitle);
  assert(active?.[1]?.content === 'Winning revision three', 'Backup lost the winner');
  assert(drafts.filter(([, record]) => record.title === conflictTitle).length === 1, 'Expected one recovery file');
  assert(drafts.some(([, record]) => record.title === conflictTitle && record.content === 'Competing edit with a second save'), 'Backup lost the recovery copy');
  assert(localStorage.getItem(active[0]) === null && localStorage.getItem(legacyKey) === legacyRaw, 'Source identity or storage changed silently');
  sessionStorage.removeItem(phase);
  publish('PASS', 'Verified migration, transactional save, reload, competing tabs, recovery export, Trash, rollback copy and complete backup.');
}

run().catch((error) => publish('FAIL', error.stack));
