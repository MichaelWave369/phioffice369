export const STORAGE_MIGRATION_VERIFY_SCHEMA = 'phioffice369.storage_migration_verify.v0.1';

export function entriesToMap(entries = []) {
  return new Map(entries.map(([key, value]) => [key, value]));
}

export function compareStorageSnapshots({ sourceEntries = [], targetEntries = [] }) {
  const source = entriesToMap(sourceEntries);
  const target = entriesToMap(targetEntries);
  const missingInTarget = [];
  const mismatched = [];
  const extraInTarget = [];

  source.forEach((sourceValue, key) => {
    if (!target.has(key)) {
      missingInTarget.push({ key, sourceValueLength: sourceValue.length });
      return;
    }

    const targetValue = target.get(key);
    if (targetValue !== sourceValue) {
      mismatched.push({
        key,
        sourceValueLength: sourceValue.length,
        targetValueLength: targetValue.length,
      });
    }
  });

  target.forEach((targetValue, key) => {
    if (!source.has(key)) {
      extraInTarget.push({ key, targetValueLength: targetValue.length });
    }
  });

  return {
    sourceCount: source.size,
    targetCount: target.size,
    missingInTarget,
    mismatched,
    extraInTarget,
  };
}

export function createStorageVerificationReport({ sourceAdapterId, targetAdapterId, comparison }) {
  return {
    schema: STORAGE_MIGRATION_VERIFY_SCHEMA,
    createdAt: new Date().toISOString(),
    sourceAdapterId,
    targetAdapterId,
    sourceCount: comparison.sourceCount,
    targetCount: comparison.targetCount,
    missingInTargetCount: comparison.missingInTarget.length,
    mismatchedCount: comparison.mismatched.length,
    extraInTargetCount: comparison.extraInTarget.length,
    verified: comparison.missingInTarget.length === 0 && comparison.mismatched.length === 0,
    missingInTarget: comparison.missingInTarget,
    mismatched: comparison.mismatched,
    extraInTarget: comparison.extraInTarget,
  };
}

export async function verifyStorageMigration({ sourceAdapter, targetAdapter }) {
  const [sourceEntries, targetEntries] = await Promise.all([
    sourceAdapter.workspaceSnapshot({ includeEmergencyBackups: false }),
    targetAdapter.workspaceSnapshot({ includeEmergencyBackups: false }),
  ]);

  return createStorageVerificationReport({
    sourceAdapterId: sourceAdapter.id,
    targetAdapterId: targetAdapter.id,
    comparison: compareStorageSnapshots({ sourceEntries, targetEntries }),
  });
}

export function getVerificationProblemKeys(report, limit = 5) {
  return [
    ...(report?.missingInTarget ?? []),
    ...(report?.mismatched ?? []),
  ].slice(0, limit).map((entry) => entry.key);
}
