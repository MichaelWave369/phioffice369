/**
 * PhiOffice Rung 9: standalone, zero-authority PhiDeck navigation receiver.
 * Only host-approved next/previous slide UI requests; no edits, persistence,
 * imports, uploads, app launches, files, shell or execution.
 *
 * Same-origin postMessage with opener+session checks is NOT authentication.
 */
export const PHIPOSE_DECK_PROTOCOL = 'phioffice.phipose-deck.v0.1';
const IDS = Object.freeze(['phioffice.page.next', 'phioffice.page.previous']);
const KEYS = ['protocol','type','session_id','sent_at','intent'];
const INTENT_KEYS = ['schema','version','advisory','action_authority','execution_authority',
  'action_id','source','program','sequence','timestamp_ms'];
const H = /(?:^|\/)OverStrings\//;
const SESSION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROGRAM = /^([LR]:(open|pinch|grab|point|swipe-left|swipe-right)(\+[LR]:(open|pinch|grab|point|swipe-left|swipe-right))?)( > ([LR]:(open|pinch|grab|point|swipe-left|swipe-right)(\+[LR]:(open|pinch|grab|point|swipe-left|swipe-right))?)){1,4}$/;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(o,keys)=>object(o)&&Object.keys(o).length===keys.length&&
  Object.keys(o).every(k=>keys.includes(k));
export function phiPoseOpenerMatches(opener, origin) {
  if(!opener||typeof origin!=='string')return false;
  try {
    const url=new URL(opener.location.href);
    return url.origin===origin && H.test(url.pathname);
  } catch {return false;}
}
export class PhiPoseDeckHost {
  constructor(){this.revoke();}
  get active(){return this.session!==null;}
  revoke(){this.session=null;this.lastSeq=0;this.lastAcceptedAt=-Infinity;}
  enable({source,origin,sessionId,expiresAt,allowSyntheticDemo=false},nowMs) {
    this.revoke();
    if(!source||typeof origin!=='string'||!origin.startsWith('https://')||
      new URL(origin).origin!==origin || !SESSION.test(sessionId) ||
      typeof allowSyntheticDemo!=='boolean'||!Number.isSafeInteger(nowMs)||
      !Number.isSafeInteger(expiresAt)||expiresAt-nowMs<30_000||
      expiresAt-nowMs>300_000)throw new TypeError('Invalid bounded deck companion session');
    this.session=Object.freeze({source,origin,sessionId,expiresAt,allowSyntheticDemo});
  }
  accept(event,nowMs,{canPrevious=false,canNext=false,presenting=false}={}) {
    const s=this.session;
    if(!s)return {accepted:false,reason:'disabled'};
    if(!Number.isSafeInteger(nowMs)||nowMs>s.expiresAt){
      this.revoke();return {accepted:false,reason:'expired'};
    }
    if(event?.source!==s.source||event?.origin!==s.origin)
      return {accepted:false,reason:'untrusted_source'};
    const packet=event?.data;
    if(!exact(packet,KEYS)||packet.protocol!==PHIPOSE_DECK_PROTOCOL||
      packet.type!=='command'||packet.session_id!==s.sessionId||
      !Number.isSafeInteger(packet.sent_at)||
      packet.sent_at<nowMs-2500||packet.sent_at>nowMs+250)
      return {accepted:false,reason:'invalid_envelope'};
    const i=packet.intent;
    if(!exact(i,INTENT_KEYS)||i.schema!=='overstrings.phipose.intent.v0.1'||
      i.version!==1||i.advisory!==true||i.action_authority!==false||
      i.execution_authority!==false||!IDS.includes(i.action_id)||
      !['webxr','synthetic'].includes(i.source)||
      (i.source==='synthetic'&&!s.allowSyntheticDemo)||
      typeof i.program!=='string'||i.program.length>140||!PROGRAM.test(i.program)||
      !Number.isSafeInteger(i.sequence)||i.sequence<1||
      !Number.isSafeInteger(i.timestamp_ms)||i.timestamp_ms<0)
      return {accepted:false,reason:'invalid_intent'};
    if(i.sequence<=this.lastSeq)return {accepted:false,reason:'replay'};
    if(nowMs-this.lastAcceptedAt<900)return {accepted:false,reason:'cooldown'};
    if(presenting)return {accepted:false,reason:'presentation_active'};
    if(i.action_id==='phioffice.page.next'&&!canNext)
      return {accepted:false,reason:'end_of_deck'};
    if(i.action_id==='phioffice.page.previous'&&!canPrevious)
      return {accepted:false,reason:'start_of_deck'};
    this.lastSeq=i.sequence;
    this.lastAcceptedAt=nowMs;
    return {accepted:true,reason:'accepted_for_ui_dispatch',
      actionId:i.action_id,direction:i.action_id.endsWith('next')?1:-1,
      sequence:i.sequence,execution_authority:false};
  }
}
