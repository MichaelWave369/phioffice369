import { validateTransformPacket } from '@phioffice369/core/transform-packets';
import {
  canUseBrowserLocalStorage,
  scanStorageJsonEntries,
  writeStorageJson,
} from './workspaceStorageAccess.js';

export const TRANSFORM_LINEAGE_RECEIPT_SCHEMA = 'phioffice369.transform_lineage_receipt.v0.2';
export const TRANSFORM_LINEAGE_PREFIX = 'phioffice369:transform_lineage:';

export function sanitizeLineageKeyPart(value = 'item') {
  const safe = String(value ?? 'item')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96);
  return safe || 'item';
}

export function createTransformLineageKey({ transformId, sourceArtifactId, targetArtifactId, createdAt = new Date().toISOString() }) {
  return [
    TRANSFORM_LINEAGE_PREFIX.replace(/:$/, ''),
    sanitizeLineageKeyPart(transformId),
    sanitizeLineageKeyPart(sourceArtifactId),
    sanitizeLineageKeyPart(targetArtifactId),
    sanitizeLineageKeyPart(createdAt),
  ].join(':');
}

export function createTransformLineageReceipt({ packet, exportReceipt = null, status = 'exported' }) {
  const validation = validateTransformPacket(packet);
  if (!validation.ok) {
    throw new TypeError(`Invalid transform packet: ${validation.errors.join(', ')}`);
  }

  return {
    schema: TRANSFORM_LINEAGE_RECEIPT_SCHEMA,
    createdAt: new Date().toISOString(),
    status,
    transformId: packet.transformId,
    packetId: packet.packetId,
    source: {
      artifactId: packet.source.artifactId,
      title: packet.source.title,
      app: packet.source.app,
      kind: packet.source.kind,
      labels: packet.source.labels ?? [],
    },
    target: {
      artifactId: packet.target.artifactId,
      title: packet.target.title,
      app: packet.target.app,
      kind: packet.target.kind,
    },
    trustLabels: packet.trustLabels,
    warnings: packet.warnings,
    compatibilityNotes: packet.compatibilityNotes,
    trace: packet.trace,
    exportReceipt,
  };
}

export function saveTransformLineageReceipt({ packet, exportReceipt = null, status = 'exported', storage } = {}) {
  const receipt = createTransformLineageReceipt({ packet, exportReceipt, status });
  const key = createTransformLineageKey({
    transformId: receipt.transformId,
    sourceArtifactId: receipt.source.artifactId,
    targetArtifactId: receipt.target.artifactId,
    createdAt: receipt.createdAt,
  });

  if (storage || canUseBrowserLocalStorage()) {
    writeStorageJson(key, receipt, storage);
  }

  return { key, receipt };
}

export function scanTransformLineageReceipts({ storage } = {}) {
  if (!storage && !canUseBrowserLocalStorage()) return [];

  return scanStorageJsonEntries({ prefix: TRANSFORM_LINEAGE_PREFIX, storage })
    .filter(({ value }) => value?.schema === TRANSFORM_LINEAGE_RECEIPT_SCHEMA)
    .map(({ key, value }) => ({ key, receipt: value }))
    .sort((left, right) => new Date(right.receipt.createdAt).getTime() - new Date(left.receipt.createdAt).getTime());
}

export function filterLineageReceiptsForArtifact(lineageEntries, artifactId) {
  return lineageEntries.filter(({ receipt }) => (
    receipt.source?.artifactId === artifactId || receipt.target?.artifactId === artifactId
  ));
}

export function createTransformLineageSummary(entry) {
  const receipt = entry.receipt ?? entry;
  return {
    key: entry.key ?? null,
    transformId: receipt.transformId,
    packetId: receipt.packetId,
    sourceArtifactId: receipt.source?.artifactId ?? null,
    sourceTitle: receipt.source?.title ?? null,
    sourceApp: receipt.source?.app ?? null,
    targetArtifactId: receipt.target?.artifactId ?? null,
    targetTitle: receipt.target?.title ?? null,
    targetApp: receipt.target?.app ?? null,
    targetKind: receipt.target?.kind ?? null,
    status: receipt.status,
    warningCount: receipt.warnings?.length ?? 0,
    compatibilityNoteCount: receipt.compatibilityNotes?.length ?? 0,
    createdAt: receipt.createdAt,
    exportedAt: receipt.exportReceipt?.exportedAt ?? null,
  };
}

export function buildTransformLineageTimeline(lineageEntries = []) {
  return lineageEntries
    .map(createTransformLineageSummary)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}
