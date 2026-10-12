// Browser-only acceptance fixtures: run exclusively on a disposable localhost profile.
const scenario = new URLSearchParams(location.search).get('scenario');
const phaseKey = '__phioffice369_test_phase_' + scenario;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function waitFor(predicate, message, timeoutMs = 7000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = predicate();
    if (result) return result;
    await sleep(50);
  }
  throw new Error('Timed out: ' + message);
}

function findButton(label) {
  return [...document.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === label && !button.disabled
  ) ?? null;
}

function edit(element, value) {
  assert(element, 'Missing field for input');
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  assert(setter, 'Native input setter missing');
  setter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

async function openTemplate(templateName, openLabel, editorSelector) {
  const tabs = await waitFor(() => document.querySelector('nav.tabs'), 'suite tabs');
  await sleep(100);
  document.querySelector('button[aria-label="Close onboarding"]')?.click();
  const templates = [...tabs.querySelectorAll('button')].find(
    (button) => button.textContent.trim() === 'Templates'
  );
  assert(templates, 'Templates tab missing');
  templates.click();
  const card = await waitFor(
    () => [...document.querySelectorAll('.template-card')].find(
      (button) => button.querySelector('strong')?.textContent === templateName
    ),
    'starter template: ' + templateName,
  );
  card.click();
  const openButton = await waitFor(() => findButton(openLabel), 'Open ' + openLabel);
  openButton.click();
  return waitFor(() => document.querySelector(editorSelector), 'editor: ' + editorSelector);
}

function stored(key) {
  return JSON.parse(localStorage.getItem(key) ?? 'null');
}

function upload(input, filename, body, type) {
  assert(input, 'File chooser not found');
  const files = new DataTransfer();
  files.items.add(new File([body], filename, { type }));
  input.files = files.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function download(label) {
  let blob = null;
  let filename = '';
  const create = URL.createObjectURL;
  const revoke = URL.revokeObjectURL;
  const click = HTMLAnchorElement.prototype.click;
  try {
    URL.createObjectURL = (value) => { blob = value; return 'blob:phioffice-test'; };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function capture() { filename = this.download; };
    const button = findButton(label);
    assert(button, 'Missing export control: ' + label);
    button.click();
  } finally {
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    HTMLAnchorElement.prototype.click = click;
  }
  assert(blob, 'Missing downloaded Blob for ' + label);
  return { filename, body: await blob.text() };
}

async function runGrid() {
  const key = 'phioffice369:phigrid:simple_family_budget';
  const finalTitle = 'verified-final';
  const finalCell = 'Line one,\nLine two';
  if (sessionStorage.getItem(phaseKey) === 'reload') {
    await openTemplate('Simple Family Budget', 'Open in PhiGrid-lite', '.grid-title-field input');
    const grid = stored(key);
    assert(grid?.title === finalTitle, 'PhiGrid persisted title missing');
    assert(grid?.columns?.[1] === 'Category (2)', 'PhiGrid duplicate header not restored');
    assert(grid?.rows?.[0]?.Category === finalCell, 'PhiGrid multiline CSV cell not restored');
    assert(document.querySelector('.grid-title-field input')?.value === finalTitle, 'PhiGrid title not restored in UI');
    assert(document.querySelector('.table-wrap tbody tr textarea')?.value === finalCell, 'PhiGrid multiline cell not restored in UI');
    sessionStorage.removeItem(phaseKey);
    return 'PhiGrid edit, autosave, CSV/JSON export, safe import review, cancel, confirm and reload';
  }

  await openTemplate('Simple Family Budget', 'Open in PhiGrid-lite', '.grid-title-field input');
  edit(document.querySelector('.grid-title-field input'), 'Grid before import');
  const firstRow = document.querySelectorAll('.table-wrap tbody tr')[0];
  assert(firstRow, 'No editable grid row');
  edit(firstRow.querySelectorAll('input')[0], 'Fixture category');
  edit(firstRow.querySelectorAll('input')[1], '110');
  edit(firstRow.querySelectorAll('input')[2], '75');

  await waitFor(() => {
    const value = stored(key);
    return value?.title === 'Grid before import' &&
      value?.rows?.[0]?.Category === 'Fixture category' &&
      value?.rows?.[0]?.Difference === '35';
  }, 'PhiGrid autosave and difference calculation');

  const csv = await download('Export CSV');
  assert(csv.filename.endsWith('.csv'), 'CSV filename extension wrong');
  assert(csv.body.includes('"Fixture category","110","75","35"'), 'CSV export missing edited cells');
  const json = await download('Export JSON');
  assert(json.filename.endsWith('.json'), 'JSON filename extension wrong');
  const exported = JSON.parse(json.body);
  assert(exported.rows[0].Difference === '35', 'JSON export missing calculated difference');

  const chooser = document.querySelector('.grid-file-input');
  const validCsv = 'Category,Category,Notes\n"Line one,\nLine two",Second,Imported\n';
  upload(chooser, 'safe-import.csv', validCsv, 'text/csv');
  await waitFor(() => document.querySelector('.grid-import-preview'), 'PhiGrid import preview');
  assert(document.querySelector('.grid-import-warnings')?.textContent.includes('duplicate'), 'Duplicate header warning missing');
  assert(stored(key)?.rows?.[0]?.Category === 'Fixture category', 'Preview mutated saved grid');
  findButton('Cancel import')?.click();
  await waitFor(() => !document.querySelector('.grid-import-preview') &&
    document.querySelector('.grid-save-status')?.textContent.includes('CSV import cancelled') &&
    chooser.value === '', 'CSV preview cancel and file chooser reset');
  await sleep(150);
  assert(document.querySelector('.table-wrap tbody tr input')?.value === 'Fixture category', 'Cancel mutated live grid');

  // Capture an asynchronously rendered rejection independently of file
  // input clearing. The status message and chooser reset need not coexist.
  const rejectionMessages = [];
  const statusNode = document.querySelector('.grid-save-status');
  assert(statusNode, 'PhiGrid save-status element missing');
  const captureRejection = () => {
    const message = statusNode.textContent ?? '';
    if (message.includes('CSV import rejected')) rejectionMessages.push(message);
  };
  const observer = new MutationObserver(captureRejection);
  observer.observe(statusNode, { childList: true, characterData: true, subtree: true });
  try {
    upload(chooser, 'malformed.csv', 'A,B\nX,"unfinished', 'text/csv');
    await waitFor(() => chooser.value === '' && !document.querySelector('.grid-import-preview'),
      'Malformed CSV file chooser reset without a preview', 10000);
    await waitFor(() => rejectionMessages.length > 0,
      'Malformed CSV rejection appeared in UI', 10000);
  } finally {
    observer.disconnect();
  }
  await sleep(150);
  assert(document.querySelector('.table-wrap tbody tr input')?.value === 'Fixture category',
    'Malformed import mutated live grid');

  upload(chooser, 'verified-final.csv', validCsv, 'text/csv');
  await waitFor(() => document.querySelector('.grid-import-preview'),
    'second CSV import preview; status=' + document.querySelector('.grid-save-status')?.textContent, 12000);
  findButton('Replace current grid with CSV')?.click();
  await waitFor(() => {
    const value = stored(key);
    return value?.title === finalTitle &&
      value?.columns?.[1] === 'Category (2)' &&
      value?.rows?.[0]?.Category === finalCell;
  }, 'Confirmed CSV import autosave');

  sessionStorage.setItem(phaseKey, 'reload');
  location.reload();
  return null;
}

async function runDeck() {
  const key = 'phioffice369:phideck:pitch_deck_outline';
  const finalTitle = 'Imported browser deck';
  if (sessionStorage.getItem(phaseKey) === 'reload') {
    await openTemplate('Pitch Deck Outline', 'Open in PhiDeck-lite', '.deck-title-field input');
    const deck = stored(key);
    assert(deck?.title === finalTitle, 'PhiDeck title missing after refresh');
    assert(deck?.slides?.[0]?.title === 'Imported slide', 'PhiDeck slide missing after refresh');
    assert(deck?.slides?.[0]?.bullets?.[0] === 'Verified locally', 'PhiDeck bullet missing after refresh');
    assert(document.querySelector('.deck-title-field input')?.value === finalTitle, 'PhiDeck title missing in UI');
    assert(document.querySelector('.deck-slide-editor input')?.value === 'Imported slide', 'PhiDeck imported slide not shown');
    upload(document.querySelector('.deck-file-input'), 'invalid.json',
      '{"schema":"unrelated"}', 'application/json');
    await waitFor(() => document.querySelector('.deck-save-status')?.textContent.includes('not a PhiDeck-lite'),
      'Invalid native deck rejection after reload');
    assert(stored(key)?.title === finalTitle, 'Rejected deck import mutated saved title');
    assert(document.querySelector('.deck-title-field input')?.value === finalTitle,
      'Rejected deck import mutated visible title');
    sessionStorage.removeItem(phaseKey);
    return 'PhiDeck edit, add, autosave, JSON export, JSON import and reload';
  }

  await openTemplate('Pitch Deck Outline', 'Open in PhiDeck-lite', '.deck-title-field input');
  edit(document.querySelector('.deck-title-field input'), 'Deck before import');
  edit(document.querySelector('.deck-slide-editor input'), 'Edited title');
  edit(document.querySelector('.deck-slide-editor textarea'), 'Point A\nPoint B');
  await waitFor(() => {
    const deck = stored(key);
    return deck?.title === 'Deck before import' &&
      deck?.slides?.[0]?.title === 'Edited title' &&
      deck?.slides?.[0]?.bullets?.join('|') === 'Point A|Point B';
  }, 'PhiDeck edit autosave');

  findButton('Add slide')?.click();
  await waitFor(() => document.querySelector('.deck-slide-editor input')?.value === 'New Slide', 'Add slide');
  edit(document.querySelector('.deck-slide-editor input'), 'Added test slide');
  await waitFor(() => stored(key)?.slides?.some((slide) => slide.title === 'Added test slide'), 'Added slide autosave');
  const exported = await download('Export JSON');
  assert(exported.filename.endsWith('.json'), 'PhiDeck export extension wrong');
  const deckJson = JSON.parse(exported.body);
  assert(deckJson.schema === 'phioffice369.phideck_lite.v0.1', 'PhiDeck exported wrong schema');
  assert(deckJson.slides.some((slide) => slide.title === 'Added test slide'), 'PhiDeck export dropped added slide');

  const payload = {
    schema: 'phioffice369.phideck_lite.v0.1',
    title: finalTitle,
    slides: [{ id: 'fixture-slide', title: 'Imported slide', bullets: ['Verified locally'] }],
  };
  // Headless Chromium occasionally stalls its first synthetic File.text()
  // resolve. Retry the same local fixture once as a second user file-choice,
  // but still require visible content AND persisted state before PASS.
  const deckChooser = await waitFor(() => document.querySelector('.deck-file-input'),
    'PhiDeck native file chooser');
  let importVisible = false;
  for (let attempt = 0; attempt < 2 && !importVisible; attempt += 1) {
    upload(deckChooser, 'valid-' + attempt + '.json', JSON.stringify(payload), 'application/json');
    try {
      await waitFor(() => document.querySelector('.deck-title-field input')?.value === finalTitle &&
        document.querySelector('.deck-slide-editor input')?.value === 'Imported slide',
        'PhiDeck JSON import visible, attempt ' + (attempt + 1), 6500);
      importVisible = true;
    } catch (error) {
      if (attempt === 1) {
        throw new Error(error.message + '; status=' +
          document.querySelector('.deck-save-status')?.textContent +
          '; selected input=' + deckChooser.value);
      }
    }
  }
  await waitFor(() => {
    const deck = stored(key);
    return deck?.title === finalTitle &&
      deck?.slides?.[0]?.title === 'Imported slide' &&
      deck?.slides?.length === 1;
  }, 'PhiDeck native JSON import autosave; status=' +
    document.querySelector('.deck-save-status')?.textContent, 12000);
  sessionStorage.setItem(phaseKey, 'reload');
  location.reload();
  return null;
}

function publish(result, message) {
  document.documentElement.setAttribute('data-phi-acceptance', result);
  const pre = document.createElement('pre');
  pre.id = 'phi-browser-acceptance-result';
  pre.textContent = 'PhiOffice369 ' + scenario + ' acceptance: ' + result + ' - ' + message;
  document.body.prepend(pre);
}

(async () => {
  assert(scenario === 'phigrid' || scenario === 'phideck', 'Unsupported browser acceptance scenario');
  const result = scenario === 'phigrid' ? await runGrid() : await runDeck();
  if (result) publish('PASS', result);
})().catch((error) => {
  sessionStorage.removeItem(phaseKey);
  publish('FAIL', error?.stack ?? String(error));
});
