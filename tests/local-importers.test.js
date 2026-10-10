import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferImportKindFromFilename,
  normalizeTextFile,
  parseCsvImport,
  parseCsvRecords,
  parseMarkdownImport,
  parsePhiDeckJsonImport,
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

test('parsePhiDeckJsonImport validates and normalizes PhiDeck-lite decks', () => {
  const result = parsePhiDeckJsonImport(JSON.stringify({
    schema: 'phioffice369.phideck_lite.v0.1',
    title: 'Imported Deck',
    slides: [{ id: 'slide-a', title: 'Opening', bullets: ['One', 'Two'] }],
  }));

  assert.equal(result.ok, true);
  assert.equal(result.kind, 'deck');
  assert.equal(result.app, 'PhiDeck');
  assert.equal(result.title, 'Imported Deck');
  assert.deepEqual(result.slides[0], { id: 'slide-a', title: 'Opening', bullets: ['One', 'Two'] });
  assert.match(result.importNote, /No file was uploaded/);
});

test('parsePhiDeckJsonImport rejects non-deck JSON and empty decks', () => {
  const notDeck = parsePhiDeckJsonImport('{"schema":"phioffice369.project_manifest.v0.1"}');
  const emptyDeck = parsePhiDeckJsonImport('{"schema":"phioffice369.phideck_lite.v0.1","slides":[]}');
  const invalidJson = parsePhiDeckJsonImport('{not json');

  assert.equal(notDeck.ok, false);
  assert.equal(emptyDeck.ok, false);
  assert.equal(invalidJson.ok, false);
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

test('parseCsvRecords preserves quoted newlines, commas, quotes and cell whitespace', () => {
  const records = parseCsvRecords('Name,Notes,Value\r\nAda,"one,\r\ntwo ""quoted""", 4 \r\n');
  assert.deepEqual(records, [
    ['Name', 'Notes', 'Value'],
    ['Ada', 'one,\ntwo "quoted"', ' 4 '],
  ]);
});

test('parseCsvImport preserves blank rows, cell padding and trailing newline', () => {
  const result = parseCsvImport('Name,Notes\nAlex," leading "\n\n', 'Local');
  assert.deepEqual(result.columns, ['Name', 'Notes']);
  assert.deepEqual(result.rows, [
    { Name: 'Alex', Notes: ' leading ' },
    { Name: '', Notes: '' },
  ]);
});

test('parseCsvImport retains duplicate headers and excess cell values without data loss', () => {
  const result = parseCsvImport('Name,Name,,Age\nA,B,C,20,Extra');
  assert.deepEqual(result.columns, ['Name', 'Name (2)', 'Column 3', 'Age', 'Column 5']);
  assert.deepEqual(result.rows[0], {
    Name: 'A',
    'Name (2)': 'B',
    'Column 3': 'C',
    Age: '20',
    'Column 5': 'Extra',
  });
  assert.equal(result.csvWarnings.length, 3);
});

test('parseCsvRecords rejects malformed quoted fields before overwriting a grid', () => {
  assert.throws(() => parseCsvRecords('Name,Notes\nA,"unfinished'), /unterminated quoted field/);
  assert.throws(() => parseCsvRecords('Name,Notes\nA,"closed"extra'), /unexpected character/);
  assert.throws(() => parseCsvRecords('Name,Notes\nA,un"quoted'), /unexpected character/);
});

test('parseCsvImport treats spreadsheet-like formulas as literal text', () => {
  const result = parseCsvImport('Label,Value\nTotal,=SUM(A1:A5)');
  assert.equal(result.rows[0].Value, '=SUM(A1:A5)');
});

test('parseCsvRecords handles blank and trailing-delimiter records', () => {
  assert.deepEqual(parseCsvRecords(''), []);
  assert.deepEqual(parseCsvRecords('A,B,\nC,D,'), [['A', 'B', ''], ['C', 'D', '']]);
});

test('parseCsvImport preserves potentially special JavaScript object keys as columns', () => {
  const result = parseCsvImport('__proto__,constructor,toString\nsafe,1,2');
  assert.deepEqual(result.columns, ['__proto__', 'constructor', 'toString']);
  assert.equal(Object.prototype.hasOwnProperty.call(result.rows[0], '__proto__'), true);
  assert.equal(result.rows[0].__proto__, 'safe');
});
