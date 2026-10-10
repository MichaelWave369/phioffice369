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

// A small RFC 4180-style reader: commas, escaped quotes, and newlines inside
// quoted fields are data. Malformed quotes are rejected rather than silently
// changing cells or overwriting an existing local workspace.
export function parseCsvRecords(text) {
  const source = normalizeTextFile(text);
  if (source.length === 0) return [];

  const records = [];
  let record = [];
  let field = '';
  let insideQuotes = false;
  let afterQuotedField = false;

  function endField() {
    record.push(field);
    field = '';
    afterQuotedField = false;
  }

  function endRecord() {
    endField();
    records.push(record);
    record = [];
  }

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (insideQuotes) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        insideQuotes = false;
        afterQuotedField = true;
      } else {
        field += char;
      }
      continue;
    }

    if (char === ',') {
      endField();
      continue;
    }
    if (char === '\n') {
      endRecord();
      continue;
    }
    if (char === '"' && field.length === 0 && !afterQuotedField) {
      insideQuotes = true;
      continue;
    }
    if (char === '"' || afterQuotedField) {
      throw new SyntaxError('Malformed CSV: unexpected character after a quoted field.');
    }
    field += char;
  }

  if (insideQuotes) {
    throw new SyntaxError('Malformed CSV: unterminated quoted field.');
  }

  if (record.length > 0 || field.length > 0 || !source.endsWith('\n')) {
    endRecord();
  }

  return records;
}

export function splitCsvLine(line) {
  const records = parseCsvRecords(line);
  if (records.length > 1) {
    throw new SyntaxError('Expected one CSV record.');
  }
  return records[0] ?? [''];
}

export function parseCsvImport(text, fallbackTitle = 'Imported CSV') {
  const records = parseCsvRecords(text);

  if (records.length === 0) {
    return {
      kind: 'grid',
      app: 'PhiGrid',
      title: fallbackTitle,
      columns: ['Item', 'Value', 'Notes'],
      rows: [],
      csvWarnings: [],
      importNote: 'Imported empty CSV. No file was uploaded.',
    };
  }

  const headers = records[0];
  const width = records.reduce((max, record) => Math.max(max, record.length), headers.length);
  const columns = [];
  const usedNames = new Set();
  let duplicateCount = 0;
  let unnamedCount = 0;

  for (let index = 0; index < width; index += 1) {
    const rawHeader = headers[index]?.trim() ?? '';
    if (index < headers.length && !rawHeader) unnamedCount += 1;
    const base = rawHeader || 'Column ' + (index + 1);
    let label = base;
    let suffix = 2;
    while (usedNames.has(label)) {
      label = base + ' (' + suffix + ')';
      suffix += 1;
    }
    if (label !== base) duplicateCount += 1;
    usedNames.add(label);
    columns.push(label);
  }

  const rows = records.slice(1).map((record) =>
    Object.fromEntries(columns.map((column, index) => [column, record[index] ?? '']))
  );

  const csvWarnings = [];
  if (duplicateCount) csvWarnings.push(duplicateCount + ' duplicate column names were renamed to prevent overwriting cells.');
  if (unnamedCount) csvWarnings.push(unnamedCount + ' blank column names were assigned labels.');
  if (width > headers.length) csvWarnings.push((width - headers.length) + ' additional columns were created for data beyond the header.');

  return {
    kind: 'grid',
    app: 'PhiGrid',
    title: fallbackTitle,
    columns,
    rows,
    csvWarnings,
    importNote: 'Imported from local CSV. No file was uploaded.',
  };
}

function normalizeDeckSlides(slides) {
  if (!Array.isArray(slides)) return [];

  return slides.map((slide, index) => ({
    id: slide?.id ? String(slide.id) : `slide-${index + 1}`,
    title: slide?.title ? String(slide.title) : `Slide ${index + 1}`,
    bullets: Array.isArray(slide?.bullets) ? slide.bullets.map((bullet) => String(bullet)) : [],
  }));
}

export function parsePhiDeckJsonImport(text, fallbackTitle = 'Imported PhiDeck') {
  try {
    const parsed = JSON.parse(normalizeTextFile(text));
    if (parsed?.schema !== 'phioffice369.phideck_lite.v0.1') {
      return { ok: false, reason: 'JSON is valid, but it is not a PhiDeck-lite deck.' };
    }

    const slides = normalizeDeckSlides(parsed.slides);
    if (slides.length === 0) {
      return { ok: false, reason: 'PhiDeck-lite JSON did not contain any slides.' };
    }

    return {
      ok: true,
      kind: 'deck',
      app: 'PhiDeck',
      title: parsed.title || fallbackTitle,
      slides,
      importNote: 'Imported from local PhiDeck-lite JSON. No file was uploaded.',
    };
  } catch {
    return { ok: false, reason: 'Could not parse PhiDeck JSON.' };
  }
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
