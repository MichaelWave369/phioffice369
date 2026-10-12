// Runs only against the temporary localhost production-build server in CI.
// No fixtures or user data are uploaded; the browser profile is disposable.
const phaseKey = '__phioffice369_acceptance_phase_v1';
const storageKey = 'phioffice369:phiwrite:basic_project_spec';
const expectedTitle = 'PhiOffice Browser Acceptance';
const rawContent = '## Real Browser Check\n\nLocal autosave survives reload.\n\n<script>alert("not executable")</script>\n\nFormatting: alpha beta gamma delta epsilon zeta';
const expectedContent = '## Real Browser Check\n\nLocal autosave survives reload.\n\n<script>alert("not executable")</script>\n\nFormatting: **alpha** *beta* ++gamma++ ~~delta~~ ==epsilon== `zeta`';

function assert(condition, description) {
  if (!condition) throw new Error(description);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, message, timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await sleep(50);
  }
  throw new Error('Timed out: ' + message);
}

function findButton(text) {
  return Array.from(document.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text && !button.disabled,
  ) ?? null;
}

function changeInput(element, value) {
  assert(element, 'Missing editable field');
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  assert(setter, 'Native input setter is unavailable');
  setter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

async function openPhiWrite() {
  // Onboarding appears after an effect; the smoke profile has no user data.
  const tabs = await waitFor(() => document.querySelector('nav.tabs'), 'suite tabs');
  await sleep(100);
  const close = document.querySelector('button[aria-label="Close onboarding"]');
  close?.click();

  const templates = Array.from(tabs.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === 'Templates',
  );
  assert(templates, 'Templates tab is absent');
  templates.click();

  const open = await waitFor(
    () => findButton('Open in PhiWrite-lite'),
    'template launcher button',
  );
  open.click();
  return waitFor(() => document.querySelector('.editor-field textarea'), 'PhiWrite editor');
}

function publish(result, message) {
  document.documentElement.setAttribute('data-phi-acceptance', result);
  const pre = document.createElement('pre');
  pre.id = 'phi-browser-acceptance-result';
  pre.textContent = 'PhiOffice369 browser acceptance: ' + result + ' - ' + message;
  document.body.prepend(pre);
}

async function run() {
  if (sessionStorage.getItem(phaseKey) === 'reload') {
    const editor = await openPhiWrite();
    const title = document.querySelector('.title-field input');
    assert(title?.value === expectedTitle, 'Saved title was not restored after reload');
    assert(editor.value === expectedContent, 'Saved document body was not restored after reload');
    const printable = document.querySelector('.phiwrite-print-page');
    assert(printable?.textContent?.includes(expectedTitle), 'Restored print view has wrong title');
    assert(printable?.textContent?.includes('not executable'), 'Restored print view lost content');
    assert(!printable.querySelector('script'), 'User text executed as a script in print view');
    assert(printable.querySelector('strong')?.textContent === 'alpha', 'Bold toolbar formatting not preserved on reload');
    assert(printable.querySelector('em')?.textContent === 'beta', 'Italic toolbar formatting not preserved on reload');
    assert(printable.querySelector('u')?.textContent === 'gamma', 'Underline toolbar formatting not preserved on reload');
    assert(printable.querySelector('del')?.textContent === 'delta', 'Strikethrough toolbar formatting not preserved on reload');
    assert(printable.querySelector('mark')?.textContent === 'epsilon', 'Highlight toolbar formatting not preserved on reload');
    assert(printable.querySelector('code')?.textContent === 'zeta', 'Code toolbar formatting not preserved on reload');
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    assert(stored?.title === expectedTitle, 'Persisted local draft missing title');
    assert(stored?.content === expectedContent, 'Persisted local draft missing content');
    sessionStorage.removeItem(phaseKey);
    publish('PASS', 'edit, autosave, HTML output, print control and reload/restore verified');
    return;
  }

  const editor = await openPhiWrite();
  changeInput(document.querySelector('.title-field input'), expectedTitle);
  changeInput(editor, rawContent);

  const toolbar = await waitFor(() => document.querySelector('[role="toolbar"][aria-label="PhiWrite text formatting"]'),
    'PhiWrite formatting toolbar');
  const formatButton = (label) => [...toolbar.querySelectorAll('button')].find((btn) =>
    btn.getAttribute('aria-label')?.startsWith(label));
  async function formatWord(word, buttonLabel, shortcutKey = null) {
    const start = editor.value.lastIndexOf('Formatting:') + editor.value.split('Formatting:')[1].indexOf(word) + 'Formatting:'.length;
    assert(editor.value.slice(start, start + word.length) === word, 'Could not locate ' + word);
    editor.focus();
    editor.setSelectionRange(start, start + word.length);
    if (shortcutKey) {
      editor.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, cancelable: true, ctrlKey: true, key: shortcutKey,
      }));
    } else {
      const button = formatButton(buttonLabel);
      assert(button, 'Missing format button ' + buttonLabel);
      button.click();
    }
    const marker = { Bold: '**', Italic: '*', Underline: '++',
      Strikethrough: '~~', Highlight: '==', Code: '`' }[buttonLabel];
    await waitFor(() => editor.value.includes(marker + word + marker),
      'Formatting applied to ' + word);
    await waitFor(() => document.activeElement === editor &&
      editor.value.slice(editor.selectionStart, editor.selectionEnd) === word,
      'Formatting focus and selection restoration for ' + word);
  }
  await formatWord('alpha', 'Bold', 'b');
  await formatWord('beta', 'Italic', 'i');
  await formatWord('gamma', 'Underline', 'u');
  await formatWord('delta', 'Strikethrough');
  await formatWord('epsilon', 'Highlight');
  await formatWord('zeta', 'Code');
  assert(editor.value === expectedContent, 'Formatting toolbar produced incorrect Markdown');

  // A second click with text still selected removes the same markup.
  formatButton('Code').click();
  await waitFor(() => editor.value.endsWith('==epsilon== zeta'), 'Code toolbar toggle off');
  await waitFor(() => editor.value.slice(editor.selectionStart, editor.selectionEnd) === 'zeta',
    'Code toggle-off selection restoration');
  formatButton('Code').click();
  await waitFor(() => editor.value === expectedContent, 'Code toolbar toggle back on');
  await waitFor(() => editor.value.slice(editor.selectionStart, editor.selectionEnd) === 'zeta',
    'Code toggle-on selection restoration');

  // Reject multiline selections and preserve the working draft.
  editor.setSelectionRange(0, editor.value.indexOf('Local'));
  formatButton('Highlight').click();
  assert(editor.value === expectedContent, 'Multiline selection was unexpectedly changed');
  await waitFor(() => document.querySelector('.phiwrite-format-help')?.textContent.includes('single-line'),
    'Multiline selection did not explain the limit');

  await waitFor(() => {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    return stored?.title === expectedTitle && stored?.content === expectedContent;
  }, 'PhiWrite local autosave');

  const preview = document.querySelector('.phiwrite-print-page');
  assert(preview?.textContent?.includes(expectedTitle), 'Print view did not update its title');
  assert(preview?.textContent?.includes('not executable'), 'Print view did not update its body');
  assert(!preview.querySelector('script'), 'Print view contains injected script');

  // Capture the local export in memory; do not create a downloaded file.
  let exportedBlob = null;
  let exportName = '';
  const createObjectURL = URL.createObjectURL;
  const revokeObjectURL = URL.revokeObjectURL;
  const click = HTMLAnchorElement.prototype.click;
  try {
    URL.createObjectURL = (blob) => {
      exportedBlob = blob;
      return 'blob:phioffice369-smoke';
    };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function interceptDownload() {
      exportName = this.download;
    };
    const exportButton = findButton('Export HTML');
    assert(exportButton, 'Export HTML button missing');
    exportButton.click();
  } finally {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    HTMLAnchorElement.prototype.click = click;
  }
  assert(exportedBlob, 'HTML export did not create a Blob');
  assert(exportName.endsWith('.html'), 'HTML export filename is missing .html');
  const html = await exportedBlob.text();
  assert(html.includes('&lt;script&gt;alert'), 'Exported HTML did not escape user script');
  assert(!html.includes('<script>alert'), 'Exported HTML contains executable user script');
  assert(html.includes('Trust label:'), 'Exported HTML is missing trust metadata');

  let printCalled = false;
  const originalPrint = window.print;
  try {
    window.print = () => { printCalled = true; };
    const printButton = findButton('Print / Save as PDF');
    assert(printButton, 'Print / Save as PDF button missing');
    printButton.click();
    assert(printCalled, 'Print button did not call browser print');
  } finally {
    window.print = originalPrint;
  }

  sessionStorage.setItem(phaseKey, 'reload');
  window.location.reload();
}

run().catch((error) => {
  sessionStorage.removeItem(phaseKey);
  publish('FAIL', error?.stack || String(error));
});
