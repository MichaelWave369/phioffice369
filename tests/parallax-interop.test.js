import test from 'node:test';
import assert from 'node:assert/strict';
import { toParallaxLineage, toParallaxTransformReceipt } from '../packages/core/src/parallaxInterop.js';

const packet = {
  schema: 'phioffice369.transform_packet.v0.2',
  packetId: 'packet-1',
  transformId: 'transform-1',
  createdAt: '2026-08-25T16:40:00Z',
  localOnly: true,
  source: { artifactId: 'doc-1', title: 'Demo', app: 'PhiWrite', kind: 'document', labels: ['human_written'] },
  target: { artifactId: 'deck-1', title: 'Demo', app: 'PhiDeck', kind: 'deck' },
  trustLabels: ['ai_assisted'],
  warnings: [],
  compatibilityNotes: ['native'],
  trace: {
    transformId: 'transform-1',
    sourceApp: 'PhiWrite',
    targetApp: 'PhiDeck',
    sourceArtifactId: 'doc-1',
    targetArtifactId: 'deck-1',
    tracedAt: '2026-08-25T16:40:01Z'
  },
  payload: { slides: [] }
};

test('PhiOffice transform packet projects without mutation', () => {
  const before = JSON.stringify(packet);
  const lineage = toParallaxLineage(packet);
  const receipt = toParallaxTransformReceipt(packet);
  assert.equal(lineage.schema, 'parallax.lineage.v1');
  assert.deepEqual(lineage.sourceRefs, ['doc-1']);
  assert.deepEqual(lineage.targetRefs, ['deck-1']);
  assert.equal(receipt.schema, 'parallax.receipt.v1');
  assert.equal(receipt.profile, 'transform');
  assert.equal(JSON.stringify(packet), before);
});
