import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPhiWriteToPhiDeckPayload,
  createTransformRegistryManifest,
  createTransformTrace,
  getTransformById,
  getTransformIds,
  getTransformLabels,
  getTransformsForApp,
  transformDefinitions,
  transformRegistryVersion,
} from '../apps/web/src/lib/transformRegistry.js';

const sampleTemplate = {
  id: 'basic_project_spec',
  title: 'Basic Project Spec',
  trustDefaults: ['human_written'],
};

const sampleSlides = [
  { id: 'slide-1', title: 'Opening', bullets: ['Hello'] },
];

test('transform registry exposes versioned transform definitions', () => {
  assert.equal(transformRegistryVersion, 'phioffice369.transform_registry.v0.1');
  assert.ok(transformDefinitions.length >= 4);
  assert.equal(getTransformById('phiwrite_to_phideck_lite_workspace').toApp, 'PhiDeck');
});

test('getTransformsForApp returns transforms connected to an app', () => {
  const transforms = getTransformsForApp('PhiDeck');
  const ids = transforms.map((transform) => transform.id);

  assert.ok(ids.includes('phiwrite_to_phideck_lite_workspace'));
  assert.ok(ids.includes('phideck_to_json_export'));
});

test('getTransformIds and getTransformLabels preserve unknown fallback values', () => {
  assert.deepEqual(getTransformIds(['template_to_phiwrite_lite_draft', 'unknown']), ['template_to_phiwrite_lite_draft', 'unknown']);
  assert.deepEqual(getTransformLabels(['template_to_phiwrite_lite_draft', 'unknown']), ['Template → PhiWrite draft', 'unknown']);
});

test('createTransformTrace creates a trace envelope', () => {
  const trace = createTransformTrace({
    transformId: 'phiwrite_to_phideck_lite_workspace',
    sourceArtifactId: 'draft_basic_project_spec',
    targetArtifactId: 'deck_basic_project_spec',
  });

  assert.equal(trace.schema, 'phioffice369.transform_trace.v0.1');
  assert.equal(trace.label, 'PhiWrite draft → PhiDeck workspace');
  assert.equal(trace.sourceApp, 'PhiWrite');
  assert.equal(trace.targetApp, 'PhiDeck');
});

test('createPhiWriteToPhiDeckPayload includes transform metadata and trace', () => {
  const payload = createPhiWriteToPhiDeckPayload({
    title: 'Deck Title',
    template: sampleTemplate,
    slides: sampleSlides,
  });

  assert.equal(payload.title, 'Deck Title');
  assert.equal(payload.transformId, 'phiwrite_to_phideck_lite_workspace');
  assert.equal(payload.transformLabel, 'PhiWrite draft → PhiDeck workspace');
  assert.equal(payload.trace.sourceArtifactId, 'draft_basic_project_spec');
  assert.equal(payload.trace.targetArtifactId, 'deck_basic_project_spec');
  assert.deepEqual(payload.slides, sampleSlides);
  assert.ok(payload.trustDefaults.includes('needs_citation'));
});

test('createTransformRegistryManifest exports registry data', () => {
  const manifest = createTransformRegistryManifest();

  assert.equal(manifest.schema, transformRegistryVersion);
  assert.deepEqual(manifest.transforms, transformDefinitions);
});
