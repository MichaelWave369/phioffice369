import { APPEARANCE_KEY } from './storageKeyCatalog.js';
import { createArtifactManifestEntry, trustLabels } from '@phioffice369/core';
import { mergeArtifactMetadata, readArtifactMetadata, ARTIFACT_METADATA_PREFIX } from './localArtifactMetadata.js';
import { canUseBrowserLocalStorage, scanLocalExportReceipts } from './localReceipts.js';
import {
  readStorageJson,
  scanStorageEntries,
} from './workspaceStorageAccess.js';

export const CONTROL_PLANE_STORAGE_KEYS = [
  'phioffice369:storage_backend_preference',
  'phioffice369:vault_scan_source_preference',
  'phioffice369:onboarding_seen',
  APPEARANCE_KEY,
];

export function isControlPlaneStorageKey(key) {
  return CONTROL_PLANE_STORAGE_KEYS.some((controlKey) => key.startsWith(controlKey));
}

export function parseStoredJsonValue(key) {
  if (!canUseBrowserLocalStorage()) return null;
  return readStorageJson(key);
}

export function getArtifactKindAndAppFromStorageKey(key) {
  if (key.includes(':phiwrite:')) return { kind: 'document', app: 'PhiWrite' };
  if (key.includes(':phigrid:')) return { kind: 'grid', app: 'PhiGrid' };
  if (key.includes(':phideck:')) return { kind: 'deck', app: 'PhiDeck' };
  if (key.includes(':export_receipt:')) return { kind: 'export_receipt', app: 'PhiVault' };
  return { kind: 'vault_item', app: 'PhiVault' };
}

export function getArtifactTitleFromStoredValue(key, value) {
  if (typeof value?.title === 'string' && value.title.trim()) return value.title;
  if (typeof value?.filename === 'string' && value.filename.trim()) return value.filename;
  return key.split(':').at(-1) ?? 'Untitled artifact';
}

export function getStoredTrustLabels(value) {
  return trustLabels.some((label) => label.id === value?.activeLabelId) ? [value.activeLabelId] : [];
}

export function getStoredSourceTemplateId(value) {
  const id = value?.sourceTemplateId ?? value?.templateId;
  return typeof id === 'string' ? id : null;
}

export function storageKeyToArtifactId(key) {
  return key.replaceAll(':', '_');
}

export function getArtifactStatusFromStorageKey(key) {
  if (key.includes(':export_receipt:')) return 'exported';
  if (key.includes(':phideck:')) return 'local-deck';
  if (key.includes(':phigrid:')) return 'local-grid';
  if (key.includes(':phiwrite:')) return 'local-draft';
  return 'local-item';
}

export function attachLocalMetadata(artifact) {
  return mergeArtifactMetadata(artifact, readArtifactMetadata(artifact.artifactId));
}

export function storedDraftToArtifact(key, record, revision) {
  const { kind, app } = getArtifactKindAndAppFromStorageKey(key);
  const artifact = attachLocalMetadata(createArtifactManifestEntry({
    artifactId: storageKeyToArtifactId(key),
    title: getArtifactTitleFromStoredValue(key, record),
    kind, app,
    path: key,
    labels: getStoredTrustLabels(record),
    sourceTemplateId: getStoredSourceTemplateId(record),
    status: revision === undefined ? getArtifactStatusFromStorageKey(key) : 'indexeddb-draft',
  }));
  return revision === undefined ? artifact : { ...artifact, revision };
}

export function scanLocalDraftArtifacts() {
  if (!canUseBrowserLocalStorage()) return [];

  return scanStorageEntries({ prefix: 'phioffice369:', includeValues: false })
    .map(([key]) => key)
    .filter((key) => !key.startsWith('phioffice369:export_receipt:'))
    .filter((key) => !key.startsWith(ARTIFACT_METADATA_PREFIX))
    .filter((key) => !key.startsWith('phioffice369:emergency_backup:'))
    .filter((key) => !isControlPlaneStorageKey(key))
    .flatMap((key) => {
      const storedValue = parseStoredJsonValue(key);
      if (storedValue?.trashedAt) return [];
      return storedDraftToArtifact(key, storedValue);
    });
}

export function exportReceiptToArtifact({ key, receipt }) {
  return attachLocalMetadata(createArtifactManifestEntry({
    artifactId: storageKeyToArtifactId(key),
    title: receipt.filename ?? `${receipt.sourceApp} ${receipt.format} export`,
    kind: 'export_receipt',
    app: receipt.sourceApp ?? 'PhiVault',
    path: key,
    labels: [],
    receipts: [receipt],
    sourceTemplateId: null,
    status: 'exported',
  }));
}

export function scanExportReceiptArtifacts() {
  return scanLocalExportReceipts().map(exportReceiptToArtifact);
}

export function scanContinuityArtifacts() {
  return [...scanLocalDraftArtifacts(), ...scanExportReceiptArtifacts()];
}

export function groupArtifactsByApp(artifacts) {
  return artifacts.reduce((groups, artifact) => {
    const key = artifact.app ?? 'Unknown';
    return { ...groups, [key]: [...(groups[key] ?? []), artifact] };
  }, {});
}

export function uniqueArtifactValues(artifacts, key) {
  return ['all', ...Array.from(new Set(artifacts.map((artifact) => artifact[key]).filter(Boolean))).sort()];
}

export function artifactMatchesSearch(artifact, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    artifact.title,
    artifact.app,
    artifact.kind,
    artifact.path,
    artifact.status,
    artifact.sourceTemplateId,
    artifact.projectFolder,
    ...(artifact.labels ?? []),
    ...(artifact.tags ?? []),
    artifact.receipts?.[0]?.format,
    artifact.receipts?.[0]?.filename,
    artifact.receipts?.[0]?.compatibility,
  ].filter(Boolean).join(' ').toLowerCase();

  return haystack.includes(needle);
}

export function filterArtifacts(artifacts, query, appFilter, kindFilter, projectFilter = 'all') {
  return artifacts.filter((artifact) => {
    const appOk = appFilter === 'all' || artifact.app === appFilter;
    const kindOk = kindFilter === 'all' || artifact.kind === kindFilter;
    const projectOk = projectFilter === 'all' || artifact.projectFolder === projectFilter;
    return appOk && kindOk && projectOk && artifactMatchesSearch(artifact, query);
  });
}

export function buildExportTimeline(artifacts) {
  return artifacts
    .filter((artifact) => artifact.kind === 'export_receipt' && artifact.receipts?.[0])
    .map((artifact) => ({ artifact, receipt: artifact.receipts[0] }))
    .sort((left, right) => new Date(right.receipt.exportedAt).getTime() - new Date(left.receipt.exportedAt).getTime());
}

export function formatExportTime(value) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
