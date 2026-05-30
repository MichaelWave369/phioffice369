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

export function getTrustLabelById(id) {
  return trustLabels.find((label) => label.id === id) ?? null;
}

export function createArtifactReceipt({ artifactId, title, app, labels = [], transformations = [] }) {
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
