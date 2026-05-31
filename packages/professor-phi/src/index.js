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

export const PROFESSOR_PHI_MOCK_RESPONSE_SCHEMA = 'phioffice369.professor_phi_mock_response.v0.1';

export function getProfessorPhiMode(id) {
  return professorPhiModes.find((mode) => mode.id === id) ?? null;
}

export function normalizeProfessorPhiInput(value) {
  return String(value ?? '').trim();
}

export function createProfessorPhiPromptSummary(prompt, maxLength = 140) {
  const normalized = normalizeProfessorPhiInput(prompt).replace(/\s+/g, ' ');
  if (!normalized) return 'No prompt provided yet.';
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

export function getProfessorPhiModeInstruction(modeId) {
  const mode = getProfessorPhiMode(modeId) ?? professorPhiModes[0];

  const instructions = {
    draft: 'I would turn this into a clean first draft with a clear opening, useful sections, and a gentle next step.',
    polish: 'I would keep your voice intact, then tighten structure, warmth, clarity, and public readability.',
    transform: 'I would convert the idea into a new artifact shape, such as a deck, checklist, README, or launch packet.',
    analyze: 'I would look for patterns, gaps, risks, missing context, and the next practical move.',
    claim_check: 'I would separate supported claims, assumptions, hypotheses, symbolic language, and items needing sources.',
    teach: 'I would explain the idea step by step in plain language, then give one small practice move.',
    build: 'I would turn this into a usable structure: schema, checklist, table, component plan, or starter implementation.',
  };

  return instructions[mode.id] ?? instructions.draft;
}

export function createProfessorPhiMockResponse({ prompt = '', modeId = 'draft' } = {}) {
  const mode = getProfessorPhiMode(modeId) ?? professorPhiModes[0];
  const summary = createProfessorPhiPromptSummary(prompt);
  const emptyPrompt = normalizeProfessorPhiInput(prompt).length === 0;

  return {
    schema: PROFESSOR_PHI_MOCK_RESPONSE_SCHEMA,
    createdAt: new Date().toISOString(),
    modeId: mode.id,
    modeLabel: mode.label,
    trustLabel: 'ai_assisted',
    publishRisk: mode.id === 'claim_check' ? 'medium' : 'low',
    localOnly: true,
    promptSummary: summary,
    response: emptyPrompt
      ? `I’m here, my friend. Choose a mode, type what you want help with, and I’ll give a local demo response without sending anything to a server.`
      : `Professor Phi mock response (${mode.label} mode): ${getProfessorPhiModeInstruction(mode.id)}\n\nWorking note: “${summary}”\n\nTrust note: this is AI-assisted demo guidance. Review before publishing, and add sources for factual claims.`,
  };
}
