import { createArtifactManifestEntry } from '@phioffice369/core';
import { ARTIFACT_METADATA_PREFIX, normalizeMetadata } from './localArtifactMetadata.js';
import { scanWorkspaceJsonEntries } from './workspaceStorageAsync.js';
import {
  getArtifactKindAndAppFromStorageKey,
  getArtifactStatusFromStorageKey,
  getArtifactTitleFromStoredValue,
  isControlPlaneStorageKey,
  storageKeyToArtifactId,
} from './localArtifactRegistry.js';

export const ASYNC_ARTIFACT_REGISTRY_SCHEMA = 'phioffice369.async_artifact_registry.v0.1';

export function createMetadataLookup(metadataEntries = []) {
  return metadataEntries.reduce((lookup, entry) => {
    const artifactId = entry.key.replace(ARTIFACT_METADATA_PREFIX, '');
    return {
      ...lookup,
      [artifactId]: normalizeMetadata(entry.value),
    };
  }, {});
}

export function mergeAsyncArtifactMetadata(artifact, metadataLookup = {}) {
  const metadata = metadataLookup[artifact.artifactId] ?? normalizeMetadata();

  return {
    ...artifact,
    tags: metadata.tags,
    projectFolder: metadata.projectFolder,
    metadata: {
      ...(artifact.metadata ?? {}),
      tags: metadata.tags,
      projectFolder: metadata.projectFolder,
      metadataUpdatedAt: metadata.updatedAt,
    },
  };
}

export function asyncStorageEntryToArtifact({ key, value }, metadataLookup = {}) {
  const { kind, app } = getArtifactKindAndAppFromStorageKey(key);
  const isReceipt = key.startsWith('phioffice369:export_receipt:');
  const receipt = isReceipt ? value : null;

  return mergeAsyncArtifactMetadata(createArtifactManifestEntry({
    artifactId: storageKeyToArtifactId(key),
    title: isReceipt ? receipt.filename ?? `${receipt.sourceApp} ${receipt.format} export` : getArtifactTitleFromStoredValue(key, value),
    kind,
    app: isReceipt ? receipt.sourceApp ?? app : app,
    path: key,
    labels: value?.activeLabelId ? [value.activeLabelId] : [],
    receipts: receipt ? [receipt] : [],
    sourceTemplateId: value?.templateId ?? null,
    status: isReceipt ? 'exported' : getArtifactStatusFromStorageKey(key),
  }), metadataLookup);
}

export function shouldIncludeAsyncArtifactEntry({ key }) {
  if (!key.startsWith('phioffice369:')) return false;
  if (key.startsWith(ARTIFACT_METADATA_PREFIX)) return false;
  if (key.startsWith('phioffice369:emergency_backup:')) return false;
  if (isControlPlaneStorageKey(key)) return false;
  return true;
}

export async function scanContinuityArtifactsAsync({ adapter = null, environment = globalThis, options = {} } = {}) {
  const [entries, metadataEntries] = await Promise.all([
    scanWorkspaceJsonEntries({ prefix: 'phioffice369:', adapter, environment, options, includeEmergencyBackups: false }),
    scanWorkspaceJsonEntries({ prefix: ARTIFACT_METADATA_PREFIX, adapter, environment, options, includeEmergencyBackups: false }),
  ]);
  const metadataLookup = createMetadataLookup(metadataEntries);

  return entries
    .filter(shouldIncludeAsyncArtifactEntry)
    .map((entry) => asyncStorageEntryToArtifact(entry, metadataLookup));
}

export async function createAsyncArtifactRegistryStatus({ adapter = null, environment = globalThis, options = {} } = {}) {
  const artifacts = await scanContinuityArtifactsAsync({ adapter, environment, options });

  return {
    schema: ASYNC_ARTIFACT_REGISTRY_SCHEMA,
    createdAt: new Date().toISOString(),
    artifactCount: artifacts.length,
    apps: Array.from(new Set(artifacts.map((artifact) => artifact.app))).sort(),
    kinds: Array.from(new Set(artifacts.map((artifact) => artifact.kind))).sort(),
  };
}
