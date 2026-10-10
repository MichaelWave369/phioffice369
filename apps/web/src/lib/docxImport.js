import { DOCX_MAX_FILE_BYTES, extractDocxXml } from './docxZip.js';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function wordElements(root, name) {
  return [...root.getElementsByTagNameNS(WORD_NS, name)];
}

function attributeValue(element, name) {
  return element?.getAttributeNS(WORD_NS, name) ?? element?.getAttribute('w:' + name) ?? null;
}

function collectParagraphText(root) {
  let text = '';
  function visit(node) {
    if (node.nodeType !== 1) return;
    if (node.namespaceURI === WORD_NS) {
      if (node.localName === 'del' || node.localName === 'instrText') return;
      if (node.localName === 't' || node.localName === 'delText') {
        if (node.localName === 't') text += node.textContent ?? '';
        return;
      }
      if (node.localName === 'tab') { text += '\t'; return; }
      if (node.localName === 'br' || node.localName === 'cr') { text += '\n'; return; }
      if (node.localName === 'noBreakHyphen') { text += '-'; return; }
    }
    for (const child of node.childNodes) visit(child);
  }
  visit(root);
  return text.trim();
}

function markdownSafeText(value) {
  // Text-only DOCX extraction: block-leading Markdown punctuation in ordinary
  // paragraphs is escaped to avoid accidental synthetic headings or lists.
  return String(value ?? '').replace(/(^|\n)(\s*)([#>*+-](?=\s)|\d+[.)](?=\s))/g, '$1$2\\$3');
}

export function renderDocxBlocksAsMarkdown(blocks = []) {
  return blocks.filter((block) => block.text?.length > 0).map((block) => {
    if (block.kind === 'heading') {
      return '#'.repeat(Math.max(1, Math.min(6, block.level ?? 1))) + ' ' + markdownSafeText(block.text);
    }
    if (block.kind === 'list') return '- ' + markdownSafeText(block.text);
    if (block.kind === 'table') return block.text.split('\n').map((row) => '    ' + row).join('\n');
    return markdownSafeText(block.text);
  }).join('\n\n');
}

export function parseDocxDocumentXml(xml, { fallbackTitle = 'Imported Word Document', parser = null } = {}) {
  if (typeof xml !== 'string' || !xml.trim()) throw new Error('DOCX import: Empty document XML.');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DOCX import: XML entities and DOCTYPE declarations are unsupported.');
  const domParser = parser ?? (typeof DOMParser !== 'undefined' ? new DOMParser() : null);
  if (!domParser) throw new Error('DOCX import: Browser XML parsing is unavailable.');
  const document = domParser.parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror') || document.getElementsByTagName('parsererror').length) {
    throw new Error('DOCX import: Document XML could not be parsed.');
  }
  const root = document.documentElement;
  if (root.localName !== 'document' || root.namespaceURI !== WORD_NS) {
    throw new Error('DOCX import: Not WordprocessingML document XML.');
  }
  const body = wordElements(root, 'body')[0];
  if (!body) throw new Error('DOCX import: Document body missing.');
  const blocks = [];
  let flattenedTables = 0;
  function addParagraph(paragraph) {
    const text = collectParagraphText(paragraph);
    if (!text) return;
    const style = attributeValue(wordElements(paragraph, 'pStyle')[0], 'val') ?? '';
    const headingMatch = style.match(/^(Heading|heading)([1-6])$/);
    const numbered = wordElements(paragraph, 'numPr').length > 0 || /^List(Bullet|Number)/i.test(style);
    if (headingMatch) blocks.push({ kind: 'heading', level: Number(headingMatch[2]), text });
    else if (numbered) blocks.push({ kind: 'list', text });
    else blocks.push({ kind: 'paragraph', text });
  }
  for (const child of body.children) {
    if (child.namespaceURI !== WORD_NS) continue;
    if (child.localName === 'p') {
      addParagraph(child);
    } else if (child.localName === 'tbl') {
      flattenedTables += 1;
      const lines = wordElements(child, 'tr').map((row) =>
        wordElements(row, 'tc').map((cell) =>
          wordElements(cell, 'p').map(collectParagraphText).filter(Boolean).join(' / ')
        ).join('\t')
      ).filter(Boolean);
      if (lines.length) blocks.push({ kind: 'table', text: lines.join('\n') });
    }
  }
  if (!blocks.length) throw new Error('DOCX import: No supported readable document text found.');
  const warnings = [
    'Preview extracts text and basic headings/lists only. Exact Word formatting and pagination are not preserved.',
    'Images, comments, fields, tracked edits, footnotes, headers and footers are not carried into PhiWrite.',
  ];
  if (flattenedTables) warnings.push(flattenedTables + ' table(s) flattened to tab-separated text.');
  const title = fallbackTitle || 'Imported Word Document';
  return {
    schema: 'phioffice369.docx_import_preview.v0.1',
    title,
    content: renderDocxBlocksAsMarkdown(blocks),
    blockCount: blocks.length,
    warnings,
    sourceFormat: 'docx',
  };
}

export async function previewDocxFile(file) {
  if (!file?.name?.toLowerCase().endsWith('.docx')) {
    throw new Error('DOCX import: Select a .docx file.');
  }
  if (file.size > DOCX_MAX_FILE_BYTES) {
    throw new Error('DOCX import: File exceeds the 15 MiB preview limit.');
  }
  const xml = await extractDocxXml(await file.arrayBuffer());
  return parseDocxDocumentXml(xml, { fallbackTitle: file.name.replace(/\.docx$/i, '') });
}
