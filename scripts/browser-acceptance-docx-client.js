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
function createDocxFixture(variant = 'basic') {
  const encoder = new TextEncoder();
  const manifest = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    (variant === 'external' ? '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' : '') + '</Types>';
  const xml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Hello DOCX</w:t></w:r></w:p><w:p><w:r><w:t>Imported locally. No upload.</w:t></w:r></w:p></w:body></w:document>';
  const externalXml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' +
    '<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>External Meeting Memo</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:pStyle w:val="CompanySection"/></w:pPr><w:r><w:t>External Heading</w:t></w:r></w:p>' +
    '<w:sdt><w:sdtContent><w:p><w:r><w:t>Form control body survives</w:t></w:r></w:p></w:sdtContent></w:sdt>' +
    '<w:p><w:r><w:t>Special characters: café &amp; résumé</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>Regular </w:t></w:r>' +
    '<w:r><w:rPr><w:b/></w:rPr><w:t>Bold</w:t></w:r>' +
    '<w:r><w:t xml:space="preserve"> plus </w:t></w:r>' +
    '<w:r><w:rPr><w:i/></w:rPr><w:t>Italic</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>Reference: </w:t></w:r><w:hyperlink r:id="rIdLink">' +
    '<w:r><w:t>source</w:t></w:r></w:hyperlink></w:p>' +
    '<w:p><w:hyperlink r:id="rIdBad"><w:r><w:t>untrusted URL</w:t></w:r></w:hyperlink></w:p>' +
    '<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="4600"/><w:gridCol w:w="4600"/></w:tblGrid>' +
    '<w:tr><w:tc><w:p><w:r><w:t>Product</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Price</w:t></w:r></w:p></w:tc></w:tr>' +
    '<w:tr><w:tc><w:p><w:r><w:t>Tea &amp; biscuits</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>12</w:t></w:r></w:p></w:tc></w:tr>' +
    '</w:tbl>' +
    '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="7"/></w:numPr></w:pPr><w:r><w:t>First numbered task</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="7"/></w:numPr></w:pPr><w:r><w:t>Second numbered task</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="8"/></w:numPr></w:pPr><w:r><w:t>Bullet note</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="9"/></w:numPr></w:pPr><w:r><w:t>Install router</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="9"/></w:numPr></w:pPr><w:r><w:t>Label cables</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="9"/></w:numPr></w:pPr><w:r><w:t>Verify ports</w:t></w:r></w:p>' +
    '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="9"/></w:numPr></w:pPr><w:r><w:t>Test link</w:t></w:r></w:p>' +
    '</w:body></w:document>';
  const externalStyles = '<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="CompanySection"><w:name w:val="Company Section"/><w:basedOn w:val="Heading2"/></w:style>' +
    '</w:styles>';
  const externalRels = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.org/docs" TargetMode="External"/>' +
    '<Relationship Id="rIdBad" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:alert(1)" TargetMode="External"/>' +
    '</Relationships>';
  const externalNumbering = '<?xml version="1.0"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>' +
    '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>' +
    '<w:num w:numId="7"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="3"/></w:lvlOverride></w:num>' +
    '<w:num w:numId="8"><w:abstractNumId w:val="0"/></w:num>' +
    '<w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="multilevel"/>' +
    '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/></w:lvl>' +
    '<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>' +
    '<w:num w:numId="9"><w:abstractNumId w:val="2"/>' +
    '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="2"/></w:lvlOverride></w:num></w:numbering>';
  const records = [
    ['[Content_Types].xml', manifest],
    ['word/document.xml', variant === 'external' ? externalXml : xml],
    ...(variant === 'external' ? [['word/styles.xml', externalStyles], ['word/_rels/document.xml.rels', externalRels], ['word/numbering.xml', externalNumbering]] : []),
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
  if (sessionStorage.getItem(phase) === 'external-reload') {
    assert(document.querySelector('.title-field input')?.value === 'External Meeting Memo',
      'Word Title style did not survive acceptance/reload');
    assert(editor.value.includes('## External Heading'),
      'Custom Word heading style not restored');
    assert(editor.value.includes('Form control body survives'),
      'Word content-control text not restored');
    assert(editor.value.includes('café & résumé'), 'International Word text not restored');
    assert(editor.value.includes('Regular **Bold** plus *Italic*'), 'Word bold/italic lost on reload');
    assert(editor.value.includes('[source](https://example.org/docs)'), 'Word hyperlink relationship lost');
    assert(editor.value.includes('untrusted URL') && !editor.value.includes('javascript:'),
      'Unsafe Word hyperlink was not reduced to plain text');
    assert(document.querySelector('.phiwrite-print-body strong')?.textContent === 'Bold',
      'Bold run was not rendered in printable document');
    assert(document.querySelector('.phiwrite-print-body em')?.textContent === 'Italic',
      'Italic run was not rendered in printable document');
    assert(document.querySelector('.phiwrite-print-body a[href="https://example.org/docs"]')?.textContent === 'source',
      'Hyperlink was not rendered safely in printable document');
    assert(editor.value.includes('| Product | Price |'), 'External table header missing');
    assert(editor.value.includes('| Tea & biscuits | 12 |'), 'External table row missing');
    assert(editor.value.includes('3. First numbered task\n4. Second numbered task'),
      'Word ordered list was not preserved as contiguous Markdown');
    assert(editor.value.includes('- Bullet note'),
      'Word bullet list did not survive');
    assert(editor.value.includes('2. Install router\n  - Label cables\n  - Verify ports\n3. Test link'),
      'Word two-level list was not preserved as nested Markdown');
    assert(document.querySelector('.phiwrite-print-body ol[start="2"] > li > ul')?.textContent.includes('Verify ports'),
      'Word nested-list print rendering did not preserve hierarchy');
    assert(document.querySelector('.phiwrite-print-body ol[start="3"]')?.textContent.includes('Second numbered task'),
      'Printable ordered list start did not survive DOCX import');
    assert(document.querySelector('.phiwrite-print-body ul')?.textContent.includes('Bullet note'),
      'Printable bullet list did not survive DOCX import');
    assert(document.querySelector('.phiwrite-print-body table')?.textContent.includes('Tea & biscuits'),
      'Printable PhiWrite table not rendered from imported Word data');
    assert(!editor.value.startsWith('External Meeting Memo'),
      'Document title duplicated in body after external import');
    assert(saved()?.title === 'External Meeting Memo' && saved()?.content === editor.value,
      'Imported external-style document not persisted');
    sessionStorage.removeItem(phase);
    publish('PASS', 'external-style OOXML headings, title, content controls and reload');
    return;
  }
  if (sessionStorage.getItem(phase) === 'roundtrip-reload') {
    assert(document.querySelector('.title-field input')?.value === importedTitle,
      'DOCX embedded Word Title style not restored');
    assert(editor.value.startsWith('# Hello DOCX'), 'Exported DOCX heading lost after reimport');
    assert(editor.value.includes('Imported locally. No upload.'),
      'Exported DOCX paragraph lost after reimport');
    assert(!editor.value.startsWith(importedTitle), 'DOCX title duplicated inside the body');
    assert(saved()?.title === importedTitle && saved()?.content === editor.value,
      'Exported DOCX reimport did not persist across reload');

    upload('independent-word-styles.docx', createDocxFixture('external'));
    const preview = await waitFor(() => document.querySelector('.phiwrite-docx-preview'),
      'Word-style external fixture import preview');
    assert(preview.textContent.includes('External Heading'),
      'Custom Word style heading missing from preview');
    assert(preview.textContent.includes('## External Heading'),
      'Custom heading not resolved from styles.xml');
    assert(preview.textContent.includes('Form control body survives'),
      'Word content control text lost');
    assert(preview.textContent.includes('External Meeting Memo'),
      'Word Title style ignored');
    assert(preview.textContent.includes('content control'),
      'DOCX approximation warnings did not mention content controls');
    assert(preview.textContent.includes('| Product | Price |'),
      'External Word table was not converted to Markdown');
    assert(preview.textContent.includes('Markdown pipe tables'),
      'Table compatibility notice missing');
    assert(preview.textContent.includes('3. First numbered task\n4. Second numbered task'),
      'Independent Word numbering definitions were not decoded');
    assert(preview.textContent.includes('- Bullet note'),
      'Independent Word bullets were not decoded');
    assert(preview.textContent.includes('2. Install router\n  - Label cables\n  - Verify ports\n3. Test link'),
      'Independent Word two-level list was not preserved');
    assert(preview.textContent.includes('**Bold**') && preview.textContent.includes('*Italic*'),
      'Word inline emphasis missing from local preview');
    assert(preview.textContent.includes('[source](https://example.org/docs)'),
      'External safe Word hyperlink missing');
    assert(!preview.textContent.includes('javascript:alert'),
      'Unsafe Word hyperlink target leaked into preview');
    assert(document.querySelector('.title-field input')?.value === importedTitle,
      'External preview overwrote active PhiWrite title');
    button('Replace draft with extracted text')?.click();
    await waitFor(() => saved()?.title === 'External Meeting Memo' &&
      saved()?.content?.includes('## External Heading'), 'External-style DOCX saved');
    sessionStorage.setItem(phase, 'external-reload');
    location.reload();
    return;
  }
  if (sessionStorage.getItem(phase) === 'reload') {
    assert(document.querySelector('.title-field input')?.value === importedTitle, 'DOCX title not restored');
    assert(editor.value.includes('# Hello DOCX'), 'DOCX Heading1 not converted into Markdown');
    assert(editor.value.includes('Imported locally. No upload.'), 'DOCX paragraph not restored');
    assert(saved()?.content === editor.value, 'DOCX converted text did not persist');
    assert(!document.querySelector('.phiwrite-docx-preview'), 'DOCX preview left open after reload');

    let exportedBlob = null;
    let exportName = '';
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    try {
      URL.createObjectURL = (blob) => {
        exportedBlob = blob;
        return 'blob:phi-docx-export-smoke';
      };
      URL.revokeObjectURL = () => {};
      HTMLAnchorElement.prototype.click = function captureExport() {
        exportName = this.download;
      };
      assert(button('Export .docx'), 'DOCX export button is missing');
      button('Export .docx').click();
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      HTMLAnchorElement.prototype.click = originalClick;
    }
    assert(exportName === 'sample-word-document.docx', 'DOCX export filename mismatch');
    assert(exportedBlob?.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'DOCX export MIME type missing');
    const bytes = new Uint8Array(await exportedBlob.arrayBuffer());
    assert(bytes.length > 100 && bytes[0] === 0x50 && bytes[1] === 0x4b,
      'DOCX export is not a ZIP file');
    upload('roundtrip-copy.docx', bytes);
    const secondPreview = await waitFor(() => document.querySelector('.phiwrite-docx-preview'),
      'DOCX self-roundtrip preview');
    assert(secondPreview.textContent.includes('Hello DOCX'),
      'DOCX self-roundtrip lost the exported Heading 1');
    assert(secondPreview.textContent.includes('Imported locally. No upload.'),
      'DOCX self-roundtrip lost the exported body');
    assert(editor.value.startsWith('# Hello DOCX'),
      'Preview overwrote the active draft during self-roundtrip');
    button('Replace draft with extracted text')?.click();
    await waitFor(() => saved()?.title === importedTitle &&
      saved()?.content?.includes('# Hello DOCX'), 'DOCX self-roundtrip save');
    sessionStorage.setItem(phase, 'roundtrip-reload');
    location.reload();
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
