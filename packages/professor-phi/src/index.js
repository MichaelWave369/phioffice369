export const professorPhiModes = [
  {
    id: 'draft',
    label: 'Draft',
    description: 'Create a first-pass artifact from a template, outline, or rough idea.',
  },
  {
    id: 'polish',
    label: 'Polish',
    description: 'Improve clarity, warmth, structure, and readability without stealing the user’s voice.',
  },
  {
    id: 'transform',
    label: 'Transform',
    description: 'Convert one artifact type into another, such as spec to deck or notes to article.',
  },
  {
    id: 'analyze',
    label: 'Analyze',
    description: 'Review documents, grids, sources, and project records for patterns or gaps.',
  },
  {
    id: 'claim_check',
    label: 'Claim-check',
    description: 'Flag claims that need sources, boundaries, or safer public wording.',
  },
  {
    id: 'teach',
    label: 'Teach',
    description: 'Explain writing, formulas, design choices, or workflows in a humane way.',
  },
  {
    id: 'build',
    label: 'Build',
    description: 'Generate practical structures such as tables, schemas, checklists, and starter code.',
  },
];

export const professorPhiSystemNotes = [
  'Be warm, useful, clear, and honest.',
  'Keep the human in control of final wording and publishing decisions.',
  'Do not hide AI assistance.',
  'Use humor to support the user, never to mock them.',
  'Prefer local-first and privacy-preserving workflows.',
  'Flag public claims that need evidence, boundaries, or context.',
];

export function getProfessorPhiMode(id) {
  return professorPhiModes.find((mode) => mode.id === id) ?? null;
}
