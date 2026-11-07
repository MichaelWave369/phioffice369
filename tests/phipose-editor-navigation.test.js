import test from 'node:test';
import assert from 'node:assert/strict';
import {
  markdownSectionAnchors,gridVisibleCellAddresses,adjacentNavigationIndex
} from '../apps/web/src/lib/phiPoseNavigationTargets.js';
import {
  PhiPoseEditorHost,PHIPOSE_EDITOR_PROTOCOL,PHIPOSE_EDITOR_ACTIONS
} from '../apps/web/src/lib/phiPoseEditorHost.js';

const now=2_000_000,windowRef={},sessionId='cc2af102-5166-49be-b092-64f7d33c99ef';
const intent=(action,sequence=1,source='webxr')=>({
  schema:'overstrings.phipose.intent.v0.1',version:1,advisory:true,
  action_authority:false,execution_authority:false,action_id:action,
  source,program:'L:open > R:point',sequence,timestamp_ms:1000
});
const packet=(i,sent_at=now)=>({
  protocol:PHIPOSE_EDITOR_PROTOCOL,type:'command',
  session_id:sessionId,sent_at,intent:i
});
const msg=(data)=>({source:windowRef,origin:'https://example.test',data});
const open=(mode='write',demo=false)=>{
  const host=new PhiPoseEditorHost(mode);
  host.enable({source:windowRef,origin:'https://example.test',
    sessionId,expiresAt:now+60_000,allowSyntheticDemo:demo},now);
  return host;
};
const validCtx={mode:'write',hasPrevious:true,hasNext:true,blocked:false};

test('Markdown navigation finds real headings and ignores fenced pseudo-headings',()=>{
  const input=[
    '# Start','paragraph','','```md','# Code example','```',
    '## Second heading','~~~javascript','### In example','~~~',
    '### Third  ###','not a heading','#### Fourth excluded'
  ].join('\n');
  const result=markdownSectionAnchors(input);
  assert.deepEqual(result.map(x=>x.label),['Start','Second heading','Third']);
  assert.deepEqual(result.map(x=>x.depth),[1,2,3]);
  assert.equal(result[0].offset,0);
  assert.equal(input.slice(result[1].offset).startsWith('## Second heading'),true);
  assert.equal(Object.isFrozen(result),true);
  assert.equal(Object.isFrozen(result[0]),true);
  assert.deepEqual(markdownSectionAnchors(null),[]);
});
test('filtered/sorted grid navigation follows visible row indices not original order',()=>{
  const targets=gridVisibleCellAddresses([4,1],['Name','Value']);
  assert.deepEqual(targets.map(x=>x.address),['A5','B5','A2','B2']);
  assert.deepEqual(gridVisibleCellAddresses([],['One']),[]);
  assert.equal(gridVisibleCellAddresses([0],['A'])[0].row,0);
  assert.equal(Object.isFrozen(targets),true);
});
test('adjacent helper cannot wrap or mutate data',()=>{
  assert.equal(adjacentNavigationIndex(3,-1,1),0);
  assert.equal(adjacentNavigationIndex(3,0,1),1);
  assert.equal(adjacentNavigationIndex(3,1,-1),0);
  assert.equal(adjacentNavigationIndex(3,0,-1),null);
  assert.equal(adjacentNavigationIndex(3,2,1),null);
  assert.equal(adjacentNavigationIndex(0,-1,1),null);
  assert.equal(adjacentNavigationIndex(3,1,5),null);
});
test('editor host recognizes only registered commands in its own workspace mode',()=>{
  assert.deepEqual(PHIPOSE_EDITOR_ACTIONS.write,
    ['phioffice.write.section.next','phioffice.write.section.previous']);
  assert.throws(()=>new PhiPoseEditorHost('shell'),TypeError);
  assert.equal(new PhiPoseEditorHost('grid').active,false);
  const host=open('write');
  const yes=host.accept(msg(packet(intent('phioffice.write.section.next'))),now,validCtx);
  assert.equal(yes.accepted,true);
  assert.equal(yes.direction,1);
  assert.equal(yes.execution_authority,false);
  assert.equal(Object.isFrozen(yes),true);
  assert.equal(open('write').accept(msg(packet(intent('phioffice.grid.cell.next'))),now,validCtx).reason,'invalid_intent');
  assert.equal(open('grid').accept(msg(packet(intent('phioffice.write.section.next'))),now,{...validCtx,mode:'grid'}).reason,'invalid_intent');
  assert.equal(open('write').accept(msg(packet(intent('phioffice.file.save'))),now,validCtx).reason,'invalid_intent');
  assert.equal(open('write').accept(msg(packet(intent('phioffice.page.next'))),now,validCtx).reason,'invalid_intent');
});
test('editor navigation is denied during dialogs, wrong scope and boundaries',()=>{
  const i=intent('phioffice.write.section.next');
  assert.equal(open().accept(msg(packet(i)),now,{...validCtx,blocked:true}).reason,'workspace_busy');
  assert.equal(open().accept(msg(packet(i)),now,{...validCtx,mode:'grid'}).reason,'workspace_mismatch');
  assert.equal(open().accept(msg(packet(i)),now,{...validCtx,hasNext:false}).reason,'end_of_navigation');
  assert.equal(open().accept(msg(packet(intent('phioffice.write.section.previous'))),now,
    {...validCtx,hasPrevious:false}).reason,'start_of_navigation');
  assert.equal(open('grid').accept(msg(packet(intent('phioffice.grid.cell.next'))),now,
    {...validCtx,mode:'grid',hasNext:true}).accepted,true);
});
test('host rejects sender spoofing, stale packets, replays and synthetic without consent',()=>{
  const p=packet(intent('phioffice.write.section.next'));
  assert.equal(open().accept({...msg(p),origin:'https://evil.test'},now,validCtx).reason,'untrusted_source');
  assert.equal(open().accept({...msg(p),source:{}},now,validCtx).reason,'untrusted_source');
  assert.equal(open().accept(msg({...p,extra:'delete'}),now,validCtx).reason,'invalid_envelope');
  assert.equal(open().accept(msg(packet(intent('phioffice.write.section.next',1,'synthetic'))),now,validCtx).reason,'invalid_intent');
  assert.equal(open('write',true).accept(msg(packet(intent('phioffice.write.section.next',1,'synthetic'))),now,validCtx).accepted,true);
  assert.equal(open().accept(msg(packet(intent('phioffice.write.section.next'),now-4000)),now,validCtx).reason,'invalid_envelope');
  const host=open();
  assert.equal(host.accept(msg(p),now,validCtx).accepted,true);
  assert.equal(host.accept(msg(p),now+1200,validCtx).reason,'replay');
  assert.equal(host.accept(msg(packet(intent('phioffice.write.section.next',2),now+200)),now+200,validCtx).reason,'cooldown');
  assert.equal(host.accept(msg(packet(intent('phioffice.write.section.next',2),now+1200)),now+1200,validCtx).accepted,true);
  assert.equal(host.accept(msg(p),now+60_001,validCtx).reason,'expired');
  assert.equal(host.active,false);
});
