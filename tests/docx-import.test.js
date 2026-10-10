import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import {
  crc32, extractDocxXml, findDocxZipEntries,
} from '../apps/web/src/lib/docxZip.js';
import { renderDocxBlocksAsMarkdown } from '../apps/web/src/lib/docxImport.js';

const contentTypes = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
const wordXml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello Word</w:t></w:r></w:p></w:body></w:document>';

function fixtureZip(entries) {
  const chunks = [];
  const directory = [];
  let offset = 0;
  for (const { name, data, method = 0 } of entries) {
    const filename = Buffer.from(name);
    const plain = Buffer.from(data);
    const zipped = method === 8 ? deflateRawSync(plain) : plain;
    const checksum = crc32(plain);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(zipped.length, 18);
    local.writeUInt32LE(plain.length, 22);
    local.writeUInt16LE(filename.length, 26);
    chunks.push(local, filename, zipped);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt32LE(checksum, 16);
    cd.writeUInt32LE(zipped.length, 20);
    cd.writeUInt32LE(plain.length, 24);
    cd.writeUInt16LE(filename.length, 28);
    cd.writeUInt32LE(offset, 42);
    directory.push(cd, filename);
    offset += local.length + filename.length + zipped.length;
  }

  const cdBytes = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cdBytes, end]);
}

function docx(document = wordXml, method = 0) {
  return fixtureZip([
    { name: '[Content_Types].xml', data: contentTypes, method },
    { name: 'word/document.xml', data: document, method },
  ]);
}

test('bounded ZIP reader reads genuine stored OOXML entries', async () => {
  const zip = docx();
  const inspected = findDocxZipEntries(zip);
  assert.equal(inspected.entries.size, 2);
  assert.equal(await extractDocxXml(zip), wordXml);
});

test('bounded ZIP reader decompresses genuine DEFLATE OOXML entries', async () => {
  assert.equal(await extractDocxXml(docx(wordXml, 8)), wordXml);
});

test('reader rejects corrupted ZIP checksums', async () => {
  const zip = docx();
  const offset = zip.indexOf(Buffer.from('Hello Word'));
  assert.ok(offset > 0);
  zip[offset] ^= 0x01;
  await assert.rejects(() => extractDocxXml(zip), /checksum/);
});

test('reader rejects wrong archive signatures or missing DOCX package parts', async () => {
  await assert.rejects(() => extractDocxXml(Buffer.from('not a zip')), /Invalid ZIP/);
  const unrelated = fixtureZip([{ name: 'random.txt', data: 'not word content' }]);
  await assert.rejects(() => extractDocxXml(unrelated), /Missing standard DOCX/);
});

test('reader rejects duplicate ZIP entry names', () => {
  const zip = fixtureZip([
    { name: 'word/document.xml', data: wordXml },
    { name: 'word/document.xml', data: wordXml },
  ]);
  assert.throws(() => findDocxZipEntries(zip), /Duplicate ZIP entry/);
});

test('reader rejects oversized files and decompression bombs', async () => {
  assert.throws(() => findDocxZipEntries(new Uint8Array(15 * 1024 * 1024 + 1)), /15 MiB/);
  const repeated = '<?xml version="1.0"?>' + 'X'.repeat(350000);
  await assert.rejects(() => extractDocxXml(docx(repeated, 8)), /compression ratio/);
});

test('reader rejects embedded DOCTYPE before browser XML processing', async () => {
  const entityXml = '<!DOCTYPE x [<!ENTITY y SYSTEM "file:///secret">]>' + wordXml;
  await assert.rejects(() => extractDocxXml(docx(entityXml)), /DOCTYPE/);
});

test('reader rejects fake DOCX packages without main document content type', async () => {
  const zip = fixtureZip([
    { name: '[Content_Types].xml', data: '<Types/>' },
    { name: 'word/document.xml', data: wordXml },
  ]);
  await assert.rejects(() => extractDocxXml(zip), /not a standard Word DOCX/);
});

test('basic Word text blocks become Markdown without treating ordinary punctuation as headings', () => {
  const markdown = renderDocxBlocksAsMarkdown([
    { kind: 'heading', level: 2, text: 'Scope' },
    { kind: 'paragraph', text: '# not a heading' },
    { kind: 'list', text: 'First point' },
    { kind: 'table', text: 'A\tB\nC\tD' },
  ]);
  assert.match(markdown, /## Scope/);
  assert.match(markdown, /\\# not a heading/);
  assert.match(markdown, /- First point/);
  assert.match(markdown, /    A\tB\n    C\tD/);
});
