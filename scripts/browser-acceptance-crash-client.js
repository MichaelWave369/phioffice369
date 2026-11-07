// Isolated, destructive-on-process crash fixture for a disposable Chromium profile.
// This script never runs as a normal acceptance scenario. The external runner
// terminates Chrome with SIGKILL after it publishes READY.
const sourceKey = 'phioffice369:phiwrite:file_crashsource';
const sourceTitle = 'Crash-proof draft';
const copyTitle = sourceTitle + ' (IndexedDB copy)';
const source = JSON.stringify({
  title: sourceTitle, templateId: 'file_crashsource', sourceTemplateId: 'crash_fixture',
  content: 'Original local source remains unchanged.\n', activeLabelId: 'private',
});
const committed = 'Revision two survived the browser process being killed.\n';
const deckCount = 8;
const slidesPerDeck = 4;

function assert(ok, message) { if (!ok) throw Error(message); }
async function waitFor(check, label, attempts = 240) {
  for (let i = 0; i < attempts; i++) {
    const result = await check();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 45));
  }
  throw Error('Timed out waiting for ' + label);
}
const button = (label) => [...document.querySelectorAll('button')]
  .find(node => node.textContent.trim() === label && !node.disabled);
async function click(label) { (await waitFor(() => button(label), 'button ' + label)).click(); }
async function vault() {
  if (!document.querySelector('.vault-hero')) await click('Vault');
  await waitFor(() => document.querySelector('.vault-hero'), 'PhiVault');
}
async function selectFile(title) {
  await vault();
  const row = await waitFor(() => [...document.querySelectorAll('.artifact-row')]
    .find(node => node.querySelector('h3')?.textContent === title), 'file ' + title);
  row.click();
  await waitFor(() => document.querySelector('.artifact-detail-drawer'), 'file details');
}
function edit(field, value) {
  assert(field, 'Missing editable field');
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
}
function emit(status, detail) {
  document.documentElement.dataset.phiAcceptance = status;
  const result = document.createElement('pre');
  result.id = 'phi-browser-acceptance-result';
  result.textContent = detail;
  document.body.prepend(result);
}
function pngFixture(seed) {
  const size = 256, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(size, size);
  let value = seed;
  for (let i = 0; i < pixels.data.length; i += 4) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    pixels.data[i] = value >>> 24;
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    pixels.data[i + 1] = value >>> 24;
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    pixels.data[i + 2] = value >>> 24;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/png');
}
async function readEditorRows() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('phioffice369-editor-revisions', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('files', 'readonly');
      const read = transaction.objectStore('files').getAll();
      read.onerror = () => reject(read.error);
      read.onsuccess = () => resolve(read.result);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
async function seedImageHeavyDecks() {
  const images = Array.from({ length: slidesPerDeck }, (_, i) => pngFixture(369 + 137 * i));
  assert(images.every(item => item.startsWith('data:image/png;base64,') && item.length > 190000),
    'Expected genuinely image-heavy raster fixtures');
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('phioffice369-editor-revisions', 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite', { durability: 'strict' });
      const store = tx.objectStore('files');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || Error('Image fixture transaction aborted'));
      for (let n = 0; n < deckCount; n++) {
        const id = 'file_tx_crash_image_' + n;
        const key = 'phioffice369:phideck:' + id;
        const raw = JSON.stringify({
          title: 'Crash image deck ' + n, templateId: id, sourceTemplateId: 'image_stress',
          activeLabelId: 'private',
          slides: Array.from({ length: slidesPerDeck }, (_, slide) => ({
            id: 'image_' + slide,
            title: 'Synthetic image slide ' + slide,
            bullets: ['Recoverable content ' + n + '/' + slide],
            layout: 'image-left',
            image: { src: images[slide], alt: 'Synthetic RGB pixels ' + slide },
          })),
        });
        store.add({ key, revision: 1, raw });
      }
    });
  } finally { db.close(); }
  return images.reduce((total, img) => total + img.length, 0) * deckCount;
}

async function firstPhase() {
  await waitFor(() => document.querySelector('.tabs'), 'workspace launcher');
  document.querySelector('[aria-label="Close onboarding"]')?.click();
  localStorage.setItem(sourceKey, source);
  await vault();
  await click('Refresh scan');
  await selectFile(sourceTitle);
  await click('Create IndexedDB copy');
  await selectFile(copyTitle);
  await click('Open file');
  const field = await waitFor(() => document.querySelector('.editor-field textarea'), 'PhiWrite editor');
  edit(field, committed);
  await click('Save file');
  await waitFor(() => document.querySelector('.save-status')?.textContent.includes('revision 2'),
    'confirmed revision 2 commit');
  const bytes = await seedImageHeavyDecks();
  const rows = await readEditorRows();
  assert(rows.length === deckCount + 1 && rows.some(r => r.revision === 2 && JSON.parse(r.raw).content === committed),
    'Transactional records not committed before hard crash');
  assert(bytes > 6000000, 'Heavy image test data unexpectedly small');
  assert(localStorage.getItem(sourceKey) === source, 'Original local source was overwritten');
  emit('READY', 'Confirmed revision 2 plus ' + deckCount + ' image-heavy decks (' + bytes +
    ' encoded-image characters) were committed. Runner must SIGKILL Chrome now.');
}

async function verifyPhase() {
  await waitFor(() => document.querySelector('.tabs'), 'restarted workspace');
  document.querySelector('[aria-label="Close onboarding"]')?.click();
  assert(localStorage.getItem(sourceKey) === source, 'Unclean termination lost or changed original local file');
  const rows = await readEditorRows();
  assert(rows.length === deckCount + 1, 'Unclean termination lost transactional files: ' + rows.length);
  const write = rows.find(row => row.key.startsWith('phioffice369:phiwrite:'));
  assert(write?.revision === 2 && JSON.parse(write.raw).content === committed,
    'Previously acknowledged revision 2 did not survive hard process termination');
  const decks = rows.filter(row => row.key.startsWith('phioffice369:phideck:'));
  assert(decks.length === deckCount, 'Image-heavy decks lost on restart');
  let imageCharacters = 0;
  for (const row of decks) {
    assert(row.revision === 1, 'Unexpected deck revision after restart');
    const data = JSON.parse(row.raw);
    assert(data.slides.length === slidesPerDeck, 'Slide count changed after crash');
    for (const slide of data.slides) {
      assert(slide.image?.src.startsWith('data:image/png;base64,'), 'PNG bytes missing');
      imageCharacters += slide.image.src.length;
    }
  }
  assert(imageCharacters > 6000000, 'Image data truncated by unclean termination');

  await vault();
  await selectFile(copyTitle);
  await click('Open file');
  const editor = await waitFor(() => document.querySelector('.editor-field textarea'), 'reopened PhiWrite');
  assert(editor.value === committed, 'App UI reopened incorrect committed content');
  await click('Back to PhiOffice');
  await vault();

  const originalObjectUrl = URL.createObjectURL;
  let exported = null;
  URL.createObjectURL = function (blob) {
    exported = blob;
    return originalObjectUrl.call(URL, blob);
  };
  try {
    await click('Backup workspace');
    const blob = await waitFor(() => exported, 'combined backup download');
    const backup = JSON.parse(await blob.text());
    const snapshot = new Map(backup.storageSnapshot);
    assert(snapshot.get(sourceKey) === source, 'Backup lost standard storage source');
    assert(snapshot.get(write.key) === write.raw, 'Backup lost committed transactional revision');
    for (const deck of decks) assert(snapshot.get(deck.key) === deck.raw, 'Backup lost image-heavy deck ' + deck.key);
    assert(!backup.transactionalRecovery?.length, 'Unexpected backup recovery records');
  } finally { URL.createObjectURL = originalObjectUrl; }

  emit('PASS', 'SIGKILL/restart preserved acknowledged PhiWrite revision 2 and all ' + deckCount
    + ' image-heavy IndexedDB decks (' + imageCharacters + ' image characters).'
    + ' Original source and complete combined backup verified.');
}

(async () => {
  if (new URL(location.href).searchParams.get('phase') === 'verify') await verifyPhase();
  else await firstPhase();
})().catch(error => emit('FAIL', error?.stack ?? String(error)));
