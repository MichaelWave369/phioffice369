import { classifyStorageKey, getAdapterRefactorBacklog } from './storageKeyCatalog.js';

export const LOCAL_STORAGE_BOUNDARY_AUDIT_SCHEMA = 'phioffice369.local_storage_boundary_audit.v0.1';

export const LOCAL_STORAGE_BOUNDARY_FILES = [
  {
    path: 'apps/web/src/lib/workspaceStorageAccess.js',
    boundary: 'primary-sync-access-layer',
    migrationAction: 'keep-as-localStorage-compatibility-boundary-until-async-adapter-access-lands',
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
    path: 'apps/web/src/lib/localStorageBoundaryAudit.js',
    boundary: 'storage-boundary-audit-definition',
    migrationAction: 'keep-as-static-boundary-catalog-source-of-truth',
  },
  {
    path: 'apps/web/src/lib/storageDiagnostics.js',
    boundary: 'storage-status-diagnostics',
    migrationAction: 'keep-as-operator-visible-storage-status-layer',
  },
  {
    path: 'apps/web/src/lib/storageKeyCatalog.js',
    boundary: 'storage-key-namespace-catalog',
    migrationAction: 'keep-as-known-key-classification-source-of-truth',
  },
  {
    path: 'apps/web/src/lib/artifactRegistryParity.js',
    boundary: 'registry-parity-audit',
    migrationAction: 'keep-as-sync-async-comparison-layer',
  },
  {
    path: 'apps/web/src/lib/vaultScanSwitchGate.js',
    boundary: 'vault-scan-switch-policy-gate',
    migrationAction: 'keep-as-visible-scan-safety-gate',
  },
  {
    path: 'apps/web/src/lib/vaultVisibleScanPolicy.js',
    boundary: 'vault-visible-scan-policy',
    migrationAction: 'keep-as-visible-artifact-source-selector',
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
    path: 'apps/web/src/components/DataSovereigntyStatusBar.jsx',
    boundary: 'operator-visible-data-sovereignty-ui',
    migrationAction: 'replace-direct-window-localStorage-calls-after-status-bar-uses-adapter-backed-export',
  },
  {
    path: 'apps/web/src/components/OnboardingGate.jsx',
    boundary: 'first-run-onboarding-local-flag-ui',
    migrationAction: 'keep-local-onboarding-flag-small-and-isolated',
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
