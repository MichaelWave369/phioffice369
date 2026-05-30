export const starterTemplates = [
  {
    id: 'basic_project_spec',
    title: 'Basic Project Spec',
    app: 'PhiWrite',
    purpose: 'Turn an idea into a clear buildable spec.',
    trustDefaults: ['human_written', 'ai_assisted', 'needs_citation'],
    sections: ['Vision', 'Audience', 'Core Features', 'Local-first Notes', 'Risks', 'Next Build Tasks'],
  },
  {
    id: 'simple_family_budget',
    title: 'Simple Family Budget',
    app: 'PhiGrid',
    purpose: 'Create a calm monthly budget without financial shame.',
    trustDefaults: ['private', 'human_written'],
    sections: ['Income', 'Bills', 'Food', 'Savings', 'Debt', 'Kindness Money', 'Notes'],
  },
  {
    id: 'pitch_deck_outline',
    title: 'Pitch Deck Outline',
    app: 'PhiDeck',
    purpose: 'Convert a project into a short public-facing pitch.',
    trustDefaults: ['ai_assisted', 'needs_citation'],
    sections: ['Problem', 'Solution', 'Why Now', 'Demo', 'Roadmap', 'Ask'],
  },
  {
    id: 'meeting_notes',
    title: 'Meeting Notes',
    app: 'PhiNotes',
    purpose: 'Capture decisions, questions, and follow-up tasks.',
    trustDefaults: ['human_written', 'private'],
    sections: ['Attendees', 'Context', 'Decisions', 'Open Questions', 'Action Items'],
  },
  {
    id: 'public_launch_note',
    title: 'Public Launch Note',
    app: 'PhiWrite',
    purpose: 'Announce a project clearly without overclaiming.',
    trustDefaults: ['ai_assisted', 'needs_citation', 'human_written'],
    sections: ['What It Is', 'Who It Helps', 'Current Status', 'What Comes Next', 'Affiliation Notes'],
  },
  {
    id: 'claim_boundary_matrix',
    title: 'Claim Boundary Matrix',
    app: 'PhiGrid',
    purpose: 'Separate exact claims, assumptions, hypotheses, mappings, and non-claims.',
    trustDefaults: ['sourced', 'hypothesis', 'symbolic'],
    sections: ['Claim', 'Type', 'Evidence', 'Boundary', 'Publish Status'],
  },
  {
    id: 'game_design_one_pager',
    title: 'Game Design One-Pager',
    app: 'PhiWrite',
    purpose: 'Summarize a game concept in one usable page.',
    trustDefaults: ['human_written', 'ai_assisted', 'symbolic'],
    sections: ['Vibe', 'Player Fantasy', 'Core Loop', 'World', 'Systems', 'First Prototype'],
  },
  {
    id: 'small_business_proposal',
    title: 'Small Business Proposal',
    app: 'PhiWrite',
    purpose: 'Create a simple proposal for helpful client work.',
    trustDefaults: ['human_written', 'ai_assisted', 'private'],
    sections: ['Client Need', 'Scope', 'Deliverables', 'Timeline', 'Price', 'Next Step'],
  },
];

export function getTemplateById(id) {
  return starterTemplates.find((template) => template.id === id) ?? null;
}
