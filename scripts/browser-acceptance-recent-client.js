// Production-build browser acceptance for independent local files and Recent Files.
// Runs only in a disposable localhost Chrome profile. No external services.
const phaseKey = '__phioffice369_recent_files_phase';

function assert(value, message) {
  if (!value) throw new Error(message);
}
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function waitFor(predicate, message, ms = 7000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const value = predicate();
    if (value) return value;
    await sleep(50);
  }
  throw new Error('Timed out: ' + message);
}
function button(text) {
  return [...document.querySelectorAll('button')].find(
    (el) => !el.disabled && el.textContent?.trim() === text,
  );
}
function edit(el, value) {
  assert(el, 'Missing input field');
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
function selectApp(name) {
  const card = [...document.querySelectorAll('.app-card')].find(
    (el) => el.querySelector('.app-name')?.textContent === name,
  );
  assert(card, 'Missing Suite app card ' + name);
  card.click();
}
async function closeEditor() {
  const back = await waitFor(() => button('Back to PhiOffice'), 'Back to PhiOffice');
  back.click();
  await waitFor(() => document.querySelector('.recent-files-panel'), 'Recent Files panel after return');
}
async function newFile(app, selector) {
  selectApp(app);
  const newButton = await waitFor(() => button('New ' + app + ' file'), 'New ' + app + ' file');
  newButton.click();
  return waitFor(() => document.querySelector(selector), app + ' editor opened');
}
function storedWithPrefix(prefix) {
  return Object.keys(localStorage).filter((key) => key.startsWith(prefix)).map((key) => ({
    key, value: JSON.parse(localStorage.getItem(key)),
  }));
}
async function openRecent(name, selector) {
  const result = await waitFor(() => [...document.querySelectorAll('.recent-file-open')].find(
    (el) => el.querySelector('.recent-file-name')?.textContent === name,
  ), 'Recent Files entry ' + name);
  result.click();
  return waitFor(() => document.querySelector(selector), name + ' reopened');
}
function publish(result, message) {
  document.documentElement.setAttribute('data-phi-acceptance', result);
  const el = document.createElement('pre');
  el.id = 'phi-browser-acceptance-result';
  el.textContent = 'PhiOffice369 recent files acceptance: ' + result + ' - ' + message;
  document.body.prepend(el);
}

async function run() {
  await waitFor(() => document.querySelector('nav.tabs'), 'Suite tabs');
  await sleep(100);
  document.querySelector('button[aria-label="Close onboarding"]')?.click();
  const oldKey = 'phioffice369:phiwrite:basic_project_spec';

  if (sessionStorage.getItem(phaseKey) === 'reload') {
    await waitFor(() => document.querySelectorAll('.recent-file-open').length >= 5, 'saved recent files after browser reload');
    const first = await openRecent('First independent spec', '.editor-field textarea');
    assert(first.value === 'first independent content', 'First independent document body lost on page refresh');
    assert(document.querySelector('.title-field input')?.value === 'First independent spec', 'First title lost on refresh');
    assert(JSON.parse(localStorage.getItem(oldKey))?.content === 'legacy content', 'Legacy document overwritten by new files');
    sessionStorage.removeItem(phaseKey);
    publish('PASS', 'two separate docs, legacy preservation, grid, deck, recent reopen and browser reload');
    return;
  }

  // Legacy template draft stays where users expect it. New files must never overwrite it.
  const openLegacy = await waitFor(() => button('Open PhiWrite'), 'legacy PhiWrite launcher');
  openLegacy.click();
  await waitFor(() => document.querySelector('.editor-field textarea'), 'legacy editor');
  edit(document.querySelector('.title-field input'), 'Legacy draft');
  edit(document.querySelector('.editor-field textarea'), 'legacy content');
  await sleep(80);
  await closeEditor();
  assert(JSON.parse(localStorage.getItem(oldKey))?.content === 'legacy content', 'Legacy draft not saved');

  await newFile('PhiWrite', '.editor-field textarea');
  edit(document.querySelector('.title-field input'), 'First independent spec');
  edit(document.querySelector('.editor-field textarea'), 'first independent content');
  await sleep(80);
  await closeEditor();

  await newFile('PhiWrite', '.editor-field textarea');
  edit(document.querySelector('.title-field input'), 'Second independent spec');
  edit(document.querySelector('.editor-field textarea'), 'second independent content');
  await sleep(80);
  await closeEditor();

  const docs = storedWithPrefix('phioffice369:phiwrite:');
  assert(docs.length === 3, 'Expected one legacy template plus two distinct documents');
  const first = docs.find((file) => file.value.title === 'First independent spec');
  const second = docs.find((file) => file.value.title === 'Second independent spec');
  assert(first?.key !== second?.key, 'Two new documents share one storage key');
  assert(first?.value.sourceTemplateId === 'basic_project_spec', 'First document lost source-template identity');
  assert(second?.value.content === 'second independent content', 'Second document body missing');
  assert(JSON.parse(localStorage.getItem(oldKey))?.content === 'legacy content', 'Legacy draft overwritten');

  await newFile('PhiGrid', '.grid-title-field input');
  assert(document.querySelector('.table-wrap tbody tr input')?.value === 'Income', 'Independent budget missing template rows');
  edit(document.querySelector('.grid-title-field input'), 'Independent budget');
  await sleep(80);
  await closeEditor();

  await newFile('PhiDeck', '.deck-title-field input');
  assert(document.querySelector('.deck-slide-editor input')?.value === 'Problem', 'Independent deck missing template slide');
  edit(document.querySelector('.deck-title-field input'), 'Independent pitch');
  await sleep(80);
  await closeEditor();

  assert(storedWithPrefix('phioffice369:phigrid:file_').some((item) => item.value.title === 'Independent budget'),
    'Independent budget not stored');
  assert(storedWithPrefix('phioffice369:phideck:file_').some((item) => item.value.title === 'Independent pitch'),
    'Independent deck not stored');

  const recent = document.querySelectorAll('.recent-file-open');
  assert(recent.length >= 5, 'Recent Files dashboard missed saved artifacts');
  const firstReopened = await openRecent('First independent spec', '.editor-field textarea');
  assert(firstReopened.value === 'first independent content', 'Recent Files reopened the wrong draft');
  await closeEditor();
  sessionStorage.setItem(phaseKey, 'reload');
  location.reload();
}

run().catch((error) => {
  sessionStorage.removeItem(phaseKey);
  publish('FAIL', error?.stack ?? String(error));
});
