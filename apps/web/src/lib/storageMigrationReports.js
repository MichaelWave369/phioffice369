export const STORAGE_MIGRATION_REPORT_SCHEMA = 'phioffice369.storage_migration_report.v0.1';

export function valueLength(value) {
  return typeof value === 'string' ? value.length : 0;
}

export function redactMigrationEntry(entry) {
  return {
    key: entry.key,
    existsInTarget: entry.existsInTarget,
    conflict: entry.conflict,
    valueLength: valueLength(entry.value),
    targetValueLength: valueLength(entry.targetValue),
  };
}

export function redactMigrationResultEntry(entry) {
  return {
    key: entry.key,
    reason: entry.reason ?? null,
    existsInTarget: entry.existsInTarget,
    conflict: entry.conflict,
    valueLength: valueLength(entry.value),
    targetValueLength: valueLength(entry.targetValue),
  };
}

export function createStorageMigrationReport({ plan, result = null }) {
  return {
    schema: STORAGE_MIGRATION_REPORT_SCHEMA,
    createdAt: new Date().toISOString(),
    plan: plan ? {
      schema: plan.schema,
      createdAt: plan.createdAt,
      sourceAdapterId: plan.sourceAdapterId,
      targetAdapterId: plan.targetAdapterId,
      sourceCount: plan.sourceCount,
      missingInTargetCount: plan.missingInTargetCount,
      alreadySyncedCount: plan.alreadySyncedCount,
      conflictCount: plan.conflictCount,
      entries: plan.entries.map(redactMigrationEntry),
    } : null,
    result: result ? {
      schema: result.schema,
      createdAt: result.createdAt,
      dryRun: result.dryRun,
      overwrite: result.overwrite,
      appliedCount: result.appliedCount,
      skippedCount: result.skippedCount,
      conflictCount: result.conflictCount,
      applied: result.applied.map(redactMigrationEntry),
      skipped: result.skipped.map(redactMigrationResultEntry),
      conflicts: result.conflicts.map(redactMigrationEntry),
    } : null,
  };
}

export function getMigrationConflictKeys(planOrResult, limit = 5) {
  const entries = planOrResult?.entries ?? planOrResult?.conflicts ?? [];
  return entries
    .filter((entry) => entry.conflict)
    .slice(0, limit)
    .map((entry) => entry.key);
}
