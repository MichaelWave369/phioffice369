import { useMemo, useState } from 'react';
import {
  Bot,
  CalendarCheck,
  CheckCircle2,
  Database,
  FileText,
  FolderLock,
  Grid3X3,
  Layers3,
  Network,
  Newspaper,
  NotebookTabs,
  Search,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';

const apps = [
  {
    name: 'PhiWrite',
    role: 'Documents, specs, letters, PDFs',
    category: 'Create',
    status: 'v0.1 lite',
    icon: FileText,
    detail: 'Write specs, letters, public docs, structured notes, books, and PDF-ready artifacts.',
  },
  {
    name: 'PhiGrid',
    role: 'Spreadsheets, formulas, budgets, atlases',
    category: 'Analyze',
    status: 'v0.1 lite',
    icon: Grid3X3,
    detail: 'Build budgets, trackers, formula catalogs, ledgers, and simple dashboard-ready tables.',
  },
  {
    name: 'PhiDeck',
    role: 'Slides, posters, pitch decks',
    category: 'Present',
    status: 'v0.1 lite',
    icon: Layers3,
    detail: 'Turn specs and notes into visual decks, one-page explainers, and public launch posters.',
  },
  {
    name: 'PhiNotes',
    role: 'Research notebooks and idea gardens',
    category: 'Research',
    status: 'planned',
    icon: NotebookTabs,
    detail: 'Capture meeting notes, research trails, source maps, and living idea gardens.',
  },
  {
    name: 'PhiMap',
    role: 'Diagrams, flowcharts, system maps',
    category: 'Map',
    status: 'planned',
    icon: Network,
    detail: 'Create flowcharts, architecture maps, relationship graphs, and implementation diagrams.',
  },
  {
    name: 'PhiPress',
    role: 'Flyers, zines, print layouts',
    category: 'Publish',
    status: 'planned',
    icon: Newspaper,
    detail: 'Design flyers, zines, worksheets, one-pagers, and community-ready print layouts.',
  },
  {
    name: 'PhiBase',
    role: 'Local databases and dashboards',
    category: 'Organize',
    status: 'planned',
    icon: Database,
    detail: 'Build simple records, inventory tables, card catalogs, forms, and local dashboards.',
  },
  {
    name: 'PhiVault',
    role: 'Local file vault, tags, project folders',
    category: 'Protect',
    status: 'planned',
    icon: FolderLock,
    detail: 'Organize artifacts locally with tags, project folders, export receipts, and private mode.',
  },
  {
    name: 'PhiFlow',
    role: 'Tasks, calendar, reminders, workflow bridge',
    category: 'Coordinate',
    status: 'planned',
    icon: CalendarCheck,
    detail: 'Bridge artifacts into tasks, checklists, project rhythms, reminders, and future calendar flows.',
  },
  {
    name: 'Professor Phi',
    role: 'Assistant, editor, transformer, claim-checker',
    category: 'Assist',
    status: 'v0.1 panel',
    icon: Bot,
    detail: 'Draft, polish, transform, teach, analyze, and label claims while keeping the human in control.',
  },
];

const pillars = [
  ['Local-first', 'Your work stays yours. Offline-friendly, no forced login.'],
  ['Free core suite', 'Useful for families, students, creators, small business, and community projects.'],
  ['Trust panels', 'Separate human-written, AI-assisted, sourced, hypothesis, symbolic, and private content.'],
  ['Compatibility honesty', 'Import/export with visible reports instead of false promises.'],
  ['Living artifacts', 'Turn docs into decks, posters, reports, checklists, and handouts.'],
  ['Professor Phi', 'Warm, helpful, funny, disciplined AI assistance built into the suite.'],
];

const trustLabels = [
  { label: 'Human-written', tone: 'gold', description: 'Created directly by the user.' },
  { label: 'AI-assisted', tone: 'blue', description: 'Drafted, transformed, or polished with AI help.' },
  { label: 'Sourced', tone: 'green', description: 'Backed by visible references or project files.' },
  { label: 'Needs citation', tone: 'orange', description: 'Factual claim needs support before publishing.' },
  { label: 'Hypothesis', tone: 'purple', description: 'Plausible but unverified idea.' },
  { label: 'Symbolic', tone: 'pink', description: 'Mythic, metaphorical, artistic, or interface-layer meaning.' },
  { label: 'Private', tone: 'red', description: 'Sensitive or internal content.' },
  { label: 'Verified', tone: 'green', description: 'Checked against a trusted source or project record.' },
];

const transformations = [
  { from: 'Master spec', to: 'Pitch deck + README + task board', example: 'A product spec becomes a public launch packet.' },
  { from: 'Spreadsheet', to: 'Dashboard + report + chart deck', example: 'A family budget becomes a monthly plan.' },
  { from: 'Research notebook', to: 'Source map + article + presentation', example: 'Notes become a claim-disciplined explainer.' },
  { from: 'Diagram', to: 'Architecture spec + checklist', example: 'A system map becomes build tickets.' },
];

const roadmap = [
  ['v0.1', 'Identity MVP', 'Launcher shell, PhiWrite-lite, PhiGrid-lite, PhiDeck-lite, Professor Phi panel.'],
  ['v0.2', 'Artifact transformation', 'Spec-to-deck, grid-to-report, notes-to-doc, doc-to-poster workflows.'],
  ['v0.3', 'PhiVault + search', 'Local index, tags, project graph, related artifacts, private mode.'],
  ['v0.4', 'Compatibility lab', 'Evaluate DOCX/XLSX/PPTX with visible compatibility reports.'],
];

const tabs = ['Suite', 'Trust', 'Transform', 'Roadmap'];

function AppCard({ app, isSelected, onSelect }) {
  const Icon = app.icon;
  return (
    <button className={`app-card ${isSelected ? 'selected' : ''}`} type="button" onClick={onSelect}>
      <span className="app-card-topline">
        <Icon aria-hidden="true" />
        <span>{app.status}</span>
      </span>
      <span className="app-name">{app.name}</span>
      <span className="app-role">{app.role}</span>
    </button>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('Suite');
  const [query, setQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState(apps[0]);
  const [selectedTrustLabel, setSelectedTrustLabel] = useState(trustLabels[0]);

  const filteredApps = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return apps;
    return apps.filter((app) => `${app.name} ${app.role} ${app.category} ${app.detail}`.toLowerCase().includes(needle));
  }, [query]);

  return (
    <main className="shell">
      <section className="hero panel">
        <div className="orb orb-left" />
        <div className="orb orb-right" />
        <p className="eyebrow hero-mark">Φ369</p>
        <h1>PhiOffice369</h1>
        <p className="subtitle">A free, local-first, AI-assisted sovereign productivity suite.</p>
        <p className="codename">Internal codename: MikeySoft Office</p>
        <div className="hero-actions">
          <a href="https://github.com/MichaelWave369/phioffice369" target="_blank" rel="noreferrer">GitHub Repo</a>
          <a href="https://github.com/MichaelWave369/phioffice369/blob/main/ROADMAP.md" target="_blank" rel="noreferrer">Roadmap</a>
          <a href="https://github.com/MichaelWave369/phioffice369/tree/main/docs" target="_blank" rel="noreferrer">Docs</a>
        </div>
      </section>

      <section className="privacy panel">
        <ShieldCheck aria-hidden="true" />
        <div>
          <h2>Local-first promise</h2>
          <p>No forced login. No hidden cloud dependency. AI help should be labeled, controllable, and honest.</p>
        </div>
      </section>

      <nav className="tabs" aria-label="PhiOffice369 sections">
        {tabs.map((tab) => (
          <button key={tab} type="button" className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === 'Suite' && (
        <section className="section-block fade-in">
          <div className="section-heading split-heading">
            <div>
              <p className="eyebrow">Core apps</p>
              <h2>Build once. Transform ethically. Work sovereign.</h2>
            </div>
            <label className="search-box">
              <Search aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search apps, roles, workflows..." />
            </label>
          </div>

          <div className="app-grid">
            {filteredApps.map((app) => (
              <AppCard key={app.name} app={app} isSelected={selectedApp.name === app.name} onSelect={() => setSelectedApp(app)} />
            ))}
          </div>

          <aside className="detail-panel panel">
            <p className="eyebrow">Selected app</p>
            <h2>{selectedApp.name}</h2>
            <p>{selectedApp.detail}</p>
            <div className="metadata-row">
              <span>{selectedApp.category}</span>
              <span>{selectedApp.status}</span>
            </div>
          </aside>
        </section>
      )}

      {activeTab === 'Trust' && (
        <section className="section-block two-column fade-in">
          <div className="panel">
            <p className="eyebrow">Trust panel v0.1</p>
            <h2>Clear labels for human + AI work</h2>
            <div className="label-grid interactive-labels">
              {trustLabels.map((item) => (
                <button key={item.label} type="button" className={`label-chip ${selectedTrustLabel.label === item.label ? 'selected' : ''}`} onClick={() => setSelectedTrustLabel(item)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel trust-preview">
            <p className="eyebrow">Selected label</p>
            <h2>{selectedTrustLabel.label}</h2>
            <p>{selectedTrustLabel.description}</p>
            <div className={`trust-sample ${selectedTrustLabel.tone}`}>
              <CheckCircle2 aria-hidden="true" />
              <span>This artifact block is labeled: {selectedTrustLabel.label}</span>
            </div>
            <p className="note">The trust panel protects clarity, authorship, privacy, and public trust without shaming the user.</p>
          </div>
        </section>
      )}

      {activeTab === 'Transform' && (
        <section className="section-block fade-in">
          <div className="section-heading">
            <p className="eyebrow">Living artifact transformations</p>
            <h2>One artifact can become the next useful thing.</h2>
          </div>
          <div className="transformation-grid">
            {transformations.map((item) => (
              <article className="transform-card panel" key={item.from}>
                <Wand2 aria-hidden="true" />
                <p className="from">{item.from}</p>
                <p className="arrow">→</p>
                <h3>{item.to}</h3>
                <p>{item.example}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'Roadmap' && (
        <section className="section-block two-column fade-in">
          <div className="panel">
            <p className="eyebrow">Feature pillars</p>
            <div className="pillar-list">
              {pillars.map(([title, body]) => (
                <div className="pillar" key={title}>
                  <Sparkles aria-hidden="true" />
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel roadmap-panel">
            <p className="eyebrow">Roadmap</p>
            <div className="roadmap-list">
              {roadmap.map(([version, title, body]) => (
                <article className="roadmap-item" key={version}>
                  <span>{version}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
