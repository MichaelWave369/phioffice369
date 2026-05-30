import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bot,
  CalendarCheck,
  Database,
  FileText,
  FolderLock,
  Grid3X3,
  Layers3,
  Network,
  Newspaper,
  NotebookTabs,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import './styles.css';

const apps = [
  { name: 'PhiWrite', role: 'Documents, specs, letters, PDFs', icon: FileText },
  { name: 'PhiGrid', role: 'Spreadsheets, formulas, budgets, atlases', icon: Grid3X3 },
  { name: 'PhiDeck', role: 'Slides, posters, pitch decks', icon: Layers3 },
  { name: 'PhiNotes', role: 'Research notebooks and idea gardens', icon: NotebookTabs },
  { name: 'PhiMap', role: 'Diagrams, flowcharts, system maps', icon: Network },
  { name: 'PhiPress', role: 'Flyers, zines, print layouts', icon: Newspaper },
  { name: 'PhiBase', role: 'Local databases and dashboards', icon: Database },
  { name: 'PhiVault', role: 'Local file vault, tags, project folders', icon: FolderLock },
  { name: 'PhiFlow', role: 'Tasks, calendar, reminders, workflow bridge', icon: CalendarCheck },
  { name: 'Professor Phi', role: 'Assistant, editor, transformer, claim-checker', icon: Bot },
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
  'Human-written',
  'AI-assisted',
  'Sourced',
  'Needs citation',
  'Hypothesis',
  'Symbolic',
  'Private',
  'Verified',
];

function AppCard({ app }) {
  const Icon = app.icon;
  return (
    <article className="app-card">
      <Icon aria-hidden="true" />
      <h3>{app.name}</h3>
      <p>{app.role}</p>
    </article>
  );
}

function App() {
  return (
    <main className="shell">
      <section className="hero panel">
        <div className="orb orb-left" />
        <div className="orb orb-right" />
        <p className="eyebrow">Φ369</p>
        <h1>PhiOffice369</h1>
        <p className="subtitle">A free, local-first, AI-assisted sovereign productivity suite.</p>
        <p className="codename">Internal codename: MikeySoft Office</p>
        <div className="hero-actions">
          <a href="../../ROADMAP.md">Roadmap</a>
          <a href="../../docs/PRODUCT_VISION.md">Product Vision</a>
          <a href="../../docs/TRUST_PANEL.md">Trust Panel</a>
        </div>
      </section>

      <section className="privacy panel">
        <ShieldCheck aria-hidden="true" />
        <div>
          <h2>Local-first promise</h2>
          <p>No forced login. No hidden cloud dependency. AI help should be labeled, controllable, and honest.</p>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <p className="eyebrow">Core apps</p>
          <h2>Build once. Transform ethically. Work sovereign.</h2>
        </div>
        <div className="app-grid">
          {apps.map((app) => (
            <AppCard key={app.name} app={app} />
          ))}
        </div>
      </section>

      <section className="section-block two-column">
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

        <div className="panel">
          <p className="eyebrow">Trust panel v0.1</p>
          <h2>Clear labels for human + AI work</h2>
          <div className="label-grid">
            {trustLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <p className="note">The trust panel protects clarity, authorship, privacy, and public trust without shaming the user.</p>
        </div>
      </section>

      <section className="section-block two-column">
        <div className="panel">
          <p className="eyebrow">MVP v0.1</p>
          <h2>What ships first</h2>
          <ul className="checklist">
            <li>Launcher shell</li>
            <li>PhiWrite-lite</li>
            <li>PhiGrid-lite</li>
            <li>PhiDeck-lite</li>
            <li>Template packs</li>
            <li>Trust panel</li>
            <li>Local-only privacy controls</li>
          </ul>
        </div>

        <div className="panel">
          <p className="eyebrow">Professor Phi</p>
          <h2>Built-in assistant layer</h2>
          <p>Draft, polish, transform, analyze, claim-check, teach, and build — while keeping user approval and source clarity at the center.</p>
          <button type="button">Professor Phi panel placeholder</button>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
