import test from 'node:test';
import assert from 'node:assert/strict';
import { getTemplateById, starterTemplates } from '../packages/templates/src/index.js';

test('starter template catalog is not empty', () => {
  assert.ok(starterTemplates.length >= 8);
});

test('starter templates include PhiWrite and PhiGrid templates', () => {
  const apps = new Set(starterTemplates.map((template) => template.app));

  assert.ok(apps.has('PhiWrite'));
  assert.ok(apps.has('PhiGrid'));
});

test('getTemplateById returns templates and null for missing templates', () => {
  assert.equal(getTemplateById('basic_project_spec')?.title, 'Basic Project Spec');
  assert.equal(getTemplateById('missing_template'), null);
});

test('each starter template includes required fields', () => {
  for (const template of starterTemplates) {
    assert.equal(typeof template.id, 'string');
    assert.equal(typeof template.title, 'string');
    assert.equal(typeof template.app, 'string');
    assert.equal(typeof template.purpose, 'string');
    assert.ok(Array.isArray(template.trustDefaults));
    assert.ok(Array.isArray(template.sections));
    assert.ok(template.sections.length > 0);
  }
});
