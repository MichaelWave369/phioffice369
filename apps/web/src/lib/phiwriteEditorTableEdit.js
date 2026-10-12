// Review-first editing of a previously parsed PhiWrite pipe table.
// Uses the same Markdown tokenizer/renderer as print and DOCX, and does not
// touch surrounding source on refusal or cancellation.
import { parsePipeTableAt, splitPipeTableRow, renderPipeTable } from './simpleTables.js';
import { PHIWRITE_TABLE_LIMITS } from './phiwriteEditorTables.js';

function bounded(value, length) {
  return Math.max(0, Math.min(length, Number.isFinite(value) ? Math.trunc(value) : 0));
}

function fenceOf(line) {
  const found = line.match(/^ {0,3}(`{3,}|~{3,})/);
  return found ? { char: found[1][0], width: found[1].length } : null;
}

function scanSource(source) {
  const lines = source.split('\n');
  const starts = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }
  const inFence = [];
  let active = null;
  for (let i = 0; i < lines.length; i += 1) {
    const candidate = fenceOf(lines[i]);
    inFence.push(Boolean(active) || Boolean(candidate));
    if (candidate && !active) active = candidate;
    else if (candidate && candidate.char === active?.char &&
      candidate.width >= active.width) active = null;
  }
  return { lines, starts, inFence };
}

export function preparePhiWriteTableEdit(content, start, end) {
  const source = String(content ?? '');
  const a = bounded(start, source.length), b = bounded(end, source.length);
  const left = Math.min(a, b), right = Math.max(a, b);
  const failure = (reason) => ({
    content: source, start: left, end: right,
    headers: [], rows: [], reason,
  });

  if (source.includes('\r')) return failure('lineEndings');
  const { lines, starts, inFence } = scanSource(source);
  let unsupported = false;
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (inFence[i] || inFence[i + 1]) continue;
    const parsed = parsePipeTableAt(lines, i);
    if (!parsed) continue;
    const blockStart = starts[i];
    const lastLine = parsed.nextIndex - 1;
    const blockEnd = starts[lastLine] + lines[lastLine].length;
    if (left < blockStart || left > blockEnd || right > blockEnd) {
      i = lastLine;
      continue;
    }
    // A right-exclusive selection ending immediately after the table is OK.
    const headers = parsed.rows[0];
    const rows = parsed.rows.slice(1);
    const limits = PHIWRITE_TABLE_LIMITS;
    const rule = splitPipeTableRow(lines[i + 1]);
    const canonicalRule = rule?.every((value) => value === '---');
    const sizeOkay = headers.length >= limits.minColumns &&
      headers.length <= limits.maxColumns &&
      rows.length >= limits.minRows && rows.length <= limits.maxRows;
    const contentsOkay = parsed.rows.every((cells) => cells.every((cell) =>
      cell.length <= limits.maxCellLength &&
      !/[\r\n\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(cell)));
    if (!canonicalRule) return failure('alignment');
    if (!sizeOkay || !contentsOkay) return failure('size');
    // Non-table text outside the selected table survives byte-for-byte.
    return {
      content: source, start: blockStart, end: blockEnd,
      headers: [...headers], rows: rows.map((row) => [...row]), reason: null,
    };
  }
  return failure(unsupported ? 'size' : 'table');
}

export function savePhiWriteTableEdit(currentContent, snapshot, headers, bodyRows) {
  const source = String(currentContent ?? '');
  const failure = (reason) => ({
    content: source, changed: false, reason,
    selectionStart: snapshot?.start ?? 0,
    selectionEnd: snapshot?.end ?? 0,
  });
  if (!snapshot || snapshot.content !== source) return failure('stale');
  if (snapshot.reason) return failure(snapshot.reason);
  const fresh = preparePhiWriteTableEdit(source, snapshot.start, snapshot.end);
  if (fresh.reason || fresh.start !== snapshot.start || fresh.end !== snapshot.end) {
    return failure(fresh.reason ?? 'table');
  }
  // PR #38 is intentionally cell-only, not a destructive resizing tool.
  if (!Array.isArray(headers) || headers.length !== snapshot.headers.length ||
      !Array.isArray(bodyRows) || bodyRows.length !== snapshot.rows.length ||
      bodyRows.some((row) => !Array.isArray(row) || row.length !== headers.length)) {
    return failure('shape');
  }
  const values = [...headers, ...bodyRows.flat()];
  if (values.some((value) => typeof value !== 'string' ||
      value.length > PHIWRITE_TABLE_LIMITS.maxCellLength ||
      /[\r\n\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))) {
    return failure('cell');
  }
  // Headers can be renamed, but never to an empty value.
  const names = headers.map((value) => value.trim());
  if (names.some((value) => !value)) return failure('header');
  const markdown = renderPipeTable([names, ...bodyRows]);
  const original = source.slice(snapshot.start, snapshot.end);
  if (original === markdown) return failure('unchanged');
  const next = source.slice(0, snapshot.start) + markdown + source.slice(snapshot.end);
  return {
    content: next, changed: true, reason: null,
    selectionStart: snapshot.start, selectionEnd: snapshot.start + markdown.length,
  };
}
