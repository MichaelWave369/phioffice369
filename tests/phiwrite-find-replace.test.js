import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findPhiWriteMatches, choosePhiWriteMatch, replacePhiWriteMatch,
  replaceAllPhiWriteMatches, undoPhiWriteReplace, MAX_PHIWRITE_MATCHES,
} from '../apps/web/src/lib/phiwriteFindReplace.js';
import { buildPhiWriteHtmlDocument } from '../apps/web/src/lib/phiwritePrint.js';
import { buildPhiWriteDocx } from '../apps/web/src/lib/docxExport.js';
import { extractDocxPackage } from '../apps/web/src/lib/docxZip.js';

test('literal search returns exact source UTF-16 positions and excludes overlapping matches', () => {
  const result = findPhiWriteMatches('aaaaa', 'aa', true);
  assert.deepEqual(result.matches, [{start:0,end:2},{start:2,end:4}]);
  assert.equal(result.reason, null);
  assert.equal(result.truncated, false);
});

test('metacharacters have no regex meaning and can be replaced literally', () => {
  const text = 'a.+? a.+? aZZ?';
  assert.deepEqual(findPhiWriteMatches(text, '.+?', true).matches,
    [{start:1,end:4},{start:6,end:9}]);
  const result = replaceAllPhiWriteMatches(text, '.+?', '$&');
  assert.equal(result.content, 'a$& a$& aZZ?');
  assert.equal(result.count, 2);
});

test('case insensitive matches are optional and case sensitive mode is exact', () => {
  const source = 'Port port PORT support';
  assert.deepEqual(findPhiWriteMatches(source, 'port').matches,
    [{start:0,end:4},{start:5,end:9},{start:10,end:14},{start:18,end:22}]);
  assert.deepEqual(findPhiWriteMatches(source, 'port', true).matches,
    [{start:5,end:9},{start:18,end:22}]);
});

test('empty and multiline queries are rejected without unintended replacements', () => {
  assert.deepEqual(findPhiWriteMatches('body', ''), {matches:[],truncated:false,reason:'empty'});
  for (const input of ['\n', 'foo\nbar', '\u0000', 'a'.repeat(257)]) {
    const matches = findPhiWriteMatches('foo\nbar', input);
    assert.equal(matches.reason, 'query');
    assert.equal(matches.matches.length, 0);
    assert.equal(replaceAllPhiWriteMatches('foo\nbar', input, 'X').changed,false);
  }
});

test('forward and backward navigation wrap and report missing matches', () => {
  const matches = findPhiWriteMatches('one two one', 'one').matches;
  assert.equal(choosePhiWriteMatch(matches, 0),0);
  assert.equal(choosePhiWriteMatch(matches, 3),1);
  assert.equal(choosePhiWriteMatch(matches, 20),0);
  assert.equal(choosePhiWriteMatch(matches, 8, 'previous'),0);
  assert.equal(choosePhiWriteMatch(matches, 11, 'previous'),1);
  assert.equal(choosePhiWriteMatch(matches, 0, 'previous'),1);
  assert.equal(choosePhiWriteMatch([], 20),-1);
  assert.throws(() => choosePhiWriteMatch(matches, 4, 'skip'), RangeError);
});

test('replace one operates at an exact current offset and leaves other matches unchanged', () => {
  const source='wire wire wire';
  const result=replacePhiWriteMatch(source,'wire','cable',5);
  assert.equal(result.content,'wire cable wire');
  assert.equal(result.count,1);
  assert.deepEqual([result.selectionStart,result.selectionEnd],[5,10]);
  const wrong=replacePhiWriteMatch(source,'wire','cable',6);
  assert.equal(wrong.changed,false);
  assert.equal(wrong.reason,'match');
  assert.equal(wrong.content,source);
});

test('replace all handles changing lengths and empty replacements without regex expansion', () => {
  const result=replaceAllPhiWriteMatches('aa b aa c aa','aa','X');
  assert.equal(result.content,'X b X c X');
  assert.equal(result.count,3);
  assert.equal(replaceAllPhiWriteMatches('a-b-a','a','').content,'-b-');
  assert.equal(replaceAllPhiWriteMatches('x x','x','$1').content,'$1 $1');
});

test('identical replacement returns unchanged and permits no bogus undo receipt', () => {
  const result=replacePhiWriteMatch('abc','abc','abc',0);
  assert.equal(result.changed,false);
  assert.equal(result.reason,'same');
  assert.equal(undoPhiWriteReplace('abc',result).reason,'stale');
});

test('undo returns original snapshot only when current draft exactly matches the replacement', () => {
  const result=replaceAllPhiWriteMatches('cable cable','cable','port');
  assert.equal(undoPhiWriteReplace(result.content,result).content,'cable cable');
  const stale=undoPhiWriteReplace('port port and new notes',result);
  assert.equal(stale.changed,false);
  assert.equal(stale.reason,'stale');
  assert.equal(stale.content,'port port and new notes');
});

test('overflow is explicit and replace-all refuses to mutate any of the >10k hits', () => {
  const source='x'.repeat(MAX_PHIWRITE_MATCHES+1);
  const found=findPhiWriteMatches(source,'x');
  assert.equal(found.matches.length,MAX_PHIWRITE_MATCHES);
  assert.equal(found.truncated,true);
  const result=replaceAllPhiWriteMatches(source,'x','y');
  assert.equal(result.reason,'limit');
  assert.equal(result.changed,false);
  assert.equal(result.content,source);
});

test('replacement length is bounded; no match or blank query never changes the draft', () => {
  for(const replacement of ['a'.repeat(2049)]) {
    assert.equal(replacePhiWriteMatch('abc','a',replacement,0).reason,'replacement');
    assert.equal(replaceAllPhiWriteMatches('abc','a',replacement).reason,'replacement');
  }
  assert.equal(replaceAllPhiWriteMatches('abc','xyz','1').changed,false);
  assert.equal(replaceAllPhiWriteMatches('abc','','1').changed,false);
});

test('replaced literal HTML still escapes safely through PhiWrite export', () => {
  const changed=replaceAllPhiWriteMatches('Check SCRIPT here.','SCRIPT','<script>alert(1)</script>');
  const html=buildPhiWriteHtmlDocument({title:'Safety check',content:changed.content});
  assert.match(html,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
});

test('replacing text in existing formatted Markdown preserves Word paragraph and inline properties', async () => {
  const before='## Verify cable\n\n**cable** has been checked.';
  const changed=replaceAllPhiWriteMatches(before,'cable','interface');
  const {documentXml}=await extractDocxPackage(buildPhiWriteDocx({
    title:'Technician notes',content:changed.content,
  }).bytes);
  assert.match(documentXml,/<w:pStyle w:val="Heading2"\/>/);
  assert.match(documentXml,/<w:b\/>/);
  assert.match(documentXml,/interface/);
  assert.doesNotMatch(documentXml,/<w:t[^>]*>cable<\/w:t>/);
});
