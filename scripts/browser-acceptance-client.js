// Runs only against the temporary localhost production-build server in CI.
// No fixtures or user data are uploaded; the browser profile is disposable.
const phaseKey = '__phioffice369_acceptance_phase_v1';
const storageKey = 'phioffice369:phiwrite:basic_project_spec';
const expectedTitle = 'PhiOffice Browser Acceptance';
const rawContent = '## Real Browser Check\n\nLocal autosave survives reload.\n\n<script>alert("not executable")</script>\n\nFormatting: alpha beta gamma delta epsilon zeta\n\nReference: field manual\n\nOutline heading\n\nInspect cable\nVerify port';
const expectedFormatting = '## Real Browser Check\n\nLocal autosave survives reload.\n\n<script>alert("not executable")</script>\n\nFormatting: **alpha** *beta* ++gamma++ ~~delta~~ ==epsilon== `zeta`\n\nReference: field manual\n\nOutline heading\n\nInspect cable\nVerify port';
const expectedContent = expectedFormatting.replace('field manual', '[field manual](https://example.org/docs)');
const expectedFinalContent = expectedContent.replace('Outline heading', '## Outline heading')
  .replace('Inspect cable\nVerify port', '- Inspect cable\n- Verify port');

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
    assert(editor.value === expectedFinalContent, 'Saved document body was not restored after reload');
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
    assert(printable.querySelector('a[href="https://example.org/docs"]')?.textContent === 'field manual',
      'Safe external link not present in React print after reload');
    assert([...printable.querySelectorAll('.phiwrite-print-body h3')].some((node) =>
      node.textContent === 'Outline heading'), 'Heading 2 toolbar output did not survive reload');
    assert([...printable.querySelectorAll('.phiwrite-print-body ul')].some((node) =>
      node.textContent.includes('Inspect cable') && node.textContent.includes('Verify port')),
      'Bullet list toolbar output did not survive reload');
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    assert(stored?.title === expectedTitle, 'Persisted local draft missing title');
    assert(stored?.content === expectedFinalContent, 'Persisted local draft missing content');
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
  assert(editor.value === expectedFormatting, 'Formatting toolbar produced incorrect Markdown');

  // A second click with text still selected removes the same markup.
  formatButton('Code').click();
  await waitFor(() => editor.value.includes('==epsilon== zeta\n\nReference: field manual'), 'Code toolbar toggle off');
  await waitFor(() => editor.value.slice(editor.selectionStart, editor.selectionEnd) === 'zeta',
    'Code toggle-off selection restoration');
  formatButton('Code').click();
  await waitFor(() => editor.value === expectedFormatting, 'Code toolbar toggle back on');
  await waitFor(() => editor.value.slice(editor.selectionStart, editor.selectionEnd) === 'zeta',
    'Code toggle-on selection restoration');

  // Review a prospective hyperlink without modifying the active draft.
  const linkWord = 'field manual';
  const linkStart = editor.value.indexOf(linkWord);
  editor.focus();
  editor.setSelectionRange(linkStart, linkStart + linkWord.length);
  const insertLink = await waitFor(() => findButton('Link'), 'Insert Link toolbar action');
  insertLink.click();
  const linkForm = await waitFor(() =>
    document.querySelector('form[aria-label="Insert safe external link"]'), 'Link review panel');
  assert(linkForm.querySelector('input[aria-label="Link text"]')?.value === linkWord,
    'Selected text did not initialize the link label');
  assert(editor.value === expectedFormatting, 'Opening link review mutated the draft');
  changeInput(linkForm.querySelector('input[aria-label="HTTP(S) address"]'), 'javascript:alert(1)');
  findButton('Insert link')?.click();
  await waitFor(() => linkForm.querySelector('[role="alert"]')?.textContent.includes('valid HTTP(S)'),
    'Unsafe link was not rejected with a visible explanation');
  assert(editor.value === expectedFormatting, 'Unsafe URL changed the draft');
  findButton('Cancel link')?.click();
  await waitFor(() => !document.querySelector('form[aria-label="Insert safe external link"]'),
    'Link cancellation');
  assert(editor.value === expectedFormatting, 'Cancel link changed the document');

  // Ctrl+K must restore the selected label as a safe HTTPS hyperlink.
  editor.focus();
  editor.setSelectionRange(linkStart, linkStart + linkWord.length);
  editor.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true, cancelable: true, ctrlKey: true, key: 'k',
  }));
  const approved = await waitFor(() =>
    document.querySelector('form[aria-label="Insert safe external link"]'),
    'Ctrl+K link editor');
  assert(approved.querySelector('input[aria-label="Link text"]')?.value === linkWord,
    'Ctrl+K did not preserve selection');
  changeInput(approved.querySelector('input[aria-label="HTTP(S) address"]'), 'https://example.org/docs');
  findButton('Insert link')?.click();
  await waitFor(() => editor.value === expectedContent, 'Approved link insertion');
  await waitFor(() => document.activeElement === editor &&
    editor.value.slice(editor.selectionStart, editor.selectionEnd) === linkWord,
    'Approved link selection restored');
  await waitFor(() => document.querySelector('.phiwrite-print-body a[href="https://example.org/docs"]')
      ?.textContent === linkWord, 'Safe link visible in React print');

  // Paragraph tools edit whole lines, and preserve a selection for toggles.
  const paragraphs = await waitFor(() =>
    document.querySelector('[role="toolbar"][aria-label="PhiWrite paragraph formatting"]'),
    'Paragraph formatting toolbar');
  const paragraphButton = (label) => [...paragraphs.querySelectorAll('button')].find(
    (button) => button.getAttribute('aria-label') === label);
  async function clickParagraph(label, expected) {
    const button = paragraphButton(label);
    assert(button, 'Paragraph action missing: ' + label);
    button.click();
    await waitFor(() => editor.value === expected, 'Paragraph action: ' + label);
  }
  const headingIndex = editor.value.indexOf('Outline heading');
  editor.focus();
  editor.setSelectionRange(headingIndex, headingIndex + 'Outline heading'.length);
  await clickParagraph('Heading 1', expectedContent.replace('Outline heading', '# Outline heading'));
  await clickParagraph('Heading 3', expectedContent.replace('Outline heading', '### Outline heading'));
  await clickParagraph('Heading 3', expectedContent);
  await clickParagraph('Heading 2', expectedContent.replace('Outline heading', '## Outline heading'));
  const headingReady = editor.value;

  const listBegin = editor.value.indexOf('Inspect cable');
  const listEnd = listBegin + 'Inspect cable\nVerify port'.length;
  editor.focus();
  editor.setSelectionRange(listBegin, listEnd);
  await clickParagraph('Numbered list',
    headingReady.replace('Inspect cable\nVerify port', '1. Inspect cable\n2. Verify port'));
  await clickParagraph('Numbered list', headingReady);
  await clickParagraph('Bullet list', expectedFinalContent);
  // A multiline heading attempt must be rejected with no mutations.
  paragraphButton('Heading 1').click();
  assert(editor.value === expectedFinalContent,
    'Multiline heading unexpectedly changed the selected list');
  await waitFor(() => document.querySelector('.phiwrite-format-help')?.textContent.includes('single paragraph'),
    'Rejected multi-line heading did not explain its limitation');

  // Reject multiline selections and preserve the working draft.
  editor.setSelectionRange(0, editor.value.indexOf('Local'));
  formatButton('Highlight').click();
  assert(editor.value === expectedFinalContent, 'Multiline selection was unexpectedly changed');
  await waitFor(() => document.querySelector('.phiwrite-format-help')?.textContent.includes('single-line'),
    'Multiline selection did not explain the limit');

  await waitFor(() => {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    return stored?.title === expectedTitle && stored?.content === expectedFinalContent;
  }, 'PhiWrite local autosave');

  const preview = document.querySelector('.phiwrite-print-page');
  assert(preview?.textContent?.includes(expectedTitle), 'Print view did not update its title');
  assert(preview?.textContent?.includes('not executable'), 'Print view did not update its body');
  assert(preview.querySelector('.phiwrite-print-body h3')?.textContent === 'Outline heading',
    'Heading 2 not reflected in local React print');
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
  assert(html.includes('href="https://example.org/docs"'), 'Safe link lost from HTML export');
  assert(html.includes('<h3>Outline heading</h3>'), 'Heading 2 absent from exported HTML');
  assert(html.includes('<li>Inspect cable</li>') && html.includes('<li>Verify port</li>'),
    'Bullet list absent from exported HTML');
  assert(!html.includes('href="javascript:'), 'Unsafe link was introduced into HTML export');

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
