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
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { createArtifactReceipt, trustLabels } from '@phioffice369/core';
import { professorPhiModes, professorPhiSystemNotes } from '@phioffice369/professor-phi';
import { starterTemplates } from '@phioffice369/templates';
import PhiWriteLite from './components/PhiWriteLite.jsx';
import './interactive.css';

const appIcons = {
  PhiWrite: FileText,
  PhiGrid: Grid3X3,
  PhiDeck: Layers3,
  PhiNotes: NotebookTabs,
  PhiMap: Network,
  PhiPress: Newspaper,
  PhiBase: Database,
  PhiVault: FolderLock,
  PhiFlow: CalendarCheck,
  'Professor Phi': Bot,
};

const apps = [
  {
    name: 'PhiWrite',
    role: 'Documents, specs, letters, PDFs',
    category: 'Create',
    status: 'v0.1 lite',
    detail: 'Write specs, letters, public docs, structured notes, books, and PDF-ready artifacts.',
  },
  {
    name: 'PhiGrid',
    role: 'Spreadsheets, formulas, budgets, atlases',
    category: 'Analyze',
    status: 'v0.1 lite',
    detail: 'Build budgets, trackers, formula catalogs, ledgers, and simple dashboard-ready tables.',
  },
  {
    name: 'PhiDeck',
    role: 'Slides, posters, pitch decks',
    category: 'Present',
    status: 'v0.1 lite',
    detail: 'Turn specs and notes into visual decks, one-page explainers, and public launch posters.',
  },
  {
    name: 'PhiNotes',
    role: 'Research notebooks and idea gardens',
    category: 'Research',
    status: 'planned',
    detail: 'Capture meeting notes, research trails, source maps, and living idea gardens.',
  },
  {
    name: 'PhiMap',
    role: 'Diagrams, flowcharts, system maps',
    category: 'Map',
    status: 'planned',
    detail: 'Create flowcharts, architecture maps, relationship graphs, and implementation diagrams.',
  },
  {
    name: 'PhiPress',
    role: 'Flyers, zines, print layouts',
    category: 'Publish',
    status: 'planned',
    detail: 'Design flyers, zines, worksheets, one-pagers, and community-ready print layouts.',
  },
  {
    name: 'PhiBase',
    role: 'Local databases and dashboards',
    category: 'Organize',
    status: 'planned',
    detail: 'Build simple records, inventory tables, card catalogs, forms, and local dashboards.',
  },
  {
    name: 'PhiVault',
    role: 'Local file vault, tags, project folders',
    category: 'Protect',
    status: 'planned',
    detail: 'Organize artifacts locally with tags, project folders, export receipts, and private mode.',
  },
  {
    name: 'PhiFlow',
    role: 'Tasks, calendar, reminders, workflow bridge',
    category: 'Coordinate',
    status: 'planned',
    detail: 'Bridge artifacts into tasks, checklists, project rhythms, reminders, and future calendar flows.',
  },
  {
    name: 'Professor Phi',
    role: 'Assistant, editor, transformer, claim-checker',
    category: 'Assist',
    status: 'v0.1 panel',
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

const tabs = ['Suite', 'Templates', 'Trust', 'Professor Phi', 'Transform', 'Roadmap'];

function AppCard({ app, isSelected, onSelect }) {
  const Icon = appIcons[app.name] ?? Sparkles;
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
  const [templateQuery, setTemplateQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState(apps[0]);
  const [selectedTrustLabel, setSelectedTrustLabel] = useState(trustLabels[0]);
  const [selectedTemplate, setSelectedTemplate] = useState(starterTemplates[0]);
  const [selectedMode, setSelectedMode] = useState(professorPhiModes[0]);
  const [activeWorkspaceTemplate, setActiveWorkspaceTemplate] = useState(null);

  const filteredApps = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return apps;
    return apps.filter((app) => `${app.name} ${app.role} ${app.category} ${app.detail}`.toLowerCase().includes(needle));
  }, [query]);

  const filteredTemplates = useMemo(() => {
    const needle = templateQuery.trim().toLowerCase();
    if (!needle) return starterTemplates;
    return starterTemplates.filter((template) => `${template.title} ${template.app} ${template.purpose} ${template.sections.join(' ')}`.toLowerCase().includes(needle));
  }, [templateQuery]);

  const receiptPreview = useMemo(() => createArtifactReceipt({
    artifactId: selectedTemplate.id,
    title: selectedTemplate.title,
    app: selectedTemplate.app,
    labels: selectedTemplate.trustDefaults,
    transformations: ['template_to_artifact_preview'],
  }), [selectedTemplate]);

  if (activeWorkspaceTemplate) {
    return (
      <main className="shell">
        <PhiWriteLite template={activeWorkspaceTemplate} onBack={() => setActiveWorkspaceTemplate(null)} />
      </main>
    );
  }

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

      {activeTab === 'Templates' && (
        <section className="section-block fade-in">
          <div className="section-heading split-heading">
            <div>
              <p className="eyebrow">Starter templates</p>
              <h2>Useful artifacts from day one.</h2>
            </div>
            <label className="search-box">
              <Search aria-hidden="true" />
              <input value={templateQuery} onChange={(event) => setTemplateQuery(event.target.value)} placeholder="Search templates..." />
            </label>
          </div>

          <div className="template-layout">
            <div className="template-list">
              {filteredTemplates.map((template) => (
                <button key={template.id} className={`template-card panel ${selectedTemplate.id === template.id ? 'selected' : ''}`} type="button" onClick={() => setSelectedTemplate(template)}>
                  <span className="template-app">{template.app}</span>
                  <strong>{template.title}</strong>
                  <span>{template.purpose}</span>
                </button>
              ))}
            </div>

            <aside className="panel template-preview">
              <p className="eyebrow">Template preview</p>
              <h2>{selectedTemplate.title}</h2>
              <p>{selectedTemplate.purpose}</p>
              <div className="section-chip-grid">
                {selectedTemplate.sections.map((section) => <span key={section}>{section}</span>)}
              </div>
              <div className="receipt-box">
                <ReceiptText aria-hidden="true" />
                <div>
                  <h3>Artifact receipt preview</h3>
                  <code>{receiptPreview.schema}</code>
                  <p>{receiptPreview.app} · {receiptPreview.labels.length} trust labels · {receiptPreview.transformations[0]}</p>
                </div>
              </div>
              <button className="open-workspace-button" type="button" onClick={() => setActiveWorkspaceTemplate(selectedTemplate)}>
                Open in PhiWrite-lite
              </button>
            </aside>
          </div>
        </section>
      )}

      {activeTab === 'Trust' && (
        <section className="section-block two-column fade-in">
          <div className="panel">
            <p className="eyebrow">Trust panel v0.1</p>
            <h2>Clear labels for human + AI work</h2>
            <div className="label-grid interactive-labels">
              {trustLabels.map((item) => (
                <button key={item.id} type="button" className={`label-chip ${selectedTrustLabel.id === item.id ? 'selected' : ''}`} onClick={() => setSelectedTrustLabel(item)}>
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
            <div className="metadata-row"><span>Publish risk: {selectedTrustLabel.publishRisk}</span></div>
            <p className="note">The trust panel protects clarity, authorship, privacy, and public trust without shaming the user.</p>
          </div>
        </section>
      )}

      {activeTab === 'Professor Phi' && (
        <section className="section-block two-column fade-in">
          <div className="panel">
            <p className="eyebrow">Professor Phi modes</p>
            <h2>Assistant behavior with boundaries.</h2>
            <div className="mode-list">
              {professorPhiModes.map((mode) => (
                <button key={mode.id} type="button" className={`mode-card ${selectedMode.id === mode.id ? 'selected' : ''}`} onClick={() => setSelectedMode(mode)}>
                  <strong>{mode.label}</strong>
                  <span>{mode.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel professor-panel">
            <p className="eyebrow">Selected mode</p>
            <h2>{selectedMode.label}</h2>
            <p>{selectedMode.description}</p>
            <div className="professor-note-box">
              <Bot aria-hidden="true" />
              <p>Professor Phi helps create, transform, explain, and verify — while keeping the user sovereign over final choices.</p>
            </div>
            <ul className="system-notes">
              {professorPhiSystemNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
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
