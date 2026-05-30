export function normalizeTextFile(text) {
  return String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function parseMarkdownImport(text, fallbackTitle = 'Imported Markdown') {
  const content = normalizeTextFile(text).trim();
  const headingMatch = content.match(/^#\s+(.+)$/m);
  const title = headingMatch?.[1]?.trim() || fallbackTitle;

  return {
    kind: 'document',
    app: 'PhiWrite',
    title,
    content,
    importNote: 'Imported from local Markdown. No file was uploaded.',
  };
}

export function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

export function parseCsvImport(text, fallbackTitle = 'Imported CSV') {
  const lines = normalizeTextFile(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      kind: 'grid',
      app: 'PhiGrid',
      title: fallbackTitle,
      columns: ['Item', 'Value', 'Notes'],
      rows: [],
      importNote: 'Imported empty CSV. No file was uploaded.',
    };
  }

  const columns = splitCsvLine(lines[0]).map((column, index) => column.trim() || `Column ${index + 1}`);
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return columns.reduce((row, column, index) => ({ ...row, [column]: cells[index] ?? '' }), {});
  });

  return {
    kind: 'grid',
    app: 'PhiGrid',
    title: fallbackTitle,
    columns,
    rows,
    importNote: 'Imported from local CSV. No file was uploaded.',
  };
}

export function tryParsePhiOfficeJsonImport(text) {
  try {
    const parsed = JSON.parse(normalizeTextFile(text));
    if (typeof parsed?.schema !== 'string' || !parsed.schema.startsWith('phioffice369.')) {
      return { ok: false, reason: 'JSON is valid, but it is not a PhiOffice369 artifact.' };
    }
    return { ok: true, artifact: parsed };
  } catch {
    return { ok: false, reason: 'Could not parse JSON.' };
  }
}

export function inferImportKindFromFilename(filename) {
  const lower = String(filename ?? '').toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.json')) return 'json';
  return 'unknown';
}
