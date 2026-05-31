import {
  canUseBrowserLocalStorage,
  readStorageJson,
  writeStorageJson,
} from './workspaceStorageAccess.js';

export const ARTIFACT_METADATA_PREFIX = 'phioffice369:artifact_metadata:';

export function createArtifactMetadataKey(artifactId) {
  return `${ARTIFACT_METADATA_PREFIX}${artifactId}`;
}

export function normalizeTag(value) {
  return String(value ?? '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase();
}

export function normalizeProjectFolder(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

export function parseTagInput(value) {
  return Array.from(new Set(
    String(value ?? '')
      .split(',')
      .map(normalizeTag)
      .filter(Boolean),
  ));
}

export function normalizeMetadata(metadata = {}) {
  return {
    tags: Array.isArray(metadata.tags) ? Array.from(new Set(metadata.tags.map(normalizeTag).filter(Boolean))) : [],
    projectFolder: normalizeProjectFolder(metadata.projectFolder),
    updatedAt: metadata.updatedAt ?? null,
  };
}

export function readArtifactMetadata(artifactId) {
  if (!canUseBrowserLocalStorage()) return normalizeMetadata();

  return normalizeMetadata(readStorageJson(createArtifactMetadataKey(artifactId)) ?? {});
}

export function writeArtifactMetadata(artifactId, metadata) {
  const existingMetadata = readArtifactMetadata(artifactId);
  const nextMetadata = normalizeMetadata({
    ...existingMetadata,
    ...metadata,
    tags: metadata?.tags ?? existingMetadata.tags,
    projectFolder: metadata?.projectFolder ?? existingMetadata.projectFolder,
    updatedAt: new Date().toISOString(),
  });

  if (canUseBrowserLocalStorage()) {
    writeStorageJson(createArtifactMetadataKey(artifactId), nextMetadata);
  }

  return nextMetadata;
}

export function mergeArtifactMetadata(artifact, metadata = {}) {
  const normalizedMetadata = normalizeMetadata(metadata);

  return {
    ...artifact,
    tags: normalizedMetadata.tags,
    projectFolder: normalizedMetadata.projectFolder,
    metadata: {
      ...(artifact.metadata ?? {}),
      tags: normalizedMetadata.tags,
      projectFolder: normalizedMetadata.projectFolder,
      metadataUpdatedAt: normalizedMetadata.updatedAt,
    },
  };
}

export function readAllArtifactMetadata(artifactIds = []) {
  return artifactIds.reduce((metadataById, artifactId) => ({
    ...metadataById,
    [artifactId]: readArtifactMetadata(artifactId),
  }), {});
}
