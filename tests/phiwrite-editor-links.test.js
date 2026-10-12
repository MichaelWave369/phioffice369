import test from 'node:test';
import assert from 'node:assert/strict';
import {
  preparePhiWriteLinkSelection, insertPhiWriteSafeLink,
} from '../apps/web/src/lib/phiwriteEditorLinks.js';
import { tokenizePhiWriteInline } from '../apps/web/src/lib/phiwriteInline.js';
import { renderInlinePhiWriteHtml } from '../apps/web/src/lib/phiwritePrint.js';
import { buildPhiWriteDocx } from '../apps/web/src/lib/docxExport.js';
import { extractDocxPackage } from '../apps/web/src/lib/docxZip.js';
import { phiWriteShortcutForKey } from '../apps/web/src/lib/phiwriteEditorFormatting.js';

test('selected text is proposed as label, with no implicit draft mutation', () => {
  const source='Read docs before changing the router.';
  const start=source.indexOf('docs');
  const snapshot=preparePhiWriteLinkSelection(source,start,start+4);
  assert.deepEqual(snapshot,{content:source,start,end:start+4,label:'docs',reason:null});
  assert.equal(source, 'Read docs before changing the router.');
});

test('approved HTTPS link replaces selected text and keeps label selected', () => {
  const source='Read docs before proceeding.';
  const start=source.indexOf('docs');
  const sel=preparePhiWriteLinkSelection(source,start,start+4);
  const result=insertPhiWriteSafeLink(source,sel,'specifications','https://example.org/docs');
  assert.equal(result.content,'Read [specifications](https://example.org/docs) before proceeding.');
  assert.equal(result.content.slice(result.selectionStart,result.selectionEnd),'specifications');
  assert.equal(result.changed,true);
  assert.deepEqual(tokenizePhiWriteInline(result.content).find(x=>x.href)?.text,'specifications');
});

test('collapsed cursor uses editable placeholder and never erases adjacent text', () => {
  const source='See .';
  const snapshot=preparePhiWriteLinkSelection(source,4,4);
  assert.equal(snapshot.label,'link text');
  const result=insertPhiWriteSafeLink(source,snapshot,snapshot.label,'http://example.org');
  assert.equal(result.content,'See [link text](http://example.org/).');
  assert.equal(result.content.slice(result.selectionStart,result.selectionEnd),'link text');
});

test('unsafe schemes, userinfo, scripts, whitespace and unparseable parentheses are rejected', () => {
  const source='read docs';const snapshot=preparePhiWriteLinkSelection(source,5,9);
  for(const url of [
    'javascript:alert(1)','data:text/html,<script>', 'file:///etc/passwd',
    'https://evil:password@example.org/path','https://example.org/a)b',
    'https://example.org/embedded space','https://example.org/\\evil',
    'https://example.org/\ncode', '', 'ftp://example.org',
  ]) {
    const result=insertPhiWriteSafeLink(source,snapshot,'docs',url);
    assert.equal(result.changed,false,url);
    assert.equal(result.content,source,url);
    assert.equal(result.reason,'url',url);
  }
});

test('safe canonical URL link survives HTML rendering and Word hyperlink packaging', async () => {
  const source='Refer to manual';
  const snapshot=preparePhiWriteLinkSelection(source,9,15);
  const result=insertPhiWriteSafeLink(source,snapshot,'manual','https://example.org/?x=1&y=2');
  assert.equal(result.changed,true);
  const html=renderInlinePhiWriteHtml(result.content);
  assert.match(html, /<a href="https:\/\/example.org\/\?x=1&amp;y=2" target="_blank" rel="noopener noreferrer">manual<\/a>/);
  const docx=await extractDocxPackage(buildPhiWriteDocx({
    title:'Safe field guide',content:result.content,
  }).bytes);
  assert.match(docx.documentXml,/<w:hyperlink r:id="rId3"/);
  assert.match(docx.relationshipsXml,/Target="https:\/\/example.org\/\?x=1&amp;y=2"/);
});

test('stale editor snapshot refuses to overwrite newer local content', () => {
  const snapshot=preparePhiWriteLinkSelection('Read docs',5,9);
  const updated='Read new notes and docs';
  const result=insertPhiWriteSafeLink(updated,snapshot,'docs','https://example.org');
  assert.equal(result.changed,false);
  assert.equal(result.reason,'stale');
  assert.equal(result.content,updated);
});

test('selection containing multiline or existing markup cannot be linked by accident', () => {
  const source='See **important**\nmore detail';
  const multi=preparePhiWriteLinkSelection(source,0,source.length);
  assert.equal(multi.reason,'multiline');
  assert.equal(insertPhiWriteSafeLink(source,multi,'docs','https://example.org').reason,'multiline');
  const start=source.indexOf('**important**');
  const nested=preparePhiWriteLinkSelection(source,start,start+13);
  assert.equal(insertPhiWriteSafeLink(source,nested,'name','https://example.org').reason,'nested');
});

test('link text rejects controls, delimiters, empty input and incompatible markup', () => {
  const source='docs';const sel=preparePhiWriteLinkSelection(source,0,4);
  for(const label of ['', '    ','line\nbreak','[nested]', '`code`','**bold**','++underlined++','==yellow==', '~~strike~~']) {
    const result=insertPhiWriteSafeLink(source,sel,label,'https://example.org');
    assert.equal(result.changed,false,label);
    assert.equal(result.reason,'label',label);
    assert.equal(result.content,source,label);
  }
});

test('literal untrusted HTML inside link label is escaped in output HTML', () => {
  const source='review';const sel=preparePhiWriteLinkSelection(source,0,6);
  const result=insertPhiWriteSafeLink(source,sel,'<img src=x onerror=evil()>','https://example.org');
  assert.equal(result.changed,true);
  const html=renderInlinePhiWriteHtml(result.content);
  assert.match(html, /&lt;img src=x onerror=evil\(\)&gt;/);
  assert.doesNotMatch(html,/<img/);
});

test('non-nested pasted link or formatted span is refused', () => {
  const source='Read [docs](https://example.org) and **bold**.';
  const link=preparePhiWriteLinkSelection(source,5,32);
  assert.equal(insertPhiWriteSafeLink(source,link,'docs','https://example.org/next').changed,false);
  const start=source.indexOf('bold');
  const nested=preparePhiWriteLinkSelection(source,start,start+4);
  assert.equal(insertPhiWriteSafeLink(source,nested,'bold','https://example.org').changed,false);
  assert.equal(insertPhiWriteSafeLink(source,nested,'bold','https://example.org').reason,'nested');
});

test('Ctrl/Cmd+K only opens link editor when modifier contract is satisfied', () => {
  assert.equal(phiWriteShortcutForKey({key:'k',ctrlKey:true}),'link');
  assert.equal(phiWriteShortcutForKey({key:'K',metaKey:true}),'link');
  assert.equal(phiWriteShortcutForKey({key:'k',ctrlKey:true,altKey:true}),null);
  assert.equal(phiWriteShortcutForKey({key:'k',shiftKey:true,ctrlKey:true}),null);
  assert.equal(phiWriteShortcutForKey({key:'k'}),null);
});
