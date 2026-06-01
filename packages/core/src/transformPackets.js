import {
  assertKnownSuiteApp,
  assertKnownTrustLabels,
  assertNonEmptyString,
  assertStringArray,
  getTrustLabelById,
  suiteApps,
} from './index.js';

export const TRANSFORM_PACKET_SCHEMA = 'phioffice369.transform_packet.v0.2';

export const transformPacketKinds = [
  'deck',
  'document',
  'checklist',
  'readme',
  'report',
  'bundle',
  'notes',
];

export function assertKnownTransformPacketKind(kind) {
  assertNonEmptyString(kind, 'target.kind');
  if (!transformPacketKinds.includes(kind)) {
    throw new TypeError(`Invalid transform packet kind: ${kind}`);
  }
}

export function normalizeTransformWarnings(warnings = []) {
  assertStringArray(warnings, 'warnings');
  return Array.from(new Set(warnings.map((warning) => warning.trim()).filter(Boolean)));
}

export function normalizeCompatibilityNotes(notes = []) {
  assertStringArray(notes, 'compatibilityNotes');
  return Array.from(new Set(notes.map((note) => note.trim()).filter(Boolean)));
}

export function createTransformTrace({ transformId, sourceApp, targetApp, sourceArtifactId, targetArtifactId = null }) {
  assertNonEmptyString(transformId, 'transformId');
  assertKnownSuiteApp(sourceApp, 'sourceApp');
  assertKnownSuiteApp(targetApp, 'targetApp');
  assertNonEmptyString(sourceArtifactId, 'sourceArtifactId');
  if (targetArtifactId !== null && typeof targetArtifactId !== 'string') {
    throw new TypeError('targetArtifactId must be null or a string');
  }

  return {
    transformId,
    sourceApp,
    targetApp,
    sourceArtifactId,
    targetArtifactId,
    tracedAt: new Date().toISOString(),
  };
}

export function createTransformPacket({
  packetId,
  transformId,
  source,
  target,
  payload,
  trustLabels = ['ai_assisted'],
  warnings = [],
  compatibilityNotes = [],
  localOnly = true,
}) {
  assertNonEmptyString(packetId, 'packetId');
  assertNonEmptyString(transformId, 'transformId');
  if (!source || typeof source !== 'object') throw new TypeError('source must be an object');
  if (!target || typeof target !== 'object') throw new TypeError('target must be an object');
  if (payload === undefined || payload === null) throw new TypeError('payload is required');

  assertNonEmptyString(source.artifactId, 'source.artifactId');
  assertNonEmptyString(source.title, 'source.title');
  assertKnownSuiteApp(source.app, 'source.app');
  assertKnownSuiteApp(target.app, 'target.app');
  assertKnownTransformPacketKind(target.kind);
  assertKnownTrustLabels(trustLabels);

  const normalizedWarnings = normalizeTransformWarnings(warnings);
  const normalizedCompatibilityNotes = normalizeCompatibilityNotes(compatibilityNotes);
  const targetArtifactId = target.artifactId ?? `${source.artifactId}_${target.kind}`;
  assertNonEmptyString(targetArtifactId, 'target.artifactId');

  return {
    schema: TRANSFORM_PACKET_SCHEMA,
    packetId,
    transformId,
    createdAt: new Date().toISOString(),
    localOnly: Boolean(localOnly),
    source: {
      artifactId: source.artifactId,
      title: source.title,
      app: source.app,
      kind: source.kind ?? 'document',
      labels: Array.isArray(source.labels) ? source.labels : [],
    },
    target: {
      artifactId: targetArtifactId,
      title: target.title ?? source.title,
      app: target.app,
      kind: target.kind,
    },
    trustLabels,
    warnings: normalizedWarnings,
    compatibilityNotes: normalizedCompatibilityNotes,
    trace: createTransformTrace({
      transformId,
      sourceApp: source.app,
      targetApp: target.app,
      sourceArtifactId: source.artifactId,
      targetArtifactId,
    }),
    payload,
  };
}

export function validateTransformPacket(packet) {
  const errors = [];

  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    return { ok: false, errors: ['transform packet must be an object'] };
  }

  if (packet.schema !== TRANSFORM_PACKET_SCHEMA) errors.push(`Invalid schema: ${packet.schema}`);
  if (typeof packet.packetId !== 'string' || !packet.packetId.trim()) errors.push('packetId must be a non-empty string');
  if (typeof packet.transformId !== 'string' || !packet.transformId.trim()) errors.push('transformId must be a non-empty string');
  if (typeof packet.createdAt !== 'string' || !packet.createdAt.trim()) errors.push('createdAt must be a non-empty string');
  if (typeof packet.localOnly !== 'boolean') errors.push('localOnly must be a boolean');

  if (!packet.source || typeof packet.source !== 'object') {
    errors.push('source must be an object');
  } else {
    if (typeof packet.source.artifactId !== 'string' || !packet.source.artifactId.trim()) errors.push('source.artifactId must be a non-empty string');
    if (typeof packet.source.title !== 'string' || !packet.source.title.trim()) errors.push('source.title must be a non-empty string');
    if (!suiteApps.includes(packet.source.app)) errors.push(`Invalid source.app: ${packet.source.app}`);
  }

  if (!packet.target || typeof packet.target !== 'object') {
    errors.push('target must be an object');
  } else {
    if (typeof packet.target.artifactId !== 'string' || !packet.target.artifactId.trim()) errors.push('target.artifactId must be a non-empty string');
    if (!suiteApps.includes(packet.target.app)) errors.push(`Invalid target.app: ${packet.target.app}`);
    if (!transformPacketKinds.includes(packet.target.kind)) errors.push(`Invalid target.kind: ${packet.target.kind}`);
  }

  if (!Array.isArray(packet.trustLabels)) {
    errors.push('trustLabels must be an array');
  } else {
    const invalidLabels = packet.trustLabels.filter((label) => !getTrustLabelById(label));
    if (invalidLabels.length) errors.push(`Invalid trust labels: ${invalidLabels.join(', ')}`);
  }

  if (!Array.isArray(packet.warnings) || packet.warnings.some((warning) => typeof warning !== 'string')) errors.push('warnings must be an array of strings');
  if (!Array.isArray(packet.compatibilityNotes) || packet.compatibilityNotes.some((note) => typeof note !== 'string')) errors.push('compatibilityNotes must be an array of strings');
  if (!packet.trace || typeof packet.trace !== 'object') errors.push('trace must be an object');
  if (packet.payload === undefined || packet.payload === null) errors.push('payload is required');

  return { ok: errors.length === 0, errors };
}

export function summarizeTransformPacket(packet) {
  return {
    packetId: packet.packetId,
    transformId: packet.transformId,
    sourceArtifactId: packet.source?.artifactId ?? null,
    sourceApp: packet.source?.app ?? null,
    targetArtifactId: packet.target?.artifactId ?? null,
    targetApp: packet.target?.app ?? null,
    targetKind: packet.target?.kind ?? null,
    trustLabelCount: packet.trustLabels?.length ?? 0,
    warningCount: packet.warnings?.length ?? 0,
    compatibilityNoteCount: packet.compatibilityNotes?.length ?? 0,
    localOnly: packet.localOnly === true,
  };
}
