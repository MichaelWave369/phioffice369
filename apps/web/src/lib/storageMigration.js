export const STORAGE_MIGRATION_SCHEMA = 'phioffice369.storage_migration.v0.1';

export function createMigrationEntry([key, value], targetValue = null) {
  return {
    key,
    value,
    existsInTarget: targetValue !== null && targetValue !== undefined,
    targetValue,
    conflict: targetValue !== null && targetValue !== undefined && targetValue !== value,
  };
}

export async function createStorageMigrationPlan({ sourceAdapter, targetAdapter }) {
  const sourceSnapshot = await sourceAdapter.workspaceSnapshot({ includeEmergencyBackups: false });
  const entries = [];

  for (const entry of sourceSnapshot) {
    const [key] = entry;
    const targetValue = await targetAdapter.getItem(key);
    entries.push(createMigrationEntry(entry, targetValue));
  }

  const conflicts = entries.filter((entry) => entry.conflict);
  const alreadySynced = entries.filter((entry) => entry.existsInTarget && !entry.conflict);
  const missingInTarget = entries.filter((entry) => !entry.existsInTarget);

  return {
    schema: STORAGE_MIGRATION_SCHEMA,
    createdAt: new Date().toISOString(),
    sourceAdapterId: sourceAdapter.id,
    targetAdapterId: targetAdapter.id,
    sourceCount: sourceSnapshot.length,
    missingInTargetCount: missingInTarget.length,
    alreadySyncedCount: alreadySynced.length,
    conflictCount: conflicts.length,
    entries,
  };
}

export function summarizeMigrationPlan(plan) {
  return {
    sourceCount: plan.sourceCount,
    missingInTargetCount: plan.missingInTargetCount,
    alreadySyncedCount: plan.alreadySyncedCount,
    conflictCount: plan.conflictCount,
    safeToCopyWithoutOverwrite: plan.conflictCount === 0,
  };
}

export async function migrateStoragePlan({ plan, targetAdapter, overwrite = false, dryRun = true }) {
  const applied = [];
  const skipped = [];
  const conflicts = [];

  for (const entry of plan.entries) {
    if (entry.conflict && !overwrite) {
      conflicts.push(entry);
      skipped.push({ ...entry, reason: 'conflict' });
      continue;
    }

    if (entry.existsInTarget && !entry.conflict) {
      skipped.push({ ...entry, reason: 'already_synced' });
      continue;
    }

    if (!dryRun) {
      await targetAdapter.setItem(entry.key, entry.value);
    }

    applied.push(entry);
  }

  return {
    schema: 'phioffice369.storage_migration_result.v0.1',
    createdAt: new Date().toISOString(),
    dryRun,
    overwrite,
    appliedCount: applied.length,
    skippedCount: skipped.length,
    conflictCount: conflicts.length,
    applied,
    skipped,
    conflicts,
  };
}

export async function migrateStorage({ sourceAdapter, targetAdapter, overwrite = false, dryRun = true }) {
  const plan = await createStorageMigrationPlan({ sourceAdapter, targetAdapter });
  const result = await migrateStoragePlan({ plan, targetAdapter, overwrite, dryRun });

  return { plan, result };
}
