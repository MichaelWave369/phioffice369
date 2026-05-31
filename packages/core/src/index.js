export const trustLabels = [
  {
    id: 'human_written',
    label: 'Human-written',
    tone: 'gold',
    description: 'Created directly by the user.',
    publishRisk: 'low',
  },
  {
    id: 'ai_assisted',
    label: 'AI-assisted',
    tone: 'blue',
    description: 'Drafted, transformed, summarized, or polished with AI help.',
    publishRisk: 'medium',
  },
  {
    id: 'sourced',
    label: 'Sourced',
    tone: 'green',
    description: 'Backed by visible citations, files, or references.',
    publishRisk: 'low',
  },
  {
    id: 'needs_citation',
    label: 'Needs citation',
    tone: 'orange',
    description: 'Factual claim that should be supported before publishing.',
    publishRisk: 'high',
  },
  {
    id: 'hypothesis',
    label: 'Hypothesis',
    tone: 'purple',
    description: 'Plausible but unverified idea.',
    publishRisk: 'medium',
  },
  {
    id: 'symbolic',
    label: 'Symbolic',
    tone: 'pink',
    description: 'Mythic, metaphorical, artistic, or interface-layer meaning.',
    publishRisk: 'medium',
  },
  {
    id: 'private',
    label: 'Private',
    tone: 'red',
    description: 'Sensitive, personal, internal, or not for publication.',
    publishRisk: 'high',
  },
  {
    id: 'verified',
    label: 'Verified',
    tone: 'green',
    description: 'Checked against a trusted source or project record.',
    publishRisk: 'low',
  },
];

export const suiteApps = [
  'PhiWrite',
  'PhiGrid',
  'PhiDeck',
  'PhiNotes',
  'PhiMap',
  'PhiPress',
  'PhiBase',
  'PhiVault',
  'PhiFlow',
  'Professor Phi',
];

export const artifactKinds = [
  'document',
  'grid',
  'deck',
  'note',
  'diagram',
  'press',
  'database',
  'vault_item',
  'workflow',
  'export_receipt',
];

export function getTrustLabelById(id) {
  return trustLabels.find((label) => label.id === id) ?? null;
}

export function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }
}

export function assertKnownSuiteApp(app, fieldName = 'app') {
  assertNonEmptyString(app, fieldName);
  if (!suiteApps.includes(app)) {
    throw new TypeError(`Invalid ${fieldName}: ${app}`);
  }
}

export function assertKnownArtifactKind(kind) {
  assertNonEmptyString(kind, 'kind');
  if (!artifactKinds.includes(kind)) {
    throw new TypeError(`Invalid artifact kind: ${kind}`);
  }
}

export function assertStringArray(value, fieldName) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new TypeError(`${fieldName} must be an array of strings`);
  }
}

export function assertKnownTrustLabels(labels = []) {
  assertStringArray(labels, 'labels');
  const invalidLabels = labels.filter((label) => !getTrustLabelById(label));
  if (invalidLabels.length > 0) {
    throw new TypeError(`Invalid trust labels: ${invalidLabels.join(', ')}`);
  }
}

export function assertUniqueArtifactIds(artifacts = []) {
  if (!Array.isArray(artifacts)) {
    throw new TypeError('artifacts must be an array');
  }

  const seen = new Set();
  const duplicates = new Set();
  artifacts.forEach((artifact) => {
    const artifactId = artifact?.artifactId;
    assertNonEmptyString(artifactId, 'artifact.artifactId');
    if (seen.has(artifactId)) duplicates.add(artifactId);
    seen.add(artifactId);
  });

  if (duplicates.size > 0) {
    throw new TypeError(`Duplicate artifact ids: ${Array.from(duplicates).join(', ')}`);
  }
}

export function createArtifactReceipt({ artifactId, title, app, labels = [], transformations = [] }) {
  assertNonEmptyString(artifactId, 'artifactId');
  assertNonEmptyString(title, 'title');
  assertKnownSuiteApp(app);
  assertKnownTrustLabels(labels);
  assertStringArray(transformations, 'transformations');

  return {
    artifactId,
    title,
    app,
    labels,
    transformations,
    createdAt: new Date().toISOString(),
    schema: 'phioffice369.artifact_receipt.v0.1',
  };
}

export function createProjectManifest({
  projectId,
  title,
  description = '',
  artifacts = [],
  tags = [],
  owner = 'local-user',
}) {
  assertNonEmptyString(projectId, 'projectId');
  assertNonEmptyString(title, 'title');
  assertNonEmptyString(owner, 'owner');
  if (typeof description !== 'string') throw new TypeError('description must be a string');
  assertStringArray(tags, 'tags');
  assertUniqueArtifactIds(artifacts);

  return {
    schema: 'phioffice369.project_manifest.v0.1',
    projectId,
    title,
    description,
    owner,
    tags,
    artifacts,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createArtifactManifestEntry({
  artifactId,
  title,
  kind,
  app,
  path = '',
  labels = [],
  receipts = [],
  sourceTemplateId = null,
  status = 'draft',
}) {
  assertNonEmptyString(artifactId, 'artifactId');
  assertNonEmptyString(title, 'title');
  assertKnownArtifactKind(kind);
  assertKnownSuiteApp(app);
  if (typeof path !== 'string') throw new TypeError('path must be a string');
  assertKnownTrustLabels(labels);
  if (!Array.isArray(receipts)) throw new TypeError('receipts must be an array');
  if (sourceTemplateId !== null && typeof sourceTemplateId !== 'string') throw new TypeError('sourceTemplateId must be null or a string');
  assertNonEmptyString(status, 'status');

  return {
    artifactId,
    title,
    kind,
    app,
    path,
    labels,
    receipts,
    sourceTemplateId,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function addArtifactToProjectManifest(manifest, artifact) {
  if (!manifest || typeof manifest !== 'object') throw new TypeError('manifest must be an object');
  if (!artifact || typeof artifact !== 'object') throw new TypeError('artifact must be an object');
  assertNonEmptyString(artifact.artifactId, 'artifact.artifactId');
  assertUniqueArtifactIds([...(manifest.artifacts ?? []), artifact]);

  return {
    ...manifest,
    artifacts: [...(manifest.artifacts ?? []), artifact],
    updatedAt: new Date().toISOString(),
  };
}

export function createExportReceipt({
  artifactId,
  format,
  filename,
  sourceApp,
  warnings = [],
  compatibility = 'native',
}) {
  assertNonEmptyString(artifactId, 'artifactId');
  assertNonEmptyString(format, 'format');
  assertNonEmptyString(filename, 'filename');
  assertKnownSuiteApp(sourceApp, 'sourceApp');
  assertStringArray(warnings, 'warnings');
  assertNonEmptyString(compatibility, 'compatibility');

  return {
    schema: 'phioffice369.export_receipt.v0.1',
    artifactId,
    format,
    filename,
    sourceApp,
    warnings,
    compatibility,
    exportedAt: new Date().toISOString(),
  };
}

export function createLocalStorageExportReceiptKey({ sourceApp, artifactId, format, exportedAt = new Date().toISOString() }) {
  assertKnownSuiteApp(sourceApp, 'sourceApp');
  assertNonEmptyString(artifactId, 'artifactId');
  assertNonEmptyString(format, 'format');
  assertNonEmptyString(exportedAt, 'exportedAt');

  return `phioffice369:export_receipt:${sourceApp}:${artifactId}:${format}:${exportedAt}`;
}
