import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ClipboardCopy, Copy, Download, Layers3, Plus, RotateCcw, ShieldCheck, Sparkles, Trash2, Upload } from 'lucide-react';
import { createArtifactReceipt, trustLabels } from '@phioffice369/core';
import { deckMediaSize, deckSchemaForSlides, DECK_LAYOUTS, DECK_LIMITS, DECK_SHAPES, readSlideImage } from '../lib/deckSlides.js';
import { buildDeckHtml } from '../lib/deckHtml.js';
import DeckSlide from './DeckSlide.jsx';
import DeckPresentation from './DeckPresentation.jsx';
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
  if (!template.sections.length) return [{ id: 'slide-1', title: '', bullets: [] }];
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

function nextSlideId() {
  return 'slide-' + (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
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

export default function PhiDeckLite({ template, onBack, initialDeck = null, loadedFile }) {
  const importInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const presentButton = useRef(null);
  const latestImport = useRef(0);
  const latestImage = useRef(0);
  const storageKey = createPhiDeckStorageKey(template.id);
  const [loaded] = useState(() => loadedFile ?? readWorkspaceRecord(storageKey));
  const savedDeck = loaded.record;
  const [initialState] = useState(() => resolveInitialDeck(template, initialDeck, savedDeck));
  const [title, setTitle] = useState(initialState.title);
  const [slides, setSlides] = useState(initialState.slides);
  const [activeSlideId, setActiveSlideId] = useState(initialState.slides[0]?.id ?? 'slide-1');
  const [activeLabelId, setActiveLabelId] = useState(initialState.activeLabelId);
  const [copyStatus, setCopyStatus] = useState('');
  const [pendingImport, setPendingImport] = useState(null);
  const [presenting, setPresenting] = useState(false);
  const [lineage, setLineage] = useState(() => ({
    transformTrace: initialDeck?.trace ?? savedDeck?.transformTrace ?? null,
    transformId: initialDeck?.transformId ?? savedDeck?.transformId ?? 'template_to_phideck_lite_deck',
    importedProvenance: savedDeck?.importedProvenance ?? null,
  }));

  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0];
  const activeLabel = trustLabels.find((label) => label.id === activeLabelId) ?? trustLabels[0];
  const { transformId, transformTrace, importedProvenance } = lineage;
  const slideIndex = slides.indexOf(activeSlide);

  const receipt = useMemo(() => createArtifactReceipt({
    artifactId: `deck_${template.id}`,
    title: workspaceTitle(title, 'PhiDeck'),
    app: 'PhiDeck',
    labels: Array.from(new Set([...template.trustDefaults, activeLabelId])),
    transformations: getTransformIds([transformId]),
  }), [activeLabelId, template, title, transformId]);

  const draftSnapshot = useMemo(() => ({
    ...savedDeck, templateId: template.id, sourceTemplateId: template.sourceTemplateId ?? template.id,
    title: workspaceTitle(title, 'PhiDeck'), slides, activeLabelId, ...lineage,
  }), [savedDeck, template, title, slides, lineage, activeLabelId]);
  const { saveStatus, setSaveStatus, saveFailed, save } = useWorkspaceDraft(storageKey, draftSnapshot, loaded);

  async function backToPhiOffice() {
    if (await save()) onBack();
  }

  function changeSlide(id, changes) {
    setSlides((current) => current.map((slide) => slide.id === id ? { ...slide, ...changes } : slide));
  }

  function addSlide() {
    const nextSlide = { id: nextSlideId(), title: 'New Slide', bullets: ['Add your key point here.'] };
    setSlides((current) => [...current, nextSlide]);
    setActiveSlideId(nextSlide.id);
  }

  function duplicateSlide() {
    const copy = { ...activeSlide, id: nextSlideId(), title: activeSlide.title + ' Copy' };
    setSlides((current) => [...current.slice(0, slideIndex + 1), copy, ...current.slice(slideIndex + 1)]);
    setActiveSlideId(copy.id);
  }

  function moveSlide(direction) {
    const to = slideIndex + direction;
    if (to < 0 || to >= slides.length) return;
    const next = [...slides];
    [next[slideIndex], next[to]] = [next[to], next[slideIndex]];
    setSlides(next);
  }

  function removeSlide() {
    if (slides.length <= 1 || !window.confirm(`Remove slide "${activeSlide.title}"?`)) return;
    const next = slides.filter((slide) => slide.id !== activeSlide.id);
    setSlides(next);
    setActiveSlideId(next[Math.min(slideIndex, next.length - 1)].id);
  }

  async function importImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const slideId = activeSlide.id;
    const revision = ++latestImage.current;
    try {
      const image = await readSlideImage(file);
      if (revision !== latestImage.current) return;
      setSlides((current) => {
        const size = deckMediaSize(current.filter((slide) => slide.id !== slideId));
        if (size + image.src.length > DECK_LIMITS.mediaChars) return current;
        return current.map((slide) => slide.id === slideId ? { ...slide, image, layout: slide.layout ?? 'image-right' } : slide);
      });
      if (deckMediaSize(slides.filter((slide) => slide.id !== slideId)) + image.src.length > DECK_LIMITS.mediaChars) {
        setSaveStatus('The deck is at its image storage limit. Remove an image or choose a smaller file.');
      }
    } catch (error) {
      if (revision === latestImage.current) setSaveStatus(error.message || 'Could not decode this local image.');
    }
  }

  function resetDeck() {
    if (!window.confirm('Reset this file to its starter template? This replaces the current content.')) return;
    latestImport.current += 1;
    latestImage.current += 1;
    setPendingImport(null);
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
      schema: deckSchemaForSlides(slides),
      title,
      sourceTemplate: template.id,
      generatedAt: new Date().toISOString(),
      transformId,
      transformTrace,
      importedProvenance,
      slides,
      receipt,
    };
    downloadTextFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    setSaveStatus(recordLocalExport('Deck JSON exported', { artifactId: `deck_${template.id}`, format: 'json', filename, sourceApp: 'PhiDeck' }));
  }

  function exportHtml() {
    const filename = slugify(title) + '-slides.html';
    const html = buildDeckHtml({ title: workspaceTitle(title, 'PhiDeck'), slides, trustLabel: activeLabel.label });
    downloadTextFile(filename, html, 'text/html;charset=utf-8');
    setSaveStatus(recordLocalExport('Standalone slides exported', {
      artifactId: `deck_${template.id}`, format: 'html', filename, sourceApp: 'PhiDeck', compatibility: 'view-only',
    }));
  }

  async function handleImportDeckJson(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const revision = ++latestImport.current;
    setPendingImport(null);
    try {
      if (file.size > DECK_LIMITS.fileBytes) throw new Error('Choose a PhiDeck JSON file smaller than 4 MiB.');
      const text = await file.text();
      if (revision !== latestImport.current) return;
      const imported = parsePhiDeckJsonImport(text, file.name.replace(/\.json$/i, ''));
      if (imported.ok) setPendingImport(imported);
      setSaveStatus(imported.ok ? 'Deck preview ready. Current deck unchanged.' : imported.reason);
    } catch (error) {
      if (revision === latestImport.current) setSaveStatus(error.message || 'Could not import PhiDeck JSON.');
    }
  }

  function acceptImport() {
    if (!pendingImport) return;
    latestImage.current += 1;
    setTitle(pendingImport.title);
    setSlides(pendingImport.slides);
    setActiveSlideId(pendingImport.slides[0].id);
    setActiveLabelId('needs_citation');
    setLineage({ transformId: 'template_to_phideck_lite_deck', transformTrace: null, importedProvenance: pendingImport.provenance });
    setPendingImport(null);
    setSaveStatus('Deck imported locally.');
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
          <button type="button" onClick={() => importInputRef.current?.click()}><Upload aria-hidden="true" /> Import JSON</button>
          <button type="button" onClick={exportDeckJson}><Download aria-hidden="true" /> Export JSON</button>
          <button type="button" onClick={exportHtml}><Download aria-hidden="true" /> Export slides HTML</button>
          <button ref={presentButton} type="button" onClick={() => setPresenting(true)}>Present</button>
          <input ref={importInputRef} className="deck-file-input" type="file" accept=".json,application/json" onChange={handleImportDeckJson} />
        </div>
      </div>

      {pendingImport && (
        <section className="panel deck-import-review" aria-label="Deck import review">
          <h3>Review before replacing this deck</h3>
          <p>{pendingImport.title} · {pendingImport.slides.length} slides. The current deck remains available until you confirm.</p>
          <button type="button" onClick={() => { setPendingImport(null); setSaveStatus('Deck import cancelled.'); }}>Cancel import</button>
          <button type="button" onClick={acceptImport}>Replace deck with JSON</button>
        </section>
      )}
      {presenting && <DeckPresentation slides={slides} start={slideIndex}
        onClose={() => { setPresenting(false); requestAnimationFrame(() => presentButton.current?.focus()); }} />}
      <div className="deck-workspace-layout">
        <aside className="panel deck-side-panel">
          <Layers3 aria-hidden="true" />
          <h3>Slides</h3>
          <div className="deck-slide-list">
            {slides.map((slide, index) => (
              <button key={slide.id} type="button" className={activeSlide?.id === slide.id ? 'selected' : ''} aria-current={activeSlide.id === slide.id ? 'true' : undefined} onClick={() => setActiveSlideId(slide.id)}>
                <span>Slide {index + 1}</span>
                <strong>{slide.title}</strong>
              </button>
            ))}
          </div>
          <div className="deck-tool-stack">
            <button type="button" onClick={addSlide} disabled={slides.length >= DECK_LIMITS.slides}><Plus aria-hidden="true" /> Add slide</button>
            <button type="button" onClick={duplicateSlide} disabled={slides.length >= DECK_LIMITS.slides || deckMediaSize(slides) + (activeSlide.image?.src.length ?? 0) > DECK_LIMITS.mediaChars}><Copy aria-hidden="true" /> Duplicate</button>
            <button type="button" disabled={slideIndex <= 0} onClick={() => moveSlide(-1)}>Move earlier</button>
            <button type="button" disabled={slideIndex >= slides.length - 1} onClick={() => moveSlide(1)}>Move later</button>
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
                <input value={activeSlide.title} onChange={(event) => changeSlide(activeSlide.id, { title: event.target.value })} />
              </label>
              <label>
                <span>Bullets, one per line</span>
                <textarea value={activeSlide.bullets.join('\n')} onChange={(event) => changeSlide(activeSlide.id, { bullets: event.target.value.split('\n') })} />
              </label>
            </div>
          )}

          <div className="deck-visual-tools">
            <label>Slide layout<select value={activeSlide.layout ?? 'content'}
              onChange={(event) => changeSlide(activeSlide.id, { layout: event.target.value })}>
              {Object.entries(DECK_LAYOUTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select></label>
            <label>Accent shape<select value={activeSlide.shape ?? 'none'}
              onChange={(event) => changeSlide(activeSlide.id, { shape: event.target.value })}>
              {Object.entries(DECK_SHAPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select></label>
            <button type="button" onClick={() => imageInputRef.current?.click()}>{activeSlide.image ? 'Replace image' : 'Add image'}</button>
            <input ref={imageInputRef} className="deck-image-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={importImage} />
            {activeSlide.image && <>
              <label>Image description<input maxLength={240} value={activeSlide.image.alt}
                onChange={(event) => changeSlide(activeSlide.id, { image: { ...activeSlide.image, alt: event.target.value } })} /></label>
              <button type="button" onClick={() => changeSlide(activeSlide.id, { image: null })}>Remove image</button>
            </>}
          </div>
          <p className="deck-format-note">PhiDeck JSON keeps editable slides. HTML gives you a portable, read-only slideshow. Local images are limited to 384 KiB each. PowerPoint import and export are planned.</p>
          <DeckSlide slide={activeSlide} index={slideIndex} />
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
