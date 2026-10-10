import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import {
  crc32, extractDocxPackage, extractDocxXml, findDocxZipEntries,
} from '../apps/web/src/lib/docxZip.js';

const wordXml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>External text</w:t></w:r></w:p></w:body></w:document>';
const stylesXml = '<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="CompanySection"><w:name w:val="Company Section"/><w:basedOn w:val="Heading2"/></w:style></w:styles>';
const manifest = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';

// Independent Node ZIP constructor, not imported from PhiWrite's own exporter.
function packageFixture(parts) {
  const fileSections = [];
  const centralSections = [];
  let offset = 0;
  for (const part of parts) {
    const name = Buffer.from(part.name);
    const body = Buffer.from(part.data);
    const zip = part.method === 8 ? deflateRawSync(body) : body;
    const checksum = crc32(body);
    const file = Buffer.alloc(30);
    file.writeUInt32LE(0x04034b50, 0);
    file.writeUInt16LE(20, 4);
    file.writeUInt16LE(part.method ?? 0, 8);
    file.writeUInt32LE(checksum, 14);
    file.writeUInt32LE(zip.length, 18);
    file.writeUInt32LE(body.length, 22);
    file.writeUInt16LE(name.length, 26);
    fileSections.push(file, name, zip);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(part.method ?? 0, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(zip.length, 20);
    central.writeUInt32LE(body.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralSections.push(central, name);
    offset += file.length + name.length + zip.length;
  }
  const directory = Buffer.concat(centralSections);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(parts.length, 8);
  end.writeUInt16LE(parts.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...fileSections, directory, end]);
}

function withStyles(styles = stylesXml, styleMethod = 8) {
  return packageFixture([
    { name: '[Content_Types].xml', data: manifest, method: 8 },
    { name: 'word/document.xml', data: wordXml, method: 8 },
    { name: 'word/styles.xml', data: styles, method: styleMethod },
  ]);
}

test('independently assembled OOXML ZIP fixture exposes both document and styles', async () => {
  const archive = withStyles();
  assert.equal(findDocxZipEntries(archive).entries.get('word/styles.xml').method, 8);
  const extracted = await extractDocxPackage(archive);
  assert.equal(extracted.documentXml, wordXml);
  assert.equal(extracted.stylesXml, stylesXml);
  assert.equal(await extractDocxXml(archive), wordXml);
});

test('legacy DOCX without styles.xml still opens safely', async () => {
  const archive = packageFixture([
    { name: '[Content_Types].xml', data: manifest, method: 0 },
    { name: 'word/document.xml', data: wordXml, method: 0 },
  ]);
  const parts = await extractDocxPackage(archive);
  assert.equal(parts.documentXml, wordXml);
  assert.equal(parts.stylesXml, null);
});

test('invalid compressed styles CRC fails instead of silently dropping semantic styling', async () => {
  const archive = withStyles(stylesXml, 0);
  const index = archive.indexOf(Buffer.from('CompanySection'));
  assert.ok(index > 0);
  archive[index] ^= 0x01;
  await assert.rejects(() => extractDocxPackage(archive), /checksum/);
});

test('unsafe styles DOCTYPE/entity declarations are rejected', async () => {
  const styles = '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + stylesXml;
  await assert.rejects(() => extractDocxPackage(withStyles(styles, 0)), /DOCTYPE/);
});

test('oversized uncompressed style definitions are rejected', async () => {
  const styles = '<w:styles>' + 'x'.repeat(2 * 1024 * 1024 + 1) + '</w:styles>';
  await assert.rejects(() => extractDocxPackage(withStyles(styles, 0)), /XML entry exceeds the preview limit/);
});
