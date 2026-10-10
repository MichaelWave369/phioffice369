import { DOCX_MAX_FILE_BYTES, extractDocxPackage } from './docxZip.js';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function wordElements(root, name) {
  return [...root.getElementsByTagNameNS(WORD_NS, name)];
}

function attributeValue(element, name) {
  return element?.getAttributeNS(WORD_NS, name) ?? element?.getAttribute('w:' + name) ?? null;
}

// Word and other OOXML producers often use custom style IDs. Resolve heading
// names, outline levels and basedOn inheritance instead of relying on HeadingN.
function parseXml(xml, parser, label) {
  if (!xml || /<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new Error('DOCX import: Missing or unsafe ' + label + ' XML.');
  }
  const document = parser.parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror') || document.getElementsByTagName('parsererror').length) {
    throw new Error('DOCX import: ' + label + ' XML could not be parsed.');
  }
  return document;
}

function headingFromName(value) {
  const match = String(value ?? '').trim().match(/^heading\s*([1-6])$/i);
  return match ? Number(match[1]) : null;
}

export function buildDocxStyleResolver(stylesXml, parser) {
  const styleMap = new Map();
  if (stylesXml) {
    const stylesDocument = parseXml(stylesXml, parser, 'styles');
    if (stylesDocument.documentElement.localName !== 'styles' ||
      stylesDocument.documentElement.namespaceURI !== WORD_NS) {
      throw new Error('DOCX import: Not a WordprocessingML styles part.');
    }
    for (const style of wordElements(stylesDocument, 'style')) {
      if (attributeValue(style, 'type') !== 'paragraph') continue;
      const id = attributeValue(style, 'styleId');
      if (!id || styleMap.has(id)) continue;
      const name = attributeValue(wordElements(style, 'name')[0], 'val') ?? '';
      const basedOn = attributeValue(wordElements(style, 'basedOn')[0], 'val') ?? '';
      const outline = attributeValue(wordElements(style, 'outlineLvl')[0], 'val');
      const outlineNumber = outline !== null ? Number(outline) : -1;
      styleMap.set(id, {
        name, basedOn,
        heading: Number.isInteger(outlineNumber) && outlineNumber >= 0 && outlineNumber <= 5
          ? outlineNumber + 1 : headingFromName(name),
      });
    }
  }
  function resolve(id) {
    const visited = new Set();
    let current = id;
    for (let step = 0; current && step < 16; step += 1) {
      if (visited.has(current)) break;
      visited.add(current);
      const style = styleMap.get(current);
      if (/^title$/i.test(current) || /^title$/i.test(style?.name ?? '')) {
        return { kind: 'title' };
      }
      const heading = style?.heading ?? headingFromName(current);
      if (heading) return { kind: 'heading', level: heading };
      current = style?.basedOn ?? '';
    }
    return { kind: 'paragraph' };
  }
  return resolve;
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

export function parseDocxDocumentXml(xml, { fallbackTitle = 'Imported Word Document', stylesXml = null, parser = null } = {}) {
  if (typeof xml !== 'string' || !xml.trim()) throw new Error('DOCX import: Empty document XML.');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DOCX import: XML entities and DOCTYPE declarations are unsupported.');
  const domParser = parser ?? (typeof DOMParser !== 'undefined' ? new DOMParser() : null);
  if (!domParser) throw new Error('DOCX import: Browser XML parsing is unavailable.');
  const document = parseXml(xml, domParser, 'Document');
  const resolveStyle = buildDocxStyleResolver(stylesXml, domParser);
  const root = document.documentElement;
  if (root.localName !== 'document' || root.namespaceURI !== WORD_NS) {
    throw new Error('DOCX import: Not WordprocessingML document XML.');
  }
  const body = wordElements(root, 'body')[0];
  if (!body) throw new Error('DOCX import: Document body missing.');
  const blocks = [];
  let flattenedTables = 0;
  let documentTitle = null;
  let contentControlCount = 0;
  function addParagraph(paragraph) {
    const text = collectParagraphText(paragraph);
    if (!text) return;
    const styleId = attributeValue(wordElements(paragraph, 'pStyle')[0], 'val') ?? '';
    const resolved = resolveStyle(styleId);
    const directOutline = wordElements(paragraph, 'pPr').flatMap((node) =>
      [...node.children].filter((child) => child.namespaceURI === WORD_NS && child.localName === 'outlineLvl')
    )[0];
    const outlineValue = attributeValue(directOutline, 'val');
    const outlineLevel = outlineValue === null ? -1 : Number(outlineValue);
    const heading = Number.isInteger(outlineLevel) && outlineLevel >= 0 && outlineLevel <= 5
      ? outlineLevel + 1 : resolved.kind === 'heading' ? resolved.level : null;
    const numbered = wordElements(paragraph, 'numPr').length > 0 || /^List(Bullet|Number)/i.test(styleId);
    if (resolved.kind === 'title' && blocks.length === 0 && !documentTitle) {
      documentTitle = text;
    } else if (heading) {
      blocks.push({ kind: 'heading', level: heading, text });
    } else if (numbered) {
      blocks.push({ kind: 'list', text });
    } else {
      blocks.push({ kind: 'paragraph', text });
    }
  }
  function visitBodyChild(child) {
    if (child.namespaceURI !== WORD_NS) return;
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
    } else if (child.localName === 'sdt') {
      contentControlCount += 1;
      const content = wordElements(child, 'sdtContent')[0];
      if (content) for (const nested of content.children) visitBodyChild(nested);
    } else if (['customXml', 'smartTag', 'ins', 'moveTo'].includes(child.localName)) {
      for (const nested of child.children) visitBodyChild(nested);
    }
  }
  for (const child of body.children) visitBodyChild(child);
  // A title-only DOCX still has user content; do not silently reject it.
  if (!blocks.length && documentTitle) blocks.push({ kind: 'paragraph', text: documentTitle });
  if (!blocks.length) throw new Error('DOCX import: No supported readable document text found.');
  const warnings = [
    'Preview extracts text and basic headings/lists only. Exact Word formatting and pagination are not preserved.',
    'Images, comments, fields, tracked edits, footnotes, headers and footers are not carried into PhiWrite.',
  ];
  if (flattenedTables) warnings.push(flattenedTables + ' table(s) flattened to tab-separated text.');
  if (contentControlCount) warnings.push(contentControlCount + ' Word content control(s) read as plain text; form behavior was not preserved.');
  if (documentTitle) warnings.push('Document Title style was extracted into the PhiWrite title field rather than duplicated in the body.');
  const title = documentTitle ?? fallbackTitle ?? 'Imported Word Document';
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
  const { documentXml, stylesXml } = await extractDocxPackage(await file.arrayBuffer());
  return parseDocxDocumentXml(documentXml, {
    fallbackTitle: file.name.replace(/\.docx$/i, ''),
    stylesXml,
  });
}
