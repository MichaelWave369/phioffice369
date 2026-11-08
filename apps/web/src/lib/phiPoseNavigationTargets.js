/**
 * Rung 11: non-mutating navigation helpers for PhiWrite and PhiGrid.
 * Pure functions only. Never change document bodies, cells, save state or
 * local storage. Heading indices are real Markdown source offsets.
 */
export function markdownSectionAnchors(source) {
  if (typeof source !== 'string') return Object.freeze([]);
  const lines=source.split('\n');
  const anchors=[];
  let offset=0;
  let fenceChar=null,fenceSize=0;
  for(const line of lines){
    const candidate=line.replace(/\r$/,'');
    const fence=/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(candidate);
    if(fence){
      if(!fenceChar){
        fenceChar=fence[1][0];fenceSize=fence[1].length;
      }else if(fence[1][0]===fenceChar && fence[1].length>=fenceSize &&
        !fence[2].trim()){
        fenceChar=null;fenceSize=0;
      }
    }else if(!fenceChar){
      const match=/^ {0,3}(#{1,3})[ \t]+(.+?)\s*#*\s*$/.exec(candidate);
      if(match && match[2].trim()){
        anchors.push(Object.freeze({
          offset,depth:match[1].length,label:match[2].trim().slice(0,120)
        }));
      }
    }
    offset+=line.length+1;
  }
  return Object.freeze(anchors);
}
export function gridVisibleCellAddresses(visibleRowIndices,columns) {
  if(!Array.isArray(visibleRowIndices)||!Array.isArray(columns)||columns.length>100)
    return Object.freeze([]);
  const out=[];
  for(const row of visibleRowIndices){
    if(!Number.isSafeInteger(row)||row<0)continue;
    for(let c=0;c<columns.length;c++){
      if(typeof columns[c]!=='string')continue;
      let n=c+1,label='';
      while(n>0){n--;label=String.fromCharCode(65+n%26)+label;n=Math.floor(n/26);}
      out.push(Object.freeze({row,column:c,address:label+(row+1)}));
    }
  }
  return Object.freeze(out);
}
export function adjacentNavigationIndex(length,current,direction) {
  if(!Number.isSafeInteger(length)||length<=0||length>50000||
    !Number.isSafeInteger(current)||current< -1||current>=length||
    ![-1,1].includes(direction))return null;
  const next=current+direction;
  return next>=0&&next<length?next:null;
}
