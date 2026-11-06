import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGrid, columnLetter, exportGridCsv } from '../apps/web/src/lib/gridFormulas.js';
import { parseCsvImport, parseMarkdownImport, parsePhiDeckJsonImport } from '../apps/web/src/lib/localImporters.js';
import { deckSchemaForSlides, isSlideImage, VISUAL_DECK_SCHEMA } from '../apps/web/src/lib/deckSlides.js';
import { buildDeckHtml } from '../apps/web/src/lib/deckHtml.js';
import { createDocumentHistory, updateDocumentHistory } from '../apps/web/src/lib/documentHistory.js';

test('grid calculates arithmetic, mixed function arguments and dependent A1 references', () => {
  const rows = [
    { A: '6', B: '4', C: '=A1-B1*2', D: '=sum(A1:B2, -(B1+1))' },
    { A: '2', B: '=A1/2', C: '=AVERAGE(A1:B2)', D: '=COUNT(A1:A3,B1:B3)' },
    { A: 'text', B: '', C: '=MIN(A1:B2)+MAX(B2:A1)', D: '=B3' },
  ];
  assert.deepEqual(calculateGrid(['A', 'B', 'C', 'D'], rows), [
    { A: '6', B: '4', C: -2, D: 10 },
    { A: '2', B: 3, C: 3.75, D: 4 },
    { A: 'text', B: '', C: 8, D: 0 },
  ]);
  assert.equal(calculateGrid(['A', 'B', 'C', 'D'], rows, false), rows);
  assert.equal(columnLetter(26), 'AA');
});

test('grid handles cycles, bad references, unexpected syntax, nonfinite results and limits', () => {
  const columns = ['A', 'B', 'C', 'D'];
  const calculated = calculateGrid(columns, [
    { A: '=B1', B: '=A1', C: '=Z9', D: '=3/0' },
    { A: '=IMPORT("file")', B: '=fetch()', C: '=SUM(A1:A9000)', D: '=1e999' },
    { A: 'text', B: '=A3+1', C: '=1+2 garbage', D: '=' + '('.repeat(35) + '1' + ')'.repeat(35) },
  ]);
  assert.deepEqual(calculated, [
    { A: '#CYCLE!', B: '#CYCLE!', C: '#REF!', D: '#DIV/0!' },
    { A: '#PARSE!', B: '#NAME?', C: '#LIMIT!', D: '#NUM!' },
    { A: 'text', B: '#VALUE!', C: '#PARSE!', D: '#LIMIT!' },
  ]);
});

test('CSV quotes data, preserves numeric negatives and neutralizes risky cell and header starts', () => {
  const columns = ['=header', 'Value', '__proto__'];
  const rows = [Object.fromEntries([['=header', ' @LOOKUP(x)'], ['Value', '-3.25'], ['__proto__', 'one,\n"two"']])];
  const csv = exportGridCsv(columns, rows);
  assert.match(csv, /"\x27=header"/);
  assert.match(csv, /"\x27 @LOOKUP/);
  assert.match(csv, /"-3\.25"/);
  assert.equal(parseCsvImport(csv).rows[0].__proto__, 'one,\n"two"');
  assert.throws(() => parseCsvImport('A\n' + 'x\n'.repeat(501)), /500 data rows/);
  assert.throws(() => parseCsvImport('A,'.repeat(40) + 'B'), /40 columns/);
});

test('Markdown preserves leading code indentation and trailing line breaks', () => {
  assert.equal(parseMarkdownImport('    indented\r\n\r\n').content, '    indented\n\n');
});

test('body history groups typing, undoes formatting, redoes edits and clears a divergent future', () => {
  let history = createDocumentHistory('start');
  const act = (action) => { history = updateDocumentHistory(history, action); };
  act({ type: 'edit', next: 's', typedAt: 100 });
  act({ type: 'edit', next: 'sovereign', typedAt: 150 });
  act({ type: 'edit', next: '**sovereign**' });
  act({ type: 'undo' });
  assert.equal(history.content, 'sovereign');
  act({ type: 'undo' });
  assert.equal(history.content, 'start');
  act({ type: 'redo' });
  assert.equal(history.content, 'sovereign');
  act({ type: 'edit', next: 'edited' });
  assert.equal(history.future.length, 0);
});

const image = { src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=', alt: 'Local "asset"' };
const slide = { id: 'id-1', title: '<script>title</script>', bullets: ['a', 'b'], layout: 'image-left', shape: 'square', image };

test('Deck JSON and HTML retain visual slides without running or fetching user content', () => {
  assert.equal(isSlideImage(image), true);
  assert.equal(isSlideImage({ ...image, src: 'https://example.com/private.png' }), false);
  assert.equal(isSlideImage({ ...image, src: 'data:image/svg+xml;base64,PHN2Zy8+' }), false);
  assert.equal(deckSchemaForSlides([slide]), VISUAL_DECK_SCHEMA);
  const imported = parsePhiDeckJsonImport(JSON.stringify({ schema: VISUAL_DECK_SCHEMA, title: 'Deck', slides: [slide] }));
  assert.deepEqual(imported.slides, [slide]);
  const duplicate = parsePhiDeckJsonImport(JSON.stringify({ schema: VISUAL_DECK_SCHEMA, slides: [slide, slide] }));
  assert.equal(duplicate.ok, false);
  const html = buildDeckHtml({ title: '<img src=x>', slides: [slide], trustLabel: 'Private' });
  assert.ok(html.includes('&lt;script&gt;title&lt;/script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('alt="Local &quot;asset&quot;"'));
  assert.ok(html.includes("img-src data:"));
});
