import { crc32, DOCX_MAX_FILE_BYTES, DOCX_MAX_XML_BYTES } from './docxZip.js';
import { parsePhiWritePrintBlocks } from './phiwritePrint.js';
import { tokenizePhiWriteInline } from './phiwriteInline.js';

export const DOCX_EXPORT_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const DOCX_EXPORT_SCHEMA = 'phioffice369.docx_text_export.v0.1';
const encoder = new TextEncoder();

export const DOCX_EXPORT_LIMITS = Object.freeze({
  maxSourceCharacters: 2_000_000,
  maxDocumentXmlBytes: DOCX_MAX_XML_BYTES,
  maxPackageBytes: DOCX_MAX_FILE_BYTES,
});

export function escapeDocxXml(value) {
  // XML 1.0 excludes most control characters (and U+FFFE/U+FFFF).
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '\ufffd')
    .replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
    })[c]);
}

function textRuns(value) {
  const segments = String(value ?? '').replace(/\r\n?/g, '\n').split(/(\n|\t)/);
  return segments.map((segment) => {
    if (segment === '\n') return '<w:r><w:br/></w:r>';
    if (segment === '\t') return '<w:r><w:tab/></w:r>';
    return segment ? '<w:r><w:t xml:space="preserve">' + escapeDocxXml(segment) + '</w:t></w:r>' : '';
  }).join('');
}

function richTextRuns(value, links) {
  return tokenizePhiWriteInline(value).map((token) => {
    if (token.href) {
      const id = links.has(token.href) ? links.get(token.href) : 'rId' + (3 + links.size);
      links.set(token.href, id);
      return '<w:hyperlink r:id="' + id + '" w:history="1"><w:r>' +
        '<w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr><w:t xml:space="preserve">' +
        escapeDocxXml(token.text) + '</w:t></w:r></w:hyperlink>';
    }
    if (token.bold || token.italic) {
      return '<w:r><w:rPr>' + (token.bold ? '<w:b/>' : '') +
        (token.italic ? '<w:i/>' : '') + '</w:rPr><w:t xml:space="preserve">' +
        escapeDocxXml(token.text) + '</w:t></w:r>';
    }
    return textRuns(token.text);
  }).join('');
}

function paragraph(text, { style = 'Normal', numId = null, rich = false, links = null } = {}) {
  const numbering = numId === null ? '' :
    '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="' + numId + '"/></w:numPr>';
  return '<w:p><w:pPr><w:pStyle w:val="' + style + '"/>' + numbering +
    '</w:pPr>' + (rich && links ? richTextRuns(text, links) : textRuns(text)) + '</w:p>';
}

function simpleWordTable(rows) {
  const width = rows[0]?.length ?? 0;
  if (width < 2 || width > 32 || rows.length > 500 ||
    rows.some((row) => row.length !== width)) {
    throw new Error('DOCX export: Only rectangular tables of 2–32 columns and up to 500 rows are supported.');
  }
  const columnWidth = Math.max(220, Math.floor(9360 / width));
  const grid = rows[0].map(() => '<w:gridCol w:w="' + columnWidth + '"/>').join('');
  const rowXml = rows.map((cells, index) =>
    '<w:tr>' + (index === 0 ? '<w:trPr><w:tblHeader w:val="true"/></w:trPr>' : '') +
    cells.map((cell) => '<w:tc><w:tcPr><w:tcW w:w="' + columnWidth +
      '" w:type="dxa"/></w:tcPr>' + paragraph(cell) + '</w:tc>').join('') + '</w:tr>'
  ).join('');
  return '<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/>' +
    '<w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/>' +
    '<w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/>' +
    '<w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/>' +
    '</w:tblBorders></w:tblPr><w:tblGrid>' + grid + '</w:tblGrid>' + rowXml + '</w:tbl>';
}

function xmlParts({ title, content }) {
  const blocks = parsePhiWritePrintBlocks(content);
  const hyperlinkIds = new Map();
  const orderedInstances = [];
  const documentBody = [
    paragraph(title || 'Untitled', { style: 'Title' }),
    ...blocks.map((block) => {
      if (block.kind === 'heading') {
        return paragraph(block.text, { style: 'Heading' + Math.max(1, Math.min(6, block.level || 1)), rich: true, links: hyperlinkIds });
      }
      if (block.kind === 'list') {
        let numId = 1; // shared bullet definition
        if (block.listType === 'ol') {
          numId = 2 + orderedInstances.length;
          orderedInstances.push({
            numId,
            start: Number.isInteger(block.start) && block.start >= 1 &&
              block.start <= 999999 ? block.start : 1,
          });
        }
        return block.items.map((item) => paragraph(item, {
          style: 'ListParagraph', numId, rich: true, links: hyperlinkIds,
        })).join('');
      }
      if (block.kind === 'table') return simpleWordTable(block.rows);
      if (block.kind === 'code') return paragraph(block.text, { style: 'Code' });
      if (block.kind === 'quote') return paragraph(block.text, { style: 'Quote', rich: true, links: hyperlinkIds });
      return paragraph(block.text, { rich: true, links: hyperlinkIds });
    }),
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>' +
      '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>',
  ].join('');

  const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<w:body>' + documentBody + '</w:body></w:document>';
  const styleDef = (id, name, props = '') =>
    '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name +
    '"/><w:basedOn w:val="Normal"/>' + props + '</w:style>';
  const headingStyle = (level) =>
    styleDef('Heading' + level, 'heading ' + level, '<w:pPr><w:keepNext/>' +
      '<w:spacing w:before="' + (280 - level * 20) + '" w:after="120"/></w:pPr>' +
      '<w:rPr><w:b/><w:sz w:val="' + Math.max(22, 34 - level * 2) + '"/></w:rPr>');
  const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>' +
    '<w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:styleId="Normal" w:default="1">' +
    '<w:name w:val="Normal"/><w:pPr><w:spacing w:after="160"/></w:pPr></w:style>' +
    styleDef('Title', 'Title', '<w:pPr><w:spacing w:after="300"/></w:pPr>' +
      '<w:rPr><w:b/><w:sz w:val="42"/></w:rPr>') +
    [1, 2, 3, 4, 5, 6].map(headingStyle).join('') +
    styleDef('Quote', 'Quote', '<w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/></w:rPr>') +
    styleDef('Code', 'Code', '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' +
      '<w:sz w:val="19"/></w:rPr>') +
    styleDef('Hyperlink', 'Hyperlink', '<w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr>') +
    styleDef('ListParagraph', 'List Paragraph', '<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>') +
    '</w:styles>';
  const listDef = (abstractId, format, text) =>
    '<w:abstractNum w:abstractNumId="' + abstractId + '"><w:multiLevelType w:val="singleLevel"/>' +
    '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="' + format +
    '"/><w:lvlText w:val="' + text +
    '"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs>' +
    '<w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>';
  const numberingXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    listDef(0, 'bullet', '•') + listDef(1, 'decimal', '%1.') +
    '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
    (orderedInstances.length ? orderedInstances.map(({ numId, start }) =>
      '<w:num w:numId="' + numId + '"><w:abstractNumId w:val="1"/>' +
      '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="' + start +
      '"/></w:lvlOverride></w:num>'
    ).join('') : '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>') +
    '</w:numbering>';
  const contentTypesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
    '</Types>';
  const relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';
  const documentRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
    [...hyperlinkIds.entries()].map(([href, id]) =>
      '<Relationship Id="' + id +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="' +
      escapeDocxXml(href) + '" TargetMode="External"/>'
    ).join('') +
    '</Relationships>';
  return [
    ['[Content_Types].xml', contentTypesXml],
    ['_rels/.rels', relsXml],
    ['word/document.xml', documentXml],
    ['word/_rels/document.xml.rels', documentRelsXml],
    ['word/styles.xml', stylesXml],
    ['word/numbering.xml', numberingXml],
  ];
}

// Build a standards-shaped OPC ZIP with stored (uncompressed) parts. Keeping
// compression disabled makes behavior deterministic and avoids browser support
// differences while maintaining full DOCX ZIP compatibility.
export function zipStoredDocxParts(parts) {
  if (!Array.isArray(parts) || parts.length === 0 || parts.length > 100) {
    throw new Error('DOCX export: Invalid package entry count.');
  }
  const localParts = [];
  const centralParts = [];
  let position = 0;

  function header(size) {
    const bytes = new Uint8Array(size);
    return { bytes, view: new DataView(bytes.buffer) };
  }

  for (const [name, body] of parts) {
    if (typeof name !== 'string' || !name || name.includes('\\') || name.includes('..') || name.startsWith('/')) {
      throw new Error('DOCX export: Invalid package part path.');
    }
    const nameBytes = encoder.encode(name);
    const data = typeof body === 'string' ? encoder.encode(body) : body;
    if (!(data instanceof Uint8Array) || nameBytes.length > 0xffff) {
      throw new Error('DOCX export: Invalid package part.');
    }
    const checksum = crc32(data);
    const local = header(30);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x0800, true);
    local.view.setUint16(8, 0, true);
    local.view.setUint16(12, 0x0021, true); // DOS date: 1980-01-01, for reproducible ZIPs
    local.view.setUint32(14, checksum, true);
    local.view.setUint32(18, data.length, true);
    local.view.setUint32(22, data.length, true);
    local.view.setUint16(26, nameBytes.length, true);
    const cd = header(46);
    cd.view.setUint32(0, 0x02014b50, true);
    cd.view.setUint16(4, 20, true);
    cd.view.setUint16(6, 20, true);
    cd.view.setUint16(8, 0x0800, true);
    cd.view.setUint16(10, 0, true);
    cd.view.setUint16(14, 0x0021, true);
    cd.view.setUint32(16, checksum, true);
    cd.view.setUint32(20, data.length, true);
    cd.view.setUint32(24, data.length, true);
    cd.view.setUint16(28, nameBytes.length, true);
    cd.view.setUint32(42, position, true);
    localParts.push(local.bytes, nameBytes, data);
    centralParts.push(cd.bytes, nameBytes);
    position += 30 + nameBytes.length + data.length;
  }
  const centralSize = centralParts.reduce((n, chunk) => n + chunk.length, 0);
  const end = header(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, parts.length, true);
  end.view.setUint16(10, parts.length, true);
  end.view.setUint32(12, centralSize, true);
  end.view.setUint32(16, position, true);
  const chunks = [...localParts, ...centralParts, end.bytes];
  const total = chunks.reduce((sum, part) => sum + part.length, 0);
  if (total > DOCX_EXPORT_LIMITS.maxPackageBytes) {
    throw new Error('DOCX export: Result exceeds the 15 MiB DOCX compatibility limit.');
  }
  const bytes = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, cursor);
    cursor += chunk.length;
  }
  return bytes;
}

export function buildPhiWriteDocx({ title = 'Untitled', content = '' } = {}) {
  const actualTitle = String(title ?? '').trim() || 'Untitled';
  const actualContent = String(content ?? '');
  if (actualTitle.length + actualContent.length > DOCX_EXPORT_LIMITS.maxSourceCharacters) {
    throw new Error('DOCX export: Draft exceeds the 2-million-character export limit.');
  }
  const parts = xmlParts({ title: actualTitle, content: actualContent });
  const documentXml = parts.find(([name]) => name === 'word/document.xml')[1];
  if (encoder.encode(documentXml).byteLength > DOCX_EXPORT_LIMITS.maxDocumentXmlBytes) {
    throw new Error('DOCX export: Document XML exceeds the 6 MiB round-trip limit.');
  }
  return {
    schema: DOCX_EXPORT_SCHEMA,
    mime: DOCX_EXPORT_MIME,
    bytes: zipStoredDocxParts(parts),
    warnings: [
      'Exports basic paragraphs, headings, lists, quotes, code, simple pipe tables, and limited bold/italic and http(s) hyperlink spans. Nested Markdown formatting is not supported.',
      'Complex tables, Word page layout, images, unsupported link schemes, comments, tracked changes, macros and exact source fidelity are not supported.',
      'Importing this DOCX back into PhiWrite is a text round trip, not a pixel-perfect or formatting-preserving round trip.',
    ],
  };
}
