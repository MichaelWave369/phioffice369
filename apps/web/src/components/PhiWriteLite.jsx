import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  ClipboardCopy,
  Download,
  FileText,
  Layers3,
  ListChecks,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import { createArtifactReceipt, trustLabels } from '@phioffice369/core';
import { parseMarkdownImport } from '../lib/localImporters.js';
import { saveLocalExportReceipt } from '../lib/localReceipts.js';
import './PhiWriteLite.css';

function makeStarterContent(template) {
  return template.sections.map((section) => `## ${section}\n\nWrite your ${section.toLowerCase()} here...`).join('\n\n');
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'phioffice369-draft';
}

function canUseLocalStorage() {
  try {
    return typeof window !== 'undefined' && 'localStorage' in window;
  } catch {
    return false;
  }
}

function loadDraft(template) {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(`phioffice369:phiwrite:${template.id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function cleanSentences(value) {
  return value.split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
}

function buildDraftSection(template) {
  return [
    '',
    '## Professor Phi Draft Pass',
    '',
    `This ${template.title.toLowerCase()} is intended to help turn the current idea into a clear, practical artifact.`,
    '',
    '- What matters most here?',
    '- Who does this help?',
    '- What should stay local or private?',
    '- What needs evidence before it becomes public?',
  ].join('\n');
}

function buildLightPolish(value) {
  return value.replace(/Write your ([a-z\s]+) here\.\.\./g, 'Add clear notes for $1 here.').replace(/\n{3,}/g, '\n\n').trim();
}

function buildSummary(value) {
  const sentences = cleanSentences(value.replace(/^#+\s+/gm, ''));
  const summaryLines = sentences.slice(0, 4).map((sentence) => `- ${sentence}`);
  return ['', '## Professor Phi Summary', '', ...(summaryLines.length ? summaryLines : ['- Add more draft content to generate a stronger summary.'])].join('\n');
}

function buildClaimCheck(value) {
  const riskyWords = ['prove', 'guarantee', 'cure', 'always', 'never', 'scientifically', 'evidence', 'best', 'only'];
  const matches = riskyWords.filter((word) => new RegExp(`\\b${word}\\b`, 'i').test(value));
  return [
    '',
    '## Professor Phi Claim-Check Notes',
    '',
    matches.length ? `Potential claim-boundary words found: ${matches.join(', ')}.` : 'No obvious high-risk claim words found in this lightweight local scan.',
    '',
    '- Mark factual claims as Sourced or Needs citation before publishing.',
    '- Mark symbolic, mythic, or interface-layer meaning as Symbolic.',
    '- Keep private/internal details labeled Private until intentionally released.',
  ].join('\n');
}

function createDeckSlides(title, template, value) {
  const sentences = cleanSentences(value.replace(/^#+\s+/gm, ''));
  const seed = sentences.slice(0, 5);
  return [
    { id: 'slide-1', title, bullets: [`Based on the ${template.title} template.`, 'A PhiOffice369 artifact transformed into PhiDeck-lite.'] },
    { id: 'slide-2', title: 'Why it matters', bullets: [seed[0] ?? 'State the core problem or opportunity.'] },
    { id: 'slide-3', title: 'Core idea', bullets: [seed[1] ?? 'Explain the main idea in simple language.'] },
    { id: 'slide-4', title: 'How it works', bullets: [seed[2] ?? 'Show the workflow, system, or process.'] },
    { id: 'slide-5', title: 'Trust and boundaries', bullets: ['Name what is verified, what is AI-assisted, what is symbolic, and what needs citation.', 'Keep private details local until intentionally released.'] },
    { id: 'slide-6', title: 'Next step', bullets: ['Define the first build, test, share, or review action.'] },
  ];
}

function buildDeckOutlineFromSlides(slides) {
  return ['', '## PhiDeck Outline Draft', '', ...slides.flatMap((slide, index) => [`### Slide ${index + 1} — ${slide.title}`, ...slide.bullets.map((bullet) => `- ${bullet}`), ''])].join('\n');
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

export default function PhiWriteLite({ template, onBack, onOpenDeck }) {
  const importInputRef = useRef(null);
  const savedDraft = useMemo(() => loadDraft(template), [template]);
  const [title, setTitle] = useState(savedDraft?.title ?? template.title);
  const [content, setContent] = useState(savedDraft?.content ?? makeStarterContent(template));
  const [activeLabelId, setActiveLabelId] = useState(savedDraft?.activeLabelId ?? template.trustDefaults[0] ?? 'human_written');
  const [saveStatus, setSaveStatus] = useState(savedDraft ? 'Restored local draft' : 'New local draft');
  const [copyStatus, setCopyStatus] = useState('');
  const [assistantStatus, setAssistantStatus] = useState('Local mock assistant ready');
  const [deckSlides, setDeckSlides] = useState([]);

  const activeLabel = trustLabels.find((label) => label.id === activeLabelId) ?? trustLabels[0];
  const receipt = useMemo(() => createArtifactReceipt({
    artifactId: `draft_${template.id}`,
    title,
    app: template.app,
    labels: Array.from(new Set([...template.trustDefaults, activeLabelId])),
    transformations: ['template_to_phiwrite_lite_draft'],
  }), [activeLabelId, template, title]);

  useEffect(() => {
    if (!canUseLocalStorage()) return undefined;
    setSaveStatus('Unsaved changes...');
    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(`phioffice369:phiwrite:${template.id}`, JSON.stringify({ templateId: template.id, title, content, activeLabelId, updatedAt: new Date().toISOString() }));
      setSaveStatus('Autosaved locally');
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [activeLabelId, content, template.id, title]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const sectionCount = template.sections.length;
  const characterCount = content.length;

  function appendAssistantBlock(label, block) {
    setContent((current) => `${current.trim()}\n\n${block.trim()}\n`);
    setAssistantStatus(`${label} added locally`);
  }

  function handleResetDraft() {
    setTitle(template.title);
    setContent(makeStarterContent(template));
    setDeckSlides([]);
    setActiveLabelId(template.trustDefaults[0] ?? 'human_written');
    if (canUseLocalStorage()) window.localStorage.removeItem(`phioffice369:phiwrite:${template.id}`);
    setSaveStatus('Reset to template');
    setAssistantStatus('Local mock assistant ready');
  }

  function buildMarkdownExport() {
    return [`# ${title}`, '', `> Created in PhiOffice369 / PhiWrite-lite from template: ${template.title}`, `> Active trust label: ${activeLabel.label}`, '', content, '', '---', '', '## PhiOffice369 Receipt Preview', '', `- Schema: ${receipt.schema}`, `- App: ${receipt.app}`, `- Labels: ${receipt.labels.join(', ')}`, `- Transformations: ${receipt.transformations.join(', ')}`].join('\n');
  }

  function handleExportMarkdown() {
    const filename = `${slugify(title)}.md`;
    downloadTextFile(filename, buildMarkdownExport(), 'text/markdown;charset=utf-8');
    saveLocalExportReceipt({ artifactId: `draft_${template.id}`, format: 'markdown', filename, sourceApp: 'PhiWrite' });
    setSaveStatus('Markdown exported + receipt saved');
  }

  function handleExportDeckJson() {
    const filename = `${slugify(title)}-phideck-lite.json`;
    const payload = { schema: 'phioffice369.phideck_lite.v0.1', title, sourceTemplate: template.id, generatedAt: new Date().toISOString(), slides: deckSlides };
    downloadTextFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    saveLocalExportReceipt({ artifactId: `deck_${template.id}`, format: 'json', filename, sourceApp: 'PhiDeck' });
    setAssistantStatus('PhiDeck-lite JSON exported + receipt saved');
  }

  function handleOpenDeckWorkspace() {
    const slides = deckSlides.length ? deckSlides : createDeckSlides(title, template, content);
    setDeckSlides(slides);
    if (!onOpenDeck) {
      setAssistantStatus('PhiDeck-lite workspace bridge is unavailable');
      return;
    }
    onOpenDeck({
      title,
      sourceTemplateId: template.id,
      sourceTemplateTitle: template.title,
      trustDefaults: Array.from(new Set([...template.trustDefaults, 'ai_assisted', 'needs_citation'])),
      slides,
    });
  }

  function triggerMarkdownImport() {
    importInputRef.current?.click();
  }

  async function handleImportMarkdown(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = parseMarkdownImport(text, file.name.replace(/\.(md|markdown)$/i, ''));
      setTitle(imported.title);
      setContent(imported.content);
      setDeckSlides([]);
      setActiveLabelId('human_written');
      setSaveStatus('Markdown imported locally');
      setAssistantStatus(imported.importNote);
    } catch {
      setSaveStatus('Could not import Markdown');
    } finally {
      event.target.value = '';
    }
  }

  async function handleCopyReceipt() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
      setCopyStatus('Receipt copied');
    } catch {
      setCopyStatus('Copy unavailable in this browser');
    }
  }

  function handleAssistantAction(action) {
    if (action === 'draft') return appendAssistantBlock('Draft section', buildDraftSection(template));
    if (action === 'polish') {
      setContent((current) => buildLightPolish(current));
      setAssistantStatus('Light polish applied locally');
      return;
    }
    if (action === 'summary') return appendAssistantBlock('Summary', buildSummary(content));
    if (action === 'claim-check') {
      appendAssistantBlock('Claim-check', buildClaimCheck(content));
      setActiveLabelId('needs_citation');
      return;
    }
    if (action === 'deck') {
      const slides = createDeckSlides(title, template, content);
      setDeckSlides(slides);
      appendAssistantBlock('Deck outline', buildDeckOutlineFromSlides(slides));
    }
  }

  return (
    <section className="phiwrite-workspace fade-in">
      <div className="workspace-topbar panel">
        <button className="ghost-button" type="button" onClick={onBack}><ArrowLeft aria-hidden="true" />Back to templates</button>
        <div><p className="eyebrow">PhiWrite-lite</p><h2>{template.title}</h2><p className="save-status">{saveStatus}</p></div>
        <div className="workspace-actions">
          <button className="ghost-button" type="button" onClick={handleResetDraft}><RotateCcw aria-hidden="true" />Reset</button>
          <button className="ghost-button" type="button" onClick={triggerMarkdownImport}><Upload aria-hidden="true" />Import .md</button>
          <button className="gold-button" type="button" onClick={handleExportMarkdown}><Download aria-hidden="true" />Export .md</button>
          <input ref={importInputRef} className="workspace-file-input" type="file" accept=".md,.markdown,text/markdown,text/plain" onChange={handleImportMarkdown} />
        </div>
      </div>

      <div className="workspace-grid">
        <aside className="panel workspace-sidebar">
          <FileText aria-hidden="true" />
          <h3>Template sections</h3>
          <div className="section-stack">{template.sections.map((section) => <span key={section}>{section}</span>)}</div>
          <div className="workspace-stat-grid"><div><strong>{wordCount}</strong><span>words</span></div><div><strong>{sectionCount}</strong><span>sections</span></div><div><strong>{characterCount}</strong><span>characters</span></div><div><strong>{receipt.labels.length}</strong><span>labels</span></div></div>
          <div className="assistant-card"><Bot aria-hidden="true" /><div><h3>Professor Phi</h3><p>This is a local mock assistant for the prototype. No text leaves the browser.</p><p className="assistant-status">{assistantStatus}</p></div></div>
          <div className="assistant-actions"><button type="button" onClick={() => handleAssistantAction('draft')}><Sparkles aria-hidden="true" /> Draft Section</button><button type="button" onClick={() => handleAssistantAction('polish')}><Wand2 aria-hidden="true" /> Light Polish</button><button type="button" onClick={() => handleAssistantAction('summary')}><ListChecks aria-hidden="true" /> Summarize</button><button type="button" onClick={() => handleAssistantAction('claim-check')}><ShieldCheck aria-hidden="true" /> Claim-check</button><button type="button" onClick={() => handleAssistantAction('deck')}><FileText aria-hidden="true" /> Deck Outline</button></div>
        </aside>

        <section className="panel editor-panel"><label className="title-field"><span>Artifact title</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="editor-field"><span>Draft content</span><textarea value={content} onChange={(event) => setContent(event.target.value)} spellCheck="true" /></label></section>

        <aside className="panel trust-dock">
          <ShieldCheck aria-hidden="true" />
          <h3>Trust panel</h3><p>Label the working draft before exporting or publishing.</p>
          <div className="workspace-labels">{trustLabels.map((label) => <button key={label.id} type="button" className={activeLabelId === label.id ? 'selected' : ''} onClick={() => setActiveLabelId(label.id)}>{label.label}</button>)}</div>
          <div className={`active-label-preview ${activeLabel.tone}`}><Sparkles aria-hidden="true" /><div><strong>{activeLabel.label}</strong><p>{activeLabel.description}</p></div></div>
          <div className="receipt-mini"><h3>Receipt preview</h3><code>{receipt.schema}</code><p>{receipt.app} · {receipt.labels.length} labels · local draft</p><button className="copy-receipt-button" type="button" onClick={handleCopyReceipt}><ClipboardCopy aria-hidden="true" />Copy receipt JSON</button>{copyStatus && <p className="copy-status">{copyStatus}</p>}</div>
        </aside>
      </div>

      {deckSlides.length > 0 && (
        <section className="phideck-preview panel fade-in">
          <div className="phideck-heading"><div><p className="eyebrow">PhiDeck-lite preview</p><h2>{title}</h2><p>{deckSlides.length} slide cards generated locally from this PhiWrite draft.</p></div><div className="phideck-actions"><button className="ghost-button" type="button" onClick={handleOpenDeckWorkspace}><Layers3 aria-hidden="true" />Open in PhiDeck-lite</button><button className="gold-button" type="button" onClick={handleExportDeckJson}><Download aria-hidden="true" />Export deck JSON</button></div></div>
          <div className="slide-grid">{deckSlides.map((slide, index) => <article className="slide-card" key={slide.id}><span>Slide {index + 1}</span><h3>{slide.title}</h3><ul>{slide.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul></article>)}</div>
        </section>
      )}
    </section>
  );
}
