import { DOCX_MAX_FILE_BYTES, extractDocxPackage } from './docxZip.js';
import { renderPipeTable } from './simpleTables.js';
import { inlineTokensToMarkdown, safeExternalDocumentUrl } from './phiwriteInline.js';
import { createDocxNumberingResolver } from './docxNumbering.js';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const OFFICE_REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

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

function quoteFromName(value) {
  // Common Word quote style IDs and display names. Resolve through basedOn
  // chains, but do not treat an arbitrary style containing "quote" as a quote.
  return /^(?:quote|intense[\s_-]?quote|block[\s_-]?quote)$/i.test(String(value ?? '').trim());
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
      if (quoteFromName(current) || quoteFromName(style?.name)) return { kind: 'quote' };
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

export function readDocxHyperlinkRelationships(xml, parser) {
  const links = new Map();
  if (!xml) return links;
  const document = parseXml(xml, parser, 'relationships');
  if (document.documentElement.localName !== 'Relationships' ||
      document.documentElement.namespaceURI !== PACKAGE_REL_NS) {
    throw new Error('DOCX import: Invalid document relationships.');
  }
  for (const relationship of document.documentElement.children) {
    if (relationship.localName !== 'Relationship' ||
        relationship.namespaceURI !== PACKAGE_REL_NS) continue;
    const type = relationship.getAttribute('Type') ?? '';
    if (type !== 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink' ||
        relationship.getAttribute('TargetMode') !== 'External') continue;
    const id = relationship.getAttribute('Id');
    const href = safeExternalDocumentUrl(relationship.getAttribute('Target'));
    if (id && href) links.set(id, href);
  }
  return links;
}

function paragraphInlineMarkdown(paragraph, hyperlinks) {
  const tokens = [];
  let hasFormatting = false;
  function runText(run) {
    let value = '';
    function visit(node) {
      if (node.nodeType !== 1) return;
      if (node.namespaceURI === WORD_NS) {
        if (node.localName === 't') { value += node.textContent ?? ''; return; }
        if (node.localName === 'tab') { value += '\t'; return; }
        if (node.localName === 'br' || node.localName === 'cr') { value += '\n'; return; }
      }
      for (const child of node.childNodes) visit(child);
    }
    visit(run);
    return value;
  }
  function addRun(run, href = null) {
    const value = runText(run);
    if (!value) return;
    const rPr = [...run.children].find((node) =>
      node.namespaceURI === WORD_NS && node.localName === 'rPr');
    const enabled = (name) => {
      const prop = rPr && [...rPr.children].find((node) =>
        node.namespaceURI === WORD_NS && node.localName === name);
      return Boolean(prop && !['0', 'false', 'off'].includes(String(attributeValue(prop, 'val')).toLowerCase()));
    };
    const bold = enabled('b');
    const italic = enabled('i');
    const code = attributeValue(rPr && [...rPr.children].find((node) =>
      node.namespaceURI === WORD_NS && node.localName === 'rStyle'), 'val') === 'CodeChar';
    if (bold || italic || code || href) hasFormatting = true;
    const prev = tokens[tokens.length - 1];
    if (prev && Boolean(prev.bold) === bold && Boolean(prev.italic) === italic &&
        Boolean(prev.code) === code && (prev.href ?? null) === href) prev.text += value;
    else tokens.push({ text: value, ...(bold ? { bold: true } : {}),
      ...(italic ? { italic: true } : {}), ...(code ? { code: true } : {}),
      ...(href ? { href } : {}) });
  }
  function visit(node) {
    if (node.namespaceURI !== WORD_NS) return;
    if (node.localName === 'r') return addRun(node);
    if (node.localName === 'hyperlink') {
      const id = node.getAttributeNS(OFFICE_REL_NS, 'id') ?? node.getAttribute('r:id');
      const href = hyperlinks.get(id);
      const value = collectParagraphText(node);
      if (value) {
        if (href) { tokens.push({ text: value, href }); hasFormatting = true; }
        else tokens.push({ text: value });
      }
      return;
    }
    if (node.localName === 'pPr' || node.localName === 'bookmarkStart' ||
        node.localName === 'bookmarkEnd') return;
    if (node.localName === 'del' || node.localName === 'moveFrom') return;
    for (const child of node.children) visit(child);
  }
  for (const child of paragraph.children) visit(child);
  if (!hasFormatting) return collectParagraphText(paragraph);
  return inlineTokensToMarkdown(tokens).trim();
}

function markdownSafeText(value) {
  // Text-only DOCX extraction: block-leading Markdown punctuation in ordinary
  // paragraphs is escaped to avoid accidental synthetic headings or lists.
  return String(value ?? '').replace(/(^|\n)(\s*)([#>*+-](?=\s)|\d+[.)](?=\s))/g, '$1$2\\$3');
}

export function renderDocxBlocksAsMarkdown(blocks = []) {
  const rendered = [];
  let previousList = null;
  let previousQuote = false;
  for (const block of blocks) {
    if (block.kind !== 'simple-table' && !block.text?.length) continue;
    if (block.kind === 'simple-table' && !block.rows?.length) continue;
    if (block.kind === 'list') {
      const ordered = block.listType === 'ol';
      const marker = ordered ? String(block.number ?? 1) + '. ' : '- ';
      const group = block.group ?? null;
      const root = block.listRoot ?? group;
      const level = block.listLevel === 1 ? 1 : 0;
      const continuation = Boolean(previousList && (
        block.listRoot && previousList.root === block.listRoot ||
        !block.listRoot && previousList.type === block.listType &&
        (group === null ? previousList.group === null : previousList.group === group)
      ));
      rendered.push({ text: '  '.repeat(level) + marker + markdownSafeText(block.text),
        join: continuation ? '\n' : '\n\n' });
      previousList = { type: block.listType, group, root, level };
      previousQuote = false;
      continue;
    }
    if (block.kind === 'quote') {
      // Every physical quote line needs its own Markdown quote marker.
      // Consecutive Word Quote paragraphs stay one print-friendly blockquote.
      const text = block.text.replace(/\r\n?/g, '\n').split('\n')
        .map((line) => '> ' + markdownSafeText(line)).join('\n');
      rendered.push({ text, join: previousQuote ? '\n' : '\n\n' });
      previousQuote = true;
      previousList = null;
      continue;
    }
    let text;
    if (block.kind === 'heading') text = '#'.repeat(Math.max(1, Math.min(6, block.level ?? 1))) + ' ' + markdownSafeText(block.text);
    else if (block.kind === 'code') text = '~~~\n' + block.text + '\n~~~';
    else if (block.kind === 'simple-table') text = renderPipeTable(block.rows);
    else if (block.kind === 'table') text = block.text.split('\n').map((row) => '    ' + row).join('\n');
    else text = markdownSafeText(block.text);
    rendered.push({ text, join: '\n\n' });
    previousList = null;
    previousQuote = false;
  }
  return rendered.map((item, i) => (i ? item.join : '') + item.text).join('');
}

export function parseDocxDocumentXml(xml, { fallbackTitle = 'Imported Word Document', stylesXml = null, relationshipsXml = null, numberingXml = null, parser = null } = {}) {
  if (typeof xml !== 'string' || !xml.trim()) throw new Error('DOCX import: Empty document XML.');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DOCX import: XML entities and DOCTYPE declarations are unsupported.');
  const domParser = parser ?? (typeof DOMParser !== 'undefined' ? new DOMParser() : null);
  if (!domParser) throw new Error('DOCX import: Browser XML parsing is unavailable.');
  const document = parseXml(xml, domParser, 'Document');
  const resolveStyle = buildDocxStyleResolver(stylesXml, domParser);
  const hyperlinkMap = readDocxHyperlinkRelationships(relationshipsXml, domParser);
  const resolveNumbering = createDocxNumberingResolver(numberingXml, domParser);
  const root = document.documentElement;
  if (root.localName !== 'document' || root.namespaceURI !== WORD_NS) {
    throw new Error('DOCX import: Not WordprocessingML document XML.');
  }
  const body = wordElements(root, 'body')[0];
  if (!body) throw new Error('DOCX import: Document body missing.');
  const blocks = [];
  let flattenedTables = 0;
  let structuredTables = 0;
  let documentTitle = null;
  let contentControlCount = 0;
  let approximatedLists = 0;
  let unsafeCodeFences = 0;
  let convertedQuoteParagraphs = 0;
  const listCounters = new Map();
  function addParagraph(paragraph) {
    const plainText = collectParagraphText(paragraph);
    if (!plainText) return;
    const text = paragraphInlineMarkdown(paragraph, hyperlinkMap);
    const styleId = attributeValue(wordElements(paragraph, 'pStyle')[0], 'val') ?? '';
    const resolved = resolveStyle(styleId);
    const directOutline = wordElements(paragraph, 'pPr').flatMap((node) =>
      [...node.children].filter((child) => child.namespaceURI === WORD_NS && child.localName === 'outlineLvl')
    )[0];
    const outlineValue = attributeValue(directOutline, 'val');
    const outlineLevel = outlineValue === null ? -1 : Number(outlineValue);
    const heading = Number.isInteger(outlineLevel) && outlineLevel >= 0 && outlineLevel <= 5
      ? outlineLevel + 1 : resolved.kind === 'heading' ? resolved.level : null;
    const numPr = wordElements(paragraph, 'pPr').flatMap((node) =>
      [...node.children].filter((child) => child.namespaceURI === WORD_NS && child.localName === 'numPr')
    )[0];
    const numId = attributeValue(wordElements(numPr ?? paragraph, 'numId')[0], 'val');
    const rawLevel = attributeValue(wordElements(numPr ?? paragraph, 'ilvl')[0], 'val') ?? '0';
    const numbering = numId === null ? null : resolveNumbering(numId, rawLevel);
    const isList = numPr || /^List(Bullet|Number|Paragraph)/i.test(styleId);
    if (resolved.kind === 'title' && blocks.length === 0 && !documentTitle) {
      documentTitle = plainText;
    } else if (heading) {
      blocks.push({ kind: 'heading', level: heading, text });
    } else if (resolved.kind === 'quote') {
      convertedQuoteParagraphs += 1;
      blocks.push({ kind: 'quote', text });
    } else if (/^(Code|CodeBlock|HTMLPreformatted)$/i.test(styleId)) {
      // The parser supports triple-tilde code fences. If the document itself
      // contains such a line, retain the text as ordinary paragraphs instead.
      if (/(^|\n)\s*~~~/.test(plainText)) {
        unsafeCodeFences += 1;
        blocks.push({ kind: 'paragraph', text: plainText });
      } else {
        blocks.push({ kind: 'code', text: plainText });
      }
    } else if (isList) {
      const ordered = numbering ? numbering.kind === 'ol' : /^ListNumber/i.test(styleId);
      const listType = ordered ? 'ol' : 'ul';
      const parsedLevel = Number(rawLevel);
      const listLevel = numbering && Number.isInteger(parsedLevel) && parsedLevel >= 0 && parsedLevel <= 1
        ? parsedLevel : 0;
      const group = numId !== null ? 'num-' + numId + '-level-' + listLevel : 'style-' + styleId;
      const listRoot = numId !== null ? 'num-' + numId : null;
      // Level-1 numbering restarts for each subsequent level-0 parent.
      if (listLevel === 0 && listRoot) listCounters.delete(listRoot + '-level-1');
      const counter = listCounters.has(group) ? listCounters.get(group) : (numbering?.start ?? 1);
      if (ordered) listCounters.set(group, counter + 1);
      if (!numbering || numbering.approximated || parsedLevel > 1) approximatedLists += 1;
      // Indentation without a visible parent would create malformed Markdown.
      const previous = blocks[blocks.length - 1];
      const parentVisible = previous?.kind === 'list' && previous.listRoot === listRoot;
      const effectiveLevel = listLevel === 1 && parentVisible ? 1 : 0;
      if (listLevel === 1 && !parentVisible) approximatedLists += 1;
      blocks.push({ kind: 'list', text, listType, group, listRoot,
        listLevel: effectiveLevel, ...(ordered ? { number: counter } : {}) });
    } else {
      blocks.push({ kind: 'paragraph', text });
    }
  }
  function visitBodyChild(child) {
    if (child.namespaceURI !== WORD_NS) return;
    if (child.localName === 'p') {
      addParagraph(child);
    } else if (child.localName === 'tbl') {
      const directChildren = (node, localName) =>
        [...node.children].filter((element) =>
          element.namespaceURI === WORD_NS && element.localName === localName);
      const rowNodes = directChildren(child, 'tr');
      const cells = rowNodes.map((row) => directChildren(row, 'tc'));
      const width = cells[0]?.length ?? 0;
      const simple = width >= 2 && width <= 32 && rowNodes.length <= 500 &&
        rowNodes.length > 0 &&
        cells.every((row) => row.length === width && row.every((cell) => {
          const directParagraphs = directChildren(cell, 'p');
          return directParagraphs.length === 1 &&
            !wordElements(cell, 'tbl').length &&
            !wordElements(cell, 'gridSpan').length &&
            !wordElements(cell, 'vMerge').length &&
            !wordElements(cell, 'hMerge').length &&
            !wordElements(cell, 'br').length;
        }));
      if (simple) {
        structuredTables += 1;
        blocks.push({ kind: 'simple-table', rows: cells.map((row) =>
          row.map((cell) => collectParagraphText(directChildren(cell, 'p')[0]))
        ) });
      } else {
        flattenedTables += 1;
        // Keep all readable cell text, including unsupported merged or nested
        // tables, rather than claiming a faithful rectangular grid.
        const lines = wordElements(child, 'tr').map((row) =>
          wordElements(row, 'tc').map((cell) =>
            wordElements(cell, 'p').map(collectParagraphText).filter(Boolean).join(' / ')
          ).join('\t')
        ).filter(Boolean);
        if (lines.length) blocks.push({ kind: 'table', text: lines.join('\n') });
      }
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
    'Preview preserves text, headings, simple quote/code styles, tables, two-level lists, inline bold/italic/code and safe HTTP(S) hyperlinks. Exact Word formatting and pagination are not preserved.',
    'Images, comments, fields, tracked edits, footnotes, headers and footers are not carried into PhiWrite.',
  ];
  if (convertedQuoteParagraphs) warnings.push(convertedQuoteParagraphs + ' Word Quote-style paragraph(s) converted into Markdown blockquotes; exact quotation styling is not retained.');
  if (unsafeCodeFences) warnings.push(unsafeCodeFences + ' Word code paragraph(s) had fence-like lines and were imported as plain text.');
  if (approximatedLists) warnings.push('Some list numbering uses missing definitions, unsupported levels/formats, or detached nesting and was approximated as flat Markdown.');
  if (structuredTables) warnings.push(structuredTables + ' simple rectangular Word table(s) converted to Markdown pipe tables; styling and header semantics may change.');
  if (flattenedTables) warnings.push(flattenedTables + ' complex Word table(s) flattened to tab-separated text because merged, nested, or multi-paragraph cells cannot round-trip faithfully.');
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
  const { documentXml, stylesXml, relationshipsXml, numberingXml } = await extractDocxPackage(await file.arrayBuffer());
  return parseDocxDocumentXml(documentXml, {
    fallbackTitle: file.name.replace(/\.docx$/i, ''),
    stylesXml,
    relationshipsXml,
    numberingXml,
  });
}
