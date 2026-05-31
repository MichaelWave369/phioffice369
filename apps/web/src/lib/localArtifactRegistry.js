import { createArtifactManifestEntry } from '@phioffice369/core';
import { mergeArtifactMetadata, readArtifactMetadata, ARTIFACT_METADATA_PREFIX } from './localArtifactMetadata.js';
import { canUseBrowserLocalStorage, scanLocalExportReceipts } from './localReceipts.js';

export function parseStoredJsonValue(key) {
  if (!canUseBrowserLocalStorage()) return null;

  try {
    return JSON.parse(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function getArtifactKindAndAppFromStorageKey(key) {
  if (key.includes(':phiwrite:')) return { kind: 'document', app: 'PhiWrite' };
  if (key.includes(':phigrid:')) return { kind: 'grid', app: 'PhiGrid' };
  if (key.includes(':phideck:')) return { kind: 'deck', app: 'PhiDeck' };
  if (key.includes(':export_receipt:')) return { kind: 'export_receipt', app: 'PhiVault' };
  return { kind: 'vault_item', app: 'PhiVault' };
}

export function getArtifactTitleFromStoredValue(key, value) {
  if (value?.title) return value.title;
  if (value?.filename) return value.filename;
  return key.split(':').at(-1) ?? 'Untitled artifact';
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

export function scanLocalDraftArtifacts() {
  if (!canUseBrowserLocalStorage()) return [];

  return Object.keys(window.localStorage)
    .filter((key) => key.startsWith('phioffice369:'))
    .filter((key) => !key.startsWith('phioffice369:export_receipt:'))
    .filter((key) => !key.startsWith(ARTIFACT_METADATA_PREFIX))
    .map((key) => {
      const storedValue = parseStoredJsonValue(key);
      const { kind, app } = getArtifactKindAndAppFromStorageKey(key);

      return attachLocalMetadata(createArtifactManifestEntry({
        artifactId: storageKeyToArtifactId(key),
        title: getArtifactTitleFromStoredValue(key, storedValue),
        kind,
        app,
        path: key,
        labels: storedValue?.activeLabelId ? [storedValue.activeLabelId] : [],
        sourceTemplateId: storedValue?.templateId ?? null,
        status: getArtifactStatusFromStorageKey(key),
      }));
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
    ...(artifact.labels ?? []),
    ...(artifact.tags ?? []),
    artifact.receipts?.[0]?.format,
    artifact.receipts?.[0]?.filename,
    artifact.receipts?.[0]?.compatibility,
  ].filter(Boolean).join(' ').toLowerCase();

  return haystack.includes(needle);
}

export function filterArtifacts(artifacts, query, appFilter, kindFilter) {
  return artifacts.filter((artifact) => {
    const appOk = appFilter === 'all' || artifact.app === appFilter;
    const kindOk = kindFilter === 'all' || artifact.kind === kindFilter;
    return appOk && kindOk && artifactMatchesSearch(artifact, query);
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
