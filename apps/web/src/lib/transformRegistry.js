export const transformRegistryVersion = 'phioffice369.transform_registry.v0.1';

export const transformDefinitions = [
  {
    id: 'template_to_phiwrite_lite_draft',
    label: 'Template → PhiWrite draft',
    fromApp: 'Templates',
    toApp: 'PhiWrite',
    fromKind: 'template',
    toKind: 'document',
    trustDefaults: ['human_written'],
    description: 'Creates an editable PhiWrite document from a starter template.',
  },
  {
    id: 'template_to_phigrid_lite_table',
    label: 'Template → PhiGrid table',
    fromApp: 'Templates',
    toApp: 'PhiGrid',
    fromKind: 'template',
    toKind: 'grid',
    trustDefaults: ['private'],
    description: 'Creates an editable PhiGrid table from a starter template.',
  },
  {
    id: 'template_to_phideck_lite_deck',
    label: 'Template → PhiDeck deck',
    fromApp: 'Templates',
    toApp: 'PhiDeck',
    fromKind: 'template',
    toKind: 'deck',
    trustDefaults: ['ai_assisted'],
    description: 'Creates an editable PhiDeck slide deck from a starter template.',
  },
  {
    id: 'phiwrite_to_phideck_lite_workspace',
    label: 'PhiWrite draft → PhiDeck workspace',
    fromApp: 'PhiWrite',
    toApp: 'PhiDeck',
    fromKind: 'document',
    toKind: 'deck',
    trustDefaults: ['ai_assisted', 'needs_citation'],
    description: 'Turns a PhiWrite draft into an editable PhiDeck-lite slide workspace.',
  },
  {
    id: 'phiwrite_to_markdown_export',
    label: 'PhiWrite draft → Markdown export',
    fromApp: 'PhiWrite',
    toApp: 'File System',
    fromKind: 'document',
    toKind: 'markdown',
    trustDefaults: ['human_written'],
    description: 'Exports a PhiWrite document as a local Markdown file with receipt context.',
  },
  {
    id: 'phigrid_to_csv_export',
    label: 'PhiGrid table → CSV export',
    fromApp: 'PhiGrid',
    toApp: 'File System',
    fromKind: 'grid',
    toKind: 'csv',
    trustDefaults: ['private'],
    description: 'Exports a PhiGrid table as a local CSV file.',
  },
  {
    id: 'phideck_to_json_export',
    label: 'PhiDeck deck → JSON export',
    fromApp: 'PhiDeck',
    toApp: 'File System',
    fromKind: 'deck',
    toKind: 'json',
    trustDefaults: ['ai_assisted'],
    description: 'Exports a PhiDeck-lite deck as editable local JSON.',
  },
];

export function getTransformById(transformId) {
  return transformDefinitions.find((definition) => definition.id === transformId) ?? null;
}

export function getTransformsForApp(appName) {
  return transformDefinitions.filter((definition) => definition.fromApp === appName || definition.toApp === appName);
}

export function getTransformIds(transformIds = []) {
  return transformIds.map((transformId) => getTransformById(transformId)?.id ?? transformId);
}

export function getTransformLabels(transformIds = []) {
  return transformIds.map((transformId) => getTransformById(transformId)?.label ?? transformId);
}

export function createTransformTrace({ transformId, sourceArtifactId, targetArtifactId, sourceApp, targetApp, notes = [] }) {
  const definition = getTransformById(transformId);

  return {
    schema: 'phioffice369.transform_trace.v0.1',
    transformId,
    label: definition?.label ?? transformId,
    sourceArtifactId,
    targetArtifactId,
    sourceApp: sourceApp ?? definition?.fromApp ?? null,
    targetApp: targetApp ?? definition?.toApp ?? null,
    createdAt: new Date().toISOString(),
    notes,
  };
}

export function createPhiWriteToPhiDeckPayload({ title, template, slides }) {
  const transform = getTransformById('phiwrite_to_phideck_lite_workspace');

  return {
    title,
    sourceTemplateId: template.id,
    sourceTemplateTitle: template.title,
    trustDefaults: Array.from(new Set([...(template.trustDefaults ?? []), ...(transform?.trustDefaults ?? [])])),
    transformId: transform.id,
    transformLabel: transform.label,
    trace: createTransformTrace({
      transformId: transform.id,
      sourceArtifactId: `draft_${template.id}`,
      targetArtifactId: `deck_${template.id}`,
      sourceApp: 'PhiWrite',
      targetApp: 'PhiDeck',
      notes: ['Generated locally from PhiWrite-lite deck outline.'],
    }),
    slides,
  };
}

export function createTransformRegistryManifest() {
  return {
    schema: transformRegistryVersion,
    transforms: transformDefinitions,
  };
}
