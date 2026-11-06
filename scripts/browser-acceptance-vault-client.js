// Production browser acceptance for workspace management and recovery.
const prefix = 'phioffice369:phiwrite:';
const phaseKey = '__phi_vault_reload';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function waitFor(check, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error('Timed out waiting for ' + label);
}
const button = (label) => Array.from(document.querySelectorAll('button')).find((item) => item.textContent.trim() === label && !item.disabled);
async function click(label) { (await waitFor(() => button(label), label)).click(); }
function edit(selector, value) {
  const input = document.querySelector(selector);
  assert(input, 'Missing ' + selector);
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
function uploadBackup(payload) {
  const input = document.querySelector('.vault-file-input');
  const transfer = new DataTransfer();
  transfer.items.add(new File([JSON.stringify(payload)], 'workspace.json', { type: 'application/json' }));
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
function selectArtifact(title) {
  const item = [...document.querySelectorAll('.artifact-row')].find((row) => row.querySelector('h3').textContent === title);
  assert(item, 'Artifact missing: ' + title);
  item.click();
}
function publish(status, message) {
  document.documentElement.dataset.phiAcceptance = status;
  const result = document.createElement('pre');
  result.id = 'phi-browser-acceptance-result';
  result.textContent = message;
  document.body.prepend(result);
}

async function run() {
  await waitFor(() => document.querySelector('.tabs'), 'launcher');
  document.querySelector('[aria-label="Close onboarding"]')?.click();

  if (sessionStorage.getItem(phaseKey)) {
    await click('Vault');
    await waitFor(() => document.querySelector('.vault-search-box input'), 'Vault search');
    edit('.vault-search-box input', 'fieldnotes');
    await waitFor(() => document.querySelectorAll('.artifact-row').length === 2, 'tag search and duplicated metadata');
    selectArtifact('Vault renamed');
    await click('Open file');
    const editor = await waitFor(() => document.querySelector('.editor-field textarea'), 'restored file after reload');
    assert(editor.value === 'Stored independently', 'Restored content differs after browser reload');
    sessionStorage.removeItem(phaseKey);
    publish('PASS', 'Vault file actions, validation, conflicts, cancellation, quota recovery and reload');
    return;
  }

  await click('New PhiWrite file');
  await waitFor(() => document.querySelector('.editor-field textarea'), 'independent editor');
  edit('.title-field input', 'Vault field file');
  edit('.editor-field textarea', 'Stored independently');
  await click('Save file');
  const key = Object.keys(localStorage).find((item) => item.startsWith(prefix + 'file_'));
  assert(key, 'New file was not stored');
  const original = localStorage.getItem(key);

  const confirm = window.confirm;
  window.confirm = () => false;
  await click('Reset');
  assert(document.querySelector('.editor-field textarea').value === 'Stored independently', 'Cancelled reset changed content');

  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (name, value) {
    if (name === key || name.startsWith('phioffice369:export_receipt:')) throw new DOMException('Test quota', 'QuotaExceededError');
    return setItem.call(this, name, value);
  };
  edit('.editor-field textarea', 'Unsaved quota fixture');
  await click('Back to PhiOffice');
  assert(document.querySelector('.editor-field textarea')?.value === 'Unsaved quota fixture', 'Failed save allowed navigation');
  assert(localStorage.getItem(key) === original, 'Failed save changed the stored file');
  await click('Leave without saving');
  assert(document.querySelector('.editor-field textarea'), 'Cancel discarded unsaved content');

  const createObjectURL = URL.createObjectURL;
  let downloaded;
  URL.createObjectURL = (blob) => { downloaded = blob; return createObjectURL.call(URL, blob); };
  await click('Export .md');
  assert((await downloaded.text()).includes('Unsaved quota fixture'), 'Export failed while local storage was full');
  assert(document.querySelector('.save-status').textContent.includes('could not save its receipt'), 'Receipt failure was not disclosed');
  Storage.prototype.setItem = setItem;
  edit('.editor-field textarea', 'Stored independently');
  await click('Back to PhiOffice');

  await click('Vault');
  await waitFor(() => document.querySelector('.artifact-row'), 'Vault files');
  selectArtifact('Vault field file');
  await waitFor(() => document.querySelector('.artifact-detail-drawer input'), 'file details');
  edit('.artifact-detail-drawer input[placeholder^="client-work"]', 'fieldnotes');
  await click('Save tags');
  edit('.artifact-detail-drawer input[placeholder^="Client Launch"]', 'Field Project');
  await click('Save folder');
  edit('.artifact-detail-drawer input[maxlength="240"]', 'Vault renamed');
  await click('Rename file');
  await waitFor(() => [...document.querySelectorAll('.artifact-row h3')].some((item) => item.textContent === 'Vault renamed'), 'renamed file');
  selectArtifact('Vault renamed');
  await click('Duplicate file');
  await waitFor(() => [...document.querySelectorAll('.artifact-row h3')].some((item) => item.textContent === 'Vault renamed (copy)'), 'duplicate');
  selectArtifact('Vault renamed');
  await click('Move to Trash');
  assert(!JSON.parse(localStorage.getItem(key)).trashedAt, 'Cancelling Trash changed the file');
  window.confirm = () => true;
  await click('Move to Trash');
  window.confirm = confirm;
  assert(JSON.parse(localStorage.getItem(key)).trashedAt, 'Trashed file did not remain recoverable');
  const trash = await waitFor(() => document.querySelector('.vault-artifacts details'), 'Trash list');
  trash.open = true;
  await click('Restore Vault renamed');
  assert(!JSON.parse(localStorage.getItem(key)).trashedAt, 'Restore did not remove Trash marker');

  await click('Backup workspace');
  const exported = JSON.parse(await downloaded.text());
  assert(exported.storageSnapshot.some(([name, value]) => name === key && JSON.parse(value).content === 'Stored independently'), 'Backup lost document content');

  const backup = (items) => ({ schema: 'phioffice369.workspace_backup.v0.1', storageSnapshot: items });
  const incomingKey = prefix + 'file_importfixture';
  const incoming = JSON.stringify({ title: 'Restored copy', content: 'Portable file content' });
  uploadBackup(backup([[incomingKey, incoming], ['other_app:account', 'tampered']]));
  await waitFor(() => document.querySelector('.vault-status').textContent.includes('validation failed'), 'invalid backup rejected');
  assert(!button('Restore missing items') && !localStorage.getItem(incomingKey), 'Invalid backup could modify browser storage');

  const conflict = JSON.stringify({ title: 'Conflict', content: 'Old work' });
  uploadBackup(backup([[incomingKey, incoming], [key, conflict]]));
  await click('Cancel restore');
  assert(localStorage.getItem(incomingKey) === null, 'Cancelled restore wrote data');
  uploadBackup(backup([[incomingKey, incoming], [key, conflict]]));
  await click('Restore missing items');
  assert(localStorage.getItem(incomingKey) === incoming, 'Missing file not restored');
  assert(JSON.parse(localStorage.getItem(key)).title === 'Vault renamed', 'Restore overwrote newer work');
  sessionStorage.setItem(phaseKey, 'yes');
  location.reload();
}
run().catch((error) => publish('FAIL', error.stack));
