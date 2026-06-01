import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTransformPacket } from '../packages/core/src/transformPackets.js';
import {
  createChecklistFromMarkdown,
  createDeckSlidesFromMarkdown,
  createPhiWriteChecklistTransformPacket,
  createPhiWriteDeckTransformPacket,
  createPhiWriteReadmeTransformPacket,
  createPhiWriteTransformSet,
  createPhiWriteTransformSource,
  createReadmeFromMarkdown,
  extractMarkdownTitle,
  lineToBullet,
  normalizePhiWriteMarkdown,
  PHIWRITE_TRANSFORMS_SCHEMA,
  slugifyArtifactText,
  splitMarkdownIntoSections,
} from '../apps/web/src/lib/phiwriteTransforms.js';

const sampleMarkdown = `# Launch Spec

A local-first product spec for PhiOffice369.

## Goals

- Build once
- Transform ethically
- Preserve provenance

## Trust

1. Label AI-assisted output
2. Review public claims

## Next Steps

- Export bundle
- Review in PhiVault
`;

const sampleTemplate = {
  id: 'launch_spec',
  title: 'Launch Spec Template',
  trustDefaults: ['human_written'],
};

test('normalizePhiWriteMarkdown trims and normalizes line endings', () => {
  assert.equal(normalizePhiWriteMarkdown(' hello\r\nworld '), 'hello\nworld');
});

test('slugifyArtifactText creates stable artifact-safe slugs', () => {
  assert.equal(slugifyArtifactText('Launch Spec! 369'), 'launch_spec_369');
  assert.equal(slugifyArtifactText('!!!'), 'artifact');
});

test('extractMarkdownTitle reads first h1 heading or fallback', () => {
  assert.equal(extractMarkdownTitle(sampleMarkdown), 'Launch Spec');
  assert.equal(extractMarkdownTitle('No heading', 'Fallback'), 'Fallback');
});

test('splitMarkdownIntoSections extracts heading sections and lines', () => {
  const sections = splitMarkdownIntoSections(sampleMarkdown);

  assert.equal(sections[0].title, 'Launch Spec');
  assert.ok(sections.some((section) => section.title === 'Goals'));
  assert.ok(sections.find((section) => section.title === 'Trust').lines.includes('1. Label AI-assisted output'));
});

test('lineToBullet strips markdown bullet and numbered prefixes', () => {
  assert.equal(lineToBullet('- Build once'), 'Build once');
  assert.equal(lineToBullet('1. Review claims'), 'Review claims');
});

test('createDeckSlidesFromMarkdown creates title content and next-step slides', () => {
  const slides = createDeckSlidesFromMarkdown(sampleMarkdown);

  assert.equal(slides[0].title, 'Launch Spec');
  assert.ok(slides.some((slide) => slide.title === 'Goals'));
  assert.ok(slides.some((slide) => slide.title === 'Next Steps'));
  assert.ok(slides.find((slide) => slide.title === 'Goals').bullets.includes('Build once'));
});

test('createReadmeFromMarkdown creates a README draft with local-first notes', () => {
  const readme = createReadmeFromMarkdown(sampleMarkdown);

  assert.match(readme, /^# Launch Spec/);
  assert.match(readme, /## Local-first Notes/);
  assert.match(readme, /Review generated README/);
});

test('createChecklistFromMarkdown creates checkbox items and safety review', () => {
  const checklist = createChecklistFromMarkdown(sampleMarkdown);

  assert.match(checklist, /^# Launch Spec Checklist/);
  assert.match(checklist, /- \[ \] Build once/);
  assert.match(checklist, /## Safety Review/);
});

test('createPhiWriteTransformSource creates source metadata from template and markdown', () => {
  const source = createPhiWriteTransformSource({ markdown: sampleMarkdown, template: sampleTemplate });

  assert.equal(source.artifactId, 'draft_launch_spec');
  assert.equal(source.title, 'Launch Spec');
  assert.equal(source.app, 'PhiWrite');
  assert.deepEqual(source.labels, ['human_written']);
});

test('createPhiWriteDeckTransformPacket creates a valid deck packet', () => {
  const packet = createPhiWriteDeckTransformPacket({ markdown: sampleMarkdown, template: sampleTemplate });

  assert.equal(packet.transformId, 'phiwrite_to_phideck');
  assert.equal(packet.target.app, 'PhiDeck');
  assert.equal(packet.target.kind, 'deck');
  assert.equal(packet.payload.schema, 'phioffice369.phideck_payload.v0.2');
  assert.ok(packet.payload.slides.length >= 3);
  assert.equal(validateTransformPacket(packet).ok, true);
});

test('createPhiWriteReadmeTransformPacket creates a valid README packet', () => {
  const packet = createPhiWriteReadmeTransformPacket({ markdown: sampleMarkdown, template: sampleTemplate });

  assert.equal(packet.transformId, 'phiwrite_to_readme');
  assert.equal(packet.target.kind, 'readme');
  assert.match(packet.payload, /# Launch Spec/);
  assert.equal(validateTransformPacket(packet).ok, true);
});

test('createPhiWriteChecklistTransformPacket creates a valid checklist packet', () => {
  const packet = createPhiWriteChecklistTransformPacket({ markdown: sampleMarkdown, template: sampleTemplate });

  assert.equal(packet.transformId, 'phiwrite_to_checklist');
  assert.equal(packet.target.kind, 'checklist');
  assert.match(packet.payload, /- \[ \] Build once/);
  assert.equal(validateTransformPacket(packet).ok, true);
});

test('createPhiWriteTransformSet returns all v0.2 PhiWrite packets', () => {
  const transformSet = createPhiWriteTransformSet({ markdown: sampleMarkdown, template: sampleTemplate });

  assert.equal(transformSet.schema, PHIWRITE_TRANSFORMS_SCHEMA);
  assert.equal(transformSet.source.artifactId, 'draft_launch_spec');
  assert.deepEqual(transformSet.packets.map((packet) => packet.transformId), [
    'phiwrite_to_phideck',
    'phiwrite_to_readme',
    'phiwrite_to_checklist',
  ]);
  assert.ok(transformSet.packets.every((packet) => validateTransformPacket(packet).ok));
});
