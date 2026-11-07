import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
  ScopedPhiPoseHost, PHIPOSE_HOST_SDK_VERSION,validatePhiPoseSentence
} from '../apps/web/src/lib/phiPoseHostCore.js';
import {PhiPoseDeckHost,PHIPOSE_DECK_PROTOCOL} from '../apps/web/src/lib/phiPoseDeckHost.js';

/**
 * Offline code-provenance check. The SDK snapshot is vendored, not loaded from
 * the network. This pin must change only after review of upstream source.
 */
test('vendor SDK matches reviewed OverStrings Git blob snapshot byte-for-byte',()=>{
  const bytes=readFileSync(new URL('../apps/web/src/lib/phiPoseHostCore.js',import.meta.url));
  const gitObject=Buffer.concat([
    Buffer.from('blob '+bytes.length+'\0','utf8'),bytes
  ]);
  const blobSha=createHash('sha1').update(gitObject).digest('hex');
  assert.equal(blobSha,'46d852582327d38966fdb01aace666bd3f9cd9cd');
  assert.equal(PHIPOSE_HOST_SDK_VERSION,'phipose.host-sdk.v0.1');
});

test('PhiDeck receiver is built on shared, zero-authority SDK',()=>{
  const deck=new PhiPoseDeckHost();
  assert.equal(deck instanceof ScopedPhiPoseHost,true);
  assert.equal(deck.active,false);
  assert.deepEqual(deck.allowed,['phioffice.page.next','phioffice.page.previous']);
  assert.equal(deck.protocol,PHIPOSE_DECK_PROTOCOL);
});

test('SDK has a strict typed scope, not an arbitrary command executor',()=>{
  assert.throws(()=>new ScopedPhiPoseHost({
    appId:'phioffice',protocol:PHIPOSE_DECK_PROTOCOL,
    actionIds:['phios.system.command']
  }),/Invalid scoped/);
  assert.equal(validatePhiPoseSentence('L:point > R:swipe-right'),true);
  assert.equal(validatePhiPoseSentence('L:open > shell.execute'),false);
});
