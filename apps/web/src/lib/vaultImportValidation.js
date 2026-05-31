import { validateProjectManifest } from '@phioffice369/core/schemas';
import { isWorkspaceBackupPayload } from './emergencyBackups.js';

export const VAULT_IMPORT_VALIDATION_SCHEMA = 'phioffice369.vault_import_validation.v0.1';

export function createVaultImportValidationResult({ ok, kind, payload = null, errors = [], summary = '' }) {
  return {
    schema: VAULT_IMPORT_VALIDATION_SCHEMA,
    ok,
    kind,
    payload,
    errors,
    summary,
  };
}

export function validateWorkspaceBackupImport(payload) {
  if (!isWorkspaceBackupPayload(payload)) {
    return createVaultImportValidationResult({
      ok: false,
      kind: 'workspace_backup',
      errors: ['not a PhiOffice369 workspace backup'],
      summary: 'Imported JSON is not a workspace backup.',
    });
  }

  const manifestResult = payload.manifest ? validateProjectManifest(payload.manifest) : { ok: true, errors: [] };
  const snapshotErrors = payload.storageSnapshot.every((entry) => Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'string')
    ? []
    : ['storageSnapshot must contain [key, value] string pairs'];
  const errors = [...manifestResult.errors.map((error) => `manifest.${error}`), ...snapshotErrors];

  return createVaultImportValidationResult({
    ok: errors.length === 0,
    kind: 'workspace_backup',
    payload,
    errors,
    summary: errors.length === 0
      ? `Workspace backup valid: ${payload.storageSnapshot.length} local item${payload.storageSnapshot.length === 1 ? '' : 's'}.`
      : `Workspace backup validation failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}.`,
  });
}

export function validateProjectManifestImport(payload) {
  const result = validateProjectManifest(payload);

  return createVaultImportValidationResult({
    ok: result.ok,
    kind: 'project_manifest',
    payload: result.ok ? payload : null,
    errors: result.errors,
    summary: result.ok
      ? `Project manifest valid: ${payload.artifacts.length} artifact${payload.artifacts.length === 1 ? '' : 's'}.`
      : `Project manifest validation failed with ${result.errors.length} issue${result.errors.length === 1 ? '' : 's'}.`,
  });
}

export function validateVaultImportPayload(payload) {
  if (isWorkspaceBackupPayload(payload)) {
    return validateWorkspaceBackupImport(payload);
  }

  if (payload?.schema?.startsWith('phioffice369.project_manifest.')) {
    return validateProjectManifestImport(payload);
  }

  return createVaultImportValidationResult({
    ok: false,
    kind: 'unknown',
    payload: null,
    errors: ['Imported file is not a PhiOffice369 project manifest or workspace backup'],
    summary: 'Imported JSON does not match a supported PhiVault import type.',
  });
}
