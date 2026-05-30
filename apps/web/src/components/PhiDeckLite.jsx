import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ClipboardCopy, Copy, Download, Layers3, Plus, RotateCcw, ShieldCheck, Sparkles, Trash2, Upload } from 'lucide-react';
import { createArtifactReceipt, trustLabels } from '@phioffice369/core';
import { parsePhiDeckJsonImport } from '../lib/localImporters.js';
import { saveLocalExportReceipt } from '../lib/localReceipts.js';
import './PhiDeckLite.css';

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'phioffice369-deck';
}

function canUseLocalStorage() {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
  } catch {
    return false;
  }
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

function loadDeck(template) {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(`phioffice369:phideck:${template.id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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

export default function PhiDeckLite({ template, onBack }) {
  const importInputRef = useRef(null);
  const savedDeck = useMemo(() => loadDeck(template), [template]);
  const starterSlides = useMemo(() => makeStarterSlides(template), [template]);
  const [title, setTitle] = useState(savedDeck?.title ?? template.title);
  const [slides, setSlides] = useState(savedDeck?.slides ?? starterSlides);
  const [activeSlideId, setActiveSlideId] = useState((savedDeck?.slides ?? starterSlides)[0]?.id ?? 'slide-1');
  const [activeLabelId, setActiveLabelId] = useState(savedDeck?.activeLabelId ?? template.trustDefaults[0] ?? 'ai_assisted');
  const [saveStatus, setSaveStatus] = useState(savedDeck ? 'Restored local deck' : 'New local deck');
  const [copyStatus, setCopyStatus] = useState('');

  const activeSlide = slides.find((slide) => slide.id === activeSlideId) ?? slides[0];
  const activeLabel = trustLabels.find((label) => label.id === activeLabelId) ?? trustLabels[0];

  const receipt = useMemo(() => createArtifactReceipt({
    artifactId: `deck_${template.id}`,
    title,
    app: 'PhiDeck',
    labels: Array.from(new Set([...template.trustDefaults, activeLabelId])),
    transformations: ['template_to_phideck_lite_deck'],
  }), [activeLabelId, template, title]);

  useEffect(() => {
    if (!canUseLocalStorage()) return undefined;
    setSaveStatus('Unsaved changes...');
    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(`phioffice369:phideck:${template.id}`, JSON.stringify({
        templateId: template.id,
        title,
        slides,
        activeLabelId,
        updatedAt: new Date().toISOString(),
      }));
      setSaveStatus('Autosaved locally');
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [activeLabelId, slides, template.id, title]);

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
    const nextStarterSlides = makeStarterSlides(template);
    setTitle(template.title);
    setSlides(nextStarterSlides);
    setActiveSlideId(nextStarterSlides[0]?.id ?? 'slide-1');
    setActiveLabelId(template.trustDefaults[0] ?? 'ai_assisted');
    if (canUseLocalStorage()) window.localStorage.removeItem(`phioffice369:phideck:${template.id}`);
    setSaveStatus('Reset to template');
  }

  function exportDeckJson() {
    const filename = `${slugify(title)}-phideck-lite.json`;
    const payload = {
      schema: 'phioffice369.phideck_lite.v0.1',
      title,
      sourceTemplate: template.id,
      generatedAt: new Date().toISOString(),
      slides,
      receipt,
    };
    downloadTextFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    saveLocalExportReceipt({ artifactId: `deck_${template.id}`, format: 'json', filename, sourceApp: 'PhiDeck' });
    setSaveStatus('Deck JSON exported + receipt saved');
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
        <button className="deck-ghost-button" type="button" onClick={onBack}><ArrowLeft aria-hidden="true" /> Back to templates</button>
        <div>
          <p className="eyebrow">PhiDeck-lite</p>
          <h2>{template.title}</h2>
          <p className="deck-save-status">{saveStatus}</p>
        </div>
        <div className="deck-actions">
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
            <p>{receipt.app} · {receipt.labels.length} labels · local deck</p>
            <button type="button" onClick={copyReceipt}><ClipboardCopy aria-hidden="true" /> Copy receipt JSON</button>
            {copyStatus && <p className="deck-copy-status">{copyStatus}</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}
