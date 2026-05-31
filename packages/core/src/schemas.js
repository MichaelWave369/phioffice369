import {
  artifactKinds,
  getTrustLabelById,
  suiteApps,
} from './index.js';

export const ARTIFACT_RECEIPT_SCHEMA = {
  $id: 'phioffice369.artifact_receipt.v0.1',
  type: 'object',
  required: ['schema', 'artifactId', 'title', 'app', 'labels', 'transformations', 'createdAt'],
  properties: {
    schema: { const: 'phioffice369.artifact_receipt.v0.1' },
    artifactId: { type: 'string', minLength: 1 },
    title: { type: 'string', minLength: 1 },
    app: { enum: suiteApps },
    labels: { type: 'array', items: { enum: ['human_written', 'ai_assisted', 'sourced', 'needs_citation', 'hypothesis', 'symbolic', 'private', 'verified'] } },
    transformations: { type: 'array', items: { type: 'string' } },
    createdAt: { type: 'string', minLength: 1 },
  },
};

export const ARTIFACT_MANIFEST_ENTRY_SCHEMA = {
  $id: 'phioffice369.artifact_manifest_entry.v0.1',
  type: 'object',
  required: ['artifactId', 'title', 'kind', 'app', 'path', 'labels', 'receipts', 'sourceTemplateId', 'status', 'createdAt', 'updatedAt'],
  properties: {
    artifactId: { type: 'string', minLength: 1 },
    title: { type: 'string', minLength: 1 },
    kind: { enum: artifactKinds },
    app: { enum: suiteApps },
    path: { type: 'string' },
    labels: { type: 'array' },
    receipts: { type: 'array' },
    sourceTemplateId: { anyOf: [{ type: 'string' }, { const: null }] },
    status: { type: 'string', minLength: 1 },
    createdAt: { type: 'string', minLength: 1 },
    updatedAt: { type: 'string', minLength: 1 },
  },
};

export const PROJECT_MANIFEST_SCHEMA = {
  $id: 'phioffice369.project_manifest.v0.1',
  type: 'object',
  required: ['schema', 'projectId', 'title', 'description', 'owner', 'tags', 'artifacts', 'createdAt', 'updatedAt'],
  properties: {
    schema: { const: 'phioffice369.project_manifest.v0.1' },
    projectId: { type: 'string', minLength: 1 },
    title: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    owner: { type: 'string', minLength: 1 },
    tags: { type: 'array', items: { type: 'string' } },
    artifacts: { type: 'array' },
    createdAt: { type: 'string', minLength: 1 },
    updatedAt: { type: 'string', minLength: 1 },
  },
};

export const EXPORT_RECEIPT_SCHEMA = {
  $id: 'phioffice369.export_receipt.v0.1',
  type: 'object',
  required: ['schema', 'artifactId', 'format', 'filename', 'sourceApp', 'warnings', 'compatibility', 'exportedAt'],
  properties: {
    schema: { const: 'phioffice369.export_receipt.v0.1' },
    artifactId: { type: 'string', minLength: 1 },
    format: { type: 'string', minLength: 1 },
    filename: { type: 'string', minLength: 1 },
    sourceApp: { enum: suiteApps },
    warnings: { type: 'array', items: { type: 'string' } },
    compatibility: { type: 'string', minLength: 1 },
    exportedAt: { type: 'string', minLength: 1 },
  },
};

export function createValidationResult({ ok, errors = [] }) {
  return { ok, errors };
}

export function validateRequiredObject(data, name) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return [`${name} must be an object`];
  }
  return [];
}

export function validateStringField(data, fieldName, { required = true, allowEmpty = false } = {}) {
  if (data[fieldName] === undefined || data[fieldName] === null) {
    return required ? [`${fieldName} is required`] : [];
  }
  if (typeof data[fieldName] !== 'string') return [`${fieldName} must be a string`];
  if (!allowEmpty && data[fieldName].trim().length === 0) return [`${fieldName} must be a non-empty string`];
  return [];
}

export function validateStringArrayField(data, fieldName, { required = true } = {}) {
  if (data[fieldName] === undefined || data[fieldName] === null) {
    return required ? [`${fieldName} is required`] : [];
  }
  if (!Array.isArray(data[fieldName])) return [`${fieldName} must be an array`];
  return data[fieldName].some((item) => typeof item !== 'string') ? [`${fieldName} must contain only strings`] : [];
}

export function validateEnumField(data, fieldName, validValues, label = fieldName) {
  if (typeof data[fieldName] !== 'string' || !validValues.includes(data[fieldName])) {
    return [`Invalid ${label}: ${data[fieldName]}`];
  }
  return [];
}

export function collectDuplicateArtifactIds(artifacts = []) {
  const seen = new Set();
  const duplicates = new Set();
  artifacts.forEach((artifact) => {
    const artifactId = artifact?.artifactId;
    if (artifactId && seen.has(artifactId)) duplicates.add(artifactId);
    if (artifactId) seen.add(artifactId);
  });
  return Array.from(duplicates);
}

export function validateArtifactReceipt(data) {
  const errors = validateRequiredObject(data, 'artifactReceipt');
  if (errors.length) return createValidationResult({ ok: false, errors });

  errors.push(...validateStringField(data, 'schema'));
  if (data.schema !== 'phioffice369.artifact_receipt.v0.1') errors.push(`Invalid schema: ${data.schema}`);
  errors.push(...validateStringField(data, 'artifactId'));
  errors.push(...validateStringField(data, 'title'));
  errors.push(...validateEnumField(data, 'app', suiteApps, 'app'));
  errors.push(...validateStringArrayField(data, 'labels'));
  errors.push(...validateStringArrayField(data, 'transformations'));
  errors.push(...validateStringField(data, 'createdAt'));

  const invalidLabels = Array.isArray(data.labels) ? data.labels.filter((label) => !getTrustLabelById(label)) : [];
  if (invalidLabels.length) errors.push(`Invalid trust labels: ${invalidLabels.join(', ')}`);

  return createValidationResult({ ok: errors.length === 0, errors });
}

export function validateArtifactManifestEntry(data) {
  const errors = validateRequiredObject(data, 'artifactManifestEntry');
  if (errors.length) return createValidationResult({ ok: false, errors });

  errors.push(...validateStringField(data, 'artifactId'));
  errors.push(...validateStringField(data, 'title'));
  errors.push(...validateEnumField(data, 'kind', artifactKinds, 'artifact kind'));
  errors.push(...validateEnumField(data, 'app', suiteApps, 'app'));
  errors.push(...validateStringField(data, 'path', { allowEmpty: true }));
  errors.push(...validateStringArrayField(data, 'labels'));
  if (!Array.isArray(data.receipts)) errors.push('receipts must be an array');
  if (data.sourceTemplateId !== null && typeof data.sourceTemplateId !== 'string') errors.push('sourceTemplateId must be null or a string');
  errors.push(...validateStringField(data, 'status'));
  errors.push(...validateStringField(data, 'createdAt'));
  errors.push(...validateStringField(data, 'updatedAt'));

  const invalidLabels = Array.isArray(data.labels) ? data.labels.filter((label) => !getTrustLabelById(label)) : [];
  if (invalidLabels.length) errors.push(`Invalid trust labels: ${invalidLabels.join(', ')}`);

  return createValidationResult({ ok: errors.length === 0, errors });
}

export function validateProjectManifest(data) {
  const errors = validateRequiredObject(data, 'projectManifest');
  if (errors.length) return createValidationResult({ ok: false, errors });

  errors.push(...validateStringField(data, 'schema'));
  if (data.schema !== 'phioffice369.project_manifest.v0.1') errors.push(`Invalid schema: ${data.schema}`);
  errors.push(...validateStringField(data, 'projectId'));
  errors.push(...validateStringField(data, 'title'));
  errors.push(...validateStringField(data, 'description', { allowEmpty: true }));
  errors.push(...validateStringField(data, 'owner'));
  errors.push(...validateStringArrayField(data, 'tags'));
  if (!Array.isArray(data.artifacts)) {
    errors.push('artifacts must be an array');
  } else {
    const duplicates = collectDuplicateArtifactIds(data.artifacts);
    if (duplicates.length) errors.push(`Duplicate artifact ids: ${duplicates.join(', ')}`);
    data.artifacts.forEach((artifact, index) => {
      const artifactResult = validateArtifactManifestEntry(artifact);
      artifactResult.errors.forEach((error) => errors.push(`artifacts[${index}].${error}`));
    });
  }
  errors.push(...validateStringField(data, 'createdAt'));
  errors.push(...validateStringField(data, 'updatedAt'));

  return createValidationResult({ ok: errors.length === 0, errors });
}

export function validateExportReceipt(data) {
  const errors = validateRequiredObject(data, 'exportReceipt');
  if (errors.length) return createValidationResult({ ok: false, errors });

  errors.push(...validateStringField(data, 'schema'));
  if (data.schema !== 'phioffice369.export_receipt.v0.1') errors.push(`Invalid schema: ${data.schema}`);
  errors.push(...validateStringField(data, 'artifactId'));
  errors.push(...validateStringField(data, 'format'));
  errors.push(...validateStringField(data, 'filename'));
  errors.push(...validateEnumField(data, 'sourceApp', suiteApps, 'sourceApp'));
  errors.push(...validateStringArrayField(data, 'warnings'));
  errors.push(...validateStringField(data, 'compatibility'));
  errors.push(...validateStringField(data, 'exportedAt'));

  return createValidationResult({ ok: errors.length === 0, errors });
}
