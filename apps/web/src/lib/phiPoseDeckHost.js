/**
 * PhiOffice Rung 10: real PhiDeck UI selection through shared ΦPose SDK.
 * The shared core is a reviewed source snapshot of OverStrings
 * packages/phipose-host-sdk/index.mjs (Rung 10).
 * No dynamic remote code, network fetch, app authority or file effects.
 */
import {ScopedPhiPoseHost} from './phiPoseHostCore.js';

export const PHIPOSE_DECK_PROTOCOL = 'phioffice.phipose-deck.v0.1';
const PATH = /(?:^|\/)OverStrings\//;
const IDS=Object.freeze(['phioffice.page.next','phioffice.page.previous']);

/** Additional opener vetting is app-specific; SDK never trusts all same-origin pages. */
export function phiPoseOpenerMatches(opener,origin){
  if(!opener||typeof origin!=='string')return false;
  try{
    const url=new URL(opener.location.href);
    return url.origin===origin&&PATH.test(url.pathname);
  }catch{return false;}
}

/** Extension must only add context-aware denials, not remote execution. */
export class PhiPoseDeckHost extends ScopedPhiPoseHost {
  constructor(){
    super({
      appId:'phioffice',protocol:PHIPOSE_DECK_PROTOCOL,actionIds:IDS,
      guard(actionId,context={}){
        if(context.presenting)return 'presentation_active';
        if(actionId==='phioffice.page.next'&&!context.canNext)return 'end_of_deck';
        if(actionId==='phioffice.page.previous'&&!context.canPrevious)return 'start_of_deck';
        return null;
      }
    });
  }
  accept(event,nowMs,context){
    const receipt=super.accept(event,nowMs,context);
    if(!receipt.accepted)return receipt;
    return Object.freeze({
      ...receipt,
      direction:receipt.actionId==='phioffice.page.next'?1:-1
    });
  }
}
