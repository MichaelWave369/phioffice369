import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenizePhiWriteInline, inlineTokensToMarkdown, escapeInlineMarkdownText,
} from '../apps/web/src/lib/phiwriteInline.js';
import {
  parsePhiWritePrintBlocks, renderInlinePhiWriteHtml, renderPhiWritePrintBlocksHtml,
} from '../apps/web/src/lib/phiwritePrint.js';
import { renderPipeTable, parsePipeTableAt } from '../apps/web/src/lib/simpleTables.js';
import { buildPhiWriteDocx } from '../apps/web/src/lib/docxExport.js';
import { extractDocxPackage } from '../apps/web/src/lib/docxZip.js';

test('bounded nonstandard underline syntax tokenizes with other inline spans', () => {
  const value = 'Mark ++inspection++ then **bold**, *italic* and ~~retired~~';
  const tokens = tokenizePhiWriteInline(value);
  assert.deepEqual(tokens, [
    { text: 'Mark ' },
    { text: 'inspection', underline: true },
    { text: ' then ' },
    { text: 'bold', bold: true },
    { text: ', ' },
    { text: 'italic', italic: true },
    { text: ' and ' },
    { text: 'retired', strike: true },
  ]);
  assert.equal(inlineTokensToMarkdown(tokens), value);
});

test('literal pluses and escaped underline markers remain visible without formatting', () => {
  const source = String.raw`C\+\+ and \+\+literal\+\+`;
  const parsed = tokenizePhiWriteInline(source);
  assert.deepEqual(parsed, [{text: 'C++ and ++literal++'}]);
  assert.equal(renderInlinePhiWriteHtml(source), 'C++ and ++literal++');
  assert.equal(escapeInlineMarkdownText('C++'), 'C\\+\\+');
  assert.equal(inlineTokensToMarkdown(parsed), String.raw`C\+\+ and \+\+literal\+\+`);
});

test('inline code takes priority over underlining and newline never becomes an underline', () => {
  assert.deepEqual(tokenizePhiWriteInline('`++literal++` and ++real++'), [
    {text:'++literal++',code:true},
    {text:' and '},
    {text:'real',underline:true},
  ]);
  assert.deepEqual(tokenizePhiWriteInline('++split\nnot matched++'),
    [{text:'++split\nnot matched++'}]);
});

test('HTML underline is semantic and escaped, not executable content', () => {
  const markup = renderInlinePhiWriteHtml('++<script>alert(1)</script>++');
  assert.match(markup, /<u>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/u>/);
  assert.doesNotMatch(markup, /<script>|<img/);
  assert.equal(renderInlinePhiWriteHtml('++underlined++'), '<u>underlined</u>');
});

test('DOCX contains a single underline Word run and no invented annotations', async () => {
  const {documentXml}=await extractDocxPackage(buildPhiWriteDocx({
    title:'Underline Review',content:'Approve ++inspection++ before signing.',
  }).bytes);
  assert.match(documentXml,
    /<w:rPr><w:u w:val="single"\/><\/w:rPr><w:t xml:space="preserve">inspection<\/w:t>/);
  assert.doesNotMatch(documentXml, /<w:u w:val="double"/);
  assert.doesNotMatch(documentXml, /<w:highlight/);
});

test('Word table cell and quote use the same bounded underline converter', async () => {
  const source='| Asset | Review |\n| --- | --- |\n| Cable | ++CHECK++ |\n\n> ++Inspector signature++';
  const blocks=parsePhiWritePrintBlocks(source);
  assert.deepEqual(blocks.map(x=>x.kind),['table','quote']);
  const html=renderPhiWritePrintBlocksHtml(blocks);
  assert.match(html, /<td><u>CHECK<\/u><\/td>/);
  assert.match(html, /<blockquote><u>Inspector signature<\/u><\/blockquote>/);
  const {documentXml}=await extractDocxPackage(buildPhiWriteDocx({
    title:'Quality Check',content:source,
  }).bytes);
  assert.match(documentXml, /<w:tbl>/);
  assert.equal((documentXml.match(/<w:u w:val="single"\/>/g)||[]).length,2);
});

test('pipe table parser safely preserves underlining and literal escaped pluses', () => {
  const rows=[['Device','Status'],['C++','++passed++'],['C++ port', String.raw`\+\+literal\+\+`]];
  const markdown=renderPipeTable(rows);
  assert.deepEqual(parsePipeTableAt(markdown.split('\n'),0).rows,rows);
  const html=renderPhiWritePrintBlocksHtml(parsePhiWritePrintBlocks(markdown));
  assert.match(html, /<u>passed<\/u>/);
  assert.match(html, /\+\+literal\+\+/);
  assert.doesNotMatch(html, /<u>literal<\/u>/);
});

test('overlapping Word-style inline properties remain deliberately single-layer', () => {
  const markdown=inlineTokensToMarkdown([{text:'Approve',bold:true,underline:true}]);
  assert.equal(markdown,'++Approve++');
  assert.deepEqual(tokenizePhiWriteInline(markdown),[{text:'Approve',underline:true}]);
});
