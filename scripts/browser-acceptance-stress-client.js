// Disposable-profile large-workspace rehearsal against the built PhiOffice UI.
// A manual browser runner can execute this same fixture in Firefox or Safari.
const phaseKey = '__phi_storage_stress_phase';
const backupKey = '__phi_storage_stress_backup';
const fileCount = 120;
const titlePrefix = 'Storage stress ';
const dbName = 'phioffice369-editor-revisions';

function assert(ok, message) { if (!ok) throw new Error(message); }
async function waitFor(check, label) {
  for (let n = 0; n < 150; n += 1) {
    const result = check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for ' + label);
}
const button = (label) => [...document.querySelectorAll('button')]
  .find((node) => !node.disabled && node.textContent.trim() === label);
async function click(label) { (await waitFor(() => button(label), label)).click(); }
function publish(status, detail) {
  document.documentElement.dataset.phiAcceptance = status;
  const result = document.createElement('pre');
  result.id = 'phi-browser-acceptance-result';
  result.textContent = detail;
  document.body.prepend(result);
}
function fixture(index) {
  const kind = ['phiwrite', 'phigrid', 'phideck'][index % 3];
  const id = 'file_stress_' + String(index).padStart(3, '0');
  const key = 'phioffice369:' + kind + ':' + id;
  const title = titlePrefix + String(index).padStart(3, '0');
  const common = { title, templateId: id, sourceTemplateId: 'stress_' + kind, activeLabelId: 'private' };
  const record = kind === 'phiwrite'
    ? { ...common, content: '# ' + title + '\n' + ('π 369 browser backup integrity\n').repeat(105) }
    : kind === 'phigrid'
      ? { ...common, columns: ['Item', 'Amount'], rows: Array.from({ length: 25 }, (_, i) => ({
        Item: 'Item ' + index + '-' + i, Amount: String(index * 10 + i),
      })) }
      : { ...common, slides: Array.from({ length: 5 }, (_, i) => ({
        id: 'slide_' + i, title: title + ' slide ' + i, bullets: [('Deck bullet ' + index + ':' + i + ' ').repeat(22)],
      })) };
  return [key, JSON.stringify(record)];
}
function uploadBackup(payload) {
  const input = document.querySelector('.vault-file-input');
  assert(input, 'Vault restore file input missing');
  const drag = new DataTransfer();
  drag.items.add(new File([JSON.stringify(payload)], 'storage-stress-backup.json', { type: 'application/json' }));
  input.files = drag.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
async function selectFile(title) {
  if (!document.querySelector('.vault-hero')) await click('Vault');
  const row = await waitFor(() => [...document.querySelectorAll('.artifact-row')]
    .find((node) => node.querySelector('h3')?.textContent === title), 'Vault artifact: ' + title);
  row.click();
  return waitFor(() => document.querySelector('.artifact-detail-drawer'), 'Vault file detail');
}
async function deleteEditorDatabase() {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Database deletion failed'));
    request.onblocked = () => reject(new Error('IndexedDB deletion blocked by an open connection'));
  });
}

async function run() {
  await waitFor(() => document.querySelector('.tabs'), 'suite launcher');
  document.querySelector('[aria-label="Close onboarding"]')?.click();
  const phase = sessionStorage.getItem(phaseKey);

  if (!phase) {
    for (let index = 0; index < fileCount; index += 1) {
      const [key, raw] = fixture(index);
      localStorage.setItem(key, raw);
    }
    sessionStorage.setItem(phaseKey, 'backup');
    location.reload();
    return;
  }

  if (phase === 'backup') {
    await selectFile(titlePrefix + '000');
    await click('Create IndexedDB copy');
    await selectFile(titlePrefix + '000 (IndexedDB copy)');

    const createObjectURL = URL.createObjectURL;
    let captured = null;
    URL.createObjectURL = (blob) => {
      captured = blob;
      return createObjectURL.call(URL, blob);
    };
    await click('Backup workspace');
    const blob = await waitFor(() => captured, 'backup export');
    const backup = JSON.parse(await blob.text());
    assert(backup.schema === 'phioffice369.workspace_backup.v0.1', 'Backup schema mismatch');
    const byKey = new Map(backup.storageSnapshot);
    for (let index = 0; index < fileCount; index += 1) {
      const [key, raw] = fixture(index);
      assert(byKey.get(key) === raw, 'Backup did not preserve original bytes for ' + key);
    }
    const copy = backup.storageSnapshot.filter(([key, raw]) =>
      key.startsWith('phioffice369:phiwrite:file_tx_') &&
      JSON.parse(raw).title === titlePrefix + '000 (IndexedDB copy)');
    assert(copy.length === 1, 'Missing verified IndexedDB copy in combined backup');
    assert(localStorage.getItem(copy[0][0]) === null, 'IndexedDB copy leaked into standard storage');

    sessionStorage.setItem(backupKey, JSON.stringify(backup));
    sessionStorage.setItem(phaseKey, 'restore');
    await deleteEditorDatabase();
    localStorage.clear();
    location.reload();
    return;
  }

  const backup = JSON.parse(sessionStorage.getItem(backupKey) || 'null');
  assert(backup && Array.isArray(backup.storageSnapshot), 'Backup was not retained across clean-profile simulation');
  if (phase === 'restore') {
    await click('Vault');
    uploadBackup(backup);
    await click('Restore missing items');
    const lastKey = fixture(fileCount - 1)[0];
    await waitFor(() => localStorage.getItem(lastKey) !== null, 'last restored file');
    sessionStorage.setItem(phaseKey, 'verify');
    location.reload();
    return;
  }

  assert(phase === 'verify', 'Unexpected stress fixture phase');
  const byKey = new Map(backup.storageSnapshot);
  for (let index = 0; index < fileCount; index += 1) {
    const [key, raw] = fixture(index);
    assert(localStorage.getItem(key) === raw && byKey.get(key) === raw,
      'Clean restore changed original content: ' + key);
  }
  const copied = backup.storageSnapshot.filter(([key, raw]) =>
    key.startsWith('phioffice369:phiwrite:file_tx_') &&
    JSON.parse(raw).title === titlePrefix + '000 (IndexedDB copy)');
  assert(copied.length === 1 && localStorage.getItem(copied[0][0]) === copied[0][1],
    'Restored IndexedDB copy missing from portable standard storage');

  await selectFile(titlePrefix + '000 (IndexedDB copy)');
  await click('Open file');
  const editor = await waitFor(() => document.querySelector('.editor-field textarea'), 'restored document editor');
  assert(editor.value === JSON.parse(copied[0][1]).content, 'Reopened copy lost its document content');
  sessionStorage.removeItem(phaseKey);
  sessionStorage.removeItem(backupKey);
  publish('PASS', fileCount + ' mixed files + IndexedDB copy preserved through backup, storage reset, restore, reload and editor reopen.');
}
run().catch((error) => publish('FAIL', error?.stack || String(error)));
