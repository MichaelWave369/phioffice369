import { parsePipeTableAt } from './simpleTables.js';
import { tokenizePhiWriteInline } from './phiwriteInline.js';
import { parsePhiWriteListAt, buildTwoLevelListTree, groupTwoLevelListNodes } from './phiwriteNestedLists.js';

// Printable block-only Markdown subset. Other Markdown remains literal.
export function parsePhiWritePrintBlocks(markdown = '') {
  const lines = String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  const blank = (line) => !line.trim();
  const heading = (line) => line.match(/^ {0,3}(#{1,6})\s+(.+)$/);
  const bullet = (line) => line.match(/^ {0,3}[-*+]\s+(.+)$/);
  const ordered = (line) => line.match(/^ {0,3}\d+[.)]\s+(.+)$/);
  const quote = (line) => line.match(/^ {0,3}>\s?(.*)$/);
  const fence = (line) => /^ {0,3}/.test(line) && (
    line.trimStart().startsWith(String.fromCharCode(96).repeat(3)) || line.trimStart().startsWith('~~~')
  );
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (blank(line)) { i += 1; continue; }
    if (fence(line)) {
      const content = []; i += 1;
      while (i < lines.length && !fence(lines[i])) { content.push(lines[i]); i += 1; }
      if (i < lines.length) i += 1;
      blocks.push({ kind: 'code', text: content.join('\n') });
      continue;
    }
    const table = parsePipeTableAt(lines, i);
    if (table) {
      blocks.push({ kind: 'table', rows: table.rows });
      i = table.nextIndex;
      continue;
    }
    const head = heading(line);
    if (head) { blocks.push({ kind: 'heading', level: head[1].length, text: head[2].trim() }); i += 1; continue; }
    const parsedList = parsePhiWriteListAt(lines, i);
    if (parsedList) {
      blocks.push(parsedList.block);
      i = parsedList.nextIndex;
      continue;
    }
    const listType = bullet(line) ? 'ul' : ordered(line) ? 'ol' : null;
    if (listType) {
      const items = [];
      while (i < lines.length) {
        const match = listType === 'ul' ? bullet(lines[i]) : ordered(lines[i]);
        if (!match) break;
        items.push(match[1]); i += 1;
      }
      blocks.push({ kind: 'list', listType, items,
        ...(listType === 'ol' ? { start: Number(ordered(line)?.[0]?.match(/^\d+/)?.[0]) || 1 } : {}) }); continue;
    }
    if (quote(line)) {
      const text = [];
      while (i < lines.length && quote(lines[i])) { text.push(quote(lines[i])[1]); i += 1; }
      blocks.push({ kind: 'quote', text: text.join('\n') }); continue;
    }
    const text = [];
    while (i < lines.length && !blank(lines[i]) && !fence(lines[i]) &&
      !heading(lines[i]) && !bullet(lines[i]) && !ordered(lines[i]) && !quote(lines[i]) && !parsePipeTableAt(lines, i)) {
      text.push(lines[i]); i += 1;
    }
    blocks.push({ kind: 'paragraph', text: text.join('\n') });
  }
  return blocks;
}

export function escapePhiWriteHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

export function renderInlinePhiWriteHtml(value) {
  return tokenizePhiWriteInline(value).map((token) => {
    const safe = escapePhiWriteHtml(token.text);
    if (token.code) return '<code>' + safe + '</code>';
    if (token.href) return '<a href="' + escapePhiWriteHtml(token.href) +
      '" target="_blank" rel="noopener noreferrer">' + safe + '</a>';
    if (token.bold) return '<strong>' + safe + '</strong>';
    if (token.italic) return '<em>' + safe + '</em>';
    return safe;
  }).join('');
}

export function renderNestedPhiWriteListHtml(items = []) {
  function groupsHtml(nodes) {
    return groupTwoLevelListNodes(nodes).map((group) => {
      const tag = group.listType === 'ol' ? 'ol' : 'ul';
      const start = tag === 'ol' && group.start > 1 ? ' start="' + group.start + '"' : '';
      const children = group.items.map((item) => '<li>' +
        renderInlinePhiWriteHtml(item.text) +
        (item.children.length ? groupsHtml(item.children) : '') + '</li>').join('');
      return '<' + tag + start + '>' + children + '</' + tag + '>';
    }).join('');
  }
  return '<div class="phiwrite-nested-list">' +
    groupsHtml(buildTwoLevelListTree(items)) + '</div>';
}

export function renderPhiWritePrintBlocksHtml(blocks = []) {
  return blocks.map((block) => {
    if (block.kind === 'heading') {
      const level = Math.max(2, Math.min(6, Number(block.level) + 1 || 2));
      return '<h' + level + '>' + renderInlinePhiWriteHtml(block.text) + '</h' + level + '>';
    }
    if (block.kind === 'nested-list') return renderNestedPhiWriteListHtml(block.items);
    if (block.kind === 'list') {
      const tag = block.listType === 'ol' ? 'ol' : 'ul';
      const start = tag === 'ol' && Number.isInteger(block.start) && block.start > 1 && block.start < 1000000 ? ' start="' + block.start + '"' : '';
      return '<' + tag + start + '>' + block.items.map((item) => '<li>' + renderInlinePhiWriteHtml(item) + '</li>').join('') + '</' + tag + '>';
    }
    if (block.kind === 'table') {
      const row = (cells, tag) => '<tr>' + cells.map((cell) => '<' + tag + '>' + renderInlinePhiWriteHtml(cell) + '</' + tag + '>').join('') + '</tr>';
      return '<table><thead>' + row(block.rows[0], 'th') + '</thead><tbody>' + block.rows.slice(1).map((cells) => row(cells, 'td')).join('') + '</tbody></table>';
    }
    if (block.kind === 'code') return '<pre><code>' + escapePhiWriteHtml(block.text) + '</code></pre>';
    if (block.kind === 'quote') return '<blockquote>' + renderInlinePhiWriteHtml(block.text) + '</blockquote>';
    return '<p>' + renderInlinePhiWriteHtml(block.text) + '</p>';
  }).join('\n');
}

export function buildPhiWriteHtmlDocument({ title = 'Untitled', content = '', trustLabel = 'Unlabeled' } = {}) {
  const safeTitle = escapePhiWriteHtml(title);
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + safeTitle + '</title>',
    '<style>',
    'body{margin:0;background:#fff;color:#172031;font:11pt/1.55 Georgia,serif}',
    'main{max-width:48rem;margin:auto;padding:2rem}',
    'h1{font-size:2em}h2,h3,h4,h5,h6{line-height:1.25;margin-top:1.2em}',
    'p,blockquote{white-space:pre-wrap}blockquote{border-left:3px solid #888;padding-left:1rem;color:#45516a}',
    'pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:1rem;background:#f2f3f5}',
    'code{font:0.9em/1.4 Consolas,monospace;background:#f2f3f5;padding:0.1em 0.2em}pre code{background:none;padding:0}',
    'li{white-space:pre-wrap;margin-bottom:.35em}header{border-bottom:1px solid #ccd2dc;margin-bottom:1.5rem}',
    'table{border-collapse:collapse;width:100%;table-layout:fixed;margin:1em 0}th,td{border:1px solid #bcc5d0;padding:.35rem .5rem;overflow-wrap:anywhere;text-align:left}thead{display:table-header-group}tr{break-inside:avoid}',
    'small{color:#44546a}a{color:#0757b0;text-decoration:underline;overflow-wrap:anywhere}@media print{@page{margin:18mm}main{padding:0}}',
    '</style></head><body><main><header><h1>' + safeTitle + '</h1>',
    '<small>Trust label: ' + escapePhiWriteHtml(trustLabel) + '</small></header>',
    renderPhiWritePrintBlocksHtml(parsePhiWritePrintBlocks(content)),
    '</main></body></html>',
  ].join('\n');
}
