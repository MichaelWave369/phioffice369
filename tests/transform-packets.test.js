import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTransformPacket,
  createTransformTrace,
  normalizeCompatibilityNotes,
  normalizeTransformWarnings,
  summarizeTransformPacket,
  TRANSFORM_PACKET_SCHEMA,
  transformPacketKinds,
  validateTransformPacket,
} from '../packages/core/src/transformPackets.js';

test('transform packet kind catalog includes v0.2 target kinds', () => {
  assert.ok(transformPacketKinds.includes('deck'));
  assert.ok(transformPacketKinds.includes('readme'));
  assert.ok(transformPacketKinds.includes('checklist'));
  assert.ok(transformPacketKinds.includes('bundle'));
});

test('warning and compatibility note normalizers trim dedupe and remove blanks', () => {
  assert.deepEqual(normalizeTransformWarnings([' keep ', '', 'keep', 'review']), ['keep', 'review']);
  assert.deepEqual(normalizeCompatibilityNotes([' layout ', 'layout', '']), ['layout']);
});

test('createTransformTrace creates a versioned trace record', () => {
  const trace = createTransformTrace({
    transformId: 'phiwrite_to_phideck',
    sourceApp: 'PhiWrite',
    targetApp: 'PhiDeck',
    sourceArtifactId: 'artifact_001',
    targetArtifactId: 'deck_001',
  });

  assert.equal(trace.transformId, 'phiwrite_to_phideck');
  assert.equal(trace.sourceApp, 'PhiWrite');
  assert.equal(trace.targetApp, 'PhiDeck');
  assert.equal(trace.sourceArtifactId, 'artifact_001');
  assert.equal(trace.targetArtifactId, 'deck_001');
  assert.match(trace.tracedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('createTransformPacket creates a local-first transform envelope', () => {
  const packet = createTransformPacket({
    packetId: 'packet_001',
    transformId: 'phiwrite_to_phideck',
    source: {
      artifactId: 'draft_001',
      title: 'Launch Spec',
      app: 'PhiWrite',
      kind: 'document',
      labels: ['human_written'],
    },
    target: {
      artifactId: 'deck_001',
      title: 'Launch Deck',
      app: 'PhiDeck',
      kind: 'deck',
    },
    payload: { slides: [{ title: 'Opening', bullets: ['Start here'] }] },
    trustLabels: ['ai_assisted', 'needs_citation'],
    warnings: [' Review factual claims ', 'Review factual claims'],
    compatibilityNotes: ['Markdown headings became slide titles.'],
  });

  assert.equal(packet.schema, TRANSFORM_PACKET_SCHEMA);
  assert.equal(packet.localOnly, true);
  assert.equal(packet.source.artifactId, 'draft_001');
  assert.equal(packet.target.artifactId, 'deck_001');
  assert.deepEqual(packet.warnings, ['Review factual claims']);
  assert.equal(validateTransformPacket(packet).ok, true);
});

test('createTransformPacket defaults target artifact id from source and kind', () => {
  const packet = createTransformPacket({
    packetId: 'packet_002',
    transformId: 'phiwrite_to_readme',
    source: {
      artifactId: 'draft_002',
      title: 'Project Spec',
      app: 'PhiWrite',
    },
    target: {
      app: 'PhiWrite',
      kind: 'readme',
    },
    payload: '# README',
  });

  assert.equal(packet.target.artifactId, 'draft_002_readme');
  assert.equal(packet.target.title, 'Project Spec');
  assert.deepEqual(packet.trustLabels, ['ai_assisted']);
});

test('createTransformPacket rejects invalid apps labels target kinds and payloads', () => {
  assert.throws(() => createTransformPacket({
    packetId: 'packet_bad',
    transformId: 'bad',
    source: { artifactId: 'draft', title: 'Draft', app: 'BadApp' },
    target: { app: 'PhiDeck', kind: 'deck' },
    payload: {},
  }), /Invalid source.app/);

  assert.throws(() => createTransformPacket({
    packetId: 'packet_bad',
    transformId: 'bad',
    source: { artifactId: 'draft', title: 'Draft', app: 'PhiWrite' },
    target: { app: 'PhiDeck', kind: 'bad_kind' },
    payload: {},
  }), /Invalid transform packet kind/);

  assert.throws(() => createTransformPacket({
    packetId: 'packet_bad',
    transformId: 'bad',
    source: { artifactId: 'draft', title: 'Draft', app: 'PhiWrite' },
    target: { app: 'PhiDeck', kind: 'deck' },
    trustLabels: ['bad_label'],
    payload: {},
  }), /Invalid trust labels/);

  assert.throws(() => createTransformPacket({
    packetId: 'packet_bad',
    transformId: 'bad',
    source: { artifactId: 'draft', title: 'Draft', app: 'PhiWrite' },
    target: { app: 'PhiDeck', kind: 'deck' },
  }), /payload is required/);
});

test('validateTransformPacket reports malformed packet errors', () => {
  const result = validateTransformPacket({
    schema: 'wrong',
    packetId: '',
    transformId: '',
    createdAt: '',
    localOnly: 'yes',
    source: { artifactId: '', title: '', app: 'BadApp' },
    target: { artifactId: '', app: 'BadApp', kind: 'bad_kind' },
    trustLabels: ['bad_label'],
    warnings: [123],
    compatibilityNotes: [123],
    payload: null,
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('Invalid schema')));
  assert.ok(result.errors.some((error) => error.includes('Invalid source.app')));
  assert.ok(result.errors.some((error) => error.includes('Invalid target.kind')));
  assert.ok(result.errors.some((error) => error.includes('Invalid trust labels')));
});

test('summarizeTransformPacket returns compact lineage fields', () => {
  const packet = createTransformPacket({
    packetId: 'packet_003',
    transformId: 'phiwrite_to_checklist',
    source: { artifactId: 'draft_003', title: 'Spec', app: 'PhiWrite' },
    target: { app: 'PhiWrite', kind: 'checklist' },
    payload: ['Item 1'],
    warnings: ['review'],
    compatibilityNotes: ['converted headings'],
  });
  const summary = summarizeTransformPacket(packet);

  assert.equal(summary.packetId, 'packet_003');
  assert.equal(summary.sourceApp, 'PhiWrite');
  assert.equal(summary.targetKind, 'checklist');
  assert.equal(summary.warningCount, 1);
  assert.equal(summary.compatibilityNoteCount, 1);
  assert.equal(summary.localOnly, true);
});
