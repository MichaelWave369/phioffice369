// Production build acceptance for explicit large-backup recovery when
// standard localStorage is at quota. Synthetic localhost profile ONLY.
const schema = 'phioffice369.workspace_backup.v0.1';
const fileCount = 120;
const prefix = 'phioffice369:phiwrite:file_restore_source_';
function assert(ok, message) { if (!ok) throw Error(message); }
async function waitFor(check, what, attempts = 160) {
  for (let i = 0; i < attempts; i++) {
    const result = await check();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw Error('Timed out waiting for ' + what);
}
const button = (label) => [...document.querySelectorAll('button')]
  .find(node => !node.disabled && node.textContent.trim() === label);
async function click(label) { (await waitFor(() => button(label), label)).click(); }
function publish(status, message) {
  document.documentElement.dataset.phiAcceptance = status;
  const element = document.createElement('pre');
  element.id = 'phi-browser-acceptance-result';
  element.textContent = message;
  document.body.prepend(element);
}
async function readIndexedRows() {
  const database = await new Promise((resolve, reject) => {
    const req = indexedDB.open('phioffice369-editor-revisions');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction('files', 'readonly');
      const req = tx.objectStore('files').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally { database.close(); }
}
function pngFixture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const image = context.createImageData(128, 128);
  let seed = 369;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    image.data[i] = seed >>> 24;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    image.data[i + 1] = seed >>> 24;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    image.data[i + 2] = seed >>> 24;
    image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
function backupFixture() {
  const entries = [];
  for (let i = 0; i < fileCount; i++) {
    const key = prefix + String(i).padStart(3, '0');
    const value = JSON.stringify({ title: 'Recovered document ' + i,
      content: 'π 369 - ' + ('portable recovery under quota ' + i + '\n').repeat(75),
      activeLabelId: 'private' });
    entries.push([key, value]);
  }
  const src = pngFixture();
  assert(src.length > 45000, 'Image fixture too small');
  for (let deck = 0; deck < 6; deck++) {
    const key = 'phioffice369:phideck:file_recovery_deck_' + deck;
    entries.push([key, JSON.stringify({
      title: 'Recovered image deck ' + deck,
      slides: Array.from({ length: 10 }, (_, slide) => ({
        id: 'slide_' + slide, title: 'Image recovery ' + slide, bullets: ['Backup pixel content'],
        layout: 'image-left', image: { src, alt: 'Synthetic seeded pixels' },
      })),
    })]);
  }
  entries.push(['phioffice369:artifact_metadata:file_restore_source_000', JSON.stringify({ tags: ['fixture'], projectFolder: 'Tests' })]);
  return { schema, source: 'Quota recovery test', storageSnapshot: entries };
}
async function uploadBackup(payload) {
  const input = await waitFor(() => document.querySelector('.vault-file-input'), 'backup file picker');
  const transfer = new DataTransfer();
  transfer.items.add(new File([JSON.stringify(payload)], 'synthetic-large-backup.json', { type: 'application/json' }));
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await waitFor(() => button('Recover file copies to IndexedDB'), 'validated backup recovery action');
}
async function run() {
  await waitFor(() => document.querySelector('.tabs'), 'workspace');
  document.querySelector('[aria-label="Close onboarding"]')?.click();
  const existing = localStorage.getItem('phioffice369:phiwrite:file_prior_work') ?? JSON.stringify({
    title: 'Keep existing work', content: 'Never overwrite this file' });
  localStorage.setItem('phioffice369:phiwrite:file_prior_work', existing);
  const initialKeys = Object.keys(localStorage).filter(key => key.startsWith('phioffice369:')).sort();
  const originals = new Map(initialKeys.map(key => [key, localStorage.getItem(key)]));
  await click('Vault');
  const backup = backupFixture();

  // The standard-store quota is simulated with the original read path intact.
  // The new restore path must never call setItem for PhiOffice keys.
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (key.startsWith('phioffice369:')) throw new DOMException('Quota fixture', 'QuotaExceededError');
    return setItem.call(this, key, value);
  };
  try {
    await uploadBackup(backup);
    await click('Recover file copies to IndexedDB');
    await waitFor(() => document.querySelector('.vault-status')?.textContent.includes('126 created'), 'new IndexedDB copies', 300);
    const rows = await readIndexedRows();
    const restored = rows.filter(row => row.key.includes(':file_tx_restore_'));
    assert(restored.length === 126, 'Expected 126 independent recovered copies, got ' + restored.length);
    const raws = new Set(backup.storageSnapshot.slice(0, 126).map(([, raw]) => raw));
    for (const row of restored) {
      assert(row.revision === 1, 'Recovered revision must start at 1');
      assert(raws.has(row.raw), 'Recovered content differs from the backup');
    }
    assert(initialKeys.every(key => localStorage.getItem(key) === originals.get(key)), 'Prior local files changed');
    assert(Object.keys(localStorage).filter(key => key.startsWith('phioffice369:')).length === initialKeys.length,
      'Recovery modified standard storage under quota');
    await click('Recover file copies to IndexedDB');
    await waitFor(() => document.querySelector('.vault-status')?.textContent.includes('126 already present'),
      'idempotent retry', 300);
    assert((await readIndexedRows()).length === rows.length, 'Second recovery duplicated rows');
    // Reopen recovered file via the real Vault UI.
    await click('Refresh scan');
    const row = await waitFor(() => [...document.querySelectorAll('.artifact-row')].find(
      item => item.querySelector('h3')?.textContent === 'Recovered document 0'), 'recovered file in Vault');
    row.click();
    await click('Open file');
    const editor = await waitFor(() => document.querySelector('.editor-field textarea'), 'recovered editor');
    assert(editor.value === JSON.parse(backup.storageSnapshot[0][1]).content, 'Reopened content differs');
    publish('PASS', '126 complete recovered IndexedDB copies under simulated localStorage quota, 6 PNG-bearing decks, original keys untouched, repeat restore idempotent and editor reopening correct.');
  } finally {
    Storage.prototype.setItem = setItem;
  }
}
run().catch(error => publish('FAIL', error?.stack ?? String(error)));
