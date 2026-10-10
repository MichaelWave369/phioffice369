// DOCX preview acceptance against an actual in-memory OOXML ZIP container.
// This runs in a throwaway browser profile and never reads user documents.
const phase = '__phi_docx_preview_acceptance_v1';
const storageKey = 'phioffice369:phiwrite:basic_project_spec';
const sourceTitle = 'Original browser draft';
const importedTitle = 'sample-word-document';

function assert(condition, message) { if (!condition) throw new Error(message); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function waitFor(fn, message, timeoutMs = 7000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = fn();
    if (value) return value;
    await sleep(50);
  }
  throw new Error('Timed out: ' + message);
}
function button(label) {
  return [...document.querySelectorAll('button')].find((element) => element.textContent?.trim() === label) ?? null;
}
function edit(input, value) {
  assert(input, 'Missing input');
  const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
async function openWrite() {
  const tabs = await waitFor(() => document.querySelector('nav.tabs'), 'navigation');
  await sleep(100);
  document.querySelector('button[aria-label="Close onboarding"]')?.click();
  [...tabs.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Templates')?.click();
  await waitFor(() => button('Open in PhiWrite-lite'), 'PhiWrite starter');
  button('Open in PhiWrite-lite').click();
  return waitFor(() => document.querySelector('.editor-field textarea'), 'PhiWrite editor');
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function createDocxFixture() {
  const encoder = new TextEncoder();
  const manifest = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const xml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Hello DOCX</w:t></w:r></w:p><w:p><w:r><w:t>Imported locally. No upload.</w:t></w:r></w:p></w:body></w:document>';
  const records = [
    ['[Content_Types].xml', manifest],
    ['word/document.xml', xml],
  ];
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  function record(size) {
    return { bytes: new Uint8Array(size), view: new DataView(new ArrayBuffer(size)) };
  }
  function header(size) {
    const bytes = new Uint8Array(size);
    return { bytes, view: new DataView(bytes.buffer) };
  }
  for (const [name, text] of records) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(text);
    const checksum = crc32(data);
    const local = header(30);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint32(14, checksum, true);
    local.view.setUint32(18, data.length, true);
    local.view.setUint32(22, data.length, true);
    local.view.setUint16(26, nameBytes.length, true);
    localParts.push(local.bytes, nameBytes, data);
    const cd = header(46);
    cd.view.setUint32(0, 0x02014b50, true);
    cd.view.setUint16(4, 20, true);
    cd.view.setUint16(6, 20, true);
    cd.view.setUint32(16, checksum, true);
    cd.view.setUint32(20, data.length, true);
    cd.view.setUint32(24, data.length, true);
    cd.view.setUint16(28, nameBytes.length, true);
    cd.view.setUint32(42, offset, true);
    centralParts.push(cd.bytes, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralLength = centralParts.reduce((sum, part) => sum + part.length, 0);
  const ending = header(22);
  ending.view.setUint32(0, 0x06054b50, true);
  ending.view.setUint16(8, records.length, true);
  ending.view.setUint16(10, records.length, true);
  ending.view.setUint32(12, centralLength, true);
  ending.view.setUint32(16, offset, true);
  const parts = [...localParts, ...centralParts, ending.bytes];
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) { result.set(part, cursor); cursor += part.length; }
  return result;
}
function upload(name, bytes) {
  const input = document.querySelector('input[accept^=".docx"]');
  assert(input, 'DOCX input missing');
  const transfer = new DataTransfer();
  transfer.items.add(new File([bytes], name, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
function saved() { return JSON.parse(localStorage.getItem(storageKey) ?? 'null'); }
function publish(result, detail) {
  document.documentElement.setAttribute('data-phi-acceptance', result);
  const element = document.createElement('pre');
  element.id = 'phi-browser-acceptance-result';
  element.textContent = 'DOCX browser acceptance ' + result + ': ' + detail;
  document.body.prepend(element);
}
async function run() {
  const editor = await openWrite();
  if (sessionStorage.getItem(phase) === 'reload') {
    assert(document.querySelector('.title-field input')?.value === importedTitle, 'DOCX title not restored');
    assert(editor.value.includes('# Hello DOCX'), 'DOCX Heading1 not converted into Markdown');
    assert(editor.value.includes('Imported locally. No upload.'), 'DOCX paragraph not restored');
    assert(saved()?.content === editor.value, 'DOCX converted text did not persist');
    assert(!document.querySelector('.phiwrite-docx-preview'), 'DOCX preview left open after reload');
    sessionStorage.removeItem(phase);
    publish('PASS', 'Word ZIP, safe review, cancel, confirmation and reload');
    return;
  }

  edit(document.querySelector('.title-field input'), sourceTitle);
  edit(editor, 'Existing text should survive preview and cancel.');
  await waitFor(() => saved()?.title === sourceTitle && saved()?.content.includes('Existing text'), 'source autosave');

  upload('broken.docx', new TextEncoder().encode('not a zip'));
  await waitFor(() => document.querySelector('.save-status')?.textContent.includes('DOCX import:'), 'invalid package rejection');
  assert(editor.value.includes('Existing text'), 'Invalid DOCX changed active editor');

  const fixture = createDocxFixture();
  upload('sample-word-document.docx', fixture);
  const preview = await waitFor(() => document.querySelector('.phiwrite-docx-preview'), 'valid DOCX review');
  assert(preview.textContent.includes('Hello DOCX'), 'DOCX preview missing converted heading');
  assert(preview.textContent.includes('not preserved'), 'DOCX compatibility warning missing');
  assert(editor.value.includes('Existing text'), 'DOCX preview replaced editor prematurely');
  button('Cancel, keep draft')?.click();
  await waitFor(() => !document.querySelector('.phiwrite-docx-preview'), 'DOCX cancel');
  assert(saved()?.title === sourceTitle, 'Cancel replaced persisted draft');

  upload('sample-word-document.docx', fixture);
  await waitFor(() => document.querySelector('.phiwrite-docx-preview'), 'DOCX second preview');
  button('Replace draft with extracted text')?.click();
  await waitFor(() => saved()?.title === importedTitle && saved()?.content?.includes('Hello DOCX'),
    'DOCX confirmation autosave');
  sessionStorage.setItem(phase, 'reload');
  location.reload();
}
run().catch((error) => {
  sessionStorage.removeItem(phase);
  publish('FAIL', error?.stack ?? String(error));
});
