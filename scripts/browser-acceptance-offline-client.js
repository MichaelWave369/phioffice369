// Production Pages scope, mobile UI, cached navigation and optional ecosystem boundaries.
const check = (condition, message) => { if (!condition) throw new Error(message); };
async function waitFor(predicate, description) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 45));
  }
  throw new Error('Timed out: ' + description);
}
const button = (name, doc = document) => [...doc.querySelectorAll('button')].find((item) => item.textContent.trim() === name);
const click = async (name, doc) => (await waitFor(() => button(name, doc), name)).click();
function input(field, value) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set.call(field, value);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
}
function publish(status, message) {
  document.documentElement.dataset.phiAcceptance = status;
  const node = document.createElement('pre');
  node.id = 'phi-browser-acceptance-result';
  node.textContent = message;
  document.body.prepend(node);
}
function fitsViewport(doc) {
  return doc.documentElement.scrollWidth <= doc.documentElement.clientWidth + 1;
}

async function run() {
  await waitFor(() => document.querySelector('.workspace-welcome'), 'dashboard');
  document.querySelector('[aria-label="Close onboarding"]')?.click();
  const appearance = document.querySelector('[aria-label="Appearance"]');
  input(appearance, 'dark');
  await waitFor(() => document.documentElement.dataset.appearance === 'dark', 'dark appearance');
  input(appearance, 'light');
  await waitFor(() => document.documentElement.dataset.appearance === 'light', 'light appearance');
  check(fitsViewport(document), 'Launcher spills horizontally at the test viewport');

  await click('Shortcuts');
  const dialog = await waitFor(() => document.querySelector('dialog.shortcut-card[open]'), 'modal shortcut help');
  check(dialog.contains(document.activeElement), 'Keyboard focus escaped the modal');
  dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
  await waitFor(() => !document.querySelector('dialog.shortcut-card[open]'), 'dialog dismissal');

  await click('New document');
  const editor = await waitFor(() => document.querySelector('.editor-field textarea'), 'blank PhiWrite file');
  check(editor.value === '', 'Blank document started with starter-template content');
  check(fitsViewport(document), 'PhiWrite spills horizontally at the test viewport');
  input(document.querySelector('.title-field input'), 'Offline field notes');
  input(editor, 'Kept in this browser.');
  await click('Save file');
  await click('Back to PhiOffice');

  await click('Professor Phi');
  const prompt = await waitFor(() => document.querySelector('.professor-prompt-box textarea'), 'Professor Phi panel');
  input(prompt, 'Explain the field notes');
  await click('Send local prompt');
  await waitFor(() => document.querySelector('.professor-response-card')?.textContent.includes('Built-in demo'), 'labeled demo response');
  await click('Suite');
  await waitFor(() => document.querySelector('.workspace-local-badge').textContent.trim() === 'Offline ready', 'scoped service worker controller');
  const cacheNames = await caches.keys();
  check(cacheNames.some((name) => name.startsWith('phioffice369-shell-')), 'Offline app shell was not cached');

  const path = location.pathname;
  const iframe = document.createElement('iframe');
  iframe.title = 'Offline acceptance fixture';
  iframe.width = String(Math.min(document.documentElement.clientWidth, 390));
  iframe.height = '800';
  // The test server returns 503 on this URL. Rendering the suite requires the
  // real service worker to serve its previously cached production app shell.
  iframe.src = path + '?offline-probe=1&app=PhiGrid';
  document.body.append(iframe);
  const offline = await waitFor(() => iframe.contentDocument?.querySelector('.workspace-welcome') && iframe.contentDocument, 'cached dashboard');
  check(offline.documentElement.dataset.appearance === 'light', 'Appearance did not persist across navigation');
  check(offline.querySelector('.app-card[aria-pressed="true"] .app-name')?.textContent === 'PhiGrid', 'PhiOS launch did not select PhiGrid');
  const recent = [...offline.querySelectorAll('.recent-file-open')].find((item) => item.textContent.includes('Offline field notes'));
  check(recent, 'Previously saved local file missing from the cached workspace');
  recent.click();
  const reopened = await waitFor(() => offline.querySelector('.editor-field textarea'), 'local file opened during fallback');
  check(reopened.value === 'Kept in this browser.', 'Offline reopen changed file content');
  input(reopened, 'Edited with the app shell offline.');
  await click('Save file', offline);
  await waitFor(() => offline.querySelector('.save-status').textContent.includes('Saved locally'), 'offline save');
  iframe.remove();
  publish('PASS', 'Themes, keyboard dialog, blank file, demo provenance, scoped offline navigation, launcher and local edit.');
}

run().catch((error) => publish('FAIL', error.stack));
