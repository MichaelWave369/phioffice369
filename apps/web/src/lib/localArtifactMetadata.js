import { canUseBrowserLocalStorage } from './localReceipts.js';

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

export function parseTagInput(value) {
  return Array.from(new Set(
    String(value ?? '')
      .split(',')
      .map(normalizeTag)
      .filter(Boolean),
  ));
}

export function readArtifactMetadata(artifactId) {
  if (!canUseBrowserLocalStorage()) return { tags: [] };

  try {
    const raw = window.localStorage.getItem(createArtifactMetadataKey(artifactId));
    if (!raw) return { tags: [] };
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(normalizeTag).filter(Boolean) : [],
    };
  } catch {
    return { tags: [] };
  }
}

export function writeArtifactMetadata(artifactId, metadata) {
  const nextMetadata = {
    tags: Array.isArray(metadata?.tags) ? Array.from(new Set(metadata.tags.map(normalizeTag).filter(Boolean))) : [],
    updatedAt: new Date().toISOString(),
  };

  if (canUseBrowserLocalStorage()) {
    window.localStorage.setItem(createArtifactMetadataKey(artifactId), JSON.stringify(nextMetadata));
  }

  return nextMetadata;
}

export function mergeArtifactMetadata(artifact, metadata = { tags: [] }) {
  const tags = Array.isArray(metadata.tags) ? Array.from(new Set(metadata.tags.map(normalizeTag).filter(Boolean))) : [];

  return {
    ...artifact,
    tags,
    metadata: {
      ...(artifact.metadata ?? {}),
      tags,
      metadataUpdatedAt: metadata.updatedAt ?? null,
    },
  };
}

export function readAllArtifactMetadata(artifactIds = []) {
  return artifactIds.reduce((metadataById, artifactId) => ({
    ...metadataById,
    [artifactId]: readArtifactMetadata(artifactId),
  }), {});
}
