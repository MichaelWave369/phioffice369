import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  CalendarCheck,
  CheckCircle2,
  Database,
  FileText,
  FilePlus2,
  Clock3,
  FolderLock,
  Grid3X3,
  Layers3,
  Network,
  Newspaper,
  NotebookTabs,
  ReceiptText,
  Search,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { createArtifactReceipt, trustLabels } from '@phioffice369/core';
import { professorPhiModes, professorPhiSystemNotes } from '@phioffice369/professor-phi';
import { blankWorkspaceTemplates, starterTemplates } from '@phioffice369/templates';
import PhiWriteLite from './components/PhiWriteLite.jsx';
import PhiGridLite from './components/PhiGridLite.jsx';
import PhiDeckLite from './components/PhiDeckLite.jsx';
import PhiVaultLite from './components/PhiVaultLite.jsx';
import ShortcutHelpOverlay from './components/ShortcutHelpOverlay.jsx';
import DataSovereigntyStatusBar from './components/DataSovereigntyStatusBar.jsx';
import ProfessorPhiPanel from './components/ProfessorPhiPanel.jsx';
import {
  getAppReadinessBadge,
  getAppReadinessMessage,
  shouldAllowAppSelection,
} from './lib/appReadiness.js';
import {
  getTabShortcutIndex,
  shouldCloseOverlay,
  shouldFocusSearch,
  shouldOpenShortcutHelp,
} from './lib/keyboardShortcuts.js';
import {
  makeIndependentWorkspaceTemplate,
  resolveRecentWorkspaceTemplate,
  scanRecentWorkspaces,
} from './lib/recentWorkspaces.js';
import { readWorkspaceRecord } from './lib/workspaceRecords.js';
import { readTransactionalDraft } from './lib/transactionalDraftStore.js';
import { readTransactionalWorkspace } from './lib/transactionalWorkspace.js';
import { resolveSuiteLaunch } from './lib/suiteLaunch.js';
import { useWorkspaceAppearance } from './lib/useWorkspaceAppearance.js';
import EcosystemConnections from './components/EcosystemConnections.jsx';
import WorkspaceHeader from './components/WorkspaceHeader.jsx';
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
  { name: 'PhiWrite', role: 'Documents, specs, letters, PDFs', category: 'Create', status: 'Local editor', detail: 'Write specs, letters, public docs, structured notes, books, and PDF-ready artifacts.' },
  { name: 'PhiGrid', role: 'Spreadsheets, formulas, budgets, atlases', category: 'Analyze', status: 'Local editor', detail: 'Build budgets, trackers, formula catalogs, ledgers, and simple dashboard-ready tables.' },
  { name: 'PhiDeck', role: 'Slides, posters, pitch decks', category: 'Present', status: 'Local editor', detail: 'Turn specs and notes into visual decks, one-page explainers, and public launch posters.' },
  { name: 'PhiNotes', role: 'Research notebooks and idea gardens', category: 'Research', status: 'planned', detail: 'Capture meeting notes, research trails, source maps, and living idea gardens.' },
  { name: 'PhiMap', role: 'Diagrams, flowcharts, system maps', category: 'Map', status: 'planned', detail: 'Create flowcharts, architecture maps, relationship graphs, and implementation diagrams.' },
  { name: 'PhiPress', role: 'Flyers, zines, print layouts', category: 'Publish', status: 'planned', detail: 'Design flyers, zines, worksheets, one-pagers, and community-ready print layouts.' },
  { name: 'PhiBase', role: 'Local databases and dashboards', category: 'Organize', status: 'planned', detail: 'Build simple records, inventory tables, card catalogs, forms, and local dashboards.' },
  { name: 'PhiVault', role: 'Local file vault, tags, project folders', category: 'Protect', status: 'Local files', detail: 'Organize artifacts locally with tags, project folders, export receipts, and private mode.' },
  { name: 'PhiFlow', role: 'Tasks, calendar, reminders, workflow bridge', category: 'Coordinate', status: 'planned', detail: 'Bridge artifacts into tasks, checklists, project rhythms, reminders, and future calendar flows.' },
  { name: 'Professor Phi', role: 'Assistant, editor, transformer, claim-checker', category: 'Assist', status: 'Demo', detail: 'Draft, polish, transform, teach, analyze, and label claims while keeping the human in control.' },
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
  ['v0.1', 'Identity MVP', 'Launcher shell, PhiWrite-lite, PhiGrid-lite, PhiVault-lite, PhiDeck preview.'],
  ['v0.2', 'Artifact transformation', 'Imports, receipt timeline, shared artifact registry, standalone PhiDeck-lite.'],
  ['v0.3', 'PhiVault + search', 'Local index, tags, project graph, related artifacts, private mode.'],
  ['v0.4', 'Compatibility lab', 'Evaluate DOCX/XLSX/PPTX with visible compatibility reports.'],
];

const tabs = ['Suite', 'Templates', 'Vault', 'Trust', 'Professor Phi', 'Transform', 'Roadmap'];

function AppCard({ app, isSelected, onSelect }) {
  const Icon = appIcons[app.name] ?? Sparkles;
  const isReady = shouldAllowAppSelection(app);
  return (
    <button
      className={`app-card ${isSelected ? 'selected' : ''} ${isReady ? 'ready' : 'planned'}`}
      type="button"
      onClick={isReady ? onSelect : undefined}
      disabled={!isReady}
      aria-disabled={!isReady}
      aria-pressed={isReady ? isSelected : undefined}
      title={getAppReadinessMessage(app)}
    >
      <span className="app-card-topline"><Icon aria-hidden="true" /><span>{getAppReadinessBadge(app)}</span></span>
      <span className="app-name">{app.name}</span>
      <span className="app-role">{app.role}</span>
      {!isReady && <span className="app-coming-soon">Placeholder preview</span>}
    </button>
  );
}

function getWorkspaceKind(template) {
  if (template.app === 'PhiGrid') return 'grid';
  if (template.app === 'PhiDeck') return 'deck';
  return 'write';
}

function getOpenButtonLabel(template) {
  if (template.app === 'PhiGrid') return 'Open in PhiGrid-lite';
  if (template.app === 'PhiDeck') return 'Open in PhiDeck-lite';
  return 'Open in PhiWrite-lite';
}

function createBridgeDeckTemplate(deckPayload) {
  return {
    id: `bridge_${deckPayload.sourceTemplateId ?? 'phiwrite'}_deck`,
    title: deckPayload.title ?? 'PhiWrite Deck',
    sourceTemplateId: deckPayload.sourceTemplateId,
    app: 'PhiDeck',
    purpose: `Generated from ${deckPayload.sourceTemplateTitle ?? 'PhiWrite-lite draft'}.`,
    trustDefaults: deckPayload.trustDefaults ?? ['ai_assisted', 'needs_citation'],
    sections: deckPayload.slides?.map((slide) => slide.title) ?? ['Opening', 'Core Idea', 'Next Step'],
  };
}

export default function App() {
  const suiteSearchRef = useRef(null);
  const templateSearchRef = useRef(null);
  const recentScan = useRef(0);
  const [launchTarget] = useState(() => resolveSuiteLaunch(window.location.search));
  const [appearance, changeAppearance] = useWorkspaceAppearance();
  const [activeTab, setActiveTab] = useState(launchTarget === 'PhiVault' ? 'Vault' : launchTarget === 'Professor Phi' ? launchTarget : 'Suite');
  const [query, setQuery] = useState('');
  const [templateQuery, setTemplateQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState(() => apps.find((app) => app.name === launchTarget) ?? apps[0]);
  const [suiteTemplateId, setSuiteTemplateId] = useState('');
  const [selectedTrustLabel, setSelectedTrustLabel] = useState(trustLabels[0]);
  const [selectedTemplate, setSelectedTemplate] = useState(starterTemplates[0]);
  const [selectedMode, setSelectedMode] = useState(professorPhiModes[0]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [fileNotice, setFileNotice] = useState('');
  const [recentFiles, setRecentFiles] = useState(() => scanRecentWorkspaces());

  const filteredApps = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return apps;
    return apps.filter((app) => `${app.name} ${app.role} ${app.category} ${app.detail} ${getAppReadinessBadge(app)}`.toLowerCase().includes(needle));
  }, [query]);

  const filteredTemplates = useMemo(() => {
    const needle = templateQuery.trim().toLowerCase();
    if (!needle) return starterTemplates;
    return starterTemplates.filter((template) => `${template.title} ${template.app} ${template.purpose} ${template.sections.join(' ')}`.toLowerCase().includes(needle));
  }, [templateQuery]);

  const suiteTemplates = useMemo(
    () => starterTemplates.filter((template) => template.app === selectedApp.name),
    [selectedApp],
  );
  const suiteTemplate = suiteTemplates.find((template) => template.id === suiteTemplateId) ?? suiteTemplates[0];

  const receiptPreview = useMemo(() => createArtifactReceipt({
    artifactId: selectedTemplate.id,
    title: selectedTemplate.title,
    app: selectedTemplate.app,
    labels: selectedTemplate.trustDefaults,
    transformations: ['template_to_artifact_preview'],
  }), [selectedTemplate]);

  function openSelectedApp() {
    if (selectedApp.name === 'PhiVault' || selectedApp.name === 'Professor Phi') {
      setActiveTab(selectedApp.name === 'PhiVault' ? 'Vault' : 'Professor Phi');
      return;
    }
    if (!suiteTemplate) return;
    setActiveWorkspace({ kind: getWorkspaceKind(suiteTemplate), template: suiteTemplate });
  }

  function createNewFile(template) {
    const newTemplate = makeIndependentWorkspaceTemplate(template);
    setActiveWorkspace({ kind: getWorkspaceKind(newTemplate), template: newTemplate });
  }

  const refreshRecentFiles = useCallback(async () => {
    const revision = ++recentScan.current;
    try {
      const { files } = await readTransactionalWorkspace();
      if (revision === recentScan.current) setRecentFiles(scanRecentWorkspaces({ transactionalFiles: files }));
    } catch {
      if (revision === recentScan.current) setRecentFiles(scanRecentWorkspaces());
    }
  }, []);

  useEffect(() => {
    void refreshRecentFiles();
  }, [refreshRecentFiles]);

  async function openRecentFile(entry) {
    const transactional = entry.revision !== undefined;
    try {
      const standard = readWorkspaceRecord(entry.key);
      const loaded = transactional ? await readTransactionalDraft(entry.key) : standard;
      if (loaded.state !== 'saved' || (transactional && standard.raw !== null)) {
        throw new Error('File changed or is unavailable.');
      }
      setFileNotice('');
      const template = resolveRecentWorkspaceTemplate(entry);
      setActiveWorkspace({ kind: getWorkspaceKind(template), template, loadedFile: transactional ? loaded : undefined });
    } catch {
      void refreshRecentFiles();
      setFileNotice('That file is no longer available. Check PhiVault for recovery options.');
    }
  }

  function closeWorkspace() {
    setActiveWorkspace(null);
    void refreshRecentFiles();
  }

  function openBridgeDeck(deckPayload) {
    const template = makeIndependentWorkspaceTemplate(createBridgeDeckTemplate(deckPayload));
    const trace = deckPayload.trace && { ...deckPayload.trace, targetArtifactId: `deck_${template.id}` };
    setActiveWorkspace({ kind: 'deck', template, initialDeck: { ...deckPayload, trace } });
  }

  function focusActiveSearch() {
    if (activeTab === 'Suite') suiteSearchRef.current?.focus();
    if (activeTab === 'Templates') templateSearchRef.current?.focus();
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.defaultPrevented) return;
      if (shouldCloseOverlay(event) && showShortcuts) {
        event.preventDefault();
        setShowShortcuts(false);
        return;
      }

      if (shouldOpenShortcutHelp(event)) {
        event.preventDefault();
        setShowShortcuts(true);
        return;
      }

      if (!activeWorkspace && ['Suite', 'Templates'].includes(activeTab) && shouldFocusSearch(event)) {
        event.preventDefault();
        focusActiveSearch();
        return;
      }

      if (activeWorkspace) return;
      const tabIndex = getTabShortcutIndex(event, tabs.length);
      if (tabIndex >= 0) {
        event.preventDefault();
        setActiveTab(tabs[tabIndex]);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, activeWorkspace, showShortcuts]);

  const brandbar = <WorkspaceHeader appearance={appearance} onAppearance={changeAppearance} onShortcuts={() => setShowShortcuts(true)} />;

  if (activeWorkspace) {
    return (
      <main className="shell">
        {brandbar}
        <div id="workspace-content" tabIndex={-1}>
        {activeWorkspace.kind === 'grid'
          ? <PhiGridLite key={activeWorkspace.template.id} template={activeWorkspace.template} loadedFile={activeWorkspace.loadedFile} onBack={closeWorkspace} />
          : activeWorkspace.kind === 'deck'
            ? <PhiDeckLite key={activeWorkspace.template.id} template={activeWorkspace.template} loadedFile={activeWorkspace.loadedFile} initialDeck={activeWorkspace.initialDeck} onBack={closeWorkspace} />
            : <PhiWriteLite key={activeWorkspace.template.id} template={activeWorkspace.template} loadedFile={activeWorkspace.loadedFile} onOpenDeck={openBridgeDeck} onBack={closeWorkspace} />}
        </div>
        <ShortcutHelpOverlay isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
        <DataSovereigntyStatusBar refreshKey={recentFiles} />
      </main>
    );
  }

  return (
    <main className="shell">
      <ShortcutHelpOverlay isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
      {brandbar}
      <nav className="tabs" aria-label="PhiOffice369 sections">{tabs.map((tab, index) =>
        <button key={tab} type="button" className={activeTab === tab ? 'active' : ''}
          aria-current={activeTab === tab ? 'page' : undefined} onClick={() => setActiveTab(tab)} title={`Ctrl/⌘ + ${index + 1}`}>{tab}</button>
      )}</nav>
      <div id="workspace-content" tabIndex={-1}>

      {fileNotice && <p className="note" role="status">{fileNotice}</p>}

      {activeTab === 'Suite' && (
        <section className="suite-dashboard fade-in">
          <div className="workspace-welcome panel">
            <div>
              <p className="eyebrow">The local office</p>
              <h1>Make room for good work.</h1>
              <p>Write, calculate, and present in your own browser workspace. Your files stay with you.</p>
            </div>
            <div className="workspace-quick-start" aria-label="Create a blank file">
              {blankWorkspaceTemplates.map((template) => {
                const Icon = appIcons[template.app];
                return <button type="button" key={template.id} onClick={() => createNewFile(template)}>
                  <Icon aria-hidden="true" /><span>New {template.title.replace('Untitled ', '')}</span>
                </button>;
              })}
            </div>
          </div>
          <div className="suite-dashboard-grid">
            <section className="suite-launcher panel" aria-label="App launcher">
              <div className="section-heading split-heading">
                <div><p className="eyebrow">Office tools</p><h2>App launcher</h2></div>
                <label className="search-box"><Search aria-hidden="true" /><input ref={suiteSearchRef} value={query}
                  onChange={(event) => setQuery(event.target.value)} aria-label="Search apps" placeholder="Search apps" /></label>
              </div>
              <div className="app-grid">{filteredApps.filter(shouldAllowAppSelection).map((app) =>
                <AppCard key={app.name} app={app} isSelected={selectedApp.name === app.name} onSelect={() => setSelectedApp(app)} />)}</div>
              {!filteredApps.some(shouldAllowAppSelection) && <p className="note">No available apps match this search.</p>}
          <aside className="detail-panel panel">
            <p className="eyebrow">Selected app</p><h2>{selectedApp.name}</h2><p>{selectedApp.detail}</p>
            <div className="metadata-row"><span>{selectedApp.category}</span><span>{getAppReadinessBadge(selectedApp)}</span></div>
            <p className="note">{getAppReadinessMessage(selectedApp)}</p>
            {suiteTemplate && (
              <div className="suite-launch-controls">
                <label htmlFor="suite-template-picker">Choose a starter template</label>
                <select id="suite-template-picker" className="suite-template-picker" value={suiteTemplate.id}
                  onChange={(event) => setSuiteTemplateId(event.target.value)}>
                  {suiteTemplates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}
                </select>
                <p className="note">Opening a template resumes its saved draft in this browser. Export a backup before clearing browser data.</p>
                <button className="open-workspace-button" type="button" onClick={openSelectedApp}>
                  Open {selectedApp.name}
                </button>
                <button className="suite-new-file-button" type="button" onClick={() => createNewFile(suiteTemplate)}>
                  <FilePlus2 aria-hidden="true" /> New {selectedApp.name} file
                </button>
              </div>
            )}
            {(selectedApp.name === 'PhiVault' || selectedApp.name === 'Professor Phi') && (
              <button className="open-workspace-button" type="button" onClick={openSelectedApp}>Open {selectedApp.name}</button>
            )}
          </aside>
            </section>
          <section className="recent-files-panel panel" aria-label="Recent files">
            <div className="recent-files-heading">
              <div>
                <p className="eyebrow">Your browser-local workspace</p>
                <h2><Clock3 aria-hidden="true" /> Recent files</h2>
              </div>
              <span>{recentFiles.length} saved file{recentFiles.length === 1 ? '' : 's'}</span>
            </div>
            {recentFiles.length ? (
              <div className="recent-files-list">
                {recentFiles.slice(0, 16).map((file) => (
                  <button className="recent-file-open" type="button" key={file.key}
                    onClick={() => openRecentFile(file)} title={'Open ' + file.title + ' in ' + file.app}>
                    <span className="recent-file-name">{file.title}</span>
                    <span className="recent-file-meta">{file.app} · {file.updatedAt && file.sortTime
                      ? new Date(file.sortTime).toLocaleString() : 'Local draft'} · {file.revision !== undefined ? 'IndexedDB revision ' + file.revision : file.isIndependent ? 'Independent file' : 'Legacy template draft'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="recent-empty"><FolderLock aria-hidden="true" /><h3>No saved files yet</h3>
                <p>Create a blank file above or choose a template to start.</p></div>
            )}
            {recentFiles.length > 16 && <p className="note">Showing the 16 most recently edited files.</p>}
            <p className="note">Files remain in this browser. Export a workspace backup from PhiVault before clearing site data or changing devices.</p>
          </section>
          </div>
          {filteredApps.some((app) => !shouldAllowAppSelection(app)) && (
            <details className="ecosystem-connections panel">
              <summary>Planned applications</summary>
              <div className="app-grid">{filteredApps.filter((app) => !shouldAllowAppSelection(app)).map((app) =>
                <AppCard key={app.name} app={app} isSelected={false} />)}</div>
            </details>
          )}
          <EcosystemConnections />
        </section>
      )}

      {activeTab === 'Templates' && (
        <section className="section-block fade-in">
          <div className="section-heading split-heading"><div><p className="eyebrow">Starter templates</p><h2>Useful artifacts from day one.</h2></div><label className="search-box"><Search aria-hidden="true" /><input ref={templateSearchRef} value={templateQuery} onChange={(event) => setTemplateQuery(event.target.value)} aria-label="Search templates" placeholder="Search templates..." /></label></div>
          <div className="template-layout">
            <div className="template-list">{filteredTemplates.map((template) => <button key={template.id} className={`template-card panel ${selectedTemplate.id === template.id ? 'selected' : ''}`} type="button" onClick={() => setSelectedTemplate(template)}><span className="template-app">{template.app}</span><strong>{template.title}</strong><span>{template.purpose}</span></button>)}</div>
            <aside className="panel template-preview">
              <p className="eyebrow">Template preview</p><h2>{selectedTemplate.title}</h2><p>{selectedTemplate.purpose}</p>
              <div className="section-chip-grid">{selectedTemplate.sections.map((section) => <span key={section}>{section}</span>)}</div>
              <div className="receipt-box"><ReceiptText aria-hidden="true" /><div><h3>Artifact receipt preview</h3><code>{receiptPreview.schema}</code><p>{receiptPreview.app} · {receiptPreview.labels.length} trust labels · {receiptPreview.transformations[0]}</p></div></div>
              <button className="open-workspace-button" type="button" onClick={() => setActiveWorkspace({ kind: getWorkspaceKind(selectedTemplate), template: selectedTemplate })}>{getOpenButtonLabel(selectedTemplate)}</button>
              {['PhiWrite', 'PhiGrid', 'PhiDeck'].includes(selectedTemplate.app) && (
                <button className="suite-new-file-button" type="button" onClick={() => createNewFile(selectedTemplate)}>
                  <FilePlus2 aria-hidden="true" /> Create independent file
                </button>
              )}
            </aside>
          </div>
        </section>
      )}

      {activeTab === 'Vault' && <PhiVaultLite onOpenFile={openRecentFile} onFilesChanged={refreshRecentFiles} />}

      {activeTab === 'Trust' && (
        <section className="section-block two-column fade-in"><div className="panel"><p className="eyebrow">Trust panel v0.1</p><h2>Clear labels for human + AI work</h2><div className="label-grid interactive-labels">{trustLabels.map((item) => <button key={item.id} type="button" className={`label-chip ${selectedTrustLabel.id === item.id ? 'selected' : ''}`} onClick={() => setSelectedTrustLabel(item)}>{item.label}</button>)}</div></div><div className="panel trust-preview"><p className="eyebrow">Selected label</p><h2>{selectedTrustLabel.label}</h2><p>{selectedTrustLabel.description}</p><div className={`trust-sample ${selectedTrustLabel.tone}`}><CheckCircle2 aria-hidden="true" /><span>This artifact block is labeled: {selectedTrustLabel.label}</span></div><div className="metadata-row"><span>Publish risk: {selectedTrustLabel.publishRisk}</span></div><p className="note">The trust panel protects clarity, authorship, privacy, and public trust without shaming the user.</p></div></section>
      )}

      {activeTab === 'Professor Phi' && (
        <ProfessorPhiPanel
          modes={professorPhiModes}
          systemNotes={professorPhiSystemNotes}
          selectedMode={selectedMode}
          onSelectMode={setSelectedMode}
        />
      )}

      {activeTab === 'Transform' && (
        <section className="section-block fade-in"><div className="section-heading"><p className="eyebrow">Living artifact transformations</p><h2>One artifact can become the next useful thing.</h2></div><div className="transformation-grid">{transformations.map((item) => <article className="transform-card panel" key={item.from}><Wand2 aria-hidden="true" /><p className="from">{item.from}</p><p className="arrow">→</p><h3>{item.to}</h3><p>{item.example}</p></article>)}</div></section>
      )}

      {activeTab === 'Roadmap' && (
        <section className="section-block two-column fade-in"><div className="panel"><p className="eyebrow">Feature pillars</p><div className="pillar-list">{pillars.map(([title, body]) => <div className="pillar" key={title}><Sparkles aria-hidden="true" /><div><h3>{title}</h3><p>{body}</p></div></div>)}</div></div><div className="panel roadmap-panel"><p className="eyebrow">Roadmap</p><div className="roadmap-list">{roadmap.map(([version, title, body]) => <article className="roadmap-item" key={version}><span>{version}</span><div><h3>{title}</h3><p>{body}</p></div></article>)}</div></div></section>
      )}

      </div>
      <DataSovereigntyStatusBar refreshKey={recentFiles} />
      <footer className="suite-footer">
        <span>PHI369 Labs · People Above Profit</span>
        <a href="https://github.com/MichaelWave369/phioffice369" target="_blank" rel="noreferrer">Source</a>
        <a href="https://github.com/MichaelWave369/phioffice369/tree/main/docs" target="_blank" rel="noreferrer">Documentation</a>
      </footer>
    </main>
  );
}
