import { classifyStorageKey, getAdapterRefactorBacklog } from './storageKeyCatalog.js';

export const LOCAL_STORAGE_BOUNDARY_AUDIT_SCHEMA = 'phioffice369.local_storage_boundary_audit.v0.1';

export const LOCAL_STORAGE_BOUNDARY_FILES = [
  {
    path: 'apps/web/src/lib/workspaceStorageAccess.js',
    boundary: 'primary-sync-access-layer',
    migrationAction: 'keep-as-localStorage-compatibility-boundary',
  },
  {
    path: 'apps/web/src/lib/storageAdapters.js',
    boundary: 'adapter-factory',
    migrationAction: 'keep-until-preference-selection-is-fully-abstracted',
  },
  {
    path: 'apps/web/src/lib/storageReadinessGate.js',
    boundary: 'storage-control-plane',
    migrationAction: 'keep-localStorage-control-key-readable-before-adapter-selection',
  },
  {
    path: 'apps/web/src/lib/emergencyBackups.js',
    boundary: 'recovery-boundary',
    migrationAction: 'keep-crash-recovery-compatible-then-add-adapter-path',
  },
  {
    path: 'apps/web/src/components/PhiVaultLite.jsx',
    boundary: 'operator-storage-ui',
    migrationAction: 'replace-direct-window-localStorage-calls-after-adapter-backed-ui-state-lands',
  },
  {
    path: 'apps/web/src/components/AppErrorBoundary.jsx',
    boundary: 'crash-recovery-ui',
    migrationAction: 'keep-until-emergency-backup-writer-is-fully-adapter-aware',
  },
  {
    path: 'apps/web/src/components/PhiWriteLite.jsx',
    boundary: 'app-data-module',
    migrationAction: 'migrate-phiwrite-drafts-to-workspace-storage-access-next',
  },
  {
    path: 'apps/web/src/components/PhiGridLite.jsx',
    boundary: 'app-data-module',
    migrationAction: 'migrate-phigrid-tables-after-phiwrite',
  },
  {
    path: 'apps/web/src/components/PhiDeckLite.jsx',
    boundary: 'app-data-module',
    migrationAction: 'migrate-phideck-decks-after-phigrid',
  },
];

export function getLocalStorageBoundaryFiles() {
  return LOCAL_STORAGE_BOUNDARY_FILES;
}

export function findLocalStorageBoundaryFile(path) {
  return LOCAL_STORAGE_BOUNDARY_FILES.find((entry) => entry.path === path) ?? null;
}

export function createLocalStorageBoundaryAudit({ observedFiles = [], observedKeys = [] } = {}) {
  const observedSet = new Set(observedFiles);
  const expectedSet = new Set(LOCAL_STORAGE_BOUNDARY_FILES.map((entry) => entry.path));
  const unexpectedFiles = observedFiles.filter((path) => !expectedSet.has(path));
  const missingExpectedFiles = LOCAL_STORAGE_BOUNDARY_FILES
    .map((entry) => entry.path)
    .filter((path) => !observedSet.has(path));
  const classifiedKeys = observedKeys.map(classifyStorageKey);

  return {
    schema: LOCAL_STORAGE_BOUNDARY_AUDIT_SCHEMA,
    createdAt: new Date().toISOString(),
    expectedBoundaryFileCount: LOCAL_STORAGE_BOUNDARY_FILES.length,
    observedFileCount: observedFiles.length,
    unexpectedFiles,
    missingExpectedFiles,
    classifiedKeys,
    unknownPhiOfficeKeys: classifiedKeys
      .filter((entry) => entry.namespaceId === 'unknown_phioffice_namespace')
      .map((entry) => entry.key),
    adapterRefactorBacklog: getAdapterRefactorBacklog().map((entry) => ({
      id: entry.id,
      prefix: entry.prefix,
      app: entry.app,
      migrationTarget: entry.migrationTarget,
      adapterStatus: entry.adapterStatus,
    })),
  };
}

export function summarizeLocalStorageBoundaryAudit(audit) {
  return {
    expectedBoundaryFileCount: audit.expectedBoundaryFileCount,
    observedFileCount: audit.observedFileCount,
    unexpectedFileCount: audit.unexpectedFiles.length,
    missingExpectedFileCount: audit.missingExpectedFiles.length,
    unknownPhiOfficeKeyCount: audit.unknownPhiOfficeKeys.length,
    adapterBacklogCount: audit.adapterRefactorBacklog.length,
    cleanBoundary: audit.unexpectedFiles.length === 0 && audit.unknownPhiOfficeKeys.length === 0,
  };
}
