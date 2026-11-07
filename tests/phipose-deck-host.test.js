import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PhiPoseDeckHost,PHIPOSE_DECK_PROTOCOL,phiPoseOpenerMatches
} from '../apps/web/src/lib/phiPoseDeckHost.js';

const now=1_000_000,source={};
const sessionId='c1e5e7fb-9af1-4b3b-9fe8-5cf76bd4999a';
const open=(synthetic=false)=>{
  const host=new PhiPoseDeckHost();
  host.enable({source,origin:'https://example.test',sessionId,
    expiresAt:now+60_000,allowSyntheticDemo:synthetic},now);
  return host;
};
const intent=(actionId='phioffice.page.next',sequence=1,sourceType='webxr')=>({
  schema:'overstrings.phipose.intent.v0.1',version:1,
  advisory:true,action_authority:false,execution_authority:false,
  action_id:actionId,source:sourceType,program:'L:point > R:swipe-right',
  sequence,timestamp_ms:100
});
const packet=(i=intent(),sentAt=now)=>({
  protocol:PHIPOSE_DECK_PROTOCOL,type:'command',session_id:sessionId,
  sent_at:sentAt,intent:i
});
const event=(data=packet(),sender=source,origin='https://example.test')=>({data,source:sender,origin});
const bounds={canPrevious:true,canNext:true,presenting:false};

test('deck host is disabled until explicit bounded approval',()=>{
  const h=new PhiPoseDeckHost();
  assert.equal(h.accept(event(),now,bounds).reason,'disabled');
  assert.throws(()=>h.enable({source,origin:'https://example.test',sessionId,
    expiresAt:now+900_000},now),/Invalid bounded/);
  assert.equal(h.active,false);
});

test('only an exact approved opener and origin are accepted',()=>{
  const h=open();
  assert.equal(h.accept(event(undefined,{},'https://example.test'),now,bounds).reason,'untrusted_source');
  assert.equal(h.accept(event(undefined,source,'https://other.test'),now,bounds).reason,'untrusted_source');
  assert.equal(h.accept(event(),now,bounds).accepted,true);
});

test('safe next/previous navigation returns a typed UI-only receipt',()=>{
  const h=open();
  const result=h.accept(event(),now,bounds);
  assert.equal(result.accepted,true);
  assert.equal(result.actionId,'phioffice.page.next');
  assert.equal(result.direction,1);
  assert.equal(result.execution_authority,false);
  const earlier=event(packet(intent('phioffice.page.previous',2),now+1200));
  const previous=h.accept(earlier,now+1200,bounds);
  assert.equal(previous.accepted,true);
  assert.equal(previous.direction,-1);
});

test('rejects unapproved app, edit/save/delete commands and unexpected packet fields',()=>{
  for(const actionId of ['phioffice.palette.open','phioffice.file.save','phioffice.file.delete',
    'phios.view.home','shell.exec','constructor']){
    assert.equal(open().accept(event(packet(intent(actionId))),now,bounds).reason,'invalid_intent');
  }
  assert.equal(open().accept(event({...packet(),extra:'file.write'}),now,bounds).reason,'invalid_envelope');
  assert.equal(open().accept(event(packet({...intent(),filename:'secret'})),now,bounds).reason,'invalid_intent');
  assert.equal(open().accept(event(packet({...intent(),execution_authority:true})),now,bounds).reason,'invalid_intent');
});

test('rejects synthetic source without separate local host opt-in',()=>{
  const e=event(packet(intent('phioffice.page.next',1,'synthetic')));
  assert.equal(open().accept(e,now,bounds).reason,'invalid_intent');
  assert.equal(open(true).accept(e,now,bounds).accepted,true);
});

test('never navigates beyond deck bounds or while presentation is active',()=>{
  assert.equal(open().accept(event(),now,{...bounds,canNext:false}).reason,'end_of_deck');
  assert.equal(open().accept(event(packet(intent('phioffice.page.previous'))),now,
    {...bounds,canPrevious:false}).reason,'start_of_deck');
  assert.equal(open().accept(event(),now,{...bounds,presenting:true}).reason,'presentation_active');
});

test('host rejects stale envelopes, revoked sessions, expiry, replays and rapid repeats',()=>{
  const h=open();
  assert.equal(h.accept(event(packet(intent(),now-4000)),now,bounds).reason,'invalid_envelope');
  assert.equal(h.accept(event(),now,bounds).accepted,true);
  assert.equal(h.accept(event(),now+1000,bounds).reason,'replay');
  assert.equal(h.accept(event(packet(intent('phioffice.page.next',2),now+300)),now+300,bounds).reason,'cooldown');
  assert.equal(h.accept(event(packet(intent('phioffice.page.next',2),now+1200)),now+1200,bounds).accepted,true);
  assert.equal(h.accept(event(),now+60_001,bounds).reason,'expired');
  assert.equal(h.active,false);
  h.revoke();
  assert.equal(h.accept(event(),now,bounds).reason,'disabled');
});

test('opener vetting requires explicit same-origin OverStrings page',()=>{
  const make=url=>({location:{href:url}});
  assert.equal(phiPoseOpenerMatches(make('https://example.test/OverStrings/'),'https://example.test'),true);
  assert.equal(phiPoseOpenerMatches(make('https://example.test/OverStrings/index.html'),'https://example.test'),true);
  assert.equal(phiPoseOpenerMatches(make('https://example.test/OtherApp/'),'https://example.test'),false);
  assert.equal(phiPoseOpenerMatches(make('https://evil.test/OverStrings/'),'https://example.test'),false);
  assert.equal(phiPoseOpenerMatches(null,'https://example.test'),false);
});
