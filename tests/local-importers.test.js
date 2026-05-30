import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferImportKindFromFilename,
  normalizeTextFile,
  parseCsvImport,
  parseMarkdownImport,
  splitCsvLine,
  tryParsePhiOfficeJsonImport,
} from '../apps/web/src/lib/localImporters.js';

test('normalizeTextFile removes BOM and normalizes line endings', () => {
  assert.equal(normalizeTextFile('\uFEFFa\r\nb\rc'), 'a\nb\nc');
});

test('parseMarkdownImport extracts the first H1 heading as title', () => {
  const result = parseMarkdownImport('# My Local Doc\n\nHello world.');

  assert.equal(result.kind, 'document');
  assert.equal(result.app, 'PhiWrite');
  assert.equal(result.title, 'My Local Doc');
  assert.match(result.importNote, /No file was uploaded/);
});

test('parseMarkdownImport falls back when no H1 heading exists', () => {
  const result = parseMarkdownImport('Just body text.', 'Fallback Title');

  assert.equal(result.title, 'Fallback Title');
  assert.equal(result.content, 'Just body text.');
});

test('splitCsvLine handles quoted commas and escaped quotes', () => {
  assert.deepEqual(splitCsvLine('Name,"Notes, long",Amount'), ['Name', 'Notes, long', 'Amount']);
  assert.deepEqual(splitCsvLine('A,"B ""quoted"" C",D'), ['A', 'B "quoted" C', 'D']);
});

test('parseCsvImport converts CSV into columns and row objects', () => {
  const result = parseCsvImport('Category,Planned,Actual\nFood,100,92\nGas,50,60', 'Budget Import');

  assert.equal(result.kind, 'grid');
  assert.equal(result.app, 'PhiGrid');
  assert.equal(result.title, 'Budget Import');
  assert.deepEqual(result.columns, ['Category', 'Planned', 'Actual']);
  assert.deepEqual(result.rows[0], { Category: 'Food', Planned: '100', Actual: '92' });
  assert.deepEqual(result.rows[1], { Category: 'Gas', Planned: '50', Actual: '60' });
});

test('parseCsvImport handles empty CSV', () => {
  const result = parseCsvImport('', 'Empty Import');

  assert.equal(result.title, 'Empty Import');
  assert.deepEqual(result.columns, ['Item', 'Value', 'Notes']);
  assert.deepEqual(result.rows, []);
});

test('tryParsePhiOfficeJsonImport validates PhiOffice369 schemas', () => {
  const ok = tryParsePhiOfficeJsonImport('{"schema":"phioffice369.project_manifest.v0.1"}');
  const notPhi = tryParsePhiOfficeJsonImport('{"schema":"other.schema"}');
  const invalid = tryParsePhiOfficeJsonImport('{not json');

  assert.equal(ok.ok, true);
  assert.equal(notPhi.ok, false);
  assert.equal(invalid.ok, false);
});

test('inferImportKindFromFilename detects supported local import types', () => {
  assert.equal(inferImportKindFromFilename('notes.md'), 'markdown');
  assert.equal(inferImportKindFromFilename('notes.markdown'), 'markdown');
  assert.equal(inferImportKindFromFilename('budget.csv'), 'csv');
  assert.equal(inferImportKindFromFilename('manifest.json'), 'json');
  assert.equal(inferImportKindFromFilename('image.png'), 'unknown');
});
