// Minimal, bounded ZIP/OOXML reader for read-only local DOCX previews.
// Intentionally does not support archive encryption, ZIP64 or exotic compression.
export const DOCX_MAX_FILE_BYTES = 15 * 1024 * 1024;
export const DOCX_MAX_XML_BYTES = 6 * 1024 * 1024;

function fail(message) { throw new Error('DOCX import: ' + message); }

export function crc32(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function findDocxZipEntries(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength > DOCX_MAX_FILE_BYTES) fail('File exceeds the 15 MiB preview limit.');
  if (bytes.byteLength < 22) fail('Invalid ZIP container.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50 &&
        i + 22 + view.getUint16(i + 20, true) === bytes.length) {
      end = i;
      break;
    }
  }
  if (end < 0) fail('ZIP end record not found.');
  const disk = view.getUint16(end + 4, true);
  const cdDisk = view.getUint16(end + 6, true);
  const diskEntries = view.getUint16(end + 8, true);
  const count = view.getUint16(end + 10, true);
  const cdLength = view.getUint32(end + 12, true);
  const cdOffset = view.getUint32(end + 16, true);
  if (disk !== 0 || cdDisk !== 0 || count !== diskEntries) fail('Multi-volume ZIP archives are unsupported.');
  if (count === 0xffff || cdOffset === 0xffffffff || cdLength === 0xffffffff) fail('ZIP64 archives are unsupported.');
  if (count > 1200) fail('Too many ZIP entries.');
  if (cdOffset + cdLength > end) fail('Invalid ZIP directory bounds.');
  let cursor = cdOffset;
  const entries = new Map();
  for (let i = 0; i < count; i += 1) {
    if (cursor + 46 > cdOffset + cdLength ||
        view.getUint32(cursor, true) !== 0x02014b50) fail('Corrupt ZIP central directory.');
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const checksum = view.getUint32(cursor + 16, true);
    const compressed = view.getUint32(cursor + 20, true);
    const uncompressed = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const startDisk = view.getUint16(cursor + 34, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > cdOffset + cdLength) fail('ZIP entry exceeds directory bounds.');
    const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (entries.has(name)) fail('Duplicate ZIP entry: ' + name);
    if (startDisk !== 0 || compressed === 0xffffffff || uncompressed === 0xffffffff || localOffset === 0xffffffff) {
      fail('ZIP64 or multi-volume entry unsupported.');
    }
    entries.set(name, { name, flags, method, checksum, compressed, uncompressed, localOffset });
    cursor = next;
  }
  if (cursor !== cdOffset + cdLength) fail('ZIP directory entry count does not match directory length.');
  return { bytes, entries };
}

async function decompressEntry(bytes, entry, limit) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = entry.localOffset;
  if (offset + 30 > bytes.length || view.getUint32(offset, true) !== 0x04034b50) {
    fail('Invalid ZIP local entry.');
  }
  const flags = view.getUint16(offset + 6, true);
  const method = view.getUint16(offset + 8, true);
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const payloadStart = offset + 30 + nameLength + extraLength;
  if (payloadStart + entry.compressed > bytes.length) fail('ZIP entry points outside the file.');
  if ((flags & 1) || (entry.flags & 1)) fail('Encrypted ZIP files are unsupported.');
  if (method !== entry.method || flags !== entry.flags) fail('Inconsistent ZIP entry metadata.');
  if (method !== 0 && method !== 8) fail('Unsupported ZIP compression method.');
  const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
  if (name !== entry.name) fail('ZIP entry name mismatch.');
  if (entry.uncompressed > limit) fail('XML entry exceeds the preview limit.');
  if (entry.compressed > 0 && entry.uncompressed > Math.max(128 * 1024, entry.compressed * 200)) {
    fail('Suspicious ZIP compression ratio.');
  }
  const compressed = bytes.subarray(payloadStart, payloadStart + entry.compressed);
  let output;
  if (method === 0) {
    output = compressed;
  } else {
    if (typeof DecompressionStream !== 'function') {
      fail('This browser cannot decode compressed DOCX documents.');
    }
    const reader = new Blob([compressed]).stream()
      .pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > limit) {
          await reader.cancel();
          fail('Expanded document XML exceeds the preview limit.');
        }
        chunks.push(part.value);
      }
    } catch (error) {
      fail('Could not decompress document XML: ' + (error?.message || 'invalid data'));
    }
    output = new Uint8Array(size);
    let cursor = 0;
    for (const part of chunks) {
      output.set(part, cursor);
      cursor += part.length;
    }
  }
  if (output.length !== entry.uncompressed) fail('ZIP extracted size does not match the declared size.');
  if (crc32(output) !== entry.checksum) fail('ZIP entry checksum did not match.');
  return output;
}

export async function extractDocxPackage(input) {
  const { bytes, entries } = findDocxZipEntries(input);
  const manifest = entries.get('[Content_Types].xml');
  const document = entries.get('word/document.xml');
  if (!manifest || !document) fail('Missing standard DOCX content types or document XML.');
  const xmlBytes = await decompressEntry(bytes, document, DOCX_MAX_XML_BYTES);
  const manifestBytes = await decompressEntry(bytes, manifest, 512 * 1024);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const xml = decoder.decode(xmlBytes).replace(/^\uFEFF/, '');
  const contentTypes = decoder.decode(manifestBytes).replace(/^\uFEFF/, '');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || /<!DOCTYPE|<!ENTITY/i.test(contentTypes)) {
    fail('XML entity and DOCTYPE declarations are unsupported.');
  }
  if (!contentTypes.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml')) {
    fail('ZIP is not a standard Word DOCX package.');
  }

  // Real Word/LibreOffice files often reference custom paragraph styles.
  // Read the optional styles part under its own strict size budget.
  const stylesPart = entries.get('word/styles.xml');
  let stylesXml = null;
  if (stylesPart) {
    const styleBytes = await decompressEntry(bytes, stylesPart, 2 * 1024 * 1024);
    stylesXml = decoder.decode(styleBytes).replace(/^\uFEFF/, '');
    if (/<!DOCTYPE|<!ENTITY/i.test(stylesXml)) {
      fail('XML entity and DOCTYPE declarations are unsupported.');
    }
  }
  const relsPart = entries.get('word/_rels/document.xml.rels');
  let relationshipsXml = null;
  if (relsPart) {
    const relsBytes = await decompressEntry(bytes, relsPart, 512 * 1024);
    relationshipsXml = decoder.decode(relsBytes).replace(/^\uFEFF/, '');
    if (/<!DOCTYPE|<!ENTITY/i.test(relationshipsXml)) {
      fail('XML entity and DOCTYPE declarations are unsupported.');
    }
  }
  return { documentXml: xml, stylesXml, relationshipsXml };
}

export async function extractDocxXml(input) {
  return (await extractDocxPackage(input)).documentXml;
}
