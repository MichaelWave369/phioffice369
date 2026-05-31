export const STORAGE_KEY_CATALOG_SCHEMA = 'phioffice369.storage_key_catalog.v0.1';

export const STORAGE_NAMESPACE_CATALOG = [
  {
    id: 'phiwrite_drafts',
    prefix: 'phioffice369:phiwrite:',
    app: 'PhiWrite',
    kind: 'document',
    purpose: 'Browser-local PhiWrite-lite draft autosave records.',
    currentBackend: 'localStorage-via-workspaceStorageAccess',
    migrationTarget: 'indexedDB',
    adapterStatus: 'routed-through-workspace-storage-access',
    sourceOfTruth: 'localStorage-until-pilot-flip',
  },
  {
    id: 'phigrid_tables',
    prefix: 'phioffice369:phigrid:',
    app: 'PhiGrid',
    kind: 'grid',
    purpose: 'Browser-local PhiGrid-lite table autosave records.',
    currentBackend: 'localStorage-via-workspaceStorageAccess',
    migrationTarget: 'indexedDB',
    adapterStatus: 'routed-through-workspace-storage-access',
    sourceOfTruth: 'localStorage-until-pilot-flip',
  },
  {
    id: 'phideck_decks',
    prefix: 'phioffice369:phideck:',
    app: 'PhiDeck',
    kind: 'deck',
    purpose: 'Browser-local PhiDeck-lite slide deck autosave records.',
    currentBackend: 'localStorage-via-workspaceStorageAccess',
    migrationTarget: 'indexedDB',
    adapterStatus: 'routed-through-workspace-storage-access',
    sourceOfTruth: 'localStorage-until-pilot-flip',
  },
  {
    id: 'export_receipts',
    prefix: 'phioffice369:export_receipt:',
    app: 'PhiVault',
    kind: 'export_receipt',
    purpose: 'Local export receipt records for exported documents, grids, and decks.',
    currentBackend: 'localStorage-via-workspaceStorageAccess',
    migrationTarget: 'indexedDB',
    adapterStatus: 'routed-through-workspace-storage-access',
    sourceOfTruth: 'localStorage-until-pilot-flip',
  },
  {
    id: 'artifact_metadata',
    prefix: 'phioffice369:artifact_metadata:',
    app: 'PhiVault',
    kind: 'metadata',
    purpose: 'Local tags and project folder assignments per artifact id.',
    currentBackend: 'localStorage-via-workspaceStorageAccess',
    migrationTarget: 'indexedDB',
    adapterStatus: 'routed-through-workspace-storage-access',
    sourceOfTruth: 'localStorage-until-pilot-flip',
  },
  {
    id: 'emergency_backups',
    prefix: 'phioffice369:emergency_backup:',
    app: 'PhiVault',
    kind: 'emergency_backup',
    purpose: 'Crash recovery snapshots created by the app error boundary.',
    currentBackend: 'localStorage',
    migrationTarget: 'manual-review-only',
    adapterStatus: 'intentionally-excluded-from-workspace-snapshots',
    sourceOfTruth: 'localStorage-recovery-only',
  },
  {
    id: 'storage_backend_preference',
    prefix: 'phioffice369:storage_backend_preference',
    app: 'PhiVault',
    kind: 'storage_preference',
    purpose: 'Local operator preference for storage backend pilot mode or fallback mode.',
    currentBackend: 'localStorage',
    migrationTarget: 'localStorage-control-key',
    adapterStatus: 'must-remain-readable-before-adapter-selection',
    sourceOfTruth: 'localStorage-control-plane',
  },
  {
    id: 'vault_scan_source_preference',
    prefix: 'phioffice369:vault_scan_source_preference',
    app: 'PhiVault',
    kind: 'scan_source_preference',
    purpose: 'Local operator preference for the visible PhiVault scan source.',
    currentBackend: 'localStorage-via-workspaceStorageAccess',
    migrationTarget: 'localStorage-control-key',
    adapterStatus: 'routed-through-workspace-storage-access',
    sourceOfTruth: 'localStorage-control-plane',
  },
];

export function getStorageKeyCatalog() {
  return {
    schema: STORAGE_KEY_CATALOG_SCHEMA,
    generatedAt: new Date().toISOString(),
    namespaces: STORAGE_NAMESPACE_CATALOG,
  };
}

export function normalizeStorageKey(value) {
  return String(value ?? '').trim();
}

export function findStorageNamespace(key) {
  const normalizedKey = normalizeStorageKey(key);
  return STORAGE_NAMESPACE_CATALOG.find((entry) => normalizedKey.startsWith(entry.prefix)) ?? null;
}

export function classifyStorageKey(key) {
  const normalizedKey = normalizeStorageKey(key);
  const namespace = findStorageNamespace(normalizedKey);

  if (namespace) {
    return {
      key: normalizedKey,
      known: true,
      namespaceId: namespace.id,
      app: namespace.app,
      kind: namespace.kind,
      currentBackend: namespace.currentBackend,
      migrationTarget: namespace.migrationTarget,
      adapterStatus: namespace.adapterStatus,
      sourceOfTruth: namespace.sourceOfTruth,
    };
  }

  return {
    key: normalizedKey,
    known: false,
    namespaceId: normalizedKey.startsWith('phioffice369:') ? 'unknown_phioffice_namespace' : 'external_namespace',
    app: 'Unknown',
    kind: 'unknown',
    currentBackend: 'unknown',
    migrationTarget: 'manual-review-required',
    adapterStatus: 'unknown',
    sourceOfTruth: 'unknown',
  };
}

export function summarizeStorageCatalog(namespaces = STORAGE_NAMESPACE_CATALOG) {
  return namespaces.reduce((summary, entry) => ({
    ...summary,
    totalNamespaces: summary.totalNamespaces + 1,
    byBackend: {
      ...summary.byBackend,
      [entry.currentBackend]: (summary.byBackend[entry.currentBackend] ?? 0) + 1,
    },
    routedThroughWorkspaceAccess: summary.routedThroughWorkspaceAccess + (entry.adapterStatus === 'routed-through-workspace-storage-access' ? 1 : 0),
    pendingAdapterRefactor: summary.pendingAdapterRefactor + (entry.adapterStatus === 'pending-adapter-refactor' ? 1 : 0),
  }), { totalNamespaces: 0, byBackend: {}, routedThroughWorkspaceAccess: 0, pendingAdapterRefactor: 0 });
}

export function getAdapterRefactorBacklog(namespaces = STORAGE_NAMESPACE_CATALOG) {
  return namespaces.filter((entry) => entry.adapterStatus === 'pending-adapter-refactor');
}

export function getWorkspaceAccessRoutedNamespaces(namespaces = STORAGE_NAMESPACE_CATALOG) {
  return namespaces.filter((entry) => entry.adapterStatus === 'routed-through-workspace-storage-access');
}
