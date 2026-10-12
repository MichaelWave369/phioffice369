// Explicit, local-only insertion of simple Markdown tables into PhiWrite.
// Reuses the exact printer/DOCX pipe-table serializer, not a second parser.
import { renderPipeTable } from './simpleTables.js';

export const PHIWRITE_TABLE_LIMITS = Object.freeze({
  minColumns: 2, maxColumns: 8, minRows: 1, maxRows: 12, maxCellLength: 160,
});

function offset(value, max) {
  return Math.max(0, Math.min(max, Number.isFinite(value) ? Math.trunc(value) : 0));
}

function isInsideFence(source, at) {
  let active = null;
  for (const line of source.slice(0, at).split('\n')) {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (!match) continue;
    const char = match[1][0], width = match[1].length;
    if (!active) active = { char, width };
    else if (active.char === char && width >= active.width) active = null;
  }
  return Boolean(active);
}

export function preparePhiWriteTableInsertion(content, start, end) {
  const source = String(content ?? '');
  const a = offset(start, source.length), b = offset(end, source.length);
  const left = Math.min(a, b), right = Math.max(a, b);
  if (left !== right) return { content: source, position: left, reason: 'selection' };
  const lineStart = source.lastIndexOf('\n', Math.max(0, left - 1)) + 1;
  const ending = source.indexOf('\n', left);
  const lineEnd = ending < 0 ? source.length : ending;
  if (source.slice(lineStart, lineEnd).length !== 0) {
    return { content: source, position: left, reason: 'line' };
  }
  if (isInsideFence(source, lineStart)) {
    return { content: source, position: left, reason: 'code' };
  }
  return { content: source, position: left, reason: null };
}

export function insertPhiWriteTable(currentContent, snapshot, headers, bodyRows) {
  const source = String(currentContent ?? '');
  const failure = (reason) => ({
    content: source, changed: false, reason,
    selectionStart: snapshot?.position ?? 0, selectionEnd: snapshot?.position ?? 0,
  });
  if (!snapshot || snapshot.content !== source) return failure('stale');
  if (snapshot.reason) return failure(snapshot.reason);
  const fresh = preparePhiWriteTableInsertion(source, snapshot.position, snapshot.position);
  if (fresh.reason || !Number.isInteger(snapshot.position) ||
      snapshot.position < 0 || snapshot.position > source.length) {
    return failure(fresh.reason ?? 'line');
  }
  const limits = PHIWRITE_TABLE_LIMITS;
  if (!Array.isArray(headers) || !Array.isArray(bodyRows) ||
      headers.length < limits.minColumns || headers.length > limits.maxColumns ||
      bodyRows.length < limits.minRows || bodyRows.length > limits.maxRows ||
      bodyRows.some((row) => !Array.isArray(row) || row.length !== headers.length)) {
    return failure('shape');
  }
  const entries = [...headers, ...bodyRows.flat()];
  if (entries.some((entry) => typeof entry !== 'string' ||
      entry.length > limits.maxCellLength ||
      /[\r\n\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(entry))) {
    return failure('cell');
  }
  const names = headers.map((value, index) => value.trim() || 'Column ' + (index + 1));
  const markdown = renderPipeTable([names, ...bodyRows]);
  const before = source.slice(0, snapshot.position);
  const after = source.slice(snapshot.position);
  // Keep table blocks separate from neighboring paragraphs and list items.
  const prefix = before && !before.endsWith('\n\n') ? '\n' : '';
  const suffix = after && !after.startsWith('\n\n') ? '\n' : '';
  const tableStart = snapshot.position + prefix.length;
  const result = before + prefix + markdown + suffix + after;
  return {
    content: result, changed: true, reason: null,
    selectionStart: tableStart, selectionEnd: tableStart + markdown.length,
  };
}
