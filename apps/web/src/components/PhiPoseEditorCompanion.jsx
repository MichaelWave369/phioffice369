import {useEffect,useRef,useState} from 'react';
import {
  PhiPoseEditorHost,PHIPOSE_EDITOR_PROTOCOL,phiPoseOpenerMatches
} from '../lib/phiPoseEditorHost.js';

/**
 * Rung 11: common consent panel for real, non-destructive editor navigation.
 * App supplies the current index and a reviewed navigation callback.
 */
export default function PhiPoseEditorCompanion({
  mode,currentIndex,total,onNavigate,blocked=false,currentLabel=''
}){
  const ref=useRef(null);
  if(!ref.current)ref.current=new PhiPoseEditorHost(mode);
  const host=ref.current;
  const [enabled,setEnabled]=useState(false);
  const [synthetic,setSynthetic]=useState(false);
  const [status,setStatus]=useState('Disabled. No gesture navigation requests accepted.');
  const state=useRef(null);
  state.current={mode,blocked,hasPrevious:currentIndex>0,
    hasNext:currentIndex<total-1,total,currentIndex,onNavigate};

  useEffect(()=>{
    const onMessage=event=>{
      if(!host.active)return;
      const result=host.accept(event,Date.now(),state.current);
      if(result.reason==='untrusted_source')return;
      if(result.accepted){
        state.current.onNavigate(result.direction);
        setStatus('Accepted '+result.actionId+' for UI navigation only.');
      }else{
        setStatus('Denied: '+result.reason);
        if(result.reason==='expired')setEnabled(false);
      }
      if(event.source===globalThis.opener&&event.origin===globalThis.location.origin){
        try{
          globalThis.opener.postMessage({
            protocol:PHIPOSE_EDITOR_PROTOCOL,type:'receipt',
            accepted:result.accepted,
            status:result.accepted?'accepted_for_ui_dispatch':'denied',
            reason:result.reason,
            sequence:result.accepted?result.sequence:null,
            action_id:result.accepted?result.actionId:null
          },globalThis.location.origin);
        }catch{/* popup may close */}
      }
    };
    const onPageHide=()=>host.revoke();
    window.addEventListener('message',onMessage);
    window.addEventListener('pagehide',onPageHide);
    return ()=>{
      host.revoke();window.removeEventListener('message',onMessage);
      window.removeEventListener('pagehide',onPageHide);
    };
  },[host]);

  function disable(){
    host.revoke();setEnabled(false);
    setStatus('Gesture navigation disabled. Session revoked.');
  }
  function enable(){
    const opener=globalThis.opener;
    if(!phiPoseOpenerMatches(opener,globalThis.location.origin)){
      setStatus('Requires an explicitly opened, same-origin OverStrings companion.');
      return;
    }
    try{
      const now=Date.now(),sessionId=globalThis.crypto.randomUUID(),expiresAt=now+300_000;
      host.enable({source:opener,origin:globalThis.location.origin,
        sessionId,expiresAt,allowSyntheticDemo:synthetic},now);
      opener.postMessage({
        protocol:PHIPOSE_EDITOR_PROTOCOL,type:'ready',
        session_id:sessionId,expires_at:expiresAt
      },globalThis.location.origin);
      setEnabled(true);
      setStatus('Enabled for 5 minutes. Navigation only, no document or cell edits.');
    }catch{
      disable();setStatus('Could not approve the gesture companion.');
    }
  }
  return (
    <section className="panel phipose-editor-companion"
      aria-label={'ΦPose '+(mode==='write'?'PhiWrite section':'PhiGrid cell')+' navigation'}>
      <p className="eyebrow">RUNG 11 · ΦPOSE APP NAVIGATION</p>
      <h3>{mode==='write'?'Navigate document headings':'Navigate visible grid cells'} by gesture</h3>
      <p>{mode==='write'
        ? 'Moves the editor cursor to a Markdown heading without altering its text.'
        : 'Focuses existing visible cells in current filter/sort order without changing values.'}</p>
      <label><input type="checkbox" checked={synthetic} disabled={enabled}
        onChange={e=>setSynthetic(e.target.checked)}/>
        Allow synthetic practice input (off by default)
      </label>
      <div className="phipose-editor-actions">
        <button type="button" onClick={enabled?disable:enable}>
          {enabled?'Disable ΦPose':'Enable ΦPose '+(mode==='write'?'headings':'cells')}
        </button>
        <span aria-live="polite">{currentLabel || (total?('Item '+(currentIndex+1)+' of '+total):'No targets')}</span>
      </div>
      <p role="status">{status}</p>
      <small>Manual, five-minute, same-origin approval required. No autosave trigger,
        content changes, export, or application execution. Browser messages are not
        authentication. Quest multiwindow WebXR remains unverified.</small>
    </section>
  );
}
