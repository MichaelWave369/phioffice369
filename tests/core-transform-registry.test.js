import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertValidTransformRegistry,
  createTransformDefinitionSummary,
  createTransformPacketDefaults,
  getTransformDefinition,
  getTransformRegistry,
  listTransformDefinitionSummaries,
  listTransformsForSourceApp,
  listTransformsForTargetKind,
  TRANSFORM_REGISTRY_SCHEMA,
  transformRegistry,
  validateTransformDefinition,
} from '../packages/core/src/transformRegistry.js';

test('core transform registry exposes versioned registry envelope', () => {
  const registry = getTransformRegistry();

  assert.equal(registry.schema, TRANSFORM_REGISTRY_SCHEMA);
  assert.equal(registry.transforms, transformRegistry);
  assert.ok(registry.transforms.length >= 6);
});

test('core transform registry contains the v0.2 foundation transforms', () => {
  const ids = transformRegistry.map((definition) => definition.id);

  assert.ok(ids.includes('phiwrite_to_phideck'));
  assert.ok(ids.includes('phiwrite_to_readme'));
  assert.ok(ids.includes('phiwrite_to_checklist'));
  assert.ok(ids.includes('phigrid_to_summary_report'));
  assert.ok(ids.includes('phideck_to_speaker_notes'));
  assert.ok(ids.includes('workspace_to_launch_packet'));
});

test('all bundled core transform definitions validate', () => {
  transformRegistry.forEach((definition) => {
    const result = validateTransformDefinition(definition);
    assert.equal(result.ok, true, `${definition.id} should validate: ${result.errors.join(', ')}`);
  });
  assert.equal(assertValidTransformRegistry(), true);
});

test('validateTransformDefinition reports malformed definitions', () => {
  const result = validateTransformDefinition({
    id: '',
    label: '',
    sourceApp: 'BadApp',
    targetApp: 'BadApp',
    targetKind: 'bad_kind',
    inputShape: '',
    outputShape: '',
    trustLabelDefaults: ['bad_label'],
    compatibilityWarningDefaults: [123],
    receiptMetadata: [123],
    publicRiskNotes: [123],
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('Invalid sourceApp')));
  assert.ok(result.errors.some((error) => error.includes('Invalid targetKind')));
  assert.ok(result.errors.some((error) => error.includes('Invalid trust labels')));
});

test('getTransformDefinition returns definitions or null', () => {
  assert.equal(getTransformDefinition('phiwrite_to_phideck')?.targetApp, 'PhiDeck');
  assert.equal(getTransformDefinition('missing_transform'), null);
});

test('listTransformsForSourceApp filters by source app', () => {
  const phiwriteTransforms = listTransformsForSourceApp('PhiWrite');

  assert.ok(phiwriteTransforms.length >= 3);
  assert.ok(phiwriteTransforms.every((definition) => definition.sourceApp === 'PhiWrite'));
  assert.throws(() => listTransformsForSourceApp('BadApp'), /Invalid sourceApp/);
});

test('listTransformsForTargetKind filters by target kind', () => {
  const deckTransforms = listTransformsForTargetKind('deck');

  assert.deepEqual(deckTransforms.map((definition) => definition.id), ['phiwrite_to_phideck']);
});

test('assertValidTransformRegistry rejects duplicate transform ids', () => {
  const duplicate = [transformRegistry[0], { ...transformRegistry[0] }];

  assert.throws(() => assertValidTransformRegistry(duplicate), /Duplicate transform ids/);
});

test('transform definition summaries expose compact UI fields', () => {
  const definition = getTransformDefinition('phiwrite_to_phideck');
  const summary = createTransformDefinitionSummary(definition);

  assert.equal(summary.id, 'phiwrite_to_phideck');
  assert.equal(summary.sourceApp, 'PhiWrite');
  assert.equal(summary.targetKind, 'deck');
  assert.equal(summary.warningCount, 1);
  assert.ok(listTransformDefinitionSummaries().some((item) => item.id === 'workspace_to_launch_packet'));
});

test('createTransformPacketDefaults returns packet defaults from registry definition', () => {
  const defaults = createTransformPacketDefaults('phiwrite_to_readme');

  assert.equal(defaults.transformId, 'phiwrite_to_readme');
  assert.equal(defaults.targetApp, 'PhiWrite');
  assert.equal(defaults.targetKind, 'readme');
  assert.deepEqual(defaults.trustLabels, ['ai_assisted']);
  assert.ok(defaults.warnings.length > 0);
  assert.match(defaults.compatibilityNotes[0], /PhiWrite to README/);
  assert.throws(() => createTransformPacketDefaults('missing_transform'), /Unknown transform/);
});
