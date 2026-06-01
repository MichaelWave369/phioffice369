import {
  assertKnownSuiteApp,
  assertKnownTrustLabels,
  assertNonEmptyString,
  assertStringArray,
  suiteApps,
} from './index.js';
import { transformPacketKinds } from './transformPackets.js';

export const TRANSFORM_REGISTRY_SCHEMA = 'phioffice369.transform_registry.v0.2';

export const transformRegistry = [
  {
    id: 'phiwrite_to_phideck',
    label: 'PhiWrite to PhiDeck',
    sourceApp: 'PhiWrite',
    targetApp: 'PhiDeck',
    targetKind: 'deck',
    inputShape: 'phiwrite_document_v0.1',
    outputShape: 'phideck_deck_v0.2',
    trustLabelDefaults: ['ai_assisted', 'needs_citation'],
    compatibilityWarningDefaults: ['Markdown headings and paragraphs are approximated into slide structure.'],
    receiptMetadata: ['source_artifact_id', 'target_artifact_id', 'transform_id', 'created_at'],
    publicRiskNotes: ['Review factual claims before presenting publicly.'],
  },
  {
    id: 'phiwrite_to_readme',
    label: 'PhiWrite to README',
    sourceApp: 'PhiWrite',
    targetApp: 'PhiWrite',
    targetKind: 'readme',
    inputShape: 'phiwrite_document_v0.1',
    outputShape: 'markdown_readme_v0.2',
    trustLabelDefaults: ['ai_assisted'],
    compatibilityWarningDefaults: ['Document sections are normalized into README headings.'],
    receiptMetadata: ['source_artifact_id', 'target_artifact_id', 'transform_id', 'created_at'],
    publicRiskNotes: ['Confirm project status and claims before publishing.'],
  },
  {
    id: 'phiwrite_to_checklist',
    label: 'PhiWrite to Checklist',
    sourceApp: 'PhiWrite',
    targetApp: 'PhiWrite',
    targetKind: 'checklist',
    inputShape: 'phiwrite_document_v0.1',
    outputShape: 'markdown_checklist_v0.2',
    trustLabelDefaults: ['ai_assisted'],
    compatibilityWarningDefaults: ['Narrative paragraphs may become summarized action items.'],
    receiptMetadata: ['source_artifact_id', 'target_artifact_id', 'transform_id', 'created_at'],
    publicRiskNotes: ['Verify deadlines, owners, and safety-critical steps manually.'],
  },
  {
    id: 'phigrid_to_summary_report',
    label: 'PhiGrid to Summary Report',
    sourceApp: 'PhiGrid',
    targetApp: 'PhiWrite',
    targetKind: 'report',
    inputShape: 'phigrid_table_v0.1',
    outputShape: 'markdown_report_v0.2',
    trustLabelDefaults: ['ai_assisted', 'needs_citation'],
    compatibilityWarningDefaults: ['Computed summaries depend on local table values at transform time.'],
    receiptMetadata: ['source_artifact_id', 'target_artifact_id', 'transform_id', 'created_at'],
    publicRiskNotes: ['Audit formulas and source data before sharing externally.'],
  },
  {
    id: 'phideck_to_speaker_notes',
    label: 'PhiDeck to Speaker Notes',
    sourceApp: 'PhiDeck',
    targetApp: 'PhiWrite',
    targetKind: 'notes',
    inputShape: 'phideck_deck_v0.2',
    outputShape: 'markdown_speaker_notes_v0.2',
    trustLabelDefaults: ['ai_assisted'],
    compatibilityWarningDefaults: ['Slide hierarchy is expanded into speaking notes.'],
    receiptMetadata: ['source_artifact_id', 'target_artifact_id', 'transform_id', 'created_at'],
    publicRiskNotes: ['Review tone and timing before presenting.'],
  },
  {
    id: 'workspace_to_launch_packet',
    label: 'Workspace to Launch Packet',
    sourceApp: 'PhiVault',
    targetApp: 'PhiVault',
    targetKind: 'bundle',
    inputShape: 'phivault_workspace_manifest_v0.1',
    outputShape: 'phioffice_launch_packet_v0.2',
    trustLabelDefaults: ['ai_assisted', 'private'],
    compatibilityWarningDefaults: ['Workspace bundle exports metadata and selected artifacts, not a full file-system clone.'],
    receiptMetadata: ['source_manifest_id', 'target_bundle_id', 'transform_id', 'created_at'],
    publicRiskNotes: ['Review private artifacts before sharing a launch packet.'],
  },
];

export function validateTransformDefinition(definition) {
  const errors = [];

  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    return { ok: false, errors: ['transform definition must be an object'] };
  }

  try { assertNonEmptyString(definition.id, 'id'); } catch (error) { errors.push(error.message); }
  try { assertNonEmptyString(definition.label, 'label'); } catch (error) { errors.push(error.message); }
  try { assertKnownSuiteApp(definition.sourceApp, 'sourceApp'); } catch (error) { errors.push(error.message); }
  try { assertKnownSuiteApp(definition.targetApp, 'targetApp'); } catch (error) { errors.push(error.message); }
  if (!transformPacketKinds.includes(definition.targetKind)) errors.push(`Invalid targetKind: ${definition.targetKind}`);
  try { assertNonEmptyString(definition.inputShape, 'inputShape'); } catch (error) { errors.push(error.message); }
  try { assertNonEmptyString(definition.outputShape, 'outputShape'); } catch (error) { errors.push(error.message); }
  try { assertKnownTrustLabels(definition.trustLabelDefaults ?? []); } catch (error) { errors.push(error.message); }
  try { assertStringArray(definition.compatibilityWarningDefaults ?? [], 'compatibilityWarningDefaults'); } catch (error) { errors.push(error.message); }
  try { assertStringArray(definition.receiptMetadata ?? [], 'receiptMetadata'); } catch (error) { errors.push(error.message); }
  try { assertStringArray(definition.publicRiskNotes ?? [], 'publicRiskNotes'); } catch (error) { errors.push(error.message); }

  return { ok: errors.length === 0, errors };
}

export function getTransformRegistry() {
  return {
    schema: TRANSFORM_REGISTRY_SCHEMA,
    transforms: transformRegistry,
  };
}

export function getTransformDefinition(transformId) {
  return transformRegistry.find((definition) => definition.id === transformId) ?? null;
}

export function listTransformsForSourceApp(sourceApp) {
  assertKnownSuiteApp(sourceApp, 'sourceApp');
  return transformRegistry.filter((definition) => definition.sourceApp === sourceApp);
}

export function listTransformsForTargetKind(targetKind) {
  assertNonEmptyString(targetKind, 'targetKind');
  return transformRegistry.filter((definition) => definition.targetKind === targetKind);
}

export function assertValidTransformRegistry(registry = transformRegistry) {
  if (!Array.isArray(registry)) throw new TypeError('transform registry must be an array');

  const ids = new Set();
  const duplicates = new Set();
  const errors = [];

  registry.forEach((definition, index) => {
    const result = validateTransformDefinition(definition);
    result.errors.forEach((error) => errors.push(`transforms[${index}].${error}`));
    if (definition?.id) {
      if (ids.has(definition.id)) duplicates.add(definition.id);
      ids.add(definition.id);
    }
  });

  if (duplicates.size) errors.push(`Duplicate transform ids: ${Array.from(duplicates).join(', ')}`);
  if (errors.length) throw new TypeError(errors.join('; '));

  return true;
}

export function createTransformDefinitionSummary(definition) {
  return {
    id: definition.id,
    label: definition.label,
    sourceApp: definition.sourceApp,
    targetApp: definition.targetApp,
    targetKind: definition.targetKind,
    trustLabelDefaults: definition.trustLabelDefaults,
    warningCount: definition.compatibilityWarningDefaults.length,
    publicRiskNoteCount: definition.publicRiskNotes.length,
  };
}

export function listTransformDefinitionSummaries(registry = transformRegistry) {
  return registry.map(createTransformDefinitionSummary);
}

export function createTransformPacketDefaults(transformId) {
  const definition = getTransformDefinition(transformId);
  if (!definition) throw new TypeError(`Unknown transform: ${transformId}`);

  return {
    transformId: definition.id,
    targetApp: definition.targetApp,
    targetKind: definition.targetKind,
    trustLabels: definition.trustLabelDefaults,
    warnings: definition.compatibilityWarningDefaults,
    compatibilityNotes: [
      `${definition.label} uses ${definition.inputShape} → ${definition.outputShape}.`,
    ],
  };
}

assertValidTransformRegistry();
