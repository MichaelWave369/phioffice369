// Independent-file journeys through the production build.
const checkpoint = '__phi_readiness_reload';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGM0mtvOwMDAxMDAwMDAAAAP3QFab+Yz3AAAAABJRU5ErkJggg==';
const docTitle = 'Field document';
const gridTitle = 'Field budget';
const deckTitle = 'Field presentation';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function waitFor(check, label) {
  for (let attempt = 0; attempt < 110; attempt += 1) {
    const result = check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 35));
  }
  throw new Error('Timed out: ' + label);
}
const query = (selector) => document.querySelector(selector);
const button = (label) => Array.from(document.querySelectorAll('button')).find((item) => item.textContent.trim() === label && !item.disabled);
async function click(label) { (await waitFor(() => button(label), label)).click(); }
function edit(selector, value) {
  const field = query(selector);
  assert(field, 'Missing field ' + selector);
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  return field;
}
function upload(selector, name, body, type) {
  const input = query(selector);
  const transfer = new DataTransfer();
  transfer.items.add(new File([body], name, { type }));
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
async function start(app, selector) {
  const card = [...document.querySelectorAll('.app-card')].find((item) => item.querySelector('.app-name')?.textContent === app);
  assert(card, 'Missing ' + app);
  card.click();
  await click('New ' + app + ' file');
  await waitFor(() => query(selector), app + ' editor');
}
async function back() {
  await click('Back to PhiOffice');
  await waitFor(() => query('.recent-files-panel'), 'dashboard');
}
async function reopen(title, selector) {
  const entry = await waitFor(() => [...document.querySelectorAll('.recent-file-open')]
    .find((item) => item.querySelector('.recent-file-name')?.textContent === title), title + ' in recent files');
  entry.click();
  return waitFor(() => query(selector), title + ' editor');
}

async function checkExports() {
  const create = URL.createObjectURL;
  let downloaded;
  URL.createObjectURL = (blob) => { downloaded = blob; return create.call(URL, blob); };

  const doc = await reopen(docTitle, '.editor-field textarea');
  assert(doc.value === 'A **durable** draft.', 'Document body changed after reload');
  await click('Export .md');
  assert((await downloaded.text()).includes('A **durable** draft.'), 'Markdown export missed saved formatting');
  await click('Export HTML');
  assert((await downloaded.text()).includes('<strong>durable</strong>'), 'HTML export missed saved formatting');
  await back();

  await reopen(gridTitle, '.grid-title-field input');
  assert(query('[aria-label="Column 6 row 1"]').value === '15', 'Calculated reference did not survive reload');
  assert(query('.grid-sheet-tools input[type="range"]').value === '240', 'Column width was lost');
  await click('Export CSV');
  assert((await downloaded.text()).includes('"Income","8","7","1","","15"'), 'CSV missed the calculated value');
  await click('Export JSON');
  const grid = JSON.parse(await downloaded.text());
  assert(grid.rows[0]['Column 6'] === '=SUM(B1:C1)' && grid.totals['Column 6'] === 17, 'JSON did not retain raw formulas and totals');
  await back();

  await reopen(deckTitle, '.deck-title-field input');
  const first = await waitFor(() => query('.deck-canvas img')?.naturalWidth === 2 && query('.deck-canvas h3'), 'local slide image after reload');
  assert(first.textContent === 'Launch <ready>', 'Slide order did not survive reload');
  await click('Export JSON');
  const deck = JSON.parse(await downloaded.text());
  assert(deck.schema.endsWith('v0.2') && deck.slides[0].layout === 'image-left' && deck.slides[0].shape === 'circle', 'Visual deck JSON lost layout or shape');
  assert(deck.slides[0].bullets.join('|') === 'One||Two' && deck.slides[0].image.src.endsWith(png), 'Visual deck JSON changed text or image');
  await click('Export slides HTML');
  const html = await downloaded.text();
  assert(html.includes('Launch &lt;ready&gt;') && html.includes('alt="Field test image"') && html.includes(png), 'Standalone slide export lost or failed to escape content');
}

function publish(status, message) {
  document.documentElement.dataset.phiAcceptance = status;
  const result = document.createElement('pre');
  result.id = 'phi-browser-acceptance-result';
  result.textContent = message;
  document.body.prepend(result);
}

async function run() {
  await waitFor(() => query('.tabs'), 'workspace tabs');
  query('[aria-label="Close onboarding"]')?.click();
  if (sessionStorage.getItem(checkpoint)) {
    await checkExports();
    sessionStorage.removeItem(checkpoint);
    publish('PASS', 'Independent Write, Grid and Deck files created, edited, saved, reopened, reloaded and exported with content checks.');
    return;
  }

  await start('PhiWrite', '.editor-field textarea');
  edit('.title-field input', docTitle);
  const editor = edit('.editor-field textarea', 'A durable draft.');
  editor.focus();
  editor.setSelectionRange(2, 9);
  query('[aria-label^="Bold ("]').click();
  await waitFor(() => editor.value === 'A **durable** draft.', 'toolbar formatting');
  await click('Undo');
  assert(editor.value === 'A durable draft.', 'Undo did not restore text');
  await click('Redo');
  assert(editor.value === 'A **durable** draft.', 'Redo did not restore formatting');
  upload('input[accept^=".md"]', 'import.md', '# Replace?\n\nExample', 'text/markdown');
  await click('Cancel Markdown import');
  assert(editor.value === 'A **durable** draft.', 'Cancelling Markdown import replaced text');
  upload('input[accept^=".md"]', 'invalid.md', new Uint8Array([0xff, 0x00]), 'text/markdown');
  await waitFor(() => query('.save-status').textContent.includes('Markdown import rejected'), 'binary text rejected');
  await click('Save file');
  await back();
  assert((await reopen(docTitle, '.editor-field textarea')).value === 'A **durable** draft.', 'Document reopen missed body');
  await back();

  await start('PhiGrid', '.grid-title-field input');
  edit('.grid-title-field input', gridTitle);
  await click('Add column');
  edit('[aria-label="Planned row 1"]', '8');
  edit('[aria-label="Actual row 1"]', '7');
  edit('[aria-label="Column 6 row 1"]', '=SUM(B1:C1)');
  edit('[aria-label="Column 6 row 2"]', '=AVERAGE(B1:B2)-2');
  await waitFor(() => query('[aria-label="Column 6 row 1"]').value === '15', 'formula result');
  edit('.grid-sheet-tools select', 'Column 6');
  await click('Ascending');
  await waitFor(() => query('.table-wrap tbody th').textContent === '1', 'descending sort');
  edit('.grid-sheet-tools input:not([type])', 'Bills');
  await waitFor(() => queryAllRows() === 1 && query('.table-wrap tbody th').textContent === '2', 'filter view retains row address');
  edit('.grid-sheet-tools input:not([type])', '');
  edit('.grid-sheet-tools input[type="range"]', '240');
  await click('Save file');
  await back();
  assert((await reopen(gridTitle, '[aria-label="Column 6 row 1"]')).value === '15', 'Grid reopen missed formula result');
  await back();

  await start('PhiDeck', '.deck-title-field input');
  edit('.deck-title-field input', deckTitle);
  await click('Add slide');
  edit('.deck-slide-editor input', 'Launch <ready>');
  edit('.deck-slide-editor textarea', 'One\n');
  assert(query('.deck-slide-editor textarea').value === 'One\n', 'Deck drops newline during entry');
  edit('.deck-slide-editor textarea', 'One\n\nTwo');
  upload('.deck-image-input', 'unsafe.svg', '<svg/>', 'image/svg+xml');
  await waitFor(() => query('.deck-save-status').textContent.includes('PNG, JPEG or WebP'), 'unsupported image rejected');
  upload('.deck-image-input', 'local.png', Uint8Array.from(atob(png), (char) => char.charCodeAt(0)), 'image/png');
  await waitFor(() => query('.deck-canvas img')?.naturalWidth === 2, 'local image decoded');
  edit('.deck-visual-tools select', 'image-left');
  edit('.deck-visual-tools label:nth-child(2) select', 'circle');
  edit('.deck-visual-tools input[maxlength]', 'Field test image');
  while (button('Move earlier')) {
    await click('Move earlier');
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const originalConfirm = window.confirm;
  window.confirm = () => false;
  await click('Remove');
  assert(query('.deck-canvas h3').textContent === 'Launch <ready>', 'Cancelling slide removal changed the deck');
  window.confirm = originalConfirm;
  await click('Present');
  const dialog = await waitFor(() => query('.deck-presentation[open]'), 'presentation dialog');
  dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await waitFor(() => dialog.querySelector('[role="status"]').textContent.startsWith('2 of'), 'keyboard slide navigation');
  await click('End presentation');
  await click('Save file');
  await back();
  await reopen(deckTitle, '.deck-title-field input');
  assert(query('.deck-canvas h3').textContent === 'Launch <ready>', 'Deck reopen lost slide order');
  await back();

  sessionStorage.setItem(checkpoint, 'yes');
  location.reload();
}

function queryAllRows() { return document.querySelectorAll('.table-wrap tbody tr').length; }

run().catch((error) => publish('FAIL', error.stack));
