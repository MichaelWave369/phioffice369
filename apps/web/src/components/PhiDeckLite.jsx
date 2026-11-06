import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ClipboardCopy, Copy, Download, Layers3, Plus, RotateCcw, ShieldCheck, Sparkles, Trash2, Upload } from 'lucide-react';
import { createArtifactReceipt, trustLabels } from '@phioffice369/core';
import { parsePhiDeckJsonImport } from '../lib/localImporters.js';
import { recordLocalExport } from '../lib/localReceipts.js';
import { getTransformIds } from '../lib/transformRegistry.js';
import { readWorkspaceRecord, workspaceTitle } from '../lib/workspaceRecords.js';
import { useWorkspaceDraft } from '../lib/useWorkspaceDraft.js';
import WorkspaceSaveActions from './WorkspaceSaveActions.jsx';
import './PhiDeckLite.css';

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'phioffice369-deck';
}

function createPhiDeckStorageKey(templateId) {
  return `phioffice369:phideck:${templateId}`;
}

function makeStarterSlides(template) {
  return template.sections.map((section, index) => ({
    id: `slide-${index + 1}`,
    title: section,
    bullets: [
      `Describe ${section.toLowerCase()} clearly.`,
      'Keep claims labeled and grounded.',
    ],
  }));
}

function downloadTextFile(filename, body, type) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function bulletTextToArray(value) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function resolveInitialDeck(template, initialDeck, savedDeck) {
  if (initialDeck?.slides?.length) {
    return {
      title: initialDeck.title ?? template.title,
      slides: initialDeck.slides,
      activeLabelId: initialDeck.trustDefaults?.[0] ?? template.trustDefaults[0] ?? 'ai_assisted',
      status: `Opened from ${initialDeck.sourceTemplateTitle ?? 'PhiWrite'} bridge`,
    };
  }

  if (savedDeck?.slides?.length) {
    return {
      title: savedDeck.title ?? template.title,
      slides: savedDeck.slides,
      activeLabelId: savedDeck.activeLabelId ?? template.trustDefaults[0] ?? 'ai_assisted',
      status: 'Restored local deck',
    };
  }

  return {
    title: template.title,
    slides: makeStarterSlides(template),
    activeLabelId: template.trustDefaults[0] ?? 'ai_assisted',
    status: 'New local deck',
  };
}

export default function PhiDeckLite({ template, onBack, initialDeck = null }) {
  const importInputRef = useRef(null);
  const storageKey = createPhiDeckStorageKey(template.id);
  const [loaded] = useState(() => readWorkspaceRecord(storageKey));
  const savedDeck = loaded.record;
  const [initialState] = useState(() => resolveInitialDeck(template, initialDeck, savedDeck));
  const [title, setTitle] = useState(initialState.title);
  const [slides, setSlides] = useState(initialState.slides);
  const [activeSlideId, setActiveSlideId] = useState(initialState.slides[0]?.id ?? 'slide-1');
  const [activeLabelId, setActiveLabelId] = useState(initialState.activeLabelId);
  const [copyStatus, setCopyStatus] = useState('');

  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0];
  const activeLabel = trustLabels.find((label) => label.id === activeLabelId) ?? trustLabels[0];
  const transformTrace = initialDeck?.trace ?? savedDeck?.transformTrace ?? null;
  const transformId = initialDeck?.transformId ?? savedDeck?.transformId ?? 'template_to_phideck_lite_deck';

  const receipt = useMemo(() => createArtifactReceipt({
    artifactId: `deck_${template.id}`,
    title: workspaceTitle(title, 'PhiDeck'),
    app: 'PhiDeck',
    labels: Array.from(new Set([...template.trustDefaults, activeLabelId])),
    transformations: getTransformIds([transformId]),
  }), [activeLabelId, template, title, transformId]);

  const draftSnapshot = useMemo(() => ({
    ...savedDeck, templateId: template.id, sourceTemplateId: template.sourceTemplateId ?? template.id,
    title: workspaceTitle(title, 'PhiDeck'), slides, activeLabelId, transformId, transformTrace,
  }), [savedDeck, template, title, slides, transformId, transformTrace, activeLabelId]);
  const { saveStatus, setSaveStatus, saveFailed, save } = useWorkspaceDraft(storageKey, draftSnapshot, loaded);

  function backToPhiOffice() {
    if (save()) onBack();
  }

  function updateActiveSlideTitle(value) {
    setSlides((currentSlides) => currentSlides.map((slide) => (slide.id === activeSlide.id ? { ...slide, title: value } : slide)));
  }

  function updateActiveSlideBullets(value) {
    setSlides((currentSlides) => currentSlides.map((slide) => (slide.id === activeSlide.id ? { ...slide, bullets: bulletTextToArray(value) } : slide)));
  }

  function addSlide() {
    const nextSlide = {
      id: `slide-${Date.now()}`,
      title: 'New Slide',
      bullets: ['Add your key point here.'],
    };
    setSlides((currentSlides) => [...currentSlides, nextSlide]);
    setActiveSlideId(nextSlide.id);
  }

  function duplicateSlide() {
    if (!activeSlide) return;
    const copySlide = {
      ...activeSlide,
      id: `slide-${Date.now()}`,
      title: `${activeSlide.title} Copy`,
    };
    setSlides((currentSlides) => [...currentSlides, copySlide]);
    setActiveSlideId(copySlide.id);
  }

  function removeSlide() {
    if (slides.length <= 1 || !activeSlide) return;
    const nextSlides = slides.filter((slide) => slide.id !== activeSlide.id);
    setSlides(nextSlides);
    setActiveSlideId(nextSlides[0].id);
  }

  function resetDeck() {
    if (!window.confirm('Reset this file to its starter template? This replaces the current content.')) return;
    const nextStarterSlides = makeStarterSlides(template);
    setTitle(template.title);
    setSlides(nextStarterSlides);
    setActiveSlideId(nextStarterSlides[0]?.id ?? 'slide-1');
    setActiveLabelId(template.trustDefaults[0] ?? 'ai_assisted');
    setSaveStatus('Reset to template');
  }

  function exportDeckJson() {
    const filename = `${slugify(title)}-phideck-lite.json`;
    const payload = {
      schema: 'phioffice369.phideck_lite.v0.1',
      title,
      sourceTemplate: template.id,
      generatedAt: new Date().toISOString(),
      transformId,
      transformTrace,
      slides,
      receipt,
    };
    downloadTextFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    setSaveStatus(recordLocalExport('Deck JSON exported', { artifactId: `deck_${template.id}`, format: 'json', filename, sourceApp: 'PhiDeck' }));
  }

  function triggerDeckImport() {
    importInputRef.current?.click();
  }

  async function handleImportDeckJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = parsePhiDeckJsonImport(text, file.name.replace(/\.json$/i, ''));
      if (!imported.ok) {
        setSaveStatus(imported.reason);
        return;
      }
      setTitle(imported.title);
      setSlides(imported.slides);
      setActiveSlideId(imported.slides[0]?.id ?? 'slide-1');
      setActiveLabelId('ai_assisted');
      setSaveStatus('PhiDeck JSON imported locally');
    } catch {
      setSaveStatus('Could not import PhiDeck JSON');
    } finally {
      event.target.value = '';
    }
  }

  async function copyReceipt() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
      setCopyStatus('Receipt copied');
    } catch {
      setCopyStatus('Copy unavailable in this browser');
    }
  }

  return (
    <section className="phideck-workspace fade-in">
      <div className="deck-topbar panel">
        <button className="deck-ghost-button" type="button" onClick={backToPhiOffice}><ArrowLeft aria-hidden="true" /> Back to PhiOffice</button>
        <div>
          <p className="eyebrow">PhiDeck-lite</p>
          <h2>{template.title}</h2>
          <p className="deck-save-status" role="status">{saveStatus}</p>
        </div>
        <div className="deck-actions">
          <WorkspaceSaveActions save={save} saveFailed={saveFailed} onBack={onBack} />
          <button type="button" onClick={resetDeck}><RotateCcw aria-hidden="true" /> Reset</button>
          <button type="button" onClick={triggerDeckImport}><Upload aria-hidden="true" /> Import JSON</button>
          <button type="button" onClick={exportDeckJson}><Download aria-hidden="true" /> Export JSON</button>
          <input ref={importInputRef} className="deck-file-input" type="file" accept=".json,application/json" onChange={handleImportDeckJson} />
        </div>
      </div>

      <div className="deck-workspace-layout">
        <aside className="panel deck-side-panel">
          <Layers3 aria-hidden="true" />
          <h3>Slides</h3>
          <div className="deck-slide-list">
            {slides.map((slide, index) => (
              <button key={slide.id} type="button" className={activeSlide?.id === slide.id ? 'selected' : ''} onClick={() => setActiveSlideId(slide.id)}>
                <span>Slide {index + 1}</span>
                <strong>{slide.title}</strong>
              </button>
            ))}
          </div>
          <div className="deck-tool-stack">
            <button type="button" onClick={addSlide}><Plus aria-hidden="true" /> Add slide</button>
            <button type="button" onClick={duplicateSlide}><Copy aria-hidden="true" /> Duplicate</button>
            <button type="button" onClick={removeSlide} disabled={slides.length <= 1}><Trash2 aria-hidden="true" /> Remove</button>
          </div>
        </aside>

        <section className="panel deck-editor-panel">
          <label className="deck-title-field">
            <span>Deck title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>

          {activeSlide && (
            <div className="deck-slide-editor">
              <label>
                <span>Slide title</span>
                <input value={activeSlide.title} onChange={(event) => updateActiveSlideTitle(event.target.value)} />
              </label>
              <label>
                <span>Bullets, one per line</span>
                <textarea value={activeSlide.bullets.join('\n')} onChange={(event) => updateActiveSlideBullets(event.target.value)} />
              </label>
            </div>
          )}

          <div className="deck-preview-grid">
            {slides.map((slide, index) => (
              <article className={`deck-preview-card ${activeSlide?.id === slide.id ? 'selected' : ''}`} key={slide.id} onClick={() => setActiveSlideId(slide.id)}>
                <span>Slide {index + 1}</span>
                <h3>{slide.title}</h3>
                <ul>{slide.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        <aside className="panel deck-trust-panel">
          <ShieldCheck aria-hidden="true" />
          <h3>Trust panel</h3>
          <p>Label this deck before exporting or publishing.</p>
          <div className="deck-labels">
            {trustLabels.map((label) => <button key={label.id} type="button" className={activeLabelId === label.id ? 'selected' : ''} onClick={() => setActiveLabelId(label.id)}>{label.label}</button>)}
          </div>
          <div className={`deck-active-label ${activeLabel.tone}`}><Sparkles aria-hidden="true" /><div><strong>{activeLabel.label}</strong><p>{activeLabel.description}</p></div></div>
          <div className="deck-receipt-mini">
            <h3>Receipt preview</h3>
            <code>{receipt.schema}</code>
            <p>{receipt.app} · {receipt.labels.length} labels · {transformId}</p>
            <button type="button" onClick={copyReceipt}><ClipboardCopy aria-hidden="true" /> Copy receipt JSON</button>
            {copyStatus && <p className="deck-copy-status">{copyStatus}</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}
