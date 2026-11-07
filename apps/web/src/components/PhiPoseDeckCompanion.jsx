import {useEffect,useRef,useState} from 'react';
import {
  PHIPOSE_DECK_PROTOCOL,PhiPoseDeckHost,phiPoseOpenerMatches,
} from '../lib/phiPoseDeckHost.js';

/** User-visible Rung 9 opt-in host for the currently opened PhiDeck only. */
export default function PhiPoseDeckCompanion({slides,activeSlideId,onSelectSlide,presenting}) {
  const hostRef=useRef(null);
  if(!hostRef.current)hostRef.current=new PhiPoseDeckHost();
  const host=hostRef.current;
  const [active,setActive]=useState(false);
  const [sandbox,setSandbox]=useState(false);
  const [status,setStatus]=useState('Disabled. No gesture commands accepted.');
  const index=slides.findIndex(s=>s.id===activeSlideId);
  const current=index<0?0:index;
  const contextRef=useRef(null);
  contextRef.current={
    canPrevious:current>0,canNext:current<slides.length-1,presenting,
    slides,onSelectSlide,current
  };

  useEffect(()=>{
    const onMessage=event=>{
      if(!host.active)return;
      const now=Date.now();
      const c=contextRef.current;
      const result=host.accept(event,now,c);
      if(result.reason==='untrusted_source')return;
      if(result.accepted){
        const target=c.slides[c.current+result.direction];
        if(target){
          c.onSelectSlide(target.id); // selection only; no content mutation or saves
          setStatus('Accepted UI navigation: '+result.actionId+' (not a file edit).');
        } else {
          setStatus('Navigation target unavailable; no change.');
        }
      } else {
        setStatus('Gesture navigation denied: '+result.reason);
        if(result.reason==='expired')setActive(false);
      }
      if(event.source===globalThis.opener&&event.origin===globalThis.location.origin){
        try{
          globalThis.opener.postMessage({
            protocol:PHIPOSE_DECK_PROTOCOL,type:'receipt',
            accepted:result.accepted,
            status:result.accepted?'accepted_for_ui_dispatch':'denied',
            reason:result.reason,
            sequence:result.accepted?result.sequence:null,
            action_id:result.accepted?result.actionId:null
          },globalThis.location.origin);
        }catch{/* Ignore missing/closed opener. */}
      }
    };
    globalThis.addEventListener('message',onMessage);
    const onHide=()=>host.revoke();
    globalThis.addEventListener('pagehide',onHide);
    return ()=>{
      host.revoke();
      globalThis.removeEventListener('message',onMessage);
      globalThis.removeEventListener('pagehide',onHide);
    };
  },[host]);

  function disable(){
    host.revoke();
    setActive(false);
    setStatus('Gesture navigation disabled. Session revoked.');
  }
  function enable(){
    const opener=globalThis.opener;
    if(!phiPoseOpenerMatches(opener,globalThis.location.origin)){
      setStatus('Not opened from the reviewed same-origin OverStrings page.');
      return;
    }
    try{
      const now=Date.now();
      const sessionId=globalThis.crypto.randomUUID();
      const expiresAt=now+5*60_000;
      host.enable({source:opener,origin:globalThis.location.origin,
        sessionId,expiresAt,allowSyntheticDemo:sandbox},now);
      opener.postMessage({
        protocol:PHIPOSE_DECK_PROTOCOL,type:'ready',
        session_id:sessionId,expires_at:expiresAt
      },globalThis.location.origin);
      setActive(true);
      setStatus('Enabled for 5 minutes in this PhiDeck editor only. Navigation, no edits.');
    }catch{
      disable();
      setStatus('Could not establish an approved local PhiPose session.');
    }
  }

  return (
    <section className="panel phipose-deck-companion" aria-label="ΦPose gesture navigation for PhiDeck">
      <div>
        <p className="eyebrow">RUNG 9 · PHIPOSE APPLICATION HOST</p>
        <h3>Navigate slides by gesture</h3>
        <p>Use the OverStrings ΦPose vocabulary to select the next or previous slide.
          Nothing is saved, overwritten, exported or deleted by this bridge.</p>
      </div>
      <label>
        <input type="checkbox" checked={sandbox} disabled={active}
          onChange={event=>setSandbox(event.target.checked)}/>
        Allow synthetic practice gestures (off by default)
      </label>
      <div className="phipose-deck-actions">
        <button type="button" onClick={active?disable:enable}>
          {active?'Disable ΦPose':'Enable ΦPose deck navigation'}
        </button>
        <strong aria-live="polite">Slide {current+1} of {slides.length}</strong>
      </div>
      <p role="status">{status}</p>
      <small>Separate approval required here and in OverStrings. Only page.next/page.previous
        accepted. Session expires after five minutes and is revoked on editor exit.
        Browser source checks are not authentication. Quest 3 multiwindow behavior remains unverified.</small>
    </section>
  );
}
