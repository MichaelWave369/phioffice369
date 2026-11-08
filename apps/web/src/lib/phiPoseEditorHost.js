/**
 * ΦPose Rung 11: app-specific, zero-authority PhiWrite/PhiGrid UI navigation.
 * Reuses the reviewed shared SDK from Rung 10. No editor content changes.
 */
import {ScopedPhiPoseHost} from './phiPoseHostCore.js';
export {phiPoseOpenerMatches} from './phiPoseDeckHost.js';
export const PHIPOSE_EDITOR_PROTOCOL='phioffice.gesture-nav.v0.1';
export const PHIPOSE_EDITOR_ACTIONS=Object.freeze({
  write:Object.freeze(['phioffice.write.section.next','phioffice.write.section.previous']),
  grid:Object.freeze(['phioffice.grid.cell.next','phioffice.grid.cell.previous'])
});
export class PhiPoseEditorHost extends ScopedPhiPoseHost {
  constructor(mode){
    if(!Object.hasOwn(PHIPOSE_EDITOR_ACTIONS,mode))
      throw new TypeError('Unknown PhiOffice navigation mode');
    super({
      appId:'phioffice',protocol:PHIPOSE_EDITOR_PROTOCOL,
      actionIds:PHIPOSE_EDITOR_ACTIONS[mode],
      guard:(id,ctx)=>{
        if(!ctx||ctx.mode!==mode)return 'workspace_mismatch';
        if(ctx.blocked)return 'workspace_busy';
        if(id.endsWith('.previous')&&!ctx.hasPrevious)return 'start_of_navigation';
        if(id.endsWith('.next')&&!ctx.hasNext)return 'end_of_navigation';
        return null;
      }
    });
    this.mode=mode;
  }
  accept(event,nowMs,context){
    const result=super.accept(event,nowMs,context);
    if(!result.accepted)return result;
    return Object.freeze({
      ...result,
      direction:result.actionId.endsWith('.next')?1:-1
    });
  }
}
