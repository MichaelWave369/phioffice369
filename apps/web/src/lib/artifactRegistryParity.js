export const ARTIFACT_REGISTRY_PARITY_SCHEMA = 'phioffice369.artifact_registry_parity.v0.1';

export function uniqueSortedArtifactIds(artifacts = []) {
  return Array.from(new Set(
    artifacts
      .map((artifact) => artifact?.artifactId)
      .filter(Boolean),
  )).sort();
}

export function createArtifactRegistryParityReport({
  syncArtifacts = [],
  asyncArtifacts = [],
  syncRegistryId = 'sync-localStorage-registry',
  asyncRegistryId = 'async-preference-aware-registry',
  asyncAdapterId = 'unknown',
} = {}) {
  const syncIds = uniqueSortedArtifactIds(syncArtifacts);
  const asyncIds = uniqueSortedArtifactIds(asyncArtifacts);
  const asyncIdSet = new Set(asyncIds);
  const syncIdSet = new Set(syncIds);
  const missingInAsync = syncIds.filter((id) => !asyncIdSet.has(id));
  const extraInAsync = asyncIds.filter((id) => !syncIdSet.has(id));

  return {
    schema: ARTIFACT_REGISTRY_PARITY_SCHEMA,
    createdAt: new Date().toISOString(),
    syncRegistryId,
    asyncRegistryId,
    asyncAdapterId,
    syncCount: syncIds.length,
    asyncCount: asyncIds.length,
    missingInAsyncCount: missingInAsync.length,
    extraInAsyncCount: extraInAsync.length,
    parity: missingInAsync.length === 0 && extraInAsync.length === 0,
    missingInAsync,
    extraInAsync,
  };
}

export function summarizeArtifactRegistryParity(report) {
  return {
    syncCount: report?.syncCount ?? 0,
    asyncCount: report?.asyncCount ?? 0,
    missingInAsyncCount: report?.missingInAsyncCount ?? 0,
    extraInAsyncCount: report?.extraInAsyncCount ?? 0,
    parity: Boolean(report?.parity),
  };
}

export function getArtifactRegistryParityProblemIds(report, limit = 5) {
  return [
    ...(report?.missingInAsync ?? []),
    ...(report?.extraInAsync ?? []),
  ].slice(0, limit);
}
