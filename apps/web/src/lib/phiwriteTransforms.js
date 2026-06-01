import { createTransformPacket } from '@phioffice369/core/transform-packets';
import { createTransformPacketDefaults } from '@phioffice369/core/transform-registry';

export const PHIWRITE_TRANSFORMS_SCHEMA = 'phioffice369.phiwrite_transforms.v0.2';

export function normalizePhiWriteMarkdown(markdown = '') {
  return String(markdown ?? '').replace(/\r\n/g, '\n').trim();
}

export function slugifyArtifactText(value = 'artifact') {
  const slug = String(value ?? 'artifact')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return slug || 'artifact';
}

export function extractMarkdownTitle(markdown = '', fallback = 'Untitled Artifact') {
  const normalized = normalizePhiWriteMarkdown(markdown);
  const heading = normalized.split('\n').find((line) => /^#\s+/.test(line.trim()));
  return heading ? heading.replace(/^#\s+/, '').trim() : fallback;
}

export function splitMarkdownIntoSections(markdown = '') {
  const normalized = normalizePhiWriteMarkdown(markdown);
  if (!normalized) return [];

  const sections = [];
  let current = null;

  normalized.split('\n').forEach((line) => {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);

    if (headingMatch) {
      if (current) sections.push(current);
      current = {
        level: headingMatch[1].length,
        title: headingMatch[2].trim(),
        lines: [],
      };
      return;
    }

    if (!current) {
      current = { level: 1, title: 'Overview', lines: [] };
    }

    if (trimmed) current.lines.push(trimmed);
  });

  if (current) sections.push(current);
  return sections.filter((section) => section.title || section.lines.length > 0);
}

export function lineToBullet(line) {
  return String(line ?? '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .trim();
}

export function createDeckSlidesFromMarkdown(markdown = '', { maxBulletsPerSlide = 5 } = {}) {
  const title = extractMarkdownTitle(markdown);
  const sections = splitMarkdownIntoSections(markdown);
  const contentSections = sections.filter((section, index) => !(index === 0 && section.title === title && section.lines.length === 0));

  const slides = [
    {
      id: 'slide-1',
      title,
      bullets: ['Local-first artifact transformed from PhiWrite.'],
    },
  ];

  contentSections.forEach((section) => {
    const bullets = section.lines.map(lineToBullet).filter(Boolean).slice(0, maxBulletsPerSlide);
    slides.push({
      id: `slide-${slides.length + 1}`,
      title: section.title,
      bullets: bullets.length ? bullets : ['Add supporting points here.'],
    });
  });

  if (!slides.some((slide) => /next/i.test(slide.title))) {
    slides.push({
      id: `slide-${slides.length + 1}`,
      title: 'Next Steps',
      bullets: ['Review claims.', 'Confirm sources.', 'Export or continue building in PhiOffice369.'],
    });
  }

  return slides;
}

export function createReadmeFromMarkdown(markdown = '', { projectName = null } = {}) {
  const title = projectName ?? extractMarkdownTitle(markdown, 'PhiOffice369 Project');
  const sections = splitMarkdownIntoSections(markdown);
  const overviewLines = sections.flatMap((section) => section.lines).slice(0, 4);
  const featureSections = sections.filter((section) => section.title !== title).slice(0, 6);

  return [
    `# ${title}`,
    '',
    '## Overview',
    '',
    ...(overviewLines.length ? overviewLines : ['Describe the project purpose here.']),
    '',
    '## Key Sections',
    '',
    ...(featureSections.length ? featureSections.map((section) => `- ${section.title}`) : ['- Add project sections here.']),
    '',
    '## Local-first Notes',
    '',
    '- Review trust labels before publishing.',
    '- Add citations for factual claims.',
    '- Export receipts should travel with public artifacts.',
    '',
    '## Next Steps',
    '',
    '- [ ] Review generated README.',
    '- [ ] Confirm compatibility notes.',
    '- [ ] Export final artifact.',
  ].join('\n');
}

export function createChecklistFromMarkdown(markdown = '') {
  const sections = splitMarkdownIntoSections(markdown);
  const items = sections.flatMap((section) => {
    const sectionItems = section.lines.map(lineToBullet).filter(Boolean).slice(0, 6);
    if (sectionItems.length) return sectionItems.map((item) => `- [ ] ${item}`);
    return [`- [ ] Review ${section.title}`];
  });

  return [
    `# ${extractMarkdownTitle(markdown, 'Generated Checklist')} Checklist`,
    '',
    ...(items.length ? items : ['- [ ] Add first task.', '- [ ] Review trust labels.', '- [ ] Export final artifact.']),
    '',
    '## Safety Review',
    '',
    '- [ ] Verify factual claims.',
    '- [ ] Confirm private content is removed before publishing.',
    '- [ ] Attach export receipt if shared publicly.',
  ].join('\n');
}

export function createPhiWriteTransformSource({ markdown, template = {}, title = null }) {
  const artifactTitle = title ?? extractMarkdownTitle(markdown, template.title ?? 'PhiWrite Artifact');
  const artifactId = template.id ? `draft_${template.id}` : `draft_${slugifyArtifactText(artifactTitle)}`;

  return {
    artifactId,
    title: artifactTitle,
    app: 'PhiWrite',
    kind: 'document',
    labels: template.trustDefaults ?? ['human_written'],
  };
}

export function createPhiWriteDeckTransformPacket({ markdown, template = {}, title = null }) {
  const source = createPhiWriteTransformSource({ markdown, template, title });
  const defaults = createTransformPacketDefaults('phiwrite_to_phideck');
  const payload = {
    schema: 'phioffice369.phideck_payload.v0.2',
    title: `${source.title} Deck`,
    sourceTemplateId: template.id ?? null,
    slides: createDeckSlidesFromMarkdown(markdown),
  };

  return createTransformPacket({
    packetId: `packet_${source.artifactId}_to_deck`,
    transformId: defaults.transformId,
    source,
    target: {
      artifactId: `deck_${slugifyArtifactText(source.title)}`,
      title: payload.title,
      app: defaults.targetApp,
      kind: defaults.targetKind,
    },
    payload,
    trustLabels: Array.from(new Set([...(template.trustDefaults ?? []), ...defaults.trustLabels])),
    warnings: defaults.warnings,
    compatibilityNotes: defaults.compatibilityNotes,
  });
}

export function createPhiWriteReadmeTransformPacket({ markdown, template = {}, title = null }) {
  const source = createPhiWriteTransformSource({ markdown, template, title });
  const defaults = createTransformPacketDefaults('phiwrite_to_readme');
  const payload = createReadmeFromMarkdown(markdown, { projectName: source.title });

  return createTransformPacket({
    packetId: `packet_${source.artifactId}_to_readme`,
    transformId: defaults.transformId,
    source,
    target: {
      artifactId: `readme_${slugifyArtifactText(source.title)}`,
      title: `${source.title} README`,
      app: defaults.targetApp,
      kind: defaults.targetKind,
    },
    payload,
    trustLabels: Array.from(new Set([...(template.trustDefaults ?? []), ...defaults.trustLabels])),
    warnings: defaults.warnings,
    compatibilityNotes: defaults.compatibilityNotes,
  });
}

export function createPhiWriteChecklistTransformPacket({ markdown, template = {}, title = null }) {
  const source = createPhiWriteTransformSource({ markdown, template, title });
  const defaults = createTransformPacketDefaults('phiwrite_to_checklist');
  const payload = createChecklistFromMarkdown(markdown);

  return createTransformPacket({
    packetId: `packet_${source.artifactId}_to_checklist`,
    transformId: defaults.transformId,
    source,
    target: {
      artifactId: `checklist_${slugifyArtifactText(source.title)}`,
      title: `${source.title} Checklist`,
      app: defaults.targetApp,
      kind: defaults.targetKind,
    },
    payload,
    trustLabels: Array.from(new Set([...(template.trustDefaults ?? []), ...defaults.trustLabels])),
    warnings: defaults.warnings,
    compatibilityNotes: defaults.compatibilityNotes,
  });
}

export function createPhiWriteTransformSet({ markdown, template = {}, title = null }) {
  return {
    schema: PHIWRITE_TRANSFORMS_SCHEMA,
    createdAt: new Date().toISOString(),
    source: createPhiWriteTransformSource({ markdown, template, title }),
    packets: [
      createPhiWriteDeckTransformPacket({ markdown, template, title }),
      createPhiWriteReadmeTransformPacket({ markdown, template, title }),
      createPhiWriteChecklistTransformPacket({ markdown, template, title }),
    ],
  };
}
