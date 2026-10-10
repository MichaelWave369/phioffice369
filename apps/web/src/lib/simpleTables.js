// Small, intentionally limited GitHub-Flavored-Markdown-style pipe table
// subset shared by PhiWrite's HTML/print and DOCX import/export paths.
// No inline HTML, cell spans, alignment fidelity, or multi-line cells.
export function splitPipeTableRow(line) {
  const value = String(line ?? '').trim();
  if (!value.startsWith('|') || !value.endsWith('|')) return null;
  const body = value.slice(1, -1);
  const cells = [];
  let cell = '';
  let escaped = false;
  for (const char of body) {
    if (escaped) {
      cell += (char === '|' || char === '\\') ? char : '\\' + char;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  if (escaped) cell += '\\';
  cells.push(cell.trim());
  return cells;
}

export function escapePipeTableCell(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

export function renderPipeTable(rows) {
  if (!Array.isArray(rows) || !rows.length) return '';
  const width = rows[0]?.length;
  if (!Number.isInteger(width) || width < 2 || width > 32 ||
    rows.length > 500 || rows.some((row) => !Array.isArray(row) || row.length !== width)) {
    throw new Error('Pipe table: expected 2–32 columns and no more than 500 equal-width rows.');
  }
  const row = (cells) => '| ' + cells.map(escapePipeTableCell).join(' | ') + ' |';
  return [
    row(rows[0]),
    '| ' + rows[0].map(() => '---').join(' | ') + ' |',
    ...rows.slice(1).map(row),
  ].join('\n');
}

export function parsePipeTableAt(lines, start) {
  if (!Array.isArray(lines) || start < 0 || start + 1 >= lines.length) return null;
  const header = splitPipeTableRow(lines[start]);
  const rule = splitPipeTableRow(lines[start + 1]);
  if (!header || !rule || header.length < 2 || header.length > 32 ||
    rule.length !== header.length || !rule.every((value) => /^:?-{3,}:?$/.test(value))) {
    return null;
  }
  const rows = [header];
  let i = start + 2;
  while (i < lines.length && rows.length < 500) {
    const cells = splitPipeTableRow(lines[i]);
    if (!cells || cells.length !== header.length) break;
    rows.push(cells);
    i += 1;
  }
  return { kind: 'table', rows, nextIndex: i };
}
